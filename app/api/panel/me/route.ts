import { NextResponse } from "next/server";
import { isPanelAuthorized, panelMode } from "@/lib/panel-auth";
import { storeMode } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/panel/me → { mode, authorized, store } — panel hangi kapıyı göstereceğini buradan öğrenir. */
export async function GET(req: Request) {
  return NextResponse.json(
    { mode: panelMode(), authorized: await isPanelAuthorized(req), store: storeMode() },
    { headers: { "cache-control": "no-store" } },
  );
}
