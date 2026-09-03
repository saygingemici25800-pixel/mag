"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** k değişince eski içerik 480 ms boyunca solarken yenisi belirir (ok geçişiyle senkron). */
export default function CrossFade({ k, className = "", children }: { k: string | number; className?: string; children: ReactNode }) {
  const lastK = useRef(k);
  const lastNode = useRef(children);
  const [out, setOut] = useState<{ k: string | number; node: ReactNode } | null>(null);
  useEffect(() => {
    if (lastK.current === k) {
      lastNode.current = children;
      return;
    }
    const prev = { k: lastK.current, node: lastNode.current };
    lastK.current = k;
    lastNode.current = children;
    const t1 = window.setTimeout(() => setOut(prev), 0);
    const t2 = window.setTimeout(() => setOut(null), 480);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [k, children]);
  return (
    <div className={"xf " + className}>
      <div key={String(k)} className="xf-in">
        {children}
      </div>
      {out ? (
        <div key={"out-" + String(out.k)} className="xf-out" aria-hidden="true">
          {out.node}
        </div>
      ) : null}
    </div>
  );
}
