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

Testler (Playwright, `pnpm add -D playwright && pnpm exec playwright install chromium`): `tests/e2e/faz3.sh` sürücüsü;
diğer scriptler `node tests/e2e/<dosya>.mjs http://localhost:3112`. Saat bağımlı testler için sunucu `MAG_FAKE_NOW=…` ile başlatılır.

Sonraki: iyzico hosted checkout (5) · katman animasyonu ve eksik ürün fotoğrafları (görseller gelince).
