import JsonLd from "@/components/seo/JsonLd";
import Stage from "@/components/stage/Stage";
import { getMessages } from "@/lib/i18n";
import { restaurantJsonLd } from "@/lib/jsonld";
import { extraCutouts } from "@/lib/cutouts-available";
import { pageMetadata } from "@/lib/seo";

const t = getMessages("ru");
export const metadata = pageMetadata({ locale: "ru", path: "/", title: t.meta.homeTitle, ogItem: "smooky" });

export default function HomePageRu() {
  return (
    <>
      <JsonLd data={restaurantJsonLd("ru")} />
      <Stage extra={extraCutouts()} />
    </>
  );
}
