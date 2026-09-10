# Arşiv — silinmedi, karar bekliyor

Buradaki dosyaların hiçbiri kodda referanslanmıyor (tarama: 10 Eyl 2026).
SİLİNMEDİ, taşındı. Silme kararı işletmeye ait.

`public/` DIŞINDA duruyor: public altında olsaydı internete açık olurdu.

## kok-kareler/ — 68 dosya, ~11 MB
Repo köküne düşmüş test kareleri (`1440-*.png`, `390-*.png`, `f5-*.png`).
Bunlar e2e testlerinin ÜRETTİĞİ çıktılar; testler bunları her koşuda yeniden yazıyor,
saklanmalarına gerek yok. Kalıcı kareler `docs/screens/` altında duruyor.

## eski-assets/ — 10 dosya
`assets/cut` ve `assets/hero`: `public/` altındaki dosyaların birebir kopyasıydı.
Aynı görselin iki yerde durması senkron sorunu doğuruyordu (menü düzeltmesinde
biri güncellenip diğeri eski kalabilirdi).

## brand/ — 3 dosya
`mag-logo-lime.png`, `mag-wordmark-cream.png`, `mag-wordmark-lime.png`:
kodda hiç kullanılmıyor. Marka varlığı oldukları için silmedim.

## olu-kod/ — 1 dosya
`CrossFade.tsx` (37 satır): hiçbir yerden import edilmiyor.

## Arşive ALINMAYANLAR (kullanılıyor)
- `assets/og/*.png` — OG görseli üretiminde dinamik okunuyor (`app/api/og/route.tsx`)
- `assets/fonts/*.ttf` — Satori woff2 okumuyor, OG için TTF şart
