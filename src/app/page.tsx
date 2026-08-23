import { AuthorSection } from "@/components/AuthorSection";
import { ContentsSection } from "@/components/ContentsSection";
import { FrameworkSection } from "@/components/FrameworkSection";
import { HeroSection } from "@/components/HeroSection";
import { NoveltySection } from "@/components/NoveltySection";
import { ProblemSection } from "@/components/ProblemSection";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SourcesSection } from "@/components/SourcesSection";
import { ThesisSection } from "@/components/ThesisSection";
import { WorldSection } from "@/components/WorldSection";
import { author } from "@/data/author";
import { finalFormula, governingAnswer } from "@/data/content";
import { siteConfig } from "@/lib/site-config";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CreativeWork",
      "@id": `${siteConfig.publicUrl}/#prospectus`,
      name: siteConfig.title,
      alternateName: siteConfig.subtitle,
      description: siteConfig.description,
      abstract: `${governingAnswer} ${finalFormula}`,
      inLanguage: "ru",
      isAccessibleForFree: true,
      url: `${siteConfig.publicUrl}/`,
      author: { "@id": `${siteConfig.publicUrl}/#author` },
      about: [
        "инженерное образование",
        "искусственный интеллект",
        "инженерное суждение",
        "когнитивный допуск",
      ],
    },
    {
      "@type": "Person",
      "@id": `${siteConfig.publicUrl}/#author`,
      name: author.name,
      jobTitle: author.role,
      email: `mailto:${author.email}`,
      sameAs: author.links.map((link) => link.url),
      affiliation: {
        "@type": "CollegeOrUniversity",
        name: "Российский университет транспорта (РУТ (МИИТ))",
        url: "https://www.miit.ru/",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <div className="page-shell">
          <HeroSection />
          <ProblemSection />
        </div>
        <ThesisSection />
        <FrameworkSection />
        <ContentsSection />
        <WorldSection />
        <NoveltySection />
        <SourcesSection />
        <AuthorSection />
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c"),
        }}
      />
    </>
  );
}
