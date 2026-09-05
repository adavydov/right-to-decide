import type { Metadata } from "next";
import { AuthorsGrid } from "@/components/AuthorsGrid";
import { siteConfig } from "@/lib/site-config";
import { getBookCreditsStructuredData } from "@/lib/editorial-team";
export const metadata: Metadata = {
  title: "Авторы",
  description:
    "Три автора «Права на решение», девять кураторов слоёв и редакционные ИИ-роли по конституции 1.2.1. Ответственность людей в практическом проекте.",
  alternates: { canonical: siteConfig.publicUrl + "/authors/" },
};
export default function AuthorsPage() {
  return (
    <main id="main-content" className="subpage wrap">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Авторы и литературная команда</p>
          <h1 className="page-heading">Об авторах</h1>
          <p className="page-intro">
            Академический опыт, технологическое предпринимательство и практика
            управленческого консалтинга. Три перспективы на способность человека принимать
            решения. Ниже — каталог редакционных ИИ-ролей по конституции проекта
            и функции людей, необходимые для практической проверки.
          </p>
        </div>
      </div>
      <AuthorsGrid />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(getBookCreditsStructuredData()).replaceAll("<", "\\u003c") }} />
    </main>
  );
}
