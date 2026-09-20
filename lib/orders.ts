/**
 * Sipariş modeli + sunucu tarafı doğrulama. Fiyatlar her zaman lib/menu.ts'ten hesaplanır (istemciye güvenilmez).
 * Depo: lib/orders-store.ts (şimdilik dosya/bellek; Faz 3'te Supabase — arayüz aynı).
 */
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { MENU, priceOf, type MenuItem } from "@/lib/menu";
import { findZone, zoneActive, type Zone } from "@/lib/zones";
import { defaultNow, isOpen, timeSlots, type Schedule } from "@/lib/hours";
import { LEGAL_FIELDS } from "@/lib/legal";

/** Onaylanan yasal metin sürümü — metin güncellenince bu da değişir. */
const LEGAL_VERSION = LEGAL_FIELDS.TARIH ?? "bilinmiyor";

export type OrderType = "pickup" | "delivery";
export type Payment = "online"; // karar 3 Eyl 2026: yalnızca online
export type PaymentStatus = "awaiting_payment" | "paid" | "payment_failed";
/* Sipariş dili = sitenin dili (lib/i18n LOCALES). Ayrı bir birlik yazmıyoruz ki
   yeni dil eklenince burası sessizce geride kalmasın. */
export type OrderLocale = Locale;
export type OrderStatus = "received" | "preparing" | "ready" | "on_the_way" | "delivered" | "cancelled";
export const STATUSES: OrderStatus[] = ["received", "preparing", "ready", "on_the_way", "delivered", "cancelled"];
export const OPEN_STATUSES: OrderStatus[] = ["received", "preparing", "ready", "on_the_way"];

export const STATUS_FLOW: Record<OrderType, OrderStatus[]> = {
  pickup: ["received", "preparing", "ready", "delivered"],
  delivery: ["received", "preparing", "on_the_way", "delivered"],
};

/** Panelde sıradaki adım (delivered/cancelled → null) */
export function nextStatus(o: { type: OrderType; status: OrderStatus }): OrderStatus | null {
  const flow = STATUS_FLOW[o.type];
  const i = flow.indexOf(o.status);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}

/* ---- PANEL: üç aşama (YENİ → HAZIR → KAPANDI, + İPTAL) ----
   Alt durumlar (received/preparing/ready/on_the_way/delivered) veri modelinde kalır; panel bunları
   üç kovaya indirger. "Siparişi al" → hazır (kurye: on_the_way'e değil, ready'ye; kapanışta türüne
   göre delivered). Böylece mevcut şema ve müşteri takip ekranı bozulmaz. */
export type PanelStage = "new" | "ready" | "closed" | "cancelled";

export function panelStage(o: { status: OrderStatus }): PanelStage {
  if (o.status === "cancelled") return "cancelled";
  if (o.status === "delivered") return "closed";
  if (o.status === "received" || o.status === "preparing") return "new";
  return "ready"; // ready | on_the_way
}

/** Aşamayı ilerletirken yazılacak yeni status (kurye/gel-al farkı burada) */
export function stageAdvance(o: { type: OrderType; status: OrderStatus }): OrderStatus | null {
  const st = panelStage(o);
  if (st === "new") return o.type === "delivery" ? "on_the_way" : "ready";
  if (st === "ready") return "delivered";
  return null;
}

/** HAZIR kartındaki butonun anlamı: kurye → "Yola çıktı", gel-al → "Teslim edildi" */
export function closeLabelKey(type: OrderType): "onTheWay" | "delivered" {
  return type === "delivery" ? "onTheWay" : "delivered";
}

/** Kısa görünen sipariş kodu (uuid'in ilk 8 hanesi) */
export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
  /** Müşterinin çıkardığı malzemeler. Fiyatı ETKİLEMEZ; mutfak için taşınır. */
  removed?: string[];
}

export interface Order {
  id: string;
  created_at: string;
  type: OrderType;
  zone: string | null;
  items: OrderItem[];
  subtotal: number;
  fee: number;
  total: number;
  name: string;
  phone: string;
  address: string | null;
  /** "simdi" veya "HH:MM" */
  requested_at: string;
  note: string | null;
  payment: Payment;
  payment_status: PaymentStatus;
  /** sağlayıcı referansı (mock token / iyzico token) */
  payment_ref: string | null;
  locale: OrderLocale;
  status: OrderStatus;
  cancel_reason?: string | null;
  /* --- panel üç aşamalı akış (0003_panel.sql) --- */
  /** "Siparişi al" anında girilen hazırlanma süresi (dakika) */
  prep_minutes?: number | null;
  /** YENİ → HAZIR zamanı */
  accepted_at?: string | null;
  /** HAZIR → KAPANDI zamanı (yola çıktı / teslim edildi) */
  closed_at?: string | null;
  /** iptal zamanı */
  cancelled_at?: string | null;
  /* --- mesafeli satış onayı (0012_terms_consent.sql) --- */
  /** onayın alındığı an — SUNUCU saati (istemciden gelen zamana güvenilmez) */
  terms_accepted_at?: string | null;
  /** onaylanan metin sürümü */
  terms_version?: string | null;
}

export interface NewOrderInput {
  type: OrderType;
  zone?: string | null;
  items: { id: string; qty: number; note?: string; removed?: string[] }[];
  name: string;
  phone: string;
  address?: string | null;
  requested_at: string;
  note?: string | null;
  locale?: OrderLocale;
  /** Ön bilgilendirme + mesafeli satış sözleşmesi onayı. Sunucu ZORUNLU tutar. */
  terms_accepted?: boolean;
}

export interface OrderStore {
  create(order: Order): Promise<Order>;
  get(id: string): Promise<Order | null>;
  /** en yeni önce; `limit` varsayılan 200; `paidOnly` panel için */
  /** @param since ISO zaman damgası — verilirse yalnızca bundan SONRA GÜNCELLENEN kayıtlar
   *  (created_at ya da aşama damgaları). Panel yoklaması bunu kullanır: her turda tüm listeyi değil
   *  yalnızca değişenleri çeker, hiçbir sipariş atlanmaz. */
  list(limit?: number, paidOnly?: boolean, since?: string): Promise<Order[]>;
  update(id: string, patch: Partial<Order>): Promise<Order | null>;
}

export interface PushSubscriptionRow {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
export interface PushStore {
  add(sub: PushSubscriptionRow): Promise<void>;
  list(): Promise<PushSubscriptionRow[]>;
  remove(endpoint: string): Promise<void>;
}

const ALL_ITEMS: MenuItem[] = Object.values(MENU).flat();
export function findMenuItem(id: string): MenuItem | undefined {
  return ALL_ITEMS.find((m) => m.id === id);
}

/** TR telefon: 05XX XXX XX XX · 5XXXXXXXXX · +905XXXXXXXXX → "+905XXXXXXXXX", geçersizse null */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const m = d.match(/^(?:90)?0?(5\d{9})$/);
  return m ? `+90${m[1]}` : null;
}

export interface Totals {
  subtotal: number;
  fee: number;
  total: number;
  minCart: number;
  /** min sepete kalan (₺), 0 ise tamam */
  missing: number;
}

/** Toplamlar. `zones` verilmezse lib/zones.ts varsayılanı kullanılır (findZone) —
    böylece mevcut çağıranlar bozulmaz; panel listesini kullanmak isteyen geçirir. */
export function computeTotals(
  items: { id: string; qty: number }[],
  type: OrderType,
  zoneId?: string | null,
  zones?: Zone[] | null,
  prices?: Record<string, number> | null,
): Totals {
  const subtotal = items.reduce((s, it) => {
    const m = findMenuItem(it.id);
    /* Fiyat priceOf'tan: panelden değiştirilmişse o, değilse koddaki. */
    return s + (m ? priceOf(m, prices) * Math.max(0, Math.floor(it.qty)) : 0);
  }, 0);
  const zone = type === "delivery" ? findZone(zones, zoneId) : undefined;
  const fee = zone?.fee ?? 0;
  const minCart = zone?.minCart ?? 0;
  return { subtotal, fee, total: subtotal + fee, minCart, missing: Math.max(0, minCart - subtotal) };
}

export type ValidationError = { field: string; code: string };

export function validateOrder(input: NewOrderInput, now: Date = defaultNow(), zones?: Zone[] | null, prices?: Record<string, number> | null, sch?: Schedule | null): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!isOpen(now, sch)) errs.push({ field: "hours", code: "closed" });
  if (input.type !== "pickup" && input.type !== "delivery") errs.push({ field: "type", code: "invalid" });
  if (!Array.isArray(input.items) || input.items.length === 0) errs.push({ field: "items", code: "empty" });
  else
    for (const it of input.items) {
      const m = findMenuItem(it.id);
      if (!m) errs.push({ field: "items", code: "unknown:" + it.id });
      if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 50) errs.push({ field: "items", code: "qty:" + it.id });
      /* FİYATI BELİRLENMEMİŞ ürün sipariş edilemez (price 0 = "fiyat bekleniyor",
         ör. 20 Eyl 2026'da eklenen citir-tavuk). Aksi hâlde ürün BEDAVA sepete
         girerdi. Panelden gerçek fiyat girilince (settings.prices) bu kontrol
         kendiliğinden geçer — kod değişikliği gerekmez. */
      if (m && priceOf(m, prices) <= 0) errs.push({ field: "items", code: "no-price:" + it.id });
    }
  /* MESAFELİ SATIŞ ONAYI ZORUNLU. Arayüzde kutu işaretlenmeden buton pasif ama
     buna güvenilmez: istek doğrudan API'ye de gelebilir. Onay bayrağı yoksa
     sipariş oluşturulmaz (Mesafeli Sözleşmeler Yönetmeliği: onay sipariş
     ONAYINDAN ÖNCE alınmış olmalı). */
  if (input.terms_accepted !== true) errs.push({ field: "terms", code: "required" });
  if (!input.name || input.name.trim().length < 2) errs.push({ field: "name", code: "required" });
  if (!normalizePhone(input.phone ?? "")) errs.push({ field: "phone", code: "invalid" });
  if (input.type === "delivery") {
    const z = findZone(zones, input.zone);
    if (!z) errs.push({ field: "zone", code: "required" });
    /* Panelden KAPATILMIŞ bölgeye sipariş kabul edilmez (arayüz de seçtirmiyor,
       ama doğrulama sunucuda da yapılır — istemciye güvenilmez). */
    else if (!zoneActive(z)) errs.push({ field: "zone", code: "closed" });
    if (!input.address || input.address.trim().length < 8) errs.push({ field: "address", code: "required" });
    const t = computeTotals(input.items ?? [], "delivery", input.zone, zones, prices);
    if (t.missing > 0) errs.push({ field: "items", code: "min-cart" });
  }
  if (typeof input.note === "string" && input.note.length > 300) errs.push({ field: "note", code: "too-long" });
  const slots = timeSlots(now, sch);
  if (!slots.includes(input.requested_at)) errs.push({ field: "requested_at", code: "invalid" });
  return errs;
}

export function newOrderId(): string {
  return crypto.randomUUID(); // Supabase `orders.id uuid` ile aynı
}

/** `zones` verilmezse varsayılan liste kullanılır — ücret ve minimum sepet oradan gelir. */
export function buildOrder(input: NewOrderInput, now: Date = defaultNow(), zones?: Zone[] | null, prices?: Record<string, number> | null): Order {
  const items: OrderItem[] = input.items.map((it) => {
    const m = findMenuItem(it.id)!;
    /* removed: yalnızca üründe gerçekten bulunan ve çıkarılabilir olan malzemeler kabul edilir
       (istemciden gelen listeye güvenilmez); fiyat hesabına GİRMEZ. */
    const allowed = new Set((m.ingredients ?? []).filter((g) => g.removable).map((g) => g.name));
    const removed = (it.removed ?? []).filter((r) => allowed.has(r));
    return {
      id: m.id,
      name: m.name,
      /* O ANKİ fiyat satıra YAZILIR. Sonraki fiyat değişikliği bu siparişi
         etkilemez — panel ve müşteri geçmişi hep sipariş anındaki tutarı gösterir. */
      price: priceOf(m, prices),
      qty: it.qty,
      ...(it.note?.trim() ? { note: it.note.trim() } : {}),
      ...(removed.length ? { removed } : {}),
    };
  });
  const t = computeTotals(items, input.type, input.zone, zones, prices);
  return {
    id: newOrderId(),
    created_at: now.toISOString(),
    type: input.type,
    zone: input.type === "delivery" ? (input.zone ?? null) : null,
    items,
    subtotal: t.subtotal,
    fee: t.fee,
    total: t.total,
    name: input.name.trim(),
    phone: normalizePhone(input.phone)!,
    address: input.type === "delivery" ? (input.address?.trim() ?? null) : null,
    requested_at: input.requested_at,
    note: input.note?.trim() || null,
    payment: "online",
    payment_status: "awaiting_payment",
    payment_ref: null,
    /* İstemciden gelen dili LOCALES'e karşı doğrula. Eskiden "en değilse tr" yazıyordu;
       bu, ru siparişini sessizce tr'ye düşürüp ödeme dönüşünü yanlış dile yönlendiriyordu. */
    locale: isLocale(input.locale) ? input.locale : DEFAULT_LOCALE,
    status: "received",
    cancel_reason: null,
    /* ONAY KAYDI — uyuşmazlıkta kanıt. Zaman SUNUCUDAN (`now`), istemciden gelen
       bir damgaya güvenilmez. Buraya gelindiyse validateOrder onayı zaten
       doğrulamış demektir (terms_accepted !== true → 422). */
    terms_accepted_at: now.toISOString(),
    terms_version: LEGAL_VERSION,
  };
}
