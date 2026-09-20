"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { isOpen } from "@/lib/hours";
import { closedShortLabel, todayHoursLabel } from "@/lib/hoursLabel";
import { cartAdd, qtyOf, useCart } from "@/lib/cart";
import { flyToCart, prefetchCartFx } from "@/lib/cartFx";
import { formatPriceFor, itemDesc, itemName } from "@/lib/i18n";
import { MENU, type Category, type MenuItem } from "@/lib/menu";
import { useClockMinute } from "@/lib/useClock";
import CartBar from "./CartBar";
import Upsell from "./Upsell";
import { useSettings } from "@/lib/useSettings";
import Ingredients from "./Ingredients";
import ProductImage from "./ProductImage";
import ProductSheet from "./ProductSheet";
import LegalLinks from "./LegalLinks";
import "./order.css";
import { priceOf } from "@/lib/menu";

const ORDER: Category[] = ["burger", "taco", "noodle", "yan", "sos", "icecek"];

/** /siparis — yapışkan kategori çipleri, büyük ürün kartları, ürün sheet'i, yapışkan sepet çubuğu (mobil öncelikli) */
export default function OrderPage() {
  const t = useT();
  const locale = useLocale();
  const o = t.order;
  const cart = useCart();
  const [sheet, setSheet] = useState<MenuItem | null>(null);
  /* panel ayarları: kapalıysa sipariş yok, tükendi işaretli ürün eklenemez */
  const settings = useSettings();
  const [activeCat, setActiveCat] = useState<Category>("burger");
  const cartHasItems = Object.keys(cart).length > 0;
  const minute = useClockMinute();
  const open = minute < 0 ? null : isOpen(undefined, settings.schedule);
  const chipsRef = useRef<HTMLDivElement>(null);

  /* gsap yalnızca bu rotada yüklenir; boşta arka planda hazırla ki ilk tıklama beklemesin */
  useEffect(() => {
    prefetchCartFx();
  }, []);

  // görünür bölüme göre aktif çip
  useEffect(() => {
    const secs = ORDER.map((c) => document.getElementById(`kat-${c}`)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActiveCat(vis.target.id.replace("kat-", "") as Category);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    secs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    /* 14 Eyl 2026: scrollIntoView KALDIRILDI — SAYFAYI dikeyde de kaydırıyordu.
       `block: "nearest"` bile yeterli değil: yapışkan çip çubuğu kısmen görünür
       durumdayken tarayıcı onu tam görünür yapmak için sayfayı yukarı çekiyor ve
       anchor payını (scroll-margin-top) geri alıyordu. Ölçüldü: #kat-sos ile
       gelince başlık 148 px'te doğru oturuyor, hemen ardından 70 px'e kayıyordu.
       Çözüm: yalnızca ÇUBUĞUN KENDİ yatay kaydırması, sayfaya hiç dokunmadan. */
    const bar = chipsRef.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-cat="${activeCat}"]`);
    if (!bar || !chip) return;
    const target = chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeCat]);

  const closeSheet = useCallback(() => setSheet(null), []);
  const noop = useCallback(() => {}, []);

  return (
    <main className={"ord ord-list" + (cartHasItems ? " has-cartbar" : "")}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-4 flex flex-col gap-4">
          <div className="ord-label">{open === false ? closedShortLabel(t, undefined, settings.schedule) : todayHoursLabel(t, undefined, settings.schedule)}</div>
          <h1 className="big in">
            <span>
              <i>{o.title[0]}</i>
            </span>
            <span>
              <i>{o.title[1]}</i>
            </span>
          </h1>
          <p className="max-w-md text-dim">{o.onlineOnly}</p>
        </header>

        <nav className="chipsbar" ref={chipsRef} aria-label={t.chrome.menu}>
          {ORDER.map((c) => (
            <a key={c} href={`#kat-${c}`} data-cat={c} className={"catchip" + (activeCat === c ? " on" : "")} onClick={() => setActiveCat(c)}>
              {t.categories[c]}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-10">
          {/* 14 Eyl 2026: bölümlerdeki `scroll-mt-32` (sabit 128 px) KALDIRILDI.
              Anchor payı artık globals.css'teki [id^="kat-"] kuralından ve ölçülen
              --sticky-top değişkeninden geliyor; gerçek engel topbar + yapışkan
              çip çubuğuydu (132 px), 128 px yetmiyordu. */}
          {ORDER.map((cat) => (
            <section key={cat} id={`kat-${cat}`}>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 className="ord-h">{t.categories[cat]}</h2>
                <span className="ord-label text-right">{cat === "burger" ? o.burgerNote : cat === "sos" ? o.sauceNote : ""}</span>
              </div>
              <div className="plist">
                {MENU[cat].map((m, idx) => {
                  const name = itemName(t, m);
                  const eager = cat === "burger" && idx < 3; // ilk ekran: LCP görseli lazy olmasın
                  const qty = qtyOf(cart, m.id);
                  /* İki AYRI sebeple pasif olabilir, etiketleri de ayrı:
                       · tükendi  → panelden işaretlenmiş (settings.sold_out)
                       · yakında  → fiyatı henüz girilmemiş (price 0, ör. citir-tavuk)
                     İkincisine "Tükendi" demek YANLIŞ olurdu: ürün tükenmedi,
                     daha fiyatlanmadı. Sunucu da reddediyor (validateOrder
                     no-price); burası kullanıcıyı boşuna uğraştırmamak için.
                     Panelden fiyat girilince kendiliğinden açılır. */
                  const fiyatsiz = priceOf(m, settings.prices) <= 0;
                  const out = settings.sold_out.includes(m.id) || fiyatsiz;
                  return (
                    <article key={m.id} data-pcard data-sold-out={out || undefined} className={"pcard" + (qty ? " on" : "") + (out ? " soldout" : "")} onClick={() => { if (!out) setSheet(m); }} role="button" tabIndex={0} onKeyDown={(e) => {
                        /* Kart bir "button" gibi davranıyor ama içinde de düğmeler var.
                           İç düğmede basılan Enter/Space buraya kabarıyordu ve sheet açılıyordu:
                           klavye kullanıcısı "+ Ekle" düğmesini hiç kullanamıyordu. */
                        if (e.target !== e.currentTarget) return;
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        if (!out) setSheet(m);
                      }}>
                      <ProductImage m={m} name={name} eager={eager} />
                      <div className="pbody">
                        <h3 className="tname">{name}</h3>
                        {itemDesc(t, m) ? (
                          <p className="pdesc">
                            <Ingredients text={itemDesc(t, m)!} />
                          </p>
                        ) : null}
                        <div className="prow">
                          {/* Fiyatı girilmemiş üründe "₺0" YANILTICI olurdu; fiyat yerine boş bırakılır. */}
                          <span className="price">{fiyatsiz ? "" : formatPriceFor(locale, priceOf(m, settings.prices))}</span>
                          <button
                            type="button"
                            className="addbtn"
                            disabled={out}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (out) return;
                              /* kopyalar bu kartın görselinden çıkar */
                              const img = e.currentTarget.closest("[data-pcard]")?.querySelector<HTMLElement>(".pimg");
                              if (img) void flyToCart({ source: img, commit: () => cartAdd(m.id, 1) });
                              else cartAdd(m.id, 1);
                            }}
                            aria-label={`${o.addShort} · ${name}`}
                          >
                            {fiyatsiz ? o.noPrice : out ? o.soldOut : qty ? `${o.addShort} · ${qty}` : o.addShort}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        {/* Yasal metinlere sipariş akışından da erişilebilsin (yönetmelik gereği) */}
        <LegalLinks locale={locale} />
      </div>
      {/* "YANINDA İYİ GİDER" — listenin sonunda, sepet çubuğunun üstünde; boş sepette görünmez */}
      <Upsell />
      {sheet ? <ProductSheet item={sheet} onClose={closeSheet} onAdded={noop} /> : null}
      <CartBar />
    </main>
  );
}
