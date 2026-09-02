import { notFound } from "next/navigation";
import LegalPage from "@/components/pages/LegalPage";
import { getMessages } from "@/lib/i18n";
import { LEGAL_SLUGS, isLegalSlug } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}
export async function generateMetadata({ params }: PageProps<"/en/yasal/[slug]">) {
  const { slug } = await params;
  const t = getMessages("en");
  return pageMetadata({ locale: "en", path: `/yasal/${slug}`, title: isLegalSlug(slug) ? t.legal[slug] : t.legal.index });
}

export default async function LegalPageEn({ params }: PageProps<"/en/yasal/[slug]">) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  return <LegalPage locale="en" slug={slug} />;
}
