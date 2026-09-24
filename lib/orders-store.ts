/**
 * Yerel STUB depo — dosya tabanlı (.data/*.json), yazılamıyorsa bellek. Değişiklikleri süreç içi
 * olay yayıcısına bildirir (SSE bunu dinler). Seçim lib/store.ts'te (Supabase varsa o).
 * Not: Vercel'de dosya sistemi kalıcı değildir; stub yalnızca yerel geliştirme içindir (stub ile deploy yok).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Order, OrderStore } from "@/lib/orders";
import { hesapla, istanbulGun, type Report, type ReportStore } from "@/lib/reports";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings, type SettingsStore } from "@/lib/settings";

const DIR = path.join(process.cwd(), ".data");

class JsonFile<T> {
  private cache: T[] | null = null;
  private fileOk = true;
  constructor(private file: string) {}
  async load(): Promise<T[]> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await readFile(path.join(DIR, this.file), "utf8")) as T[];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }
  async save(): Promise<void> {
    if (!this.fileOk) return;
    try {
      await mkdir(DIR, { recursive: true });
      await writeFile(path.join(DIR, this.file), JSON.stringify(this.cache, null, 2));
    } catch {
      this.fileOk = false; // salt okunur FS → bellekte devam
    }
  }
}

export class FileOrderStore implements OrderStore {
  private db = new JsonFile<Order>("orders.json");
  async create(order: Order): Promise<Order> {
    const all = await this.db.load();
    all.unshift(order);
    await this.db.save();
    return order;
  }
  async get(id: string): Promise<Order | null> {
    return (await this.db.load()).find((o) => o.id === id) ?? null;
  }
  async list(limit = 200, paidOnly = false, since?: string): Promise<Order[]> {
    const all = await this.db.load();
    const changed = (o: Order) =>
      !since || [o.created_at, o.accepted_at, o.closed_at, o.cancelled_at].some((t) => typeof t === "string" && t >= since);
    return [...all]
      .filter((o) => !paidOnly || o.payment_status === "paid")
      .filter(changed)
      /* created_at EŞİTSE sıralama belirsizdi (testlerde MAG_FAKE_NOW zamanı
         dondurduğu için tüm kayıtlar aynı damgayı alıyor ve yeni sipariş
         listenin sonuna düşebiliyordu). İkincil ölçüt olarak id: sonuç her
         zaman aynı ve yeni kayıt kararlı bir yerde durur. */
      .sort((a, b) => (a.created_at === b.created_at ? (a.id < b.id ? 1 : -1) : a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
  }
  async update(id: string, patch: Partial<Order>): Promise<Order | null> {
    const all = await this.db.load();
    const i = all.findIndex((o) => o.id === id);
    if (i < 0) return null;
    all[i] = { ...all[i], ...patch, id };
    await this.db.save();
    return all[i];
  }
}

/* ---- Ayarlar (sipariş açık/kapalı, tükendi) — dosya stub'ı ---- */
class JsonDoc<T> {
  private cache: T | null = null;
  private fileOk = true;
  constructor(
    private file: string,
    private fallback: T,
  ) {}
  async read(): Promise<T> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await readFile(path.join(DIR, this.file), "utf8")) as T;
    } catch {
      this.cache = this.fallback;
    }
    return this.cache;
  }
  async write(next: T): Promise<T> {
    this.cache = next;
    if (this.fileOk) {
      try {
        await mkdir(DIR, { recursive: true });
        await writeFile(path.join(DIR, this.file), JSON.stringify(next, null, 2));
      } catch {
        this.fileOk = false; // salt okunur FS → bellekte devam
      }
    }
    return next;
  }
}

export class FileSettingsStore implements SettingsStore {
  private doc = new JsonDoc<Settings>("settings.json", DEFAULT_SETTINGS);
  async get(): Promise<Settings> {
    return normalizeSettings(await this.doc.read());
  }
  async patch(p: Partial<Omit<Settings, "updated_at">>): Promise<Settings> {
    const cur = await this.get();
    return this.doc.write(normalizeSettings({ ...cur, ...p, updated_at: new Date().toISOString() }));
  }
}

/* ---- Raporlar — stub yolu ----
   SQL fonksiyonunun (0011_reports.sql) JS eşleniği. Aynı girdi → aynı çıktı
   olmalı; `raporlar` e2e paketi ikisini de aynı beklenen rakamlara karşı
   doğruluyor ki zamanla birbirinden sapmasınlar. */
export class FileReportStore implements ReportStore {
  private db = new JsonFile<Order>("orders.json");
  async report(from: string, to: string): Promise<Report> {
    return hesapla(await this.db.load(), from, to);
  }
  async rows(from: string, to: string): Promise<Order[]> {
    const all = await this.db.load();
    return all
      .filter((o) => {
        const g = istanbulGun(o.created_at);
        return g >= from && g <= to;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}
