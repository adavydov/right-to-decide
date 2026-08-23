import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  metadataBase: new URL(`${siteConfig.publicUrl}/`),
  title: siteConfig.title,
  description: siteConfig.description,
  alternates: { canonical: `${siteConfig.publicUrl}/` },
  openGraph: {
    type: "website",
    url: `${siteConfig.publicUrl}/`,
    title: `${siteConfig.title} — ${siteConfig.subtitle}`,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.title} — ${siteConfig.subtitle}`,
    description: siteConfig.description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}

