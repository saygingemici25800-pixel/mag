import Chrome from "@/components/chrome/Chrome";

/* Dil anahtarı Faz 4'te (EN) eklenecek. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Chrome />
      {children}
    </>
  );
}
