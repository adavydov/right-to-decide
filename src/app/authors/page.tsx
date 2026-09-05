import type { Metadata } from "next";
import { AuthorsGrid } from "@/components/AuthorsGrid";
import { siteConfig } from "@/lib/site-config";
export const metadata: Metadata = {
  title: "Авторы",
  description:
    "Алексей Михайлович Давыдов, Алексей Алексеевич Давыдов и Егор Алексеевич Давыдов — авторы монографии «Право на решение».",
  alternates: { canonical: siteConfig.publicUrl + "/authors/" },
};
export default function AuthorsPage() {
  return (
    <main id="main-content" className="subpage wrap">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">За текстом — люди</p>
          <h1 className="page-heading">Об авторах</h1>
          <p className="page-intro">
            Академический опыт, технологическое предпринимательство и практика
            управленческого консалтинга. Три перспективы на способность человека принимать
            решения.
          </p>
        </div>
      </div>
      <AuthorsGrid />
    </main>
  );
}
