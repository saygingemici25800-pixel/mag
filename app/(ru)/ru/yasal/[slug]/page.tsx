import { notFound } from "next/navigation";
import LegalPage from "@/components/pages/LegalPage";
import { getMessages } from "@/lib/i18n";
import { LEGAL_SLUGS, isLegalSlug } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}
export async function generateMetadata({ params }: PageProps<"/ru/yasal/[slug]">) {
  const { slug } = await params;
  const t = getMessages("ru");
  return pageMetadata({ locale: "ru", path: `/yasal/${slug}`, title: isLegalSlug(slug) ? t.legal[slug] : t.legal.index });
}

export default async function LegalPageRu({ params }: PageProps<"/ru/yasal/[slug]">) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  return <LegalPage locale="ru" slug={slug} />;
}
