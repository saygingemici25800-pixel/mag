import SiteHtml from "@/components/layout/SiteHtml";
import { baseMetadata } from "@/lib/seo";

export const metadata = baseMetadata("en");
export { viewport } from "@/lib/seo";

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return <SiteHtml locale="en">{children}</SiteHtml>;
}
