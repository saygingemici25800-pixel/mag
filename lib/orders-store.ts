/**
 * Yerel STUB depo — dosya tabanlı (.data/*.json), yazılamıyorsa bellek. Değişiklikleri süreç içi
 * olay yayıcısına bildirir (SSE bunu dinler). Seçim lib/store.ts'te (Supabase varsa o).
 * Not: Vercel'de dosya sistemi kalıcı değildir; stub yalnızca yerel geliştirme içindir (stub ile deploy yok).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { emitOrder } from "@/lib/events";
import type { Order, OrderStore, PushStore, PushSubscriptionRow } from "@/lib/orders";

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
    emitOrder({ type: "insert", order });
    return order;
  }
  async get(id: string): Promise<Order | null> {
    return (await this.db.load()).find((o) => o.id === id) ?? null;
  }
  async list(limit = 200): Promise<Order[]> {
    const all = await this.db.load();
    return [...all].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
  }
  async update(id: string, patch: Partial<Order>): Promise<Order | null> {
    const all = await this.db.load();
    const i = all.findIndex((o) => o.id === id);
    if (i < 0) return null;
    all[i] = { ...all[i], ...patch, id };
    await this.db.save();
    emitOrder({ type: "update", order: all[i] });
    return all[i];
  }
}

export class FilePushStore implements PushStore {
  private db = new JsonFile<PushSubscriptionRow>("push.json");
  async add(sub: PushSubscriptionRow): Promise<void> {
    const all = await this.db.load();
    const i = all.findIndex((s) => s.endpoint === sub.endpoint);
    if (i >= 0) all[i] = sub;
    else all.push(sub);
    await this.db.save();
  }
  async list(): Promise<PushSubscriptionRow[]> {
    return [...(await this.db.load())];
  }
  async remove(endpoint: string): Promise<void> {
    const all = await this.db.load();
    const i = all.findIndex((s) => s.endpoint === endpoint);
    if (i >= 0) {
      all.splice(i, 1);
      await this.db.save();
    }
  }
}
