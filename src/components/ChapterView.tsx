import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ReaderShell } from "@/components/ReaderShell";
import {
  readingChapters,
  getChapterNeighbors,
  getChapterReadingMinutes,
  type BookBlock,
  type BookChapter,
  type BookList,
  type TableBlock,
  type TextBlock,
} from "@/lib/book";
import { displayBookTitle } from "@/lib/book-display";
import { assetPath } from "@/lib/site-config";

function ManuscriptTable({ block }: { block: TableBlock }) {
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Таблица из монографии"
    >
      <table>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const layout = block.cellLayout?.[ri]?.[ci];
                if (layout?.verticalMerge === "continue") return null;
                let rowSpan = 1;
                if (layout?.verticalMerge === "restart") {
                  for (
                    let r = ri + 1;
                    r < block.rows.length &&
                    block.cellLayout?.[r]?.[ci]?.verticalMerge === "continue";
                    r++
                  ) {
                    rowSpan++;
                  }
                }
                const Cell = ri === 0 ? "th" : "td";
                return (
                  <Cell
                    scope={ri === 0 ? "col" : undefined}
                    key={ci}
                    colSpan={layout?.colSpan || 1}
                    rowSpan={rowSpan}
                    style={{ whiteSpace: "pre-line" }}
                  >
                    {cell}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ListParagraph = TextBlock & { type: "paragraph"; list: BookList };

function isListParagraph(block: BookBlock): block is ListParagraph {
  return block.type === "paragraph" && Boolean(block.list);
}

function renderBlock(block: BookBlock): ReactNode {
  if (block.type === "table")
    return <ManuscriptTable key={block.id} block={block} />;
  if (block.type === "image") {
    return (
      <figure key={block.id}>
        <Image
          src={assetPath(block.src)}
          alt={block.alt}
          width={block.width || 1000}
          height={block.height || 600}
        />
      </figure>
    );
  }
  if (block.type === "heading") {
    const title = displayBookTitle(block.text);
    return (block.level || 2) <= 2 ? (
      <h2 id={block.id} key={block.id}>
        {title}
      </h2>
    ) : (
      <h3 id={block.id} key={block.id}>
        {title}
      </h3>
    );
  }
  if (block.role === "quote") {
    return (
      <blockquote key={block.id}>
        <p>{block.text}</p>
      </blockquote>
    );
  }
  return (
    <p
      key={block.id}
      className={block.role === "caption" ? "figure-caption" : undefined}
      style={{ whiteSpace: "pre-line" }}
    >
      {block.text}
    </p>
  );
}

function renderBookBlocks(blocks: BookBlock[]): ReactNode[] {
  const rendered: ReactNode[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (!isListParagraph(block)) {
      rendered.push(renderBlock(block));
      index++;
      continue;
    }

    const list = block.list;
    const entries: ListParagraph[] = [block];
    index++;

    while (index < blocks.length) {
      const next = blocks[index];
      if (
        !isListParagraph(next) ||
        next.list.kind !== list.kind ||
        next.list.level !== list.level ||
        next.list.sourceNumberId !== list.sourceNumberId
      ) {
        break;
      }
      entries.push(next);
      index++;
    }

    const List = list.kind === "ordered" ? "ol" : "ul";
    rendered.push(
      <List
        key={`${block.id}-list`}
        className="manuscript-list"
        role="list"
        style={{ paddingLeft: Math.min(list.level, 3) * 14 }}
      >
        {entries.map((entry) => (
          <li key={entry.id}>
            <span className="list-marker">{entry.list.marker}</span>
            {entry.role === "quote" ? (
              <blockquote>
                <p>{entry.text}</p>
              </blockquote>
            ) : (
              <span>{entry.text}</span>
            )}
          </li>
        ))}
      </List>,
    );
  }

  return rendered;
}

export function ChapterView({ chapter }: { chapter: BookChapter }) {
  const { previous, next } = getChapterNeighbors(chapter.id);
  const items = readingChapters.map((c) => ({
    id: c.id,
    title: c.title,
    part: c.part,
    kind: c.kind,
    number: c.number,
    status: c.status,
    minutes: getChapterReadingMinutes(c),
  }));

  return (
    <main id="main-content" className="subpage wrap">
      <ReaderShell currentId={chapter.id} items={items}>
        <article>
          <p className="eyebrow" style={{ marginBottom: 18 }}>
            {chapter.part ? displayBookTitle(chapter.part) : "Право на решение"}
          </p>
          <h1 className="reading-title">{displayBookTitle(chapter.title)}</h1>
          <p className="reading-meta">
            {getChapterReadingMinutes(chapter)} мин чтения · Текст авторской
            рукописи
          </p>
          <div className="reading-copy">{renderBookBlocks(chapter.blocks)}</div>
          <nav className="chapter-end" aria-label="Переход между разделами">
            {previous ? (
              <Link href={"/read/" + previous.id + "/"}>
                <small>← ПРЕДЫДУЩИЙ РАЗДЕЛ</small>
                {displayBookTitle(previous.title)}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={"/read/" + next.id + "/"}>
                <small>СЛЕДУЮЩИЙ РАЗДЕЛ →</small>
                {displayBookTitle(next.title)}
              </Link>
            ) : (
              <Link href="/contents/">
                <small>КНИГА ПРОЧИТАНА</small>
                Вернуться к содержанию ↗
              </Link>
            )}
          </nav>
        </article>
      </ReaderShell>
    </main>
  );
}
