#!/bin/bash
# Faz 3 uçtan uca test sürücüsü. Gereksinim: `pnpm add -D playwright && pnpm exec playwright install chromium`
# (A) üretim modunda PANEL_KEY yok → her yetkili uç 401 · (B) PANEL_KEY var → giriş, SSE, durum, push mock
set -u
cd "$(dirname "$0")/../.."
PORT=${PORT:-3112}
stop(){ P=$(lsof -tiTCP:$PORT -sTCP:LISTEN); [ -n "$P" ] && kill $P; sleep 1; }
up(){ for i in $(seq 1 30); do sleep 1; curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ 2>/dev/null | grep -q 200 && return 0; done; return 1; }
pnpm build >/dev/null || exit 1
rm -rf .data
echo "== A: production, PANEL_KEY yok =="
stop; (env -u PANEL_KEY pnpm start -p $PORT >/tmp/mag-srvA.log 2>&1 &); up || { echo "server A yok"; exit 1; }
A1=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H 'content-type: application/json' -d '{"status":"preparing"}' http://localhost:$PORT/api/orders/00000000-0000-0000-0000-000000000000)
A2=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/orders)
A3=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/orders/stream)
A4=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'content-type: application/json' -d '{"endpoint":"x","keys":{"p256dh":"a","auth":"b"}}' http://localhost:$PORT/api/push/subscribe)
echo "PATCH=$A1 list=$A2 stream=$A3 push=$A4"
[ "$A1" = 401 ] && [ "$A2" = 401 ] && [ "$A3" = 401 ] && [ "$A4" = 401 ] && echo "PASS üretimde anahtar yok → 401" || echo "FAIL 401 bekleniyordu"
stop
echo "== B: PANEL_KEY=test1234 =="
(MAG_FAKE_NOW=2026-09-03T12:00:00+03:00 PANEL_KEY=test1234 pnpm start -p $PORT >/tmp/mag-srvB.log 2>&1 &); up || { echo "server B yok"; exit 1; }
PANEL_KEY=test1234 node tests/e2e/faz3.mjs http://localhost:$PORT; R=$?
stop
exit $R
