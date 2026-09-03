import JsonLd from "@/components/seo/JsonLd";
import Stage from "@/components/stage/Stage";
import { getMessages } from "@/lib/i18n";
import { restaurantJsonLd } from "@/lib/jsonld";
import { availableStages } from "@/lib/katman";
import { extraCutouts } from "@/lib/cutouts-available";
import { pageMetadata } from "@/lib/seo";

const t = getMessages("tr");
export const metadata = pageMetadata({ locale: "tr", path: "/", title: t.meta.homeTitle, ogItem: "smooky" });

/** ANA SAYFA — sinematik sahne (spec §4) */
export default function HomePage() {
  return (
    <>
      <JsonLd data={restaurantJsonLd("tr")} />
      <Stage stages={availableStages()} extra={extraCutouts()} />
    </>
  );
}
