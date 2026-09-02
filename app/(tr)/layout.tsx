import SiteHtml from "@/components/layout/SiteHtml";
import { baseMetadata } from "@/lib/seo";

export const metadata = baseMetadata("tr");
export { viewport } from "@/lib/seo";

export default function TrLayout({ children }: { children: React.ReactNode }) {
  return <SiteHtml locale="tr">{children}</SiteHtml>;
}
