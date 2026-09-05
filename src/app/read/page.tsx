import Link from "next/link";
import Image from "next/image";
import { ContinueReading } from "@/components/ContinueReading";
import { readingChapters } from "@/lib/book";
import { assetPath, siteConfig } from "@/lib/site-config";
export const metadata = {
  title: "Читать книгу",
  alternates: { canonical: siteConfig.publicUrl + "/read/" },
};
export default function ReadIndex() {
  const first =
    readingChapters.find(
      (c) => c.id === "introduction" && c.status === "available",
    ) ||
    readingChapters.find(
      (c) => c.kind === "chapter" && c.status === "available",
    );
  return (
    <main id="main-content" className="subpage wrap">
      <div className="read-entrance">
        <div>
          <p className="eyebrow">Открытая книга · Рабочая редакция</p>
          <h1 className="page-heading">Начать с вопроса.</h1>
          <p className="page-intro">
            Что должно стоять за правом человека принимать решения, когда
            значительную часть интеллектуальной работы выполняет машина?
          </p>
          <p className="page-intro" style={{ marginTop: 22 }}>
            Здесь собран доступный текст монографии: 18 глав, заключение и
            приложения. По мере работы авторов он будет обновляться.
          </p>
          <div
            style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              marginTop: 32,
            }}
          >
            {first && (
              <Link className="button" href={"/read/" + first.id + "/"}>
                Читать введение <span aria-hidden="true">↗</span>
              </Link>
            )}
            <Link className="button secondary" href="/contents/">
              Выбрать главу
            </Link>
          </div>
          <p className="eyebrow" style={{ marginTop: 28, fontSize: 10 }}>
            Редакция от 04.09.2026 · Формулы в линейной записи
          </p>
          <ContinueReading
            validIds={readingChapters
              .filter((c) => c.status === "available")
              .map((c) => c.id)}
          />
        </div>
        <Image
          src={assetPath("/images/book-cover-new-subtitle.png")}
          alt="Обложка монографии «Право на решение»"
          width={1024}
          height={1536}
          priority
          className="entrance-cover"
        />
      </div>
    </main>
  );
}
