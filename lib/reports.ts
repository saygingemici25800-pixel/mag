/**
 * Panel raporları — geçmiş sipariş verisi.
 *
 * TOPLAMA VERİTABANINDA: Supabase yolunda `panel_report` SQL fonksiyonu
 * (0011_reports.sql) satırları Postgres'te toplar, tarayıcıya yalnızca özet gider.
 * Stub yolunda (testler, Supabase'siz ortam) aynı sonucu üreten JS eşleniği var —
 * ikisi tek testle doğrulanıyor ki SQL ile JS zamanla birbirinden sapmasın.
 *
 * SAAT DİLİMİ: gün ve saat kırılımı her iki yolda da Europe/Istanbul'a göre.
 * UTC'ye göre gruplansaydı gece 00:10'daki sipariş bir önceki güne yazılırdı.
 *
 * İPTAL: ciroya girmez (status='cancelled' elenir), ayrı sayılır.
 */
import { TZ } from "@/lib/hours";
import type { Order } from "@/lib/orders";

export interface ReportSummary {
  orders: number;
  revenue: number;
  delivery: number;
  pickup: number;
  cancelled: number;
  /** iptaller dahil aralıktaki tüm kayıt sayısı (iptal oranı bunun üzerinden) */
  total_all: number;
}
export interface DailyRow {
  date: string;
  orders: number;
  revenue: number;
}
export interface HourlyRow {
  hour: number;
  orders: number;
  revenue: number;
}
export interface ItemRow {
  id: string;
  name: string;
  qty: number;
  revenue: number;
}
export interface ZoneRow {
  zone: string;
  orders: number;
  revenue: number;
}
export interface Report {
  from: string;
  to: string;
  summary: ReportSummary;
  daily: DailyRow[];
  hourly: HourlyRow[];
  items: ItemRow[];
  zones: ZoneRow[];
}

export interface ReportStore {
  report(from: string, to: string): Promise<Report>;
  /** CSV için ham satırlar (aralıkla sınırlı, en yeni önce) */
  rows(from: string, to: string): Promise<Order[]>;
}

/* ---- Ortak yardımcılar ---- */

/** "YYYY-MM-DD" — İstanbul takvimine göre. en-CA biçimi zaten ISO sırasında. */
export function istanbulGun(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
/** 0–23, İstanbul saatiyle. */
export function istanbulSaat(iso: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(iso)));
}

/** "YYYY-MM-DD" biçim denetimi — API'ye gelen tarih doğrudan SQL'e gitmeden önce. */
export function gecerliTarih(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));
}

/** Aralıktaki günleri sırayla üret (boş günler de görünsün diye). */
export function gunAraligi(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T12:00:00Z"); // öğlen: DST kaymalarında gün atlamasın
  const son = new Date(to + "T12:00:00Z");
  while (d <= son && out.length < 400) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Stub/JS toplama — SQL fonksiyonunun birebir eşleniği.
 * Supabase yokken (testler, yerel geliştirme) bu çalışır.
 */
export function hesapla(all: Order[], from: string, to: string): Report {
  /* Aralık İstanbul gününe göre: her iki uç DAHİL. */
  const kapsam = all.filter((o) => {
    const g = istanbulGun(o.created_at);
    return g >= from && g <= to;
  });
  const gecerli = kapsam.filter((o) => o.status !== "cancelled" && o.payment_status === "paid");

  const summary: ReportSummary = {
    orders: gecerli.length,
    revenue: gecerli.reduce((s, o) => s + o.total, 0),
    delivery: gecerli.filter((o) => o.type === "delivery").length,
    pickup: gecerli.filter((o) => o.type === "pickup").length,
    cancelled: kapsam.filter((o) => o.status === "cancelled").length,
    total_all: kapsam.length,
  };

  const gunM = new Map<string, DailyRow>();
  const saatM = new Map<number, HourlyRow>();
  const urunM = new Map<string, ItemRow>();
  const zonM = new Map<string, ZoneRow>();

  for (const o of gecerli) {
    const g = istanbulGun(o.created_at);
    const gr = gunM.get(g) ?? { date: g, orders: 0, revenue: 0 };
    gr.orders++;
    gr.revenue += o.total;
    gunM.set(g, gr);

    const h = istanbulSaat(o.created_at);
    const hr = saatM.get(h) ?? { hour: h, orders: 0, revenue: 0 };
    hr.orders++;
    hr.revenue += o.total;
    saatM.set(h, hr);

    for (const it of o.items) {
      const ur = urunM.get(it.id) ?? { id: it.id, name: it.name, qty: 0, revenue: 0 };
      ur.qty += it.qty;
      /* Sipariş anındaki fiyat (OrderItem.price) — sonraki zam eski raporu bozmaz. */
      ur.revenue += (it.price ?? 0) * it.qty;
      urunM.set(it.id, ur);
    }

    if (o.type === "delivery") {
      const z = o.zone ?? "-";
      const zr = zonM.get(z) ?? { zone: z, orders: 0, revenue: 0 };
      zr.orders++;
      zr.revenue += o.total;
      zonM.set(z, zr);
    }
  }

  return {
    from,
    to,
    summary,
    daily: [...gunM.values()].sort((a, b) => a.date.localeCompare(b.date)),
    hourly: [...saatM.values()].sort((a, b) => a.hour - b.hour),
    /* SQL ile AYNI sıralama: adet ↓, eşitlikte ciro ↓ */
    items: [...urunM.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 10),
    zones: [...zonM.values()].sort((a, b) => b.orders - a.orders),
  };
}

/* ---- CSV ---- */

/** Bir hücreyi CSV'ye güvenli yaz: tırnak/virgül/yeni satır kaçışlanır. */
function hucre(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const DURUM: Record<string, string> = {
  received: "alındı",
  preparing: "hazırlanıyor",
  ready: "hazır",
  on_the_way: "yolda",
  delivered: "teslim edildi",
  cancelled: "iptal",
};

/**
 * Sipariş listesi → CSV. Muhasebe için: tarih/saat, sipariş no, müşteri, telefon,
 * teslimat türü, mahalle, ürünler, tutar, durum.
 *
 * AYIRICI NOKTALI VİRGÜL: Türkçe Excel'de ondalık ayırıcı virgül olduğu için
 * virgüllü CSV tek sütuna düşüyor. `sep=;` satırı Excel'e ayırıcıyı söyler.
 * UTF-8 BOM: BOM'suz dosyada Excel Türkçe karakterleri bozuyor (Ş, ğ, ı).
 */
export function csv(rows: Order[], zoneAdi: (id: string | null | undefined) => string): string {
  const bas = ["tarih/saat", "sipariş no", "müşteri", "telefon", "teslimat türü", "mahalle", "ürünler", "tutar (₺)", "durum"];
  const satirlar = rows.map((o) => {
    const tarih = new Intl.DateTimeFormat("tr-TR", {
      timeZone: TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(o.created_at));
    const urunler = o.items.map((it) => `${it.qty}× ${it.name}`).join(" + ");
    /* Telefon Excel FORMÜLÜ olarak yazılır: ="05001112233".
       Düz yazılsaydı Excel sayıya çevirip baştaki 0'ı silerdi (5001112233).
       hucre()'den GEÇİRİLMEZ — kaçışlama formülün tırnaklarını bozar. */
    const telefon = `="${o.phone.replace(/"/g, "")}"`;
    return [
      hucre(tarih),
      hucre(o.id.slice(0, 8)),
      hucre(o.name),
      telefon,
      hucre(o.type === "delivery" ? "kurye" : "gel-al"),
      hucre(o.type === "delivery" ? zoneAdi(o.zone) : "-"),
      hucre(urunler),
      hucre(String(o.total)),
      hucre(DURUM[o.status] ?? o.status),
    ].join(";");
  });
  /* ﻿ = UTF-8 BOM (Excel Türkçe karakterleri doğru okusun) */
  return "﻿" + "sep=;\n" + bas.map(hucre).join(";") + "\n" + satirlar.join("\n") + (satirlar.length ? "\n" : "");
}
