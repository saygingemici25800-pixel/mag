"use client";

import { useEffect, useRef, useState } from "react";

const DURATION = 1500;

/** Açılış sayacı: 0→100 %, sonra .gone. Yalnızca ilk yüklemede oynar; döngüde tekrar etmez. */
export default function Preloader({ brand }: { brand: string }) {
  const numRef = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - t0) / DURATION, 1);
      if (numRef.current) numRef.current.textContent = Math.round(t * 100) + "%";
      if (t < 1) raf = requestAnimationFrame(step);
      else setGone(true);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={"pre" + (gone ? " gone" : "")} aria-hidden={gone}>
      <div className="preInner">
        <div className="preMark">
          {brand}
          <em>.</em>
        </div>
        <div className="preNum" ref={numRef}>
          0%
        </div>
      </div>
    </div>
  );
}
