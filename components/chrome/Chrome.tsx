import Link from "next/link";
import { getMessages, localePath, type Locale } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import ContactOverlay from "./ContactOverlay";
import LangSwitch from "./LangSwitch";
import SoundToggle from "./SoundToggle";
import "./chrome.css";

/** Topbar (ses anahtarı · mag. · TR|EN · ::MENÜ · İLETİŞİM) ve dört köşe braketi. */
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
          <Link href={localePath(locale, "/siparis")} className="menu" prefetch={false} aria-label={c.menu}>
            <span className="grid2" aria-hidden="true">
              <s />
              <s />
              <s />
              <s />
            </span>
            <span>{c.menu}</span>
          </Link>
          <ContactOverlay t={t.contact} social={SITE.social} />
        </nav>
      </header>
      <span className="bracket b1" aria-hidden="true" />
      <span className="bracket b2" aria-hidden="true" />
      <span className="bracket b3" aria-hidden="true" />
      <span className="bracket b4" aria-hidden="true" />
    </>
  );
}
