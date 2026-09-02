"use client";

import { useEffect, useRef } from "react";

interface Props {
  l1: string;
  l2?: string;
  as?: "h1" | "h2";
  className?: string;
}

/**
 * İki satırlı italik display başlık. Metin değişince satırlar alttan kayarak gelir
 * (proto `setTitle`: `.in` sınıfını kaldır → reflow → tekrar ekle).
 */
export default function BigTitle({ l1, l2 = "", as: Tag = "h2", className = "" }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("in");
    el.getBoundingClientRect(); // reflow
    const raf = requestAnimationFrame(() => el.classList.add("in"));
    return () => cancelAnimationFrame(raf);
  }, [l1, l2]);

  return (
    <Tag ref={ref} className={`big in ${className}`.trim()}>
      <span>
        <i>{l1}</i>
      </span>
      {l2 ? (
        <span>
          <i>{l2}</i>
        </span>
      ) : null}
    </Tag>
  );
}
