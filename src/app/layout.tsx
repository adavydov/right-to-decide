import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/lib/site-config";
import { BookHeader } from "@/components/BookHeader";
import { BookFooter } from "@/components/BookFooter";
import authorsData from "@/data/authors.json";
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
        url: siteConfig.publicUrl + "/images/book-cover-new-subtitle.png",
        width: 1024,
        height: 1536,
        alt: "Обложка монографии «Право на решение»",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [siteConfig.publicUrl + "/images/book-cover-new-subtitle.png"],
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
      <body>
        <BookHeader />
        {children}
        <BookFooter />
      </body>
    </html>
  );
}
