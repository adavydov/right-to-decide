import localFont from "next/font/local";
import type { ReaderFont } from "./reader";

const literata = localFont({
  src: [
    { path: "../assets/reader-fonts/literata-normal.woff2", style: "normal", weight: "200 900" },
    { path: "../assets/reader-fonts/literata-italic.woff2", style: "italic", weight: "200 900" },
  ],
  display: "swap", preload: false, fallback: ["Georgia", "serif"], adjustFontFallback: "Times New Roman",
});
const sourceSerif = localFont({
  src: [
    { path: "../assets/reader-fonts/source-serif-4-normal.woff2", style: "normal", weight: "200 900" },
    { path: "../assets/reader-fonts/source-serif-4-italic.woff2", style: "italic", weight: "200 900" },
  ],
  display: "swap", preload: false, fallback: ["Georgia", "serif"], adjustFontFallback: "Times New Roman",
});
const golos = localFont({
  src: "../assets/reader-fonts/golos-text-normal.woff2", weight: "400 900", style: "normal",
  display: "swap", preload: false, fallback: ["Arial", "sans-serif"], adjustFontFallback: "Arial",
});

export const readerFontSample = "Мы не знаем будущего целиком. Но каждый день выбираем, каким оно станет.";
export const readerFonts: Record<ReaderFont, { name: string; description: string; family: string }> = {
  literata: { name: "Literata", description: "Книжный · с засечками", family: literata.style.fontFamily },
  "source-serif": { name: "Source Serif 4", description: "Спокойный · с засечками", family: sourceSerif.style.fontFamily },
  golos: { name: "Golos Text", description: "Современный · без засечек", family: golos.style.fontFamily },
  serif: { name: "Georgia", description: "Классический · с засечками", family: 'Georgia, "Times New Roman", serif' },
  sans: { name: "Arial", description: "Нейтральный · без засечек", family: 'Arial, Helvetica, sans-serif' },
};
export const readerFontOrder: ReaderFont[] = ["literata", "source-serif", "golos", "serif", "sans"];

/** Load Cyrillic and Latin before changing the text metrics or restoring a saved position. */
export async function ensureReaderFont(font: ReaderFont, size: number): Promise<void> {
  if (font === "serif" || font === "sans" || !document.fonts) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`400 ${size}px ${readerFonts[font].family}`, "Будущее Ёё Aa 0123"),
        document.fonts.load(`italic 400 ${size}px ${readerFonts[font].family}`, "Будущее Ёё Aa 0123"),
      ]),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Font load timed out")), 8000); }),
    ]);
  } finally { clearTimeout(timer); }
}
