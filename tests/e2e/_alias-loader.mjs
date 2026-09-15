/**
 * Node ESM çözümleyicisine "@/..." takma adını öğretir.
 *
 * tsconfig.json'daki `paths: { "@/*": ["./*"] }` yalnızca TypeScript/bundler
 * içindir; düz `node` bunu bilmez ve `@/lib/orders` importu ERR_MODULE_NOT_FOUND
 * verir. Bu kanca sayesinde e2e testleri ÜRÜN KODUNUN KENDİSİNİ içe aktarabilir
 * (kopyasını değil), böylece test gerçekten çalışan kodu doğrular.
 *
 * Kullanım:  node --import ./tests/e2e/_alias-loader.mjs tests/e2e/<test>.mjs
 */
import { pathToFileURL } from "node:url";
import { register } from "node:module";

const ROOT = pathToFileURL(new URL("../../", import.meta.url).pathname).href;

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    /* Uzantısız yol: ".ts" ekleyerek dene, olmazsa olduğu gibi bırak. */
    const bare = new URL(specifier.slice(2), ROOT).href;
    for (const cand of [bare + ".ts", bare + ".tsx", bare + "/index.ts", bare]) {
      try {
        return await next(cand, context);
      } catch {
        /* sıradaki adayı dene */
      }
    }
  }
  return next(specifier, context);
}

/**
 * TypeScript/bundler `import x from "./a.json"` yazabilir; Node ESM ise
 * `with { type: "json" }` ister. i18n zinciri messages/*.json içe aktardığı için
 * bu olmadan test yüklenemiyor. Çözümleyicide niteliği biz ekliyoruz.
 */
export async function load(url, context, next) {
  if (url.endsWith(".json")) context = { ...context, importAttributes: { ...context.importAttributes, type: "json" } };
  return next(url, context);
}

/* --import ile çağrıldığında kendini kancaya takar. */
register(import.meta.url);
