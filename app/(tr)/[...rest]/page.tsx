import { notFound } from "next/navigation";
/** Eşleşmeyen her yol → (tr)/not-found (tasarım diliyle 404) */
export default function CatchAll() {
  notFound();
}
