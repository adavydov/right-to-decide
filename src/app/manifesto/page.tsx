import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { assetPath, siteConfig } from "@/lib/site-config";
import { getManifesto, manifestoMarkdownPath, manifestoWordPath } from "@/lib/manifesto";
import styles from "./Manifesto.module.css";

export const metadata: Metadata = {
  title: "Манифест и конституция проекта",
  description: "Главный вопрос и ответ «Права на решение», восемь слоёв книги, правила работы и критерии приёмки. Полный авторский текст конституции проекта, версия 1.0.",
  alternates: { canonical: siteConfig.publicUrl + "/manifesto/" },
};

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s]+)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (/^https?:\/\//.test(part)) return <a key={index} href={part}>{part}</a>;
    return part;
  });
}

export default function ManifestoPage() {
  const { blocks, sections } = getManifesto();
  const navigation = (
    <ol className={styles.sectionLinks}>
      {sections.map((section) => <li key={section.id}><a href={"#" + section.id}>{section.text}</a></li>)}
    </ol>
  );
  return (
    <main id="main-content" className={`subpage wrap ${styles.page}`}>
      <header className={styles.intro}>
        <p className="eyebrow">Право на решение · Версия 1.0</p>
        <h1 className="page-heading">Манифест и конституция проекта</h1>
        <p className={`page-intro ${styles.lead}`}>Главный вопрос, авторский ответ и восемь слоёв одной книги. Основа работы над текстом и практической проверкой его идей.</p>
        <div className={styles.actions}>
          <a className="button" href={assetPath(manifestoWordPath)} download>Скачать Word <span aria-hidden="true">↓</span></a>
          <a className="button secondary" href={assetPath(manifestoMarkdownPath)} download="CONSTITUTION.md">Скачать Markdown <span aria-hidden="true">↓</span></a>
          <Link className="text-link" href="/contents/">Содержание книги <span aria-hidden="true">↗</span></Link>
        </div>
        <div className={styles.status}>
          <span className="eyebrow">Статус публикации · 6 сентября 2026</span>
          <p>Инициатор принял этот документ как действующую конституцию проекта. Ниже — полный авторский текст от 5 сентября 2026 года, с сохранённой формулировкой «Для принятия соавторами». Она не означает подтверждённого согласия всех соавторов.</p>
          <p>Публикация конституции не означает повторной приёмки ранее написанных глав.</p>
        </div>
      </header>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <nav className={styles.desktopNavigation} aria-label="Содержание манифеста">
            <p className="eyebrow">В этом документе</p>
            {navigation}
          </nav>
          <details className={styles.mobileNavigation}>
            <summary>Содержание манифеста <span>{sections.length} разделов</span></summary>
            <nav aria-label="Содержание манифеста на мобильном устройстве">{navigation}</nav>
          </details>
        </aside>
        <article className={styles.document} aria-label="Полный авторский текст конституции">
          {blocks.map((block) => {
            const content = inline(block.text);
            const props = { id: block.id, "data-manifesto-block": block.kind };
            if (block.kind === "rule") return <hr key={block.id} {...props} />;
            if (block.kind === "quote") return <blockquote key={block.id} {...props}><p>{content}</p></blockquote>;
            if (block.kind === "heading") {
              if (block.depth === 1) return <h2 key={block.id} {...props} className={styles.documentTitle}>{content}</h2>;
              if (block.depth === 2) return <h2 key={block.id} {...props}>{content}</h2>;
              return <h3 key={block.id} {...props}>{content}</h3>;
            }
            return <p key={block.id} {...props}>{content}</p>;
          })}
        </article>
      </div>
    </main>
  );
}
