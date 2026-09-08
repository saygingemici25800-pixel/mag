import { NextResponse } from "next/server";
import { PALETTE } from "@/lib/palette";

/**
 * Panel PWA manifesti — /panel/manifest.webmanifest.
 * Route handler olarak yazıldı: metadata `manifest.ts` route grubunun ( (panel) ) kökünde
 * çözülüyor ve /panel altına düşmüyordu (404).
 * Kapsam yalnızca /panel: ana ekrandan açılınca doğrudan panele girer.
 */
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    {
      name: "MAG Panel",
      short_name: "MAG Panel",
      description: "MAG Street Food sipariş paneli",
      start_url: "/panel",
      scope: "/panel",
      display: "standalone",
      orientation: "portrait",
      background_color: PALETTE.purpleDeep,
      theme_color: PALETTE.purpleDeep,
      icons: [
        /* kare ikon: mor zemin + limon wordmark (scripts/brand-derivatives.mjs yanında üretildi) */
        { src: "/brand/panel-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/brand/panel-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
