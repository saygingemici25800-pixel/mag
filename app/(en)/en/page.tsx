import JsonLd from "@/components/seo/JsonLd";
import Stage from "@/components/stage/Stage";
import { getMessages } from "@/lib/i18n";
import { restaurantJsonLd } from "@/lib/jsonld";
import { availableStages } from "@/lib/katman";
import { extraCutouts } from "@/lib/cutouts-available";
import { pageMetadata } from "@/lib/seo";

const t = getMessages("en");
export const metadata = pageMetadata({ locale: "en", path: "/", title: t.meta.homeTitle, ogItem: "smooky" });

export default function HomePageEn() {
  return (
    <>
      <JsonLd data={restaurantJsonLd("en")} />
      <Stage stages={availableStages()} extra={extraCutouts()} />
    </>
  );
}
