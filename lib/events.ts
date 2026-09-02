/** Süreç içi sipariş olayları (stub yolu). Dosya deposu yazınca yayar; SSE rotası dinler. */
import { EventEmitter } from "node:events";
import type { Order } from "@/lib/orders";

export type OrderEvent = { type: "insert" | "update"; order: Order };

const g = globalThis as unknown as { __magOrderEvents?: EventEmitter };
export function orderEvents(): EventEmitter {
  if (!g.__magOrderEvents) {
    g.__magOrderEvents = new EventEmitter();
    g.__magOrderEvents.setMaxListeners(100);
  }
  return g.__magOrderEvents;
}
export function emitOrder(ev: OrderEvent): void {
  orderEvents().emit("order", ev);
}
