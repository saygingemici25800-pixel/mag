/**
 * Test sunucusu — HER ZAMAN temiz depoyla başlar.
 *
 * Neden silmek gerekiyor: MAG_FAKE_NOW zamanı dondurur, bu yüzden her test
 * siparişi aynı created_at ile yazılır. Kayıtlar biriktiğinde panel yeni
 * siparişi listenin başında göstermez ve panel/faz3/faz5 testleri düşer.
 * Depoyu korumak için: MAG_KEEP_DATA=1 pnpm test:server
 */
import { rmSync } from "node:fs";
import { spawn } from "node:child_process";

if (!process.env.MAG_KEEP_DATA) {
  rmSync(".data", { recursive: true, force: true });
  console.log("✓ yerel stub depo sıfırlandı (.data silindi)");
}
const child = spawn(
  process.execPath,
  ["--env-file=.env.test", "node_modules/next/dist/bin/next", "start", "-p", process.env.PORT || "3112"],
  { stdio: "inherit" },
);
child.on("exit", (c) => process.exit(c ?? 0));
