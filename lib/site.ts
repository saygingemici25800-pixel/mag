/** Site geneli sabitler. AÇIK maddeler işletmeden gelince doldurulacak. */
export const SITE = {
  name: "MAG Street Food",
  city: "Fethiye",
  address: "Cumhuriyet Mah. Atatürk Cd. No:24 Fethiye",
  /** AÇIK (spec §11.5): sosyal adresler */
  social: {
    tiktok: "#",
    instagram: "#",
  },
  /** Kapanış 00:00 biliniyor; açılış saati AÇIK (spec §11.2) */
  hours: { open: "11:00", close: "00:00" },
} as const;
