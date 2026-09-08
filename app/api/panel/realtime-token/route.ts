import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { isPanelAuthorized } from "@/lib/panel-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Token ömrü — kısa tutulur, panel kendiliğinden tazeler (yarısında). */
const TTL_S = 15 * 60;

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/**
 * GET /api/panel/realtime-token
 *
 * PANEL_KEY çerezi geçerliyken, YALNIZCA realtime dinlemek için kısa ömürlü bir Supabase JWT'si
 * imzalar (role="authenticated"). Böylece panel girişi PANEL_KEY olarak kalır — kullanıcı Supabase
 * Auth ekranı görmez — ama tarayıcı realtime akışına RLS'i geçerek abone olabilir.
 *
 * Neden servis kullanıcısı (b) değil de imzalı JWT (a):
 *  - Kalıcı bir kullanıcı ve şifresi saklamak gerekmiyor; sızarsa döndürülecek bir sır artmıyor.
 *  - Admin API çağrısı ve oturum yenileme döngüsü yok; tek HMAC imzası (ağ turu bile yok).
 *  - Ömür bizde: 15 dk, yalnızca realtime için. Servis kullanıcısının refresh token'ı ise
 *    tarayıcıda uzun ömürlü bir oturum bırakırdı.
 *
 * service_role anahtarı tarayıcıya ASLA gitmez; burada yalnızca JWT secret ile imza atılır.
 */
export async function GET(req: Request) {
  if (!(await isPanelAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    /* Yapılandırılmamışsa özellik sessizce kapanır: panel yoklamaya düşer, hata vermez. */
    return NextResponse.json({ error: "not-configured" }, { status: 501 });
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "supabase",
    ref: process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1],
    role: "authenticated",
    /* Supabase RLS'te auth.uid() bekleyen politikalar için sabit bir özne; bizim politikamız
       yalnızca role'e bakıyor ama token şema açısından eksiksiz olsun. */
    sub: "panel",
    aud: "authenticated",
    iat: now,
    exp: now + TTL_S,
  };
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");

  return NextResponse.json(
    { token: `${head}.${body}.${sig}`, expiresIn: TTL_S },
    { headers: { "cache-control": "no-store" } },
  );
}
