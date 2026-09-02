/**
 * Sipariş modeli + sunucu tarafı doğrulama. Fiyatlar her zaman lib/menu.ts'ten hesaplanır (istemciye güvenilmez).
 * Depo: lib/orders-store.ts (şimdilik dosya/bellek; Faz 3'te Supabase — arayüz aynı).
 */
import { MENU, type MenuItem } from "@/lib/menu";
import { getZone } from "@/lib/zones";
import { isOpen, timeSlots } from "@/lib/hours";

export type OrderType = "pickup" | "delivery";
export type Payment = "cod" | "card_on_delivery" | "online";
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
  status: OrderStatus;
  cancel_reason?: string | null;
}

export interface NewOrderInput {
  type: OrderType;
  zone?: string | null;
  items: { id: string; qty: number; note?: string }[];
  name: string;
  phone: string;
  address?: string | null;
  requested_at: string;
  note?: string | null;
  payment: Payment;
}

export interface OrderStore {
  create(order: Order): Promise<Order>;
  get(id: string): Promise<Order | null>;
  /** en yeni önce; `limit` varsayılan 200 */
  list(limit?: number): Promise<Order[]>;
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

export function computeTotals(items: { id: string; qty: number }[], type: OrderType, zoneId?: string | null): Totals {
  const subtotal = items.reduce((s, it) => {
    const m = findMenuItem(it.id);
    return s + (m ? m.price * Math.max(0, Math.floor(it.qty)) : 0);
  }, 0);
  const zone = type === "delivery" ? getZone(zoneId) : undefined;
  const fee = zone?.fee ?? 0;
  const minCart = zone?.minCart ?? 0;
  return { subtotal, fee, total: subtotal + fee, minCart, missing: Math.max(0, minCart - subtotal) };
}

export type ValidationError = { field: string; code: string };

export function validateOrder(input: NewOrderInput, now: Date = new Date()): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!isOpen(now)) errs.push({ field: "hours", code: "closed" });
  if (input.type !== "pickup" && input.type !== "delivery") errs.push({ field: "type", code: "invalid" });
  if (!Array.isArray(input.items) || input.items.length === 0) errs.push({ field: "items", code: "empty" });
  else
    for (const it of input.items) {
      if (!findMenuItem(it.id)) errs.push({ field: "items", code: "unknown:" + it.id });
      if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 50) errs.push({ field: "items", code: "qty:" + it.id });
    }
  if (!input.name || input.name.trim().length < 2) errs.push({ field: "name", code: "required" });
  if (!normalizePhone(input.phone ?? "")) errs.push({ field: "phone", code: "invalid" });
  if (input.type === "delivery") {
    if (!getZone(input.zone)) errs.push({ field: "zone", code: "required" });
    if (!input.address || input.address.trim().length < 8) errs.push({ field: "address", code: "required" });
    const t = computeTotals(input.items ?? [], "delivery", input.zone);
    if (t.missing > 0) errs.push({ field: "items", code: "min-cart" });
  }
  if (!["cod", "card_on_delivery"].includes(input.payment)) errs.push({ field: "payment", code: "invalid" }); // online: Faz 5
  if (typeof input.note === "string" && input.note.length > 300) errs.push({ field: "note", code: "too-long" });
  const slots = timeSlots(now);
  if (!slots.includes(input.requested_at)) errs.push({ field: "requested_at", code: "invalid" });
  return errs;
}

export function newOrderId(): string {
  return crypto.randomUUID(); // Supabase `orders.id uuid` ile aynı
}

export function buildOrder(input: NewOrderInput, now: Date = new Date()): Order {
  const items: OrderItem[] = input.items.map((it) => {
    const m = findMenuItem(it.id)!;
    return { id: m.id, name: m.name, price: m.price, qty: it.qty, ...(it.note?.trim() ? { note: it.note.trim() } : {}) };
  });
  const t = computeTotals(items, input.type, input.zone);
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
    payment: input.payment,
    status: "received",
    cancel_reason: null,
  };
}
