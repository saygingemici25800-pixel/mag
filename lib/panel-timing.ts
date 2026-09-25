/**
 * Panel zamanlama sabitleri — TEK KAYNAK.
 *
 * Neden ayrı dosya: bu değerleri hem panel arayüzü (PanelApp, "use client")
 * hem de e2e testleri okumak zorunda. PanelApp bir React istemci bileşeni;
 * düz `node` ile koşan testlere onu içe aktarmak tüm React ağacını sürükler.
 * Bu modülün HİÇBİR bağımlılığı yok, iki taraf da güvenle okuyabiliyor.
 *
 * 25 Eyl 2026: faz5 testi siparişin panele düşmesi için 5 sn bekliyordu, ama
 * yoklama aralığı 15 sn — yerelde (realtime yokken) kart 5 sn'de ASLA gelemez,
 * test her koşuda düşüyordu. Süreyi teste sabit yazmak yerine sabit buraya
 * taşındı: aralık değişirse test kendiliğinden uyum sağlar.
 */

/** Realtime kopukken yedek yoklama aralığı (spec: 15 sn). */
export const POLL_FALLBACK_MS = 15_000;

/**
 * Bir siparişin panelde görünmesi için beklenecek ÜST SINIR.
 *
 * Yoklamanın 1.3 katı: tam aralık kadar beklemek sınırda kalıyor (istek tam
 * dolarken gelirse bir tur daha gerekiyor), pay bırakılıyor. Testler bu değeri
 * kullanır; kimse elle süre yazmaz.
 */
export const PANEL_ORDER_WAIT_MS = Math.round(POLL_FALLBACK_MS * 1.3);
