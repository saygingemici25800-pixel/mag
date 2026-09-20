# MAG Street Food — site

Spec: [mag-burger.md](mag-burger.md) (tek kaynak). Referans prototip: [proto/proto.html](proto/proto.html)
(dokunma, karşılaştır; `proto.template.html` aynı dosyanın görselsiz, okunabilir hali).

## Çalıştırma

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # yeşil olmadan push yok
pnpm start
pnpm lint
```

Demo: `pnpm build && pnpm start` → http://localhost:3000 (sahne performansı `pnpm dev`'de değil, üretim derlemesinde ölçülür).

Stack: Next.js (App Router) + TypeScript + Tailwind 4 + pnpm. Fontlar `next/font` (Archivo + DM Mono).

## Ortam (.env.local)

`.env.example`'ı kopyala. **Supabase anahtarları yoksa her şey yerel stub ile çalışır** (`.data/*.json`, commit edilmez):

| Değişken | Ne için |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tarayıcı: panel girişi + realtime |
| `SUPABASE_SERVICE_ROLE_KEY` | yalnızca sunucu: sipariş yaz/oku, push gönder |
| `PANEL_KEY` | Supabase yokken panel şifresi. Üretimde tanımsızsa panel ve PATCH 401 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push (`pnpm exec web-push generate-vapid-keys`) |

Supabase şeması: `supabase/migrations/0001_orders.sql` (SQL Editor'da çalıştır). Panel kullanıcısı: Authentication → Users → Add user (e-posta/şifre).

## Yapı

```
app/
  layout.tsx              # fontlar, metadata, globals.css
  (site)/layout.tsx       # topbar + köşe braketleri (components/chrome)
  (site)/page.tsx         # ANA SAYFA — sinematik sahne
  (site)/siparis/         # SİPARİŞ + [id] takip (SSE ile canlı)
  panel/page.tsx          # İŞLETME PANELİ — giriş, canlı akış, ses, push
  api/orders/             # POST oluştur · GET liste (yetkili) · [id] GET/PATCH · stream (SSE)
  api/push/subscribe      # Web Push aboneliği · api/panel/login, me
components/
  order/ · panel/         # sipariş sayfası · panel kartları
  chrome/                 # Chrome.tsx, chrome.css
  stage/
    Stage.tsx             # orkestratör: scroll → computeFrame → DOM
    stageMath.ts          # proto render() matematiği, saf fonksiyonlar (S, spacing, scale, outro)
    useScrollProgress.ts  # rAF yumuşatma (0.12) + atEnd döngüsü
    Arc.tsx               # 5 slot, cutout + yansıma + gölge, diskler
    Claims.tsx            # dive kopyası + 4 iddia + ikon rayı
    Outro.tsx             # manifesto, SSS, BİZE KATIL + sosyal bar
    Preloader.tsx         # 0→100 % sayaç, bir kez
    StaticFallback.tsx    # prefers-reduced-motion
    stage.css             # proto CSS'i, ölçüler aynen
lib/
  menu.ts                 # ÜRÜN VERİSİ — tek kaynak (spec §5)
  zones.ts · hours.ts     # teslimat bölgeleri · çalışma saatleri (ikisi de panelden)
  orders.ts               # sipariş modeli + sunucu doğrulama + OrderStore/PushStore arayüzleri
  store.ts                # env'e göre depo seçimi: Supabase (supabase-store.ts) ya da stub (orders-store.ts)
  panel-auth.ts           # panel yetkisi: Supabase Bearer · PANEL_KEY çerez/başlık
  push.ts · events.ts     # web-push gönderimi · süreç içi olaylar (SSE)
  i18n.ts · site.ts · sound.ts · panel-sound.ts
messages/tr.json          # tüm metinler
public/assets/cut/*.webp  # 5 burger cutout · public/assets/hero/*.jpg
assets/ · promptlar/      # kaynak görseller ve ChatGPT promptları (spec paketi)
```

Testler (Playwright, scratchpad): Faz 3 uçtan uca akış `faz3-test.sh` — üretimde PANEL_KEY yokken 401, PANEL_KEY ile giriş,
SSE canlı kart, durum → müşteri, push mock. Deploy Faz 3 sonrası, Supabase bağlıyken (stub ile deploy yok).

## Varlık düzeni

Görseller tek bir kurala göre durur: **dosya adı = ürün id'si** (`lib/menu.ts`).
Türkçe karakter, boşluk ve büyük harf yok; hepsi küçük harf ve tire.

```
public/                  İNTERNETE AÇIK — buraya yalnızca yayınlanacak dosya konur
  urun/<id>.webp         hero kesimi, saydam, 480 px
  urun/mobil/<id>.webp   aynı kesimin mobil kopyası, 300 px
  urun/ortak/            taco/noodle/çıtır'ın paylaştığı tek kart görseli
  galeri/NN.webp         foto duvarı (liste: lib/gallery.ts)
  brand/                 logo ve marka varlıkları
  sounds/                ses dosyaları
assets/                  SUNUCU tarafı, public'e ÇIKMAZ, deploy paketine girmez
  ham/<id>.jpg           kesimlerin ham kaynağı — yeni kesim/OG üretimi için
  og/<id>.png            OG görseli üretimi (app/api/og)
  fonts/                 Satori için TTF (woff2 okumuyor)
```

17 Eyl 2026: `public/urun/ham/` → `assets/ham/` taşındı. Ham fotoğraflar
yayınlanmıyor; `public/` altındaki her dosya internete açık ve deploy paketine
giriyor, ham kaynakların orada işi yok. Aynı tarihte `_arsiv/` silindi
(içeriği git geçmişinde duruyor).

Galeri `public/galeri/` altında kendi karelerini kullanıyor (63 kare,
`lib/gallery.ts` listeliyor) — ham fotoğraflarla ilgisi yok.

### Yeni ürün fotoğrafı gelince

1. Ham fotoğrafı `assets/ham/<id>.jpg` olarak koy (1536 px yeter, public DIŞI).
2. Kesim üret: arka planı sil, alfa kutusuna kırp, 480 px yüksekliğe indir →
   `public/urun/<id>.webp`. Mobil kopyası 300 px → `public/urun/mobil/<id>.webp`.
3. `components/stage/cutouts.ts` içine iki `import` ve iki kayıt ekle.
4. Galeride görünsün istiyorsan `lib/gallery.ts` dizisine bir satır ekle.

Kesim dosyası olmayan ürün hero'da tipografik kutu olarak görünür; kod değişikliği
gerekmez (`lib/cutouts-available.ts` dosyayı build sırasında bulur).

## Diller

TR kök (`/`), EN `/en` altında aynı ağaç. Tüm metinler `messages/tr.json` ve `messages/en.json`; ürün adları `lib/menu.ts`'te,
EN açıklamaları `en.json → menuDesc/menuName`. Her dil kendi kök layout'unda (`app/(tr)`, `app/(en)/en`) → `<html lang>`,
hreflang ve canonical `lib/seo.ts`'ten. Yasal metinler yalnızca Türkçe (`lib/legal-texts.ts`), `{{ALAN}}` yer tutucuları `lib/legal.ts`'ten dolar.

## Vercel'e kurulum

1. GitHub'da repo oluştur, bu klasörü push et (`main`).
2. vercel.com → **Add New → Project** → GitHub reposunu seç (Import). Framework: Next.js otomatik algılanır; build komutu `pnpm build`.
3. **Environment Variables**: `.env.example`'daki her satırı gir (Production + Preview). Zorunlu: `NEXT_PUBLIC_SITE_URL`,
   Supabase 3 değer, VAPID 2 değer + `VAPID_SUBJECT`. Supabase varken `PANEL_KEY` gerekmez.
4. Deploy. Fluid Compute gerekmez: push gönderimi istek içinde 3 sn zaman aşımıyla yapılır; SSE bağlantıları fonksiyon
   süresi dolunca tarayıcı tarafından yeniden açılır.
5. **Domains**: alan adını ekle, Vercel'in verdiği CNAME/A kayıtlarını Cloudflare DNS'e gir (proxy kapalı, "DNS only").
   `NEXT_PUBLIC_SITE_URL`'yi gerçek alan adıyla güncelle ve yeniden deploy et.
6. Supabase → Authentication → URL Configuration → Site URL alanına aynı alan adını yaz.
7. Yayın sonrası: `/panel` girişi, `/api/og?item=smooky` görseli, `/sitemap.xml`, Search Console'a sitemap.

## Testler

**Testler CANLI veritabanına yazamaz.** Test ortamı yerel dosya stub'ını (`.data/*.json`)
kullanır; `.env.test` içinde Supabase anahtarları bilerek BOŞTUR ve bu değerler
`.env.local`'i ezer.

```bash
pnpm test:server      # sunucuyu .env.test ile başlatır (depo: stub)
pnpm test             # tüm paketi koşar
pnpm test panel push  # yalnız seçili testler
```

Kilit (`scripts/test-guard.mjs`) iki durumu da yakalar ve testi net bir mesajla
durdurur:
- test sürecinde canlı Supabase anahtarı tanımlıysa,
- sunucu canlı Supabase'e bağlıysa (`/api/panel/me` → `store:"supabase"`).

`supabase-proof` tasarım gereği canlıya yazar, bu yüzden normal pakette **atlanır**.
Bilerek koşmak için: `MAG_ALLOW_LIVE_DB=1 node tests/e2e/supabase-proof.mjs`.
Sonrasında kayıtları temizle: `node scripts/purge-test-orders.mjs --apply`.

**Canlı test kaydı temizliği:** `node scripts/purge-test-orders.mjs` (önce rapor;
silmek için `--apply`). Silmeden önce `docs/backup/` altına (gitignore'lu) yedek alır
ve test olduğu üç ölçütle kanıtlanmayan kaydı ASLA silmez.

### Yalnızca test ortamına ait değişkenler
`MAG_FAKE_NOW` ve `PAYMENT_MOCK_SECRET` **production env'inde bulunmamalıdır**.
Kod seviyesinde de korunur: production'da `MAG_FAKE_NOW` yok sayılır (uyarı basar),
`PAYMENT_PROVIDER=mock` ise hata fırlatır.

Sonraki: iyzico hosted checkout (5) · katman animasyonu ve eksik ürün fotoğrafları (görseller gelince).

## Panelden yönetilen ayarlar (altyapı)

Panelden yönetilen TÜM veriler Supabase'deki `settings` **tekil satırında** durur
(`id='singleton'`). Yeni bir ayar eklerken bu beş adımı izle:

1. `lib/settings.ts` → `Settings` arayüzüne alan + `DEFAULT_SETTINGS`'e varsayılan.
2. Aynı dosyada `normalizeSettings` içinde şemaya oturt — bozuk/eksik kayıt paneli
   açmasın, geçersizse **koddaki varsayılana düş**. (Veritabanı boşken site çalışır.)
3. `supabase/migrations/` → kolon ekle (`jsonb` çoğu iş için yeter).
4. **Yazma:** yalnızca `PATCH /api/panel/settings`. Rota `isPanelAuthorized`
   (PANEL_KEY çerezi) ister ve `service_role` ile yazar. Anahtar yalnızca sunucuda;
   tarayıcıya ASLA gitmez. Gövde şeması sunucuda yeniden doğrulanır.
5. **Okuma:** aynı rotanın `GET`'i herkese açık (yalnızca okuma). İstemci
   `lib/useSettings.ts` ile okur: modül düzeyinde tek abonelik, 30 sn yoklama +
   sekmeye dönüşte tazeleme. Yeni alanı `refresh()` içindeki karşılaştırmaya ekle,
   yoksa değişiklik ekrana yansımaz.

RLS: `settings` için `anon` **SELECT açık, INSERT/UPDATE kapalı** (0003 + 0007).
Realtime yayınında `settings` var; panel ayar değişimini anında görür.

### Teslimat bölgeleri
`settings.zones` (jsonb) — panelden ekle/düzenle/sil/kapat/sırala
(`components/panel/PanelZones.tsx`). Alanlar: `id, name, minCart, fee, etaMinutes,
active`. `id` DEĞİŞMEZ (eski siparişlerin `zone` alanı ona bakar); ad değişebilir.
`active:false` = "şu an bu mahalleye teslimat yok" — listede görünür, seçilemez,
sunucu da reddeder. Kayıt yoksa `lib/zones.ts` içindeki `ZONES` kullanılır.
Ücret ve minimum sepet SUNUCUDA hesaplanır (`computeTotals(..., settings.zones)`),
istemciden gelen tutara güvenilmez.

### Ürün fiyatları
`settings.prices` (jsonb) — ürün id → ₺, **seyrek harita**: yalnızca değiştirilen
ürünler yazılır. Panel: `components/panel/PanelPrices.tsx` (kategoriye göre gruplu,
toplu kaydet, kaydedilmemiş değişiklik uyarısı). Fiyat kuralı: **pozitif tam sayı**
(boş/0/negatif/ondalık/harf reddedilir) — panelde ve yeniden **sunucuda** doğrulanır.
Koddaki fiyat (`lib/menu.ts`) SİLİNMEZ; haritada olmayan ürün onu kullanır.

Fiyat okuyan her yer `priceOf(m, settings.prices)` kullanır (lib/menu.ts). Doğrudan
`m.price` okuyan kod panel değişikliğini GÖRMEZ.

**Tutar güvenliği:** istemci yalnızca `{id, qty}` gönderir; fiyat/tutar göndermez.
Toplam her zaman sunucuda `computeTotals(..., settings.prices)` ile hesaplanır.
İstek yine de `price`/`total`/`subtotal`/`fee` taşıyorsa sunucunun hesabıyla
karşılaştırılır; uyuşmazsa sipariş **422 `amount-mismatch`** ile reddedilir ve
loglanır (sessizce yok sayılmaz).

**Geçmiş siparişler:** `OrderItem.price` sipariş anındaki fiyatı satırda saklar;
sonraki fiyat değişikliği eski siparişi etkilemez (test: `tests/e2e/fiyatlar.mjs`).

### Servis şalterleri (kurye / gel-al)
`settings.ordering_open` + `delivery_open` + `pickup_open` (0009_service_toggles.sql).
Mantık **tek yerde**, `lib/settings.ts`: `deliveryOpen()` · `pickupOpen()` ·
`allClosed()` · `typeOpen()`. Kural:

| ordering_open | delivery_open | pickup_open | Sonuç |
|---|---|---|---|
| false | (fark etmez) | (fark etmez) | ikisi de KAPALI |
| true | true | true | ikisi de açık |
| true | false | true | yalnız gel-al |
| true | true | false | yalnız kurye |

`ordering_open` ANA ŞALTER: kapalıyken tür şalterlerine bakılmaz (panelde de
pasif çizilirler). Müşteri tarafında kapalı tür `disabled` + üstü çizili, altında
sebebi yazar; tek tür açıksa `etkinMode` ile OTOMATİK seçilir (state effect'te
değiştirilmez). Mesaj sırası: **saat kapalıysa saat mesajı önce** gelir, servis
mesajı yalnızca saat açıkken görünür.

**Sunucu reddi** (`app/api/orders/route.ts`): kapalı türle gelen sipariş
`409 delivery-closed` / `409 pickup-closed`, ana şalter kapalıysa
`409 ordering-closed`. Arayüz engeli yeterli sayılmaz.

### Çalışma saatleri ve özel günler (tatil)
`settings.schedule` (jsonb, 0010_schedule.sql):

```jsonc
{
  "week": [ { "day": 0, "openMin": 960, "closeMin": 1380 }, /* … 7 gün */ ],
  "special": [ { "date": "2026-09-30", "closed": true, "note": "Bayram" } ]
}
```

Saat **DAKİKA** cinsinden (12:00 → 720). Kapanış `00:00` → **1440**; gece yarısını
geçen pencere ancak böyle temsil edilebiliyor, yoksa 12:00–00:00 aralığında
kapanış açılıştan küçük görünürdü. Kapalı gün: `openMin === closeMin === 0`.
`day` alanı `Date.getDay()` ile aynı (0 = Pazar).

`special[]` haftalık programı O GÜN için EZER: `closed:true` gün boyu kapalı,
`closed:false` + `openMin/closeMin` özel saat. `note` yalnızca panelde görünür,
hesaba girmez. `schedule` NULL ise koddaki varsayılan (`lib/hours.ts` HOURS).

**Saat dilimi:** tüm hesap `Europe/Istanbul` üzerinden (`Intl.DateTimeFormat`),
sunucu UTC'de koşsa da doğru. "Şimdi"yi okuyan her yer `defaultNow()` kullanır —
`new Date()` ÇAĞIRMA, test zamanı donduğunda (`MAG_FAKE_NOW`) sapma yaratır.
`MAG_FAKE_NOW` production'da yok sayılır (lib/hours.ts içinde guard).

`nextOpening` **14 gün** tarar: arka arkaya tatillerde de doğru günü bulsun.
Geçmiş tarihli özel günler her yazmada sunucuda ayıklanır (`pruneSpecial`).

**Sunucu reddi** (`app/api/orders/route.ts`): kapalı saatte gelen sipariş
`422 {field:"hours", code:"closed"}`. Arayüz engeli yeterli sayılmaz.
Test: `tests/e2e/saat-panel.mjs` (18 kontrol) + `tests/e2e/saatler.mjs` (58).

### Raporlar (geçmiş sipariş verisi)
Panel → **Raporlar** sekmesi. Tarih aralığı kısayolları (Bugün / Dün / Son 7 gün /
Bu ay / Geçen ay) + özel aralık; özet kartlar, en çok satan 10 ürün, günlük ve
saatlik kırılım, mahalle dağılımı, CSV dışa aktarma.

**TOPLAMA VERİTABANINDA.** Supabase yolunda `panel_report(from,to)` SQL fonksiyonu
(0011_reports.sql) satırları Postgres'te toplar; tarayıcıya sipariş listesi DEĞİL
yalnızca özet gider (birkaç yüz bayt). Sipariş sayısı büyüdükçe panel yavaşlamasın
diye. Stub yolunda (testler) `lib/reports.ts` içindeki `hesapla()` aynı sonucu
üretir — ikisi `raporlar` paketinde AYNI beklenen rakamlara karşı doğrulanır ki
zamanla birbirinden sapmasınlar.

**Saat dilimi:** gün/saat kırılımı `at time zone 'Europe/Istanbul'` ile. UTC'ye
göre gruplansaydı gece 00:10'daki sipariş bir ÖNCEKİ güne yazılırdı (TR = UTC+3).
Test bunu 23:50 ve 00:10 kayıtlarıyla doğruluyor.

**İptal ve ödenmemiş siparişler ciroya GİRMEZ** (`status <> 'cancelled'` +
`payment_status = 'paid'`); iptal ayrı kart olarak sayı ve oranla gösterilir.
CSV'de ise iptaller de listelenir — muhasebe hepsini görmeli.

**İndeks:** `orders_created_status_idx (created_at desc, status)` eklendi (0011).
50.000 satırda aralık sorgusu Seq Scan → Bitmap Heap Scan'e geçiyor. `items` için
GIN indeksi 0003'te zaten vardı, ikincisi EKLENMEDİ (yazma maliyeti boşuna artardı).

**Yetki:** `/api/panel/reports` PANEL_KEY korumalı. SQL fonksiyonları
`security definer` olduğu için anon/authenticated'a açılmaz, yalnızca
`service_role` çağırabilir.

**CSV:** UTF-8 **BOM** + `sep=;` satırı — Excel'de Türkçe karakter bozulmasın ve
tek sütuna düşmesin. Telefon `="05..."` formülü olarak yazılır, yoksa Excel
baştaki sıfırı siler. Kolonlar: tarih/saat, sipariş no, müşteri, telefon,
teslimat türü, mahalle, ürünler, tutar, durum.

### Ürün görselleri (içecek / yan ürün)
`public/urun/icecek/*.webp` ve `public/urun/yan/*.webp` — menü kaydındaki
`photo` alanı bu yolu gösterir. Sıra `ProductImage`'te: **kesim (hero) → photo →
kısa ad rozeti**; fotoğrafı olmayan kalem (soslar, limonata) rozette kalır.

**Paylaşılan kareler:** noodle çeşitlerinin hepsi `NOODLE_PHOTO`, taco
çeşitlerinin hepsi `TACO_PHOTO` sabitini gösterir — işletme tek kare gönderdi,
dosya KOPYALANMAZ. (Önceki tek `SHARED_PHOTO` kaldırıldı.)

**Mobil kopyalar:** `pnpm assets:cut-m` → `public/urun/mobil/` altında AYNA
klasör yapısı (`mobil/icecek/`, `mobil/yan/`). Alt klasör korunuyor ki ad
çakışması olmasın.

**Ölçüler:** `node scripts/photo-dims.mjs` → `lib/photoDims.json`. Bu dosya
next/image'a DOĞRU intrinsic oranı verir; içecekler dar ve uzun (134×480),
yan ürünler geniş (824×480) — sabit 800×1200 vermek yanlış kutu ve srcset
üretiyordu. Görsel değişirse script tekrar koşulmalı.

**cutCenters.json'a kayıt GEREKMEZ:** o dosya yalnızca ana sayfa sahnesindeki
8 hero burger için (Stage.tsx); içecek/yan oraya hiç girmiyor ve okuma
`?? 0.5` ile zaten ortalanmış varsayıyor.

### Fiyatı henüz girilmemiş ürün (price 0)
Menüde `price: 0` = "fiyat bekleniyor" (ör. 20 Eyl 2026'da eklenen
`citir-tavuk`). Üç yerde ele alınır:
- **Müşteri:** kart görünür ama pasif, etiket **"Yakında"** (tükendi DEĞİL) ve
  fiyat satırı boş — "₺0" yanıltıcı olurdu.
- **Sunucu:** `validateOrder` → `422 {field:"items", code:"no-price:<id>"}`.
  Arayüz engeline güvenilmez; ürün BEDAVA sipariş edilemez.
- **Panel:** fiyat alanı BOŞ gelir ve kaydetmeyi engellemez. Fiyatı OLAN bir
  ürünün alanını boşaltmak ise hâlâ hatadır (mevcut fiyat kazara silinmesin).

Panelden fiyat girilince üçü de kendiliğinden düzelir — kod değişikliği yok.
