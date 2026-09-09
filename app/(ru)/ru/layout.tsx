import SiteHtml from "@/components/layout/SiteHtml";
import { baseMetadata } from "@/lib/seo";

export const metadata = baseMetadata("ru");
export { viewport } from "@/lib/seo";

export default function RuLayout({ children }: { children: React.ReactNode }) {
  return <SiteHtml locale="ru">{children}</SiteHtml>;
}
