import {book} from "@/lib/book";
import type { Metadata } from "next";
import { AuthorsGrid } from "@/components/AuthorsGrid";
import { siteConfig } from "@/lib/site-config";
import { getBookCreditsStructuredData } from "@/lib/editorial-team";
export const metadata: Metadata = {
  title: "Авторы",
  description:
    book.editionVersion === "10.0" ? "Три автора «Права на решение» и виртуальная литературная редакция: исследование, письмо, независимое чтение и сборка книги." : "Три автора «Права на решение» и литературная команда редакции 9.0.",
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
            решения. {book.editionVersion === "10.0" ? "Ниже — функции виртуальной литературной редакции и порядок независимого чтения книги." : "Ниже — каталог редакционных ИИ-ролей по конституции проекта и функции людей, необходимые для практической проверки."}
          </p>
        </div>
      </div>
      <AuthorsGrid />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(getBookCreditsStructuredData()).replaceAll("<", "\\u003c") }} />
    </main>
  );
}
