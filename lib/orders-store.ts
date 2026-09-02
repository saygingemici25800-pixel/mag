/**
 * Sipariş deposu — STUB. Dosya tabanlı (.data/orders.json), yazılamıyorsa bellek.
 * Faz 3'te Supabase (`lib/supabase.ts`) aynı `OrderStore` arayüzüyle gelecek.
 * Not: Vercel'de dosya sistemi kalıcı değildir; bu stub yalnızca yerel geliştirme içindir.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Order, OrderStore } from "@/lib/orders";

const FILE = path.join(process.cwd(), ".data", "orders.json");

class FileStore implements OrderStore {
  private cache: Order[] | null = null;
  private fileOk = true;

  private async load(): Promise<Order[]> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await readFile(FILE, "utf8")) as Order[];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }
  private async save(): Promise<void> {
    if (!this.fileOk) return;
    try {
      await mkdir(path.dirname(FILE), { recursive: true });
      await writeFile(FILE, JSON.stringify(this.cache, null, 2));
    } catch {
      this.fileOk = false; // salt okunur FS → bellekte devam
    }
  }
  async create(order: Order): Promise<Order> {
    const all = await this.load();
    all.unshift(order);
    await this.save();
    return order;
  }
  async get(id: string): Promise<Order | null> {
    return (await this.load()).find((o) => o.id === id) ?? null;
  }
  async list(): Promise<Order[]> {
    return [...(await this.load())];
  }
  async update(id: string, patch: Partial<Order>): Promise<Order | null> {
    const all = await this.load();
    const i = all.findIndex((o) => o.id === id);
    if (i < 0) return null;
    all[i] = { ...all[i], ...patch, id };
    await this.save();
    return all[i];
  }
}

// dev'de modül yeniden yüklense de tek örnek
const g = globalThis as unknown as { __magOrderStore?: OrderStore };
export function getOrderStore(): OrderStore {
  if (!g.__magOrderStore) g.__magOrderStore = new FileStore();
  return g.__magOrderStore;
}
