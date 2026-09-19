/**
 * Rapor testi için sabit sipariş kümesi + ELLE hesaplanmış beklenen rakamlar.
 *
 * Sayılar burada ELLE yazılı. Kodun kendi çıktısından türetilmiyor — yoksa
 * "kod ne derse o doğrudur" olur ve test hiçbir şey kanıtlamaz.
 *
 * Saatler +03:00 (İstanbul) yazılıyor; UTC'ye çevrildiğinde gün sınırı
 * testleri anlamlı olsun diye 23:50 ve 00:10 kayıtları özellikle var.
 */

/** Ürün fiyatları (sipariş anındaki fiyat satırda saklanır) */
const P = { smooky: 380, truffle: 420, berry: 350 };

/** Tek sipariş üret. total = subtotal + fee (fee yalnızca kuryede) */
function o(id, isoTR, type, status, items, zone = null, fee = 0, paid = true) {
  const satirlar = items.map(([k, qty]) => ({ id: k, name: k.toUpperCase(), price: P[k], qty }));
  const subtotal = satirlar.reduce((s, it) => s + it.price * it.qty, 0);
  return {
    id,
    created_at: new Date(isoTR).toISOString(),
    type,
    zone,
    items: satirlar,
    subtotal,
    fee,
    total: subtotal + fee,
    name: "Test " + id.slice(0, 4),
    phone: "05001112233",
    address: type === "delivery" ? "Test Mah. 1/2" : null,
    requested_at: "simdi",
    note: null,
    payment: "cod",
    payment_status: paid ? "paid" : "pending",
    payment_ref: null,
    locale: "tr",
    status,
  };
}

/* ---------------------------------------------------------------------------
   VERİ KÜMESİ — 2026-09-15 … 2026-09-17 (3 gün)

   15 Eyl (Salı)
     A  12:30  kurye   merkez    teslim   2× smooky (760) + 1× berry (350) = 1110 + fee 0  → 1110
     B  19:00  gel-al            teslim   1× truffle                        = 420          →  420
     C  20:15  kurye   oludeniz  İPTAL    3× smooky                         (ciroya GİRMEZ)
   16 Eyl (Çarşamba)
     D  13:45  gel-al            teslim   2× truffle (840)                                 →  840
     E  23:50  kurye   merkez    teslim   1× smooky (380) + fee 0                          →  380   ← gün sınırı
   17 Eyl (Perşembe)
     F  00:10  kurye   calis     teslim   1× berry (350)                                   →  350   ← gün sınırı
     G  18:00  gel-al            ödenmemiş 5× smooky   (payment_status=pending → SAYILMAZ)
--------------------------------------------------------------------------- */
export const SIPARISLER = [
  o("aaaa1111-0000-4000-8000-000000000001", "2026-09-15T12:30:00+03:00", "delivery", "delivered", [["smooky", 2], ["berry", 1]], "merkez"),
  o("bbbb2222-0000-4000-8000-000000000002", "2026-09-15T19:00:00+03:00", "pickup", "delivered", [["truffle", 1]]),
  o("cccc3333-0000-4000-8000-000000000003", "2026-09-15T20:15:00+03:00", "delivery", "cancelled", [["smooky", 3]], "oludeniz"),
  o("dddd4444-0000-4000-8000-000000000004", "2026-09-16T13:45:00+03:00", "pickup", "delivered", [["truffle", 2]]),
  o("eeee5555-0000-4000-8000-000000000005", "2026-09-16T23:50:00+03:00", "delivery", "delivered", [["smooky", 1]], "merkez"),
  o("ffff6666-0000-4000-8000-000000000006", "2026-09-17T00:10:00+03:00", "delivery", "delivered", [["berry", 1]], "calis"),
  o("99997777-0000-4000-8000-000000000007", "2026-09-17T18:00:00+03:00", "pickup", "delivered", [["smooky", 5]], null, 0, false),
];

/* ---------------------------------------------------------------------------
   ELLE HESAP — 15–17 Eyl aralığı

   Geçerli (iptal değil + ödenmiş): A, B, D, E, F  → 5 sipariş
     ciro = 1110 + 420 + 840 + 380 + 350 = 3100
     ortalama sepet = 3100 / 5 = 620
     kurye  = A, E, F = 3   (%60)
     gel-al = B, D    = 2   (%40)
   İptal: C = 1.  Aralıktaki TÜM kayıt: 7 (G ödenmemiş ama kayıt var)
     iptal oranı = 1/7 = %14

   Ürünler (adet, ciro = price × qty):
     smooky : A 2 + E 1 = 3 adet → 3×380 = 1140
     truffle: B 1 + D 2 = 3 adet → 3×420 = 1260
     berry  : A 1 + F 1 = 2 adet → 2×350 =  700
     Sıralama adet ↓, eşitlikte ciro ↓ → truffle(3,1260), smooky(3,1140), berry(2,700)

   Günlük:
     2026-09-15: A+B = 2 sipariş, 1110+420 = 1530
     2026-09-16: D+E = 2 sipariş,  840+380 = 1220
     2026-09-17: F   = 1 sipariş,            350
   Saatlik (İstanbul): 12→1, 19→1, 13→1, 23→1, 00→1
   Mahalle (yalnız kurye): merkez A+E = 2 (1490), calis F = 1 (350)
--------------------------------------------------------------------------- */
export const BEKLENEN = {
  from: "2026-09-15",
  to: "2026-09-17",
  summary: { orders: 5, revenue: 3100, delivery: 3, pickup: 2, cancelled: 1, total_all: 7 },
  ortalama: 620,
  items: [
    { id: "truffle", qty: 3, revenue: 1260 },
    { id: "smooky", qty: 3, revenue: 1140 },
    { id: "berry", qty: 2, revenue: 700 },
  ],
  daily: [
    { date: "2026-09-15", orders: 2, revenue: 1530 },
    { date: "2026-09-16", orders: 2, revenue: 1220 },
    { date: "2026-09-17", orders: 1, revenue: 350 },
  ],
  hourly: [
    { hour: 0, orders: 1 },
    { hour: 12, orders: 1 },
    { hour: 13, orders: 1 },
    { hour: 19, orders: 1 },
    { hour: 23, orders: 1 },
  ],
  zones: [
    { zone: "merkez", orders: 2, revenue: 1490 },
    { zone: "calis", orders: 1, revenue: 350 },
  ],
};

/** Yalnızca 16 Eyl: gün sınırı kontrolü (23:50 buraya, 00:10 ertesi güne) */
export const BEKLENEN_16 = { orders: 2, revenue: 1220, delivery: 1, pickup: 1 };
/** Yalnızca 17 Eyl: 00:10'daki sipariş BU güne yazılmalı */
export const BEKLENEN_17 = { orders: 1, revenue: 350, delivery: 1, pickup: 0 };
