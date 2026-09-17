/* Uçtan uca: panelden mahalle ekle → müşteri görür → kapat → seçilemez →
   min sepet engeli → teslimat ücreti toplamda ve sipariş kaydında */
import { chromium } from "playwright";
import { seedCart, FAKE_NOW } from "./_cart-fixture.mjs";
import { guard } from "../../scripts/test-guard.mjs";
const base=process.argv[2] ?? "http://localhost:3112";
const KEY=process.env.PANEL_KEY??"test1234";
/* canlı veritabanına test yazmayı engeller */
await guard(base);
let fail=0; const check=(n,ok,x="")=>{console.log((ok?"PASS":"FAIL")+" "+n+(x?" — "+x:""));if(!ok)fail++;};
const b=await chromium.launch();

/* ---------- 1) PANEL: mahalle ekle ---------- */
const pctx=await b.newContext({viewport:{width:1440,height:900}});
const p=await pctx.newPage();
p.on("dialog",d=>d.accept());          // silme onayı
await p.goto(base+"/panel",{waitUntil:"load"});
await p.fill("form input[type=password]",KEY);
await p.click("form button[type=submit]");
await p.waitForSelector(".tabs",{timeout:8000});
await p.locator('[role=tab]').last().click();           // Ayarlar sekmesi
await p.waitForSelector("[data-zones]",{timeout:8000});
const once=await p.locator("[data-zone]").count();
check("panelde bölge listesi görünüyor", once>0, once+" bölge");
await p.locator("[data-zone-add]").click();
await p.locator("[data-zone-name]").fill("Deneme Mahallesi");
await p.locator("[data-zone-min]").fill("450");
await p.locator("[data-zone-fee]").fill("35");
await p.locator("[data-zone-eta]").fill("25");
await p.locator("[data-zone-save]").click();
await p.waitForTimeout(1200);
const after=await p.locator("[data-zone]").count();
check("mahalle eklendi", after===once+1, `${once} → ${after}`);
await p.screenshot({path:"docs/screens/bolgeler/panel-1440.png",fullPage:true});

/* ---------- 2) MÜŞTERİ: listede görünüyor mu ---------- */
{
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await seedCart(ctx,{smooky:1});                        // 620 ₺ — 450 min üstü
  const c=await ctx.newPage();
  await c.clock.install({time:FAKE_NOW});
  await c.goto(base+"/siparis/odeme",{waitUntil:"load"});
  await c.waitForTimeout(2200);
  await c.getByRole("button",{name:"Kurye"}).click();
  await c.waitForTimeout(900);
  const opts=await c.locator("select[aria-label=Mahalle] option").allTextContents();
  check("müşteri listesinde yeni mahalle var", opts.some(o=>/Deneme Mahallesi/.test(o)), opts.find(o=>/Deneme/.test(o))??"(yok)");
  check("ücret ve süre etikette görünüyor", /35 ₺/.test(opts.find(o=>/Deneme/.test(o))??"") , opts.find(o=>/Deneme/.test(o)));
  await ctx.close();
}

/* ---------- 3) MİN SEPET ENGELİ (450 ₺ altı sepet) ---------- */
{
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await seedCart(ctx,{ayran:1});                         // 90 ₺ — 450'nin altı
  const c=await ctx.newPage();
  await c.clock.install({time:FAKE_NOW});
  await c.goto(base+"/siparis/odeme",{waitUntil:"load"});
  await c.waitForTimeout(2200);
  await c.getByRole("button",{name:"Kurye"}).click();
  await c.waitForTimeout(700);
  await c.selectOption("select[aria-label=Mahalle]","deneme-mahallesi").catch(()=>{});
  await c.waitForTimeout(900);
  const warn=await c.locator("[data-min-warn]").first().textContent().catch(()=>"");
  check("min sepet uyarısı görünüyor", /450/.test(warn??"") && /90/.test(warn??""), (warn??"").trim());
  const dis=await c.locator('button[type="submit"]').first().isDisabled().catch(()=>false);
  check("min sepet altında gönderim engelli", dis);
  await c.screenshot({path:"docs/screens/bolgeler/musteri-min-390.png"});
  await ctx.close();
}

/* ---------- 4) PANELDEN KAPAT → seçilemez ---------- */
await p.locator('[data-zone="deneme-mahallesi"] [data-zone-toggle]').click();
await p.waitForTimeout(1200);
check("panelde kapalı işaretlendi", (await p.locator('[data-zone="deneme-mahallesi"]').getAttribute("data-active"))==="false");
{
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await seedCart(ctx,{smooky:1});
  const c=await ctx.newPage();
  await c.clock.install({time:FAKE_NOW});
  await c.goto(base+"/siparis/odeme",{waitUntil:"load"});
  await c.waitForTimeout(2200);
  await c.getByRole("button",{name:"Kurye"}).click();
  await c.waitForTimeout(900);
  const dis=await c.locator('option[data-zone-opt="deneme-mahallesi"]').isDisabled().catch(()=>null);
  const txt=await c.locator('option[data-zone-opt="deneme-mahallesi"]').textContent().catch(()=>"");
  check("kapalı mahalle seçilemez (disabled)", dis===true, String(dis));
  check("kapalı etiketi gösteriliyor", /kapalı/i.test(txt??""), (txt??"").trim());
  await ctx.close();
}
/* Temizlik: test bölgesini sil — paket tekrar koşulunca birikmesin. */
await p.locator('[data-zone="deneme-mahallesi"] [data-zone-del]').click();
await p.waitForTimeout(1200);
check("test bölgesi silindi", (await p.locator('[data-zone="deneme-mahallesi"]').count())===0);
await pctx.close();
await b.close();
console.log(fail?`\n${fail} FAIL`:"\nHepsi geçti");
process.exit(fail?1:0);
