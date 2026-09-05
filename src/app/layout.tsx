import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { siteConfig } from "@/lib/site-config";
import { BookHeader } from "@/components/BookHeader";
import { BookFooter } from "@/components/BookFooter";
import authorsData from "@/data/authors.json";
const interfaceFont = localFont({
  src: "../assets/reader-fonts/golos-text-normal.woff2",
  variable: "--font-interface",
  weight: "400 900",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.publicUrl + "/"),
  title: { default: siteConfig.title, template: "%s — Право на решение" },
  description: siteConfig.description,
  authors: authorsData.authors.map((a) => ({ name: a.name })),
  creator: authorsData.authors.map((a) => a.name).join(", "),
  keywords: [
    "инженерное образование",
    "искусственный интеллект",
    "доверие",
    "когнитивный допуск",
    "Право на решение",
  ],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.publicUrl + "/",
    images: [
      {
        url: siteConfig.publicUrl + siteConfig.coverPath,
        width: siteConfig.coverWidth,
        height: siteConfig.coverHeight,
        alt: "Обложка монографии «Право на решение»",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [siteConfig.publicUrl + siteConfig.coverPath],
  },
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body className={interfaceFont.variable}>
        <BookHeader />
        {children}
        <BookFooter />
      </body>
    </html>
  );
}
