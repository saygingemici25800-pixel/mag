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

Stack: Next.js (App Router) + TypeScript + Tailwind 4 + pnpm. Fontlar `next/font` (Archivo + DM Mono).

## Yapı (Faz 1)

```
app/
  layout.tsx              # fontlar, metadata, globals.css
  (site)/layout.tsx       # topbar + köşe braketleri (components/chrome)
  (site)/page.tsx         # ANA SAYFA — sinematik sahne
components/
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
  i18n.ts · site.ts
messages/tr.json          # tüm metinler
public/assets/cut/*.webp  # 5 burger cutout · public/assets/hero/*.jpg
assets/ · promptlar/      # kaynak görseller ve ChatGPT promptları (spec paketi)
```

Sonraki fazlar spec §9: `/siparis` (2) · `/panel` (3) · EN + yasal + SEO + yayın (4) · iyzico (5).
