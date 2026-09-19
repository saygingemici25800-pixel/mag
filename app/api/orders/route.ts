import { NextResponse } from "next/server";
import { buildOrder, computeTotals, validateOrder, type NewOrderInput } from "@/lib/orders";
import { priceById } from "@/lib/menu";
import { isPanelAuthorized } from "@/lib/panel-auth";
import { getPaymentProvider } from "@/lib/payments";
import { siteUrl } from "@/lib/site";
import { getOrderStore, getSettingsStore } from "@/lib/store";
import { typeOpen } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders — sipariş oluştur (awaiting_payment) + ödeme sağlayıcısında checkout aç.
 * 201 → { id, redirectUrl }. Push ve panel bildirimi ödeme callback'inde (paid) olur.
 */
export async function POST(req: Request) {
  let input: NewOrderInput;
  try {
    input = (await req.json()) as NewOrderInput;
  } catch {
    return NextResponse.json({ errors: [{ field: "body", code: "invalid-json" }] }, { status: 400 });
  }
  /* Panel ayarları önce: dükkân kapalıysa form doğrulamasına hiç girme (kapalı cevabı net olsun) */
  const settings = await getSettingsStore().get();
  if (!settings.ordering_open) return NextResponse.json({ errors: [{ field: "form", code: "ordering-closed" }] }, { status: 409 });
  /* Tür bazlı kapı: kurye ve gel-al bağımsız kapatılabiliyor. Arayüz kapalı türü
     zaten seçtirmiyor ama İSTEMCİYE GÜVENİLMEZ — doğrudan API'ye gönderilen
     kapalı türlü sipariş burada reddedilir. */
  if (input.type === "delivery" || input.type === "pickup") {
    if (!typeOpen(settings, input.type)) {
      return NextResponse.json(
        { errors: [{ field: "type", code: input.type === "delivery" ? "delivery-closed" : "pickup-closed" }] },
        { status: 409 },
      );
    }
  }
  /* Bölgeler PANELDEN gelir: ücret, minimum sepet ve "kapalı mı" bilgisi
     settings.zones'dan okunur. İstemcinin gönderdiği tutara güvenilmez. */
  /* Fiyatlar da PANELDEN: settings.prices. İstemci yalnızca {id, qty} gönderiyor
     (tutar/fiyat göndermiyor); toplam SUNUCUDA bu haritayla hesaplanıyor. */
  const errors = validateOrder(input, undefined, settings.zones, settings.prices);
  if (errors.length) return NextResponse.json({ errors }, { status: 422 });

  /* TUTAR GÜVENLİĞİ — istemci fiyat/tutar göndermez; şema bu alanları taşımıyor.
     Yine de gönderilmişse (manipülasyon denemesi) SESSİZCE YOK SAYMAK yerine
     sunucunun hesabıyla KARŞILAŞTIRIP reddediyoruz: saldırı denemesi loglanır ve
     istemci "kabul edildi" sanmaz. Uyuşuyorsa sipariş normal akar. */
  const claimed = input as unknown as Record<string, unknown>;
  const server = computeTotals(input.items, input.type, input.zone, settings.zones, settings.prices);
  const uyumsuz: string[] = [];
  const say = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : undefined);
  const ct = say(claimed.total), cs = say(claimed.subtotal), cf = say(claimed.fee);
  if (ct !== undefined && ct !== server.total) uyumsuz.push(`total:${ct}≠${server.total}`);
  if (cs !== undefined && cs !== server.subtotal) uyumsuz.push(`subtotal:${cs}≠${server.subtotal}`);
  if (cf !== undefined && cf !== server.fee) uyumsuz.push(`fee:${cf}≠${server.fee}`);
  for (const it of input.items) {
    const p = say((it as unknown as Record<string, unknown>).price);
    if (p === undefined) continue;
    const gercek = priceById(it.id, settings.prices);
    if (p !== gercek) uyumsuz.push(`price(${it.id}):${p}≠${gercek}`);
  }
  if (uyumsuz.length) {
    console.warn("[güvenlik] tutar uyuşmazlığı, sipariş reddedildi:", uyumsuz.join(" "));
    return NextResponse.json({ errors: [{ field: "total", code: "amount-mismatch", detail: uyumsuz }] }, { status: 422 });
  }
  const soldOut = input.items.filter((i) => settings.sold_out.includes(i.id)).map((i) => i.id);
  if (soldOut.length) return NextResponse.json({ errors: soldOut.map((id) => ({ field: "items", code: "sold-out", id })) }, { status: 409 });
  let provider;
  try {
    provider = getPaymentProvider();
  } catch (e) {
    console.error("[payment]", (e as Error).message);
    return NextResponse.json({ errors: [{ field: "payment", code: "provider-unavailable" }] }, { status: 503 });
  }
  const store = getOrderStore();
  const order = await store.create(buildOrder(input, undefined, settings.zones, settings.prices));
  try {
    const { redirectUrl, ref } = await provider.createCheckout(order, { baseUrl: siteUrl() });
    await store.update(order.id, { payment_ref: ref });
    return NextResponse.json({ id: order.id, redirectUrl }, { status: 201 });
  } catch (e) {
    console.error("[payment checkout]", (e as Error).message);
    await store.update(order.id, { payment_status: "payment_failed" });
    return NextResponse.json({ id: order.id, errors: [{ field: "payment", code: "checkout-failed" }] }, { status: 502 });
  }
}

/** GET /api/orders — panel listesi (yetkili). ?limit=200 */
export async function GET(req: Request) {
  if (!(await isPanelAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const limit = Math.min(500, Number(url.searchParams.get("limit")) || 200);
  /* ?since=<ISO>: panel yoklaması artımlı çeker (yalnızca değişenler). Yoksa tam liste. */
  const since = url.searchParams.get("since") || undefined;
  const orders = await getOrderStore().list(limit, true, since); // panel: yalnızca ödenmiş
  return NextResponse.json(orders, { headers: { "cache-control": "no-store" } });
}
