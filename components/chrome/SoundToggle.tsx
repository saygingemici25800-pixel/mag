"use client";

import { useSyncExternalStore } from "react";
import { getSoundSnapshot, subscribeSound, toggleSound } from "@/lib/sound";

interface Props {
  onLabel: string;
  offLabel: string;
}

const serverSnapshot = () => true;

/** Sol üst "Ses açık / Ses kapalı" anahtarı + eq çubukları (kapalıyken durur, %45 opaklık). Tercih localStorage "mag:sound". */
export default function SoundToggle({ onLabel, offLabel }: Props) {
  const on = useSyncExternalStore(subscribeSound, getSoundSnapshot, serverSnapshot);
  return (
    <button type="button" className={"onbox" + (on ? "" : " off")} onClick={toggleSound} aria-pressed={on} aria-label={on ? onLabel : offLabel}>
      <span>{on ? onLabel : offLabel}</span>
      <span className="eq" aria-hidden="true">
        <b />
        <b />
        <b />
        <b />
      </span>
    </button>
  );
}
