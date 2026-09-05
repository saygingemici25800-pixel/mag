import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { isLocale } from "@/lib/i18n";
import { HERO_ITEMS, splitTitle, type HeroId } from "@/lib/menu";
import { PALETTE, hexToRgb } from "@/lib/palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // parametreye göre üretilir; cache-control ile CDN önbellekler

const W = 1200,
  H = 630;
/* Satori woff2 okumaz; OG görseli için assets/fonts altındaki TTF'ler kullanılır (web'e bağlantı yok, yalnızca sunucuda) */
let fontCache: Promise<{ italic: Buffer; upright: Buffer }> | null = null;
function fonts() {
  return (fontCache ??= Promise.all([
    readFile(path.join(process.cwd(), "assets/fonts/Archivo-BlackItalic.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/Archivo-Black.ttf")),
  ]).then(([italic, upright]) => ({ italic, upright })));
}
const rgba = (hex: string, a: number) => `rgba(${hexToRgb(hex).join(",")},${a})`;

/** GET /api/og?item=smooky&locale=tr — mor-derin zemin, sıcak backlight, cutout, "mag." + ürün adı (palet: lib/palette.ts) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const itemParam = url.searchParams.get("item") || "smooky";
  const item = HERO_ITEMS.find((m) => m.id === itemParam) ?? HERO_ITEMS[0];
  const locale = isLocale(url.searchParams.get("locale") || "") ? url.searchParams.get("locale") : "tr";
  const { italic, upright } = await fonts();
  const png = await readFile(path.join(process.cwd(), "assets/og", `${item.id as HeroId}.png`)).catch(() => null);
  const src = png ? `data:image/png;base64,${png.toString("base64")}` : null;
  const [l1, l2] = splitTitle(item.name);
  const sub = locale === "en" ? "STREET FOOD · FETHIYE" : "STREET FOOD · FETHİYE";

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          background: `linear-gradient(180deg, ${PALETTE.purpleDeep}, ${PALETTE.purple})`,
          color: PALETTE.lime,
          position: "relative",
          fontFamily: "Archivo",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 520,
            top: 40,
            width: 620,
            height: 560,
            borderRadius: 999,
            opacity: 0.55,
            background: `radial-gradient(circle at center, ${PALETTE.warm} 0%, ${rgba(PALETTE.warm, 0.35)} 45%, ${rgba(PALETTE.purpleDeep, 0)} 70%)`,
          }}
        />
        <div style={{ position: "absolute", left: 72, top: 64, display: "flex", fontSize: 64, fontStyle: "italic", letterSpacing: -4 }}>
          <span>mag</span>
          <span style={{ color: PALETTE.lime }}>.</span>
        </div>
        <div style={{ position: "absolute", left: 72, top: 148, display: "flex", fontSize: 22, letterSpacing: 6, color: rgba(PALETTE.lime, 0.6), fontStyle: "normal" }}>
          {sub}
        </div>
        <div style={{ position: "absolute", left: 66, bottom: 70, display: "flex", flexDirection: "column", fontSize: 128, lineHeight: 0.86, fontStyle: "italic", letterSpacing: -6 }}>
          <span>{l1}</span>
          {l2 ? <span>{l2}</span> : null}
        </div>
        <div style={{ position: "absolute", left: 560, top: 90, width: 600, height: 480, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} height={440} style={{ objectFit: "contain" }} alt="" />
          ) : null}
        </div>
        <div style={{ position: "absolute", left: 640, top: 540, width: 440, height: 26, borderRadius: 999, background: `radial-gradient(circle at center, ${rgba(PALETTE.ink, 0.8)} 0%, ${rgba(PALETTE.ink, 0)} 70%)` }} />
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Archivo", data: italic, style: "italic", weight: 900 },
        { name: "Archivo", data: upright, style: "normal", weight: 900 },
      ],
      headers: { "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" },
    },
  );
}
