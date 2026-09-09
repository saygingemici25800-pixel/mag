import Link from "next/link";
import { getMessages, localePath, type Locale } from "@/lib/i18n";
import ContactOverlay from "./ContactOverlay";
import LangSwitch from "./LangSwitch";
import OrderCta from "./OrderCta";
import SoundToggle from "./SoundToggle";
import "./chrome.css";

/** Topbar (ses anahtarı · mag. · TR|EN · SİPARİŞ · İLETİŞİM) ve dört köşe braketi. */
export default function Chrome({ locale }: { locale: Locale }) {
  const t = getMessages(locale);
  const c = t.chrome;
  return (
    <>
      <header className="topbar">
        <div className="navL">
          <SoundToggle onLabel={c.soundOn} offLabel={c.soundOff} />
          <LangSwitch locale={locale} labels={c.lang} />
        </div>
        <Link href={localePath(locale, "/")} className="mark" aria-label={`${c.brand}.`}>
          {c.brand}
          <i>.</i>
        </Link>
        <nav className="navR">
          <OrderCta locale={locale} label={c.menu} labelShort={c.menuShort} closedLabel={c.closedNow} closedShort={c.closedNowShort} />
          <ContactOverlay t={t.contact} label={c.contact} labelShort={c.contactShort} />
        </nav>
      </header>
      <span className="bracket b1" aria-hidden="true" />
      <span className="bracket b2" aria-hidden="true" />
      <span className="bracket b3" aria-hidden="true" />
      <span className="bracket b4" aria-hidden="true" />
    </>
  );
}
