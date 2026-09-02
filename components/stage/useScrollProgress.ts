"use client";

import { useEffect, useRef } from "react";
import { HOLD_MS, LOOP_AT, LOOP_COOLDOWN_MS, SMOOTHING, clamp } from "./stageMath";

/**
 * Scroll → p (0..1) + rAF yumuşatma + sonsuz döngü. Proto'daki `tick/loopBack` birebir.
 * `onFrame(p)` her karede çağrılır (React state değil, DOM'a doğrudan yazmak için).
 */
export function useScrollProgress(onFrame: (p: number) => void, enabled: boolean) {
  const cb = useRef(onFrame);
  useEffect(() => {
    cb.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!enabled) return;

    let max = 1,
      target = 0,
      cur = 0,
      looping = false,
      atEnd = false,
      raf = 0;
    const timers: number[] = [];

    function measure() {
      max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    }
    function onScroll() {
      const y = window.scrollY;
      target = clamp(y / max);
      if (y >= max - 4) atEnd = true;
      else if (y < max - 40) atEnd = false;
    }
    /* p=1 karesi p=0 karesiyle birebir aynı olduğu için kesme görünmez */
    function loopBack() {
      looping = true;
      atEnd = false;
      cb.current(1);
      timers.push(
        window.setTimeout(() => {
          // hero pozunda bir an dursun
          target = 0;
          cur = 0;
          window.scrollTo(0, 0);
          cb.current(0);
          timers.push(
            window.setTimeout(() => {
              looping = false;
            }, LOOP_COOLDOWN_MS),
          );
        }, HOLD_MS),
      );
    }
    function tick() {
      cur += (target - cur) * SMOOTHING;
      if (Math.abs(target - cur) < 0.00005) cur = target;
      cb.current(cur);
      /* başa yalnızca yaklaşma bitip burger hero pozuna oturduktan sonra dön */
      if (atEnd && !looping && cur > LOOP_AT) loopBack();
      raf = requestAnimationFrame(tick);
    }

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.scrollTo(0, 0);
    cb.current(0);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => clearTimeout(id));
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll);
    };
  }, [enabled]);
}
