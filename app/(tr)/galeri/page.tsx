import GalleryPage from "@/components/gallery/GalleryPage";
import { getMessages } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

const t = getMessages("tr");
export const metadata = pageMetadata({ locale: "tr", path: "/galeri", title: t.gallery.metaTitle, description: t.gallery.metaDesc, ogItem: "berry" });

/** GALERİ — sürüklenebilir sonsuz foto duvarı (tam ekran, dikey scroll yok) */
export default function GalleryRoute() {
  return <GalleryPage />;
}
