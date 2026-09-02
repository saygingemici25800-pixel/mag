import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import "./chrome.css";

/** Topbar (AÇIK + eq · mag. · ::MENÜ + İLETİŞİM) ve dört köşe braketi. */
export default function Chrome() {
  const t = getMessages("tr").chrome;
  return (
    <>
      <header className="topbar">
        <div className="onbox">
          <span>{t.open}</span>
          <span className="eq" aria-hidden="true">
            <b />
            <b />
            <b />
            <b />
          </span>
        </div>
        <Link href="/" className="mark" aria-label={`${t.brand}.`}>
          {t.brand}
          <i>.</i>
        </Link>
        <nav className="navR">
          <Link href="/siparis" className="menu" prefetch={false}>
            <span className="grid2" aria-hidden="true">
              <s />
              <s />
              <s />
              <s />
            </span>
            <span>{t.menu}</span>
          </Link>
          <button type="button" className="cta">
            {t.contact}
          </button>
        </nav>
      </header>
      <span className="bracket b1" aria-hidden="true" />
      <span className="bracket b2" aria-hidden="true" />
      <span className="bracket b3" aria-hidden="true" />
      <span className="bracket b4" aria-hidden="true" />
    </>
  );
}
