/**
 * WhatsApp sipariş kanalı — GEÇİCİ akış.
 *
 * Müşteri ödeme sayfasına gitmez; sipariş Supabase'e yazılır ve wa.me bağlantısı
 * hazır mesajla açılır. Panel/Supabase akışı DURUYOR, ileride geri açılacak.
 *
 * Mesajı SUNUCU üretir: tutarlar sunucunun hesapladığı değerlerdir, tarayıcıda
 * yeniden hesaplanmaz. Böylece mevcut tutar doğrulaması (amount-mismatch)
 * anlamını korur — istemci mesajı değiştirse bile kayıttaki tutar sunucununki.
 */
import type { Order } from "@/lib/orders";
import { findZone, type Zone } from "@/lib/zones";

/** İşletmenin WhatsApp numarası (uluslararası, + ve boşluk yok). */
export const WHATSAPP_NUMBER = "905367086584";

/* Karışabilen harf/rakam YOK: 0/O, 1/I/L kullanılmıyor — numara telefonda
   okunup panelde aranacak, yanlış okunması pahalıya patlar. */
const KOD_ALFABE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const KOD_UZUNLUK = 6;

/** 6 karakterlik okunur sipariş numarası (ör. "K7M2QX"). */
export function newOrderCode(): string {
  let s = "";
  for (let i = 0; i < KOD_UZUNLUK; i++) s += KOD_ALFABE[Math.floor(Math.random() * KOD_ALFABE.length)];
  return s;
}

/** "620 TL" — mesajda kuruş yok, tutarlar tam sayı. */
function tl(n: number): string {
  return `${n} TL`;
}

/**
 * Sipariş → WhatsApp mesaj gövdesi (düz metin, satır sonları "\n").
 *
 * Kurallar (kullanıcı şartnamesi):
 *  - Gel-al ise mahalle / adres / teslimat ücreti satırları HİÇ yazılmaz.
 *  - Çıkarılan malzeme yoksa o satır yazılmaz.
 *  - Not boşsa NOT bölümü hiç yazılmaz.
 */
export function orderMessage(o: Order, zones?: Zone[] | null): string {
  const L: string[] = [];
  L.push("MAG STREET FOOD — YENİ SİPARİŞ");
  L.push(`Sipariş no: #${o.order_code ?? ""}`);
  L.push("");
  L.push("SİPARİŞ");
  for (const it of o.items) {
    L.push(`${it.qty}× ${it.name} — ${tl(it.price * it.qty)}`);
    if (it.removed?.length) L.push(`   Çıkarılan: ${it.removed.join(", ")}`);
  }
  L.push("");
  L.push(`Ara toplam: ${tl(o.subtotal)}`);
  /* Teslimat ücreti YALNIZCA kuryede. Gel-alda satır hiç yazılmaz. */
  if (o.type === "delivery") L.push(`Teslimat ücreti: ${tl(o.fee)}`);
  L.push(`TOPLAM: ${tl(o.total)}`);
  L.push("");
  L.push("TESLİMAT");
  L.push(`Tür: ${o.type === "delivery" ? "Kurye" : "Gel-al"}`);
  if (o.type === "delivery") {
    const z = findZone(zones, o.zone);
    if (z) L.push(`Mahalle: ${z.name}`);
    if (o.address) L.push(`Adres: ${o.address}`);
  }
  L.push("");
  L.push("MÜŞTERİ");
  L.push(`Ad: ${o.name}`);
  L.push(`Telefon: ${o.phone}`);
  const not = o.note?.trim();
  if (not) {
    L.push("");
    L.push("NOT");
    L.push(not);
  }
  return L.join("\n");
}

/**
 * wa.me bağlantısı. `encodeURIComponent` satır sonunu %0A, Türkçe harfleri
 * UTF-8 yüzde-kodlamasıyla yazar (ç → %C3%A7) — WhatsApp bunları doğru çözer.
 */
export function whatsappUrl(text: string, number: string = WHATSAPP_NUMBER): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
