# MAG STREET FOOD — Web Sitesi Spec (v1)

> Bu dosya Claude Code'a verilecek tek kaynak. Karar verilmiş her şey burada; "AÇIK" işaretli
> satırlar işletmeden gelecek girdiler — kod onlarsız da ilerler, placeholder kullanılır.

---

## 0. Tek paragrafta proje

Fethiye'deki MAG Street Food (Google 4,6 · 535 yorum) için **statik, sinematik, mobil öncelikli**
bir site. Ana sayfa ciaoenergy.com'un scroll kurgusunun burgere uyarlanmış hali: tek sahnede
kaydırdıkça ilerleyen bir film. Ayrı bir **sipariş sayfası** var: gel-al veya kurye, mahalleye
göre minimum sepet. Siparişler işletme sahibinin **canlı paneline** sesli uyarı ve bildirimle
düşer. **Ödeme entegrasyonu en son faz** — o gelene kadar "teslimatta öde".

Referans prototip: `proto/proto.html` (bu paketin içinde). **Animasyon matematiği oradan birebir
taşınacak**, yeniden icat edilmeyecek. Prototip tarayıcıda açılıp yan yana karşılaştırılacak.

---

## 1. Kilitlenmiş kararlar

| Konu | Karar |
|---|---|
| Referans | ciaoenergy.com — kurgu birebir, içerik burger |
| Stack | Next.js (App Router) + TypeScript + Tailwind · Vercel · GitHub auto-deploy · Cloudflare DNS · pnpm |
| Dil | TR varsayılan, EN `/en` altında. Tüm metinler tek `messages/*.json` içinde |
| Görseller | Ek çekim yok. 5 burger fotoğrafı fondan kesilmiş (WebP, `assets/cut/`). Eksikler ChatGPT ile üretilecek (promptlar `promptlar/`) |
| Foto standardı | Siyah zemin + sıcak turuncu backlight + sol pearly rim. Referans `assets/hero/1-smooky.jpg` |
| Hero | 5 burger tek sıra, her biri **bir kez**, oklar burgerin iki yanında, **fiyat yok** |
| Sayfa sonu | BİZE KATIL yukarı süzülürken burger alttan senkron gelir → hero pozu → yanlar siluet olarak belirir → görünmez kesmeyle başa döner (preloader tekrar oynamaz) |
| Sipariş | Gel-al **ve** kurye. Kuryede mahalle bazlı minimum sepet, bilgi butonu ile görünür |
| Bildirim | `/panel` — canlı sipariş listesi, sesli uyarı, tarayıcı push bildirimi |
| Ödeme | **Faz 4.** İlk yayın: teslimatta nakit/kart. Sonra iyzico hosted checkout |
| Fotoğraf↔ürün | koyu sos = MAG BERRY · füme şerit = SMOOKY · pembe turşu = BRISKET · roka = JALAPENO · panelenmiş tavuk = MAG CAESAR |

---

## 2. Repo yapısı

```
mag-site/
  app/
    (site)/
      layout.tsx            # topbar, köşe braketleri, dil anahtarı
      page.tsx              # ANA SAYFA — sinematik sahne (bölüm 4)
      siparis/page.tsx      # SİPARİŞ — menü + sepet + teslimat (bölüm 6)
      siparis/[id]/page.tsx # sipariş takip
      yasal/[slug]/page.tsx # kvkk · mesafeli-satis · iade · cerez
    en/...                  # aynı ağaç, EN
    panel/page.tsx          # işletme paneli (auth'lu)
    api/
      orders/route.ts       # POST sipariş oluştur
      orders/[id]/route.ts  # PATCH durum
      push/subscribe/route.ts
  components/
    stage/                  # Stage.tsx, useScrollProgress.ts, Arc.tsx, Claims.tsx, Outro.tsx …
    order/                  # MenuGrid, Cart, DeliveryPicker, MinCartInfo, Checkout
    panel/                  # OrderFeed, OrderCard, SoundAlert
  lib/
    menu.ts                 # ÜRÜN VERİSİ (bölüm 5) — tek kaynak
    zones.ts                # teslimat bölgeleri + min sepet
    supabase.ts
    i18n.ts
  messages/tr.json, en.json
  public/assets/cut/*.webp  public/assets/hero/*.jpg  public/assets/katman/*
  proto/proto.html          # referans prototip — dokunma, karşılaştır
  supabase/migrations/
```

Kurallar: `pnpm build` yeşil olmadan push yok. Lighthouse mobil ≥ 90 (perf/a11y/SEO).
Görseller `next/image`, cutout'lar `priority`. Font: Archivo (900 italic display) + DM Mono.

---

## 3. Görsel sistem

```
--char:#0C0A08  --cream:#F2ECE3  --dim:#988D80
--kraft:#C89A63 --ember:#E2591F  --denim:#6F87A6  --gold:#D8B15E
ürün aksanları: smooky #E2591F · brisket #C89A63 · berry #8E3B52 · jalapeno #7E9B57 · caesar #D8B15E
```
- Zemin her zaman `--char`; manifesto bölümünde ürün aksanının %62 beyaza karışmış parlak tonu.
- Marka: küçük harf italik **mag.** — nokta ürün aksanı rengini alır.
- HUD: sol üst "AÇIK" + animasyonlu eq çubukları; sağ üst `::` MENÜ + beyaz İLETİŞİM pill; dört köşe braket; sol/sağ dikey harfler (ürün adı / FETHİYE).
- Ok butonları: 52px daire, 1px krem %30 çerçeve, buzlu cam, hover'da krem dolgu; altında "önceki/sonraki" mono etiket.
- Sahne ışığı: `.aura` sıcak elips backlight (odaktaki ürünün arkasında), `.floor` parlak zemin, `.toplight`, `.vign`.
- Her ürün: cutout `<img>` + `.refl` aynalanmış yansıma (maskeli, 1px blur) + `.shad` zemin gölgesi.

---

## 4. Ana sayfa — scroll kurgusu

`.scroller` 1200vh, `.stage` fixed. `p = scrollY / max`, rAF ile `cur += (target-cur)*0.12`.
Bölüm sınırları (prototipteki `S` nesnesi, **aynen**):

```
fan   .04–.16   yelpaze açılır (spacing ×1.16, rot t*4.4)
dive  .16–.28   odaktaki ürün sağa büyür (×2.25), diğerleri kenardan çıkar; sol kopya + ikon rayı
c0–c3 .28–.62   4 iddia (üstü çizili rozet → büyük başlık → açıklama), ürün koyulaşır (br .34)
pay   .62–.72   manifesto: zemin parlak aksana döner, dev italik "ATEŞ VE ET" ürünün ARKASINDA
range .72–.80   tüm ürünler küçük dizilir (rsp = min(vw*.135,150))
faq   .80–.87   SSS paneli
foot  .87–.905  BİZE KATIL + telif + sosyal bar; burger barın ALTINDAN ucunu gösterir
out1  .905–.958 bar+yazı yukarı (translateY −.78vh·smooth), burger alttan aynı eğriyle ortaya
out2  .958–.990 yanlar siluet (br .05 → tam), ortadan dışa açılır, başlık+oklar döner
hold  .990–1    p=1 karesi == p=0 karesi (piksel farkı ≈0) → atEnd && cur>.9985 → scrollTo(0)
```

Hero dizilim: `spacing = min(vw*.28, 460)`, `x = t*spacing`, `y = baseY + a²·13`, `sc = 1 − a·.185`
(odak ×1.14), `br = 1 − a·.24`, `bl = (a−1.6)·1.4`. `baseY = vh*.40`. Plint `top = baseY + ch·1.09`.
Oklar: `x = ±(odak genişliği/2 + 44px)`, `y = baseY + ch·.57`.

Karusel: 5 slot, `slot i → MENU[(active + i − CENTER) mod N]`; ok/klavye/sürükleme `active` döndürür,
`paint()` yalnızca değişen slotların `src`'ini yeniler. **Hiçbir ürün iki kez görünmez.**

Mobil (<900px): dive'da ürün ortada ×1.95; sol kopya altta, arkasında okunurluk perdesi
(`.left::before` gradient); oklar 40px; sideL/sideR gizli; `.tag` gizli.

Erişilebilirlik: `prefers-reduced-motion` → scroll-driven sahne yerine statik kartlar (basit fallback).

### 4.1 İçerik — iddialar (CLAIMS)
| üstü çizili | başlık | açıklama |
|---|---|---|
| donmuş köfte | 130 GR KIYMA | Her burgerde 130 gr köfte var. Kıymayı her sabah kendimiz çekiyoruz, dünden kalanı tezgâha çıkmıyor. |
| market ekmeği | GÜNLÜK BRIOCHE | Ekmek her gün taze geliyor, siparişte tereyağında tavada mühürleniyor. |
| tek tip peynir | CHEDDAR & GRAVYER | Menüde iki gerçek peynir var: cheddar ve gravyer. Kaplama peynir kullanmıyoruz. |
| hazır sos | DÖRT EV SOSU | Trüflü mayonez, jalapeno, sweet & chili ve MAG sos. Dördü de mutfakta yapılıyor, yanına 50 ₺. |

**AÇIK:** bu 4 iddia işletmeyle doğrulanacak (kıyma günlük mü, ekmek nereden, sos tarifleri).

### 4.2 SSS
Paket servis ve gel-al var mı? · Burgerlerin yanında patates geliyor mu? · Sosları ayrı isteyebilir
miyim? · Taco ve noodle da yapıyor musunuz? · Kaçta kapanıyorsunuz? — **AÇIK:** cevaplar.

### 4.3 Footer
BİZE KATIL (e-posta) → telif → sosyal bar: [TikTok] Yasal Bilgiler · Mesafeli Satış · KVKK · Çerezler [Instagram].
**AÇIK:** TikTok/Instagram URL'leri.

---

## 5. Ürün verisi (`lib/menu.ts`) — menüden birebir

```ts
export const MENU = {
  burger: [ // hepsi patates kızartması dahil
    { id:"smooky",   name:"Smooky",        price:620, accent:"#E2591F", hero:true,
      desc:"130 gr burger köftesi, füme kaburga, karamelize soğan, cheddar, iceberg marul, tütsü biberli aioli",
      layers:["ust-ekmek","aioli","iceberg","cheddar","fume-kaburga","karamelize-sogan","kofte","alt-ekmek"] },
    { id:"brisket",  name:"Brisket",       price:600, accent:"#C89A63", hero:true,
      desc:"Ağır ateşte pişmiş tiftik et, karamelize soğan, cheddar, tütsü biberli aioli, soğan turşusu" },
    { id:"berry",    name:"Mag Berry",     price:550, accent:"#8E3B52", hero:true,
      desc:"Karamelize vişne, gravyer peyniri, 130 gr burger köftesi" },
    { id:"jalapeno", name:"Jalapeno",      price:520, accent:"#7E9B57", hero:true,
      desc:"Jalapeno sos, cheddar, çıtır soğan, 130 gr burger köftesi, roka" },
    { id:"caesar",   name:"Mag Caesar",    price:490, accent:"#D8B15E", hero:true,
      desc:"Mag sos, marul, gravyer, panelenmiş tavuk" },
    { id:"orjinal",  name:"Mag Orjinal",   price:520, desc:"Mag sos, kıtır soğan, cheddar, 130 gr burger köftesi" },            // foto yok
    { id:"truffle",  name:"Truffle & Mush",price:550, desc:"130 gr burger köftesi, mantar düxelles, trüflü mayonez, cheddar, soğan turşusu" }, // foto yok
    { id:"citir",    name:"Mag Çıtır",     price:490, desc:"Panelenmiş tavuk parçaları, cips, sweet chili sos" },            // foto yok
  ],
  taco: [ // 2 adet
    { id:"tavuk-taco",   name:"Tavuk Taco",    price:450, desc:"Sotelenmiş baharatlı tavuk, iceberg marul, gravyer peyniri, avokado, chipotle mayo" },
    { id:"tiftik-taco",  name:"Tiftik Taco",   price:530, desc:"Ağır ateşte pişmiş tiftik et, maydanoz & soğan, cheddar, tütsü biberli aioli" },
    { id:"karides-taco", name:"Karidesli Taco",price:520, desc:"Tereyağında sotelenmiş karides, lahanaslaw, avokado, chipotle mayo, taze soğan" },
  ],
  noodle: [
    { id:"tavuklu-noodle",  name:"Tavuklu",   price:450, desc:"Tavuk göğsü, taze soğan, havuç, zencefil, kapya biber, soya sos, susam" },
    { id:"karidesli-noodle",name:"Karidesli", price:550, desc:"Karides, taze soğan, havuç, zencefil, kapya biber, soya sos, susam" },
  ],
  yan: [
    { id:"patates",          name:"Patates kızartması (el yapımı)", price:300 },
    { id:"patates-parmesan", name:"Patates kızartması (parmesanlı)", price:350 },
  ],
  sos: [ // 50 ₺
    { id:"truflu-mayonez", name:"Trüflü mayonez", price:50 }, { id:"jalapeno-sos", name:"Jalapeno", price:50 },
    { id:"sweet-chili",    name:"Sweet & chili",  price:50 }, { id:"mag-sos",      name:"Mag sos",  price:50 },
  ],
  icecek: [
    { id:"ayran", name:"Arslan ayran", price:90 }, { id:"icecekler", name:"İçecekler", price:110 },
    { id:"su", name:"Su", price:50 },              { id:"soda", name:"Soda", price:70 },
    { id:"zencefilli-gazoz", name:"Zencefilli gazoz", price:190 }, { id:"alkolsuz-bira", name:"Alkolsüz bira", price:190 },
  ],
};
```
**AÇIK:** "İçecekler 110" hangi ürünler (kola/fanta vb.)? · Alerjen bilgisi · EN çevirileri.

---

## 6. Sipariş sayfası (`/siparis`)

Tasarım dili ana sayfayla aynı (koyu, mono HUD, italik başlıklar) ama **kaydırma normal**, hız öncelikli.

**Akış:**
1. Üstte segment: **Gel-al** | **Kurye**.
2. Kurye seçilince mahalle seçici + yanında **ⓘ butonu** → modal: "Minimum sepet tutarları" tablosu.
3. Menü kategoriler (Burger · Taco · Noodle · Yan · Sos · İçecek) — ürün kartı: cutout görsel varsa o, yoksa isim tipografik kart. Adet ±, not alanı.
4. Sepet çekmecesi (mobilde alttan): satırlar, ara toplam, kurye ise "min sepet: X ₺ — Y ₺ daha ekle" uyarısı (kırmızı değil, kraft).
5. Bilgiler: ad, telefon, (kurye ise) adres + mahalle, istenen saat (şimdi / 30 dk aralıklar, kapanış 00:00'a kadar), not.
6. Onay → `POST /api/orders` → `/siparis/[id]` takip sayfası (durum: alındı → hazırlanıyor → hazır/yolda → teslim).

**Teslimat bölgeleri (`lib/zones.ts`)** — örnek, **AÇIK: tam liste + ücretler**:
```ts
export const ZONES = [
  { id:"merkez",   name:"Fethiye Merkez",  minCart:800,  fee:0 },
  { id:"oludeniz", name:"Ölüdeniz",        minCart:1500, fee:0 },
  // Çalış, Karagözler, Hisarönü, Ovacık, Çiftlik … işletmeden gelecek
];
```
Ödeme faz 4'e kadar: "Teslimatta nakit / kart" radio, seçilen sipariş kaydına yazılır.

Validasyon: telefon TR formatı; kurye + min sepet altı → buton pasif; kapalı saatlerde
(00:00–11:00 **AÇIK: açılış saati**) sipariş alınmaz, "yarın 11:00'da açılıyoruz" mesajı.

---

## 7. Panel (`/panel`) ve bildirim

- Supabase `orders` tablosu: id, created_at, type(pickup|delivery), zone, items(json), subtotal, fee, total,
  name, phone, address, requested_at, note, payment(cod|card_on_delivery|online), status.
- Panel: Supabase Auth (tek e-posta/şifre, işletme sahibi). Realtime abonelik → yeni sipariş kartı **üstte, aksan renginde yanıp söner**, **ses** (`/sounds/order.mp3`, kullanıcı bir kez "sesi aç"a basınca autoplay kilidi açılır), **Web Push** (service worker + VAPID; panel açık olmasa da telefona bildirim).
- Kart: ürünler, adet, not, telefon (tıkla-ara), adres (haritada aç), istenen saat, durum butonları (Hazırlanıyor → Hazır/Yolda → Teslim), iptal + sebep.
- Yedek: yeni siparişte işletme WhatsApp numarasına mesaj (CallMeBot/Twilio — **AÇIK**: hangisi). Faz 3'te.
- Müşteri tarafı: `/siparis/[id]` aynı realtime'ı dinler, durum değişince güncellenir.

---

## 8. Yasal sayfalar

`/yasal/kvkk`, `/yasal/mesafeli-satis`, `/yasal/iade-iptal`, `/yasal/cerez`. Şablon metinler kodda,
**AÇIK: işletme unvanı, vergi no, adres** (Cumhuriyet Mah. Atatürk Cd. No:24 Fethiye) girilecek.
Çerez bandı: sadece gerekli çerezler; analitik yoksa bant yok.

---

## 9. Fazlar ve sıra

| Faz | Kapsam | Bitti sayılır |
|---|---|---|
| **1** | Repo, stack, tasarım tokenları, ana sayfa sahnesi prototipten porte, TR içerik, mobil | Prototiple yan yana aynı; Lighthouse ≥90; loop kesmesiz |
| **2** | `/siparis`: menü, sepet, gel-al/kurye, min sepet ⓘ, form, Supabase kayıt, `/siparis/[id]` | Gerçek sipariş kaydı oluşuyor |
| **3** | `/panel`: auth, realtime akış, ses, Web Push, durum yönetimi; WhatsApp yedek | Telefonda bildirim düşüyor |
| **4** | EN dil, yasal sayfalar, SEO (OG görselleri, schema.org Restaurant + Menu), Vercel + domain | Yayın |
| **5** | iyzico hosted checkout, 3D Secure, sipariş ödeme durumu, iade akışı | Online ödeme |
| sonra | Katman animasyonu (ChatGPT görselleri gelince), eksik 3 burger fotoğrafı, taco/noodle görselleri | — |

Her faz sonunda `pnpm build` + mobil ekran görüntüleri + prototip karşılaştırması.

---

## 10. Claude Code açılış promptu

```
Bu klasörde mag-burger.md spec'i ve proto/proto.html referans prototipi var. Önce ikisini oku.
Faz 1'i yap: Next.js App Router + TS + Tailwind + pnpm ile repo kur; tasarım tokenlarını ve
fontları spec'teki gibi ekle; ana sayfa sinematik sahnesini proto.html'deki matematikle
(S bölüm sınırları, spacing, scale, brightness, outro'nun iki fazı, atEnd loop) React'e taşı —
görselleri public/assets/cut/ altından kullan; lib/menu.ts'i spec'teki veriyle oluştur;
mobil kırılımları uygula. Her adımda pnpm build çalıştır, kırmızıysa push etme. Bitince
1440×860 ve 390×844'te p = 0, .10, .22, .50, .68, .90, .93, .97, 1 için ekran görüntüsü al
ve prototiple farkları listele. Karar gerektiren bir şey çıkarsa spec'teki "AÇIK" maddelerine
bak; orada yoksa sor, varsayma.
```

---

## 11. AÇIK girdiler (işletmeden — kodu bloklamaz)

1. Teslimat mahalleleri tam listesi + her biri için min sepet ve kurye ücreti
2. Açılış saati (kapanış 00:00 biliniyor) ve sipariş alınmayan günler
3. 4 iddianın doğrulanması (kıyma, ekmek, peynir, sos)
4. SSS cevapları
5. TikTok / Instagram / WhatsApp adresleri
6. "İçecekler 110 ₺" içeriği, alerjenler
7. Yasal metinler için unvan / vergi no
8. Alan adı (var mı, kimde) — Cloudflare'e taşınacak
9. EN çeviriler (biz yazarız, işletme onaylar)
10. Eksik 3 burger + taco/noodle/yan/içecek fotoğrafları (promptlar hazır; gerçek çekim tercih)
