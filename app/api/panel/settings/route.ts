import { NextResponse } from "next/server";
import { isPanelAuthorized } from "@/lib/panel-auth";
import type { Settings } from "@/lib/settings";
import { getSettingsStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/panel/settings — herkese açık OKUMA: site "kapalıyız" ve "tükendi" durumunu bilmeli. */
export async function GET() {
  const s = await getSettingsStore().get();
  return NextResponse.json(s, { headers: { "cache-control": "no-store" } });
}

/** PATCH /api/panel/settings — yalnızca panel. Gövde: { ordering_open?, sold_out? } */
export async function PATCH(req: Request) {
  if (!(await isPanelAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Partial<Pick<Settings, "ordering_open" | "sold_out">>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const patch: Partial<Pick<Settings, "ordering_open" | "sold_out">> = {};
  if (typeof body.ordering_open === "boolean") patch.ordering_open = body.ordering_open;
  if (Array.isArray(body.sold_out)) patch.sold_out = body.sold_out.filter((x): x is string => typeof x === "string");
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "empty-patch" }, { status: 422 });
  return NextResponse.json(await getSettingsStore().patch(patch));
}
