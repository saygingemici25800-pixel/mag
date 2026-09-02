# MAG STREET FOOD — Görsel Üretim Promptları (ChatGPT / GPT Image)

Bu dosya, siteyi tamamlamak için eksik olan tüm kareleri üretmek üzere hazırlandı.
Sıra önemli: **önce stil bloğunu kopyala, sonra ürün satırını altına yapıştır.**

> **Dürüst not:** Ürünün kendisini gösteren kareleri (burger, taco, noodle) AI ile üretip
> "bizim ürünümüz" diye yayınlamak müşteriyi yanıltır — gelen tabak fotoğraftakine benzemezse
> yorum puanı da bundan etkilenir. **Ürün kareleri için gerçek çekim** kullan; AI'yı
> **katman/malzeme/doku görselleri** ve **arka plan-atmosfer** için kullan. Aşağıda ikisi de var,
> ama A bölümündekiler ancak "geçici yer tutucu" olarak kullanılmalı.

---

## 0. STİL BLOĞU — her promptun başına yapıştır

```
Photographic style reference: high-end studio food photography, single subject
isolated on a pure black background, warm amber backlight glowing from directly
behind the subject, soft pearly white rim light on the left edge, tungsten key
light from above, deep shadow falling off toward the base, rich golden-brown
tones, glossy highlights, no props, no plate, no table, no text, no logo,
no hands, shot on 100mm macro, f/5.6, tack sharp, ultra detailed texture,
3:2 landscape, subject fills 80% of the frame, centered.
```

Ek olarak: **elindeki `1-smooky` karesini her seferinde referans görsel olarak yükle**
("match the lighting and background of this reference image"). Tutarlılığı en çok bu sağlıyor.

---

## A. EKSİK ÜRÜN KARELERİ (yer tutucu — gerçek çekim gelene kadar)

Elimizde 5 ürünün fotoğrafı var: SMOOKY, BRISKET, MAG BERRY, JALAPENO, MAG CAESAR.
Eksik olanlar:

### A1 — MAG ORJİNAL (520 TL)
```
[STİL BLOĞU] + A single cheeseburger in a glossy brioche bun, one 130g beef
patty, melted cheddar draping over the edge, crispy fried onion strings
spilling out, creamy pale MAG sauce visible at the seam, side view at plate
level, bun top slightly domed and buttered.
```

### A2 — TRUFFLE & MUSH (550 TL)
```
[STİL BLOĞU] + A single burger in a glossy brioche bun, one 130g beef patty,
dark earthy mushroom duxelles spread thickly over the patty, melted cheddar,
a pale truffle mayonnaise drip at the seam, a few translucent pickled onion
rings peeking out, side view at plate level.
```

### A3 — MAG ÇITIR (490 TL)
```
[STİL BLOĞU] + Golden panko-crusted crispy chicken pieces piled in a loose
heap, deeply craggy crunchy coating, a glossy red sweet chili sauce drizzled
over the top, a few thin potato chips tucked between the pieces, no bowl,
no basket, the pile floating on black.
```

### A4 — TAVUK TACO (450 TL)
```
[STİL BLOĞU] + Two soft flour tortilla tacos standing side by side, filled
with sautéed spiced chicken strips, shredded iceberg lettuce, grated gruyère,
sliced avocado, and a chipotle mayo drizzle, tortillas lightly charred.
```

### A5 — TİFTİK TACO (530 TL)
```
[STİL BLOĞU] + Two soft flour tortilla tacos, filled with slow-cooked pulled
brisket with dark caramelized bark, chopped parsley and onion, melted cheddar,
smoked pepper aioli drizzle, tortillas lightly charred.
```

### A6 — KARİDESLİ TACO (520 TL)
```
[STİL BLOĞU] + Two soft flour tortilla tacos filled with butter-sautéed pink
shrimp, crunchy white cabbage slaw, avocado slices, chipotle mayo, scallion
slivers on top.
```

### A7 — TAVUKLU NOODLE (450 TL)
```
[STİL BLOĞU] + A tangle of glossy wok-fried wheat noodles lifted mid-air with
chopsticks, chicken breast strips, julienned carrot, scallion, red kapia
pepper, ginger, soy glaze, toasted sesame seeds, steam rising, no bowl visible.
```

### A8 — KARİDESLİ NOODLE (550 TL)
```
[STİL BLOĞU] + A tangle of glossy wok-fried noodles with plump pink shrimp,
julienned carrot, scallion, red kapia pepper, ginger, soy glaze, sesame seeds,
steam rising, no bowl visible.
```

### A9 — PATATES (300 / 350 TL) — iki varyant
```
[STİL BLOĞU] + A tall heap of thick-cut hand-made french fries, rough
irregular edges, golden crisp exterior, fluffy interior visible on a broken
fry, coarse salt crystals, no basket, no paper.
```
```
[STİL BLOĞU] + The same thick-cut hand-made fries, showered with finely
grated parmesan and chopped parsley, a light dusting still falling.
```

### A10 — İÇECEKLER
```
[STİL BLOĞU] + A single frosted glass of Turkish ayran with a thick foam head,
condensation beads running down the glass.
```
```
[STİL BLOĞU] + A tall glass bottle of artisanal ginger soda, amber liquid,
rising bubbles, condensation, unlabelled bottle.
```

---

## B. KATMAN GÖRSELLERİ — asıl istediğin kısım

Site scroll'unda her burger "sökülüp" katman katman anlatılacak. Her katman için
**tek malzemenin** izole, siyah zeminli, aynı ışıkta bir karesi gerekiyor.
Bunlar AI ile güvenle üretilebilir — çünkü genel malzeme görseli, ürün iddiası değil.

**Katman stil eki** (stil bloğunun sonuna ekle):
```
+ single ingredient only, nothing else in frame, floating in mid-air with a
soft shadow beneath, no bun, no burger, no plate, macro detail, 1:1 square.
```

### SMOOKY (620 TL)
| # | Katman | Prompt gövdesi |
|---|--------|----------------|
| 1 | 130 gr köfte | `a single thick hand-formed 130g beef patty, deeply seared crust, charred edges, juices glistening, slight smoke haze` |
| 2 | Füme kaburga | `three strips of smoked beef short rib, dark mahogany bark, rendered fat marbling, glossy` |
| 3 | Karamelize soğan | `a small tangle of deeply caramelized onions, dark amber, glossy, strands separating` |
| 4 | Cheddar | `a slice of cheddar mid-melt, stretching and draping, molten orange, one long cheese pull` |
| 5 | Iceberg marul | `a few crisp pale iceberg lettuce leaves, water droplets, translucent edges` |
| 6 | Tütsü biberli aioli | `a thick swirl of smoky pepper aioli, pale peachy orange, glossy, one drip falling` |

### BRISKET (600 TL)
| # | Katman | Prompt gövdesi |
|---|--------|----------------|
| 1 | Ağır ateşte tiftik et | `a mound of slow-cooked pulled brisket, dark caramelized bark mixed with tender pink-edged strands, steam` |
| 2 | Karamelize soğan | `deeply caramelized onion strands, dark amber, glossy` |
| 3 | Cheddar | `a slice of cheddar mid-melt, molten orange, draping` |
| 4 | Tütsü biberli aioli | `a swirl of smoky pepper aioli, glossy, dripping` |
| 5 | **Soğan turşusu** | `a small pile of bright magenta pickled red onion rings, translucent, glistening with brine, a few loose rings falling` |

### MAG BERRY (550 TL)
| # | Katman | Prompt gövdesi |
|---|--------|----------------|
| 1 | 130 gr köfte | `a thick seared beef patty, charred crust, juices` |
| 2 | Karamelize vişne | `a spoonful of caramelized sour cherries in dark glossy syrup, whole cherries glistening, one drip falling` |
| 3 | Gravyer peyniri | `a wedge and shavings of aged gruyère, pale golden, crystalline texture, one melting piece` |

### JALAPENO (520 TL)
| # | Katman | Prompt gövdesi |
|---|--------|----------------|
| 1 | 130 gr köfte | `a thick seared beef patty, charred crust` |
| 2 | Jalapeno sos | `a pool of bright green jalapeño sauce, glossy, flecks of pepper and seed visible, one drip` |
| 3 | Cheddar | `a slice of cheddar mid-melt, molten orange` |
| 4 | Çıtır soğan | `a nest of golden crispy fried onion strings, shatteringly crisp, a few strands breaking away` |
| 5 | Roka | `a small handful of fresh wild rocket leaves, deep green, jagged, one leaf drifting` |

### TRUFFLE & MUSH (550 TL)
| # | Katman | Prompt gövdesi |
|---|--------|----------------|
| 1 | 130 gr köfte | `a thick seared beef patty, charred crust` |
| 2 | Mantar düxelles | `a dark rustic mound of finely chopped mushroom duxelles, earthy brown, glossy with butter, visible thyme` |
| 3 | Trüflü mayonez | `a thick swirl of truffle mayonnaise, ivory white with black truffle flecks, glossy peak` |
| 4 | Cheddar | `a slice of cheddar mid-melt, molten orange` |
| 5 | **Soğan turşusu** | `bright magenta pickled onion rings, translucent, glistening with brine, a few rings falling through frame` |

### MAG CAESAR (490 TL)
| # | Katman | Prompt gövdesi |
|---|--------|----------------|
| 1 | Panelenmiş tavuk | `a single golden panko-breaded chicken fillet, craggy crunchy crust, steam, one crumb falling` |
| 2 | Marul | `crisp romaine lettuce leaves, deep green ribs, water droplets` |
| 3 | Gravyer | `shavings of aged gruyère falling through frame, pale golden` |
| 4 | MAG sos | `a thick swirl of creamy pale house sauce, glossy, one drip falling` |

### MAG ORJİNAL (520 TL)
| # | Katman | Prompt gövdesi |
|---|--------|----------------|
| 1 | 130 gr köfte | `a thick seared beef patty, charred crust` |
| 2 | Kıtır soğan | `a nest of golden crispy fried onion strings` |
| 3 | Cheddar | `a slice of cheddar mid-melt` |
| 4 | MAG sos | `a thick swirl of creamy pale house sauce, glossy, dripping` |

### ORTAK KATMANLAR (bir kere üret, her yerde kullan)
```
[STİL BLOĞU + KATMAN EKİ] + a glossy brioche bun top, deeply golden, buttered
and pan-seared flat on the cut side, slight steam.
```
```
[STİL BLOĞU + KATMAN EKİ] + four small glass jars of sauce standing in a row:
truffle mayonnaise, green jalapeño, red sweet chili, and pale house sauce,
unlabelled, glossy contents visible.
```
```
[STİL BLOĞU + KATMAN EKİ] + a mound of freshly ground raw beef mince, coarse
grind, deep red with white fat flecks, cold and fresh looking.
```

---

## C. TEKNİK NOTLAR (üretirken uy)

- **Oran:** ürün kareleri `3:2 yatay`, katman kareleri `1:1 kare`.
- **Çözünürlük:** en az 1536 px uzun kenar. Siteye küçülterek koyacağız, büyütmek olmuyor.
- **Arka plan:** siyah bırak. Ben zaten fondan kesip site ışığına oturtuyorum; şeffaf PNG
  istersen "on a pure white background, product isolated, clean edges" de işe yarar —
  ama siyah zemin bizim ışıkla daha iyi uyuşuyor.
- **Negatif liste** (prompt sonuna ekle): `no text, no watermark, no logo, no hands,
  no plate, no cutting board, no wooden table, no restaurant background, not cartoon,
  not illustration, no plastic look`.
- **Tutarlılık:** her yeni istekte referans olarak `1-smooky.jpg` karesini yükle ve
  "same lighting, same background, same camera angle" de. Tek tek üretirsen ışık kayıyor.
- **Varyasyon:** her karede 4 seçenek üret, en az yağlı/plastik görünenini seç. AI et
  dokusunu abartıyor — "not overly glossy, natural food texture" ekle.

## D. DOSYA ADLANDIRMA (bana böyle gönder)

```
urun/smooky.jpg            urun/brisket.jpg        urun/mag-berry.jpg
urun/jalapeno.jpg          urun/mag-caesar.jpg     urun/mag-orjinal.jpg
urun/truffle-mush.jpg      urun/mag-citir.jpg
taco/tavuk.jpg  taco/tiftik.jpg  taco/karides.jpg
noodle/tavuklu.jpg  noodle/karidesli.jpg
yan/patates.jpg  yan/patates-parmesan.jpg  yan/soslar.jpg
icecek/ayran.jpg  icecek/zencefilli-gazoz.jpg

katman/smooky-01-kofte.jpg ... katman/smooky-06-aioli.jpg
katman/brisket-05-sogan-tursusu.jpg
katman/truffle-05-sogan-tursusu.jpg
ortak/brioche.jpg  ortak/soslar.jpg  ortak/kiyma.jpg
```

Bu isimlendirmeyle gelirse hepsini tek seferde siteye bağlarım.
