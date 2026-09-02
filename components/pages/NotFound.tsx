import Link from "next/link";
import { getMessages, localePath, type Locale } from "@/lib/i18n";
import "@/components/order/order.css";

/** 404 — tasarım diliyle. */
export default function NotFound({ locale }: { locale: Locale }) {
  const t = getMessages(locale).notFound;
  return (
    <main className="ord flex items-center">
      <div className="mx-auto w-full max-w-3xl">
        <div className="ord-label">404</div>
        <h1 className="big in mt-4">
          <span>
            <i>{t.title[0]}</i>
          </span>
          <span>
            <i>{t.title[1]}</i>
          </span>
        </h1>
        <p className="mt-6 max-w-md text-dim">{t.lead}</p>
        <div className="mt-8 flex gap-3">
          <Link href={localePath(locale, "/siparis")} className="addbtn">
            {t.order}
          </Link>
          <Link href={localePath(locale, "/")} className="ord-label self-center hover:text-cream">
            {t.home}
          </Link>
        </div>
      </div>
    </main>
  );
}
