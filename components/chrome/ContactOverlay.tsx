"use client";

import { useEffect, useRef, useState } from "react";
import type { Messages } from "@/lib/i18n";
import { SITE } from "@/lib/site";

/** İLETİŞİM pill'i → tam ekran overlay: adres, telefon (tel:), saat (AÇIK), harita, sosyal yer tutucular. */
export default function ContactOverlay({ t, social }: { t: Messages["contact"]; social: { tiktok: string; instagram: string } }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="cta" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        {t.open}
      </button>
      {open ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="contact-title" onClick={() => setOpen(false)}>
          <div className="overlay-in" onClick={(e) => e.stopPropagation()}>
            <h2 id="contact-title" className="big in">
              <span>
                <i>{t.title[0]}</i>
              </span>
            </h2>
            <dl>
              <dt>{t.address}</dt>
              <dd>
                <a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer">
                  {SITE.address}
                </a>
                <small>{t.map} ↗</small>
              </dd>
              <dt>{t.phone}</dt>
              <dd>
                <a href={`tel:${SITE.phoneE164}`}>{SITE.phoneDisplay}</a>
              </dd>
              <dt>{t.hours}</dt>
              <dd>{t.hoursValue}</dd>
              <dt>{t.social}</dt>
              <dd className="flex gap-4">
                <a href={social.instagram} target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
                <a href={social.tiktok} target="_blank" rel="noopener noreferrer">
                  TikTok
                </a>
              </dd>
            </dl>
            <button ref={closeRef} type="button" className="cta" onClick={() => setOpen(false)}>
              {t.close}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
