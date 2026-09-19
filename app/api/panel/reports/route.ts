import { NextResponse } from "next/server";
import { isPanelAuthorized } from "@/lib/panel-auth";
import { csv, gecerliTarih, type Report } from "@/lib/reports";
import { getReportStore, getSettingsStore } from "@/lib/store";
import { findZone } from "@/lib/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/panel/reports?from=YYYY-MM-DD&to=YYYY-MM-DD[&format=csv]
 *
 * Toplama SUNUCUDA (Supabase yolunda doğrudan SQL, 0011_reports.sql):
 * tarayıcıya sipariş listesi DEĞİL, yalnızca özet gider. CSV istendiğinde
 * ham satırlar yine sunucuda süzülür ve dosya olarak indirilir.
 *
 * Yetki: PANEL_KEY (başlık ya da imzalı çerez) — summary rotasıyla aynı.
 */
export async function GET(req: Request) {
  if (!(await isPanelAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  /* Tarihler doğrudan SQL fonksiyonuna parametre olarak gidiyor (RPC, string
     birleştirme YOK) ama biçim yine de burada doğrulanır: hatalı girdi
     veritabanına hiç ulaşmasın, 400 ile geri dönsün. */
  if (!gecerliTarih(from) || !gecerliTarih(to)) {
    return NextResponse.json({ error: "bad-range", detail: "from/to YYYY-MM-DD olmalı" }, { status: 400 });
  }
  if (from > to) return NextResponse.json({ error: "bad-range", detail: "from > to" }, { status: 400 });

  try {
    const store = getReportStore();

    if (url.searchParams.get("format") === "csv") {
      const rows = await store.rows(from, to);
      const zones = (await getSettingsStore().get()).zones;
      const ad = (id: string | null | undefined) => findZone(zones, id)?.name ?? (id || "-");
      const govde = csv(rows, ad);
      return new NextResponse(govde, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="mag-siparisler-${from}_${to}.csv"`,
          "cache-control": "no-store",
        },
      });
    }

    const rapor: Report = await store.report(from, to);
    return NextResponse.json(rapor, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    /* Rapor okunamadıysa SESSİZCE boş dönme — panelde hata görünsün.
       (Ayar yazımında sessiz hata daha önce saatler kaybettirdi.) */
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[rapor okunamadı]", detail);
    return NextResponse.json({ error: "report-failed", detail }, { status: 500 });
  }
}
