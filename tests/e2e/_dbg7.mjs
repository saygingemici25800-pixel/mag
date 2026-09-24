import { chromium } from "playwright";
import { PANEL_KEY as KEY } from "./_cart-fixture.mjs";
const base="http://localhost:3112";
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto(base+"/panel",{waitUntil:"load"});
await p.fill("form input[type=password]",KEY);
await p.click("form button[type=submit]");
await p.waitForSelector(".tabs",{timeout:8000});
await p.locator("[role=tab]").last().click({force:true});
await p.waitForSelector("[data-prices]",{timeout:8000});
for(const v of ["0","-5","abc","","12.5"]){
  await p.locator('[data-price-input="smooky"]').fill(v);
  await p.waitForTimeout(160);
}
await p.locator('[data-price-input="smooky"]').fill("777");
for(const t of [50,100,200,400,800,1500]){
  await p.waitForTimeout(t===50?50:t-(t/2));
  const r=await p.evaluate(()=>({dirty:document.querySelectorAll("[data-price-dirty]").length,
    val:document.querySelector('[data-price-input="smooky"]')?.value,
    saveDis:document.querySelector("[data-price-save]")?.disabled}));
  console.log(String(t).padStart(5)+"ms →",JSON.stringify(r));
}
await b.close();
