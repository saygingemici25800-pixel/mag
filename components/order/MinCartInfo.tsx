"use client";

import { useEffect } from "react";
import type { Messages } from "@/lib/i18n";
import { useSettings } from "@/lib/useSettings";
import { zoneActive } from "@/lib/zones";

interface Props {
  t: Messages["order"];
  onClose: () => void;
}

/** ⓘ → "Minimum sepet tutarları" tablosu (modal) */
export default function MinCartInfo({ t, onClose }: Props) {
  /* Tablo PANELDEN gelen listeyi gösterir; kapalı mahalleler işaretlenir. */
  const zones = useSettings().zones;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="mincart-title" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <div className="ord-label">{t.delivery}</div>
        <h2 id="mincart-title" className="ord-h mt-2">
          {t.minInfoTitle}
        </h2>
        <p className="mt-3 text-sm text-dim">{t.minInfoLead}</p>
        <table className="mt-5">
          <thead>
            <tr>
              <th>{t.minInfoZone}</th>
              <th>{t.minInfoMin}</th>
              <th>{t.minInfoFee}</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id} data-zone-row={z.id} style={zoneActive(z) ? undefined : { opacity: 0.5 }}>
                <td>
                  {z.name}
                  {zoneActive(z) ? "" : ` · ${t.zoneClosedLabel}`}
                </td>
                <td>{z.minCart} ₺</td>
                <td>{z.fee ? `${z.fee} ₺` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="addbtn mt-6" onClick={onClose}>
          {t.close}
        </button>
      </div>
    </div>
  );
}
