"use client";

import { useCallback, useEffect, useState } from "react";

/** Yükleme adımları — hepsi eşit ağırlıklı, ilerleme = tamamlanan / toplam */
export type LoadStep = "fonts" | "cutouts" | "firstRender";
export const LOAD_STEPS: LoadStep[] = ["fonts", "cutouts", "firstRender"];

/** Yüzde göstergesi bu süreyi aşan yüklemelerde açılır (yavaş bağlantı) */
export const SLOW_MS = 4000;

export interface LoadProgress {
  /** 0→1, gerçek adımlara bağlı (zamanlayıcı değil) */
  progress: number;
  done: boolean;
  /** yükleme uzun sürdü → yüzdeyi göster */
  slow: boolean;
  /** bir adımı tamamlandı olarak işaretle (idempotent) */
  mark: (step: LoadStep) => void;
}

/**
 * Gerçek yükleme ilerlemesi: fontlar hazır · cutout decode · ilk render.
 * `mark` çağrıları Stage içinden gelir; fontları burada bekleriz.
 */
export function useLoadProgress(): LoadProgress {
  const [doneSteps, setDoneSteps] = useState<Set<LoadStep>>(() => new Set());
  const [slow, setSlow] = useState(false);

  const mark = useCallback((step: LoadStep) => {
    setDoneSteps((prev) => {
      if (prev.has(step)) return prev;
      const next = new Set(prev);
      next.add(step);
      return next;
    });
  }, []);

  // fontlar (setState senkron olmasın diye bir tık ertelenir)
  useEffect(() => {
    let cancelled = false;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const ok = () => {
      if (!cancelled) mark("fonts");
    };
    if (!fonts) {
      const id = window.setTimeout(ok, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(id);
      };
    }
    fonts.ready.then(ok, ok);
    return () => {
      cancelled = true;
    };
  }, [mark]);

  // yavaş bağlantı: 4 sn'yi aşarsa yüzdeyi göster
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(id);
  }, []);


  const progress = doneSteps.size / LOAD_STEPS.length;
  return { progress, done: progress >= 1, slow, mark };
}
