"use client";


import type { Messages } from "@/lib/i18n";
import type { HeroItem } from "@/lib/menu";
import { splitTitle } from "@/lib/menu";
import Ingredients from "@/components/order/Ingredients";
import BigTitle from "./BigTitle";
import type { Bind } from "./Arc";

interface Props {
  item: HeroItem;
  /** yerelleştirilmiş açıklama */
  desc: string;
  /** −1: ürün kopyası; 0–3: iddia */
  ci: number;
  claims: Messages["claims"];
  rail: Messages["rail"];
  bind: Bind;
}

/** Dive + 4 iddia: sol kopya (üstü çizili rozet → büyük başlık → açıklama) ve sağdaki ikon rayı. */
export default function Claims({ item, desc: itemDescription, ci, claims, rail, bind }: Props) {

  const claim = ci >= 0 ? claims[ci] : null;
  const [l1, l2] = claim ? [claim.l1, claim.l2] : splitTitle(item.name);
  const desc = claim ? claim.d : `${itemDescription}.`;

  return (
    <section className="scene scDive" ref={bind("scDive")}>
      <div className="left">
        <div className="badge" style={{ opacity: claim ? 1 : 0 }}>
          <b>×</b>
          <s>{claim?.no ?? claims[0].no}</s>
        </div>
        <BigTitle l1={l1} l2={l2} className={claim ? "claimTitle" : ""} />
        <p>{claim ? desc : <Ingredients text={itemDescription} />}{claim ? "" : "."}</p>
      </div>
      <div className="rail" ref={bind("rail")} aria-hidden="true">
        {rail.map((icon, r) => (
          <i key={r} className={r === ci ? "on" : undefined}>
            {icon}
          </i>
        ))}
      </div>
    </section>
  );
}
