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
  zones.ts · hours.ts     # teslimat bölgeleri (AÇIK) · çalışma saatleri
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
