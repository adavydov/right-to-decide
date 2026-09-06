import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { OpenEditorialReader } from "@/components/OpenEditorialReader";
import { ReaderShell } from "@/components/ReaderShell";
import {
  book,
  readingChapters,
  getChapterNeighbors,
  getChapterReadingMinutes,
  type BookBlock,
  type BookChapter,
  type BookList,
  type TableBlock,
  type TextBlock,
  type TextRun,
} from "@/lib/book";
import { displayBookTitle } from "@/lib/book-display";
import { assetPath } from "@/lib/site-config";

function InlineText({ block }: { block: TextBlock }) {
  if (!block.runs?.length) return block.text;
  return block.runs.map((run: TextRun, index: number) => {
    let content: ReactNode = run.text;
    if (run.code) content = <code>{content}</code>;
    if (run.emphasis) content = <em>{content}</em>;
    if (run.strong) content = <strong>{content}</strong>;
    if (run.noteId) return <a key={index} id={`${block.id}-ref-${index}`} className="note-reference" href={`#${run.noteId}`} aria-label={`Примечание ${run.text.replace(/[\[\]]/g, "")}`}>{content}</a>;
    if (run.href && /^(https?:\/\/|mailto:|#)/i.test(run.href)) return <a key={index} href={run.href} rel={run.href.startsWith("http") ? "noopener noreferrer" : undefined}>{content}</a>;
    return <span key={index}>{content}</span>;
  });
}

function ManuscriptTable({ block }: { block: TableBlock }) {
  return (
    <div
      id={block.id}
      data-reader-block
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Таблица из книги"
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
                    {block.cellRuns?.[ri]?.[ci] ? <InlineText block={{ type: "paragraph", id: `${block.id}-r${ri}-c${ci}`, text: cell, runs: block.cellRuns[ri][ci] }} /> : cell}
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
      <figure key={block.id} id={block.id} data-reader-block>
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
    const title = /^manuscript-v[678]-/.test(block.id) ? <InlineText block={block} /> : displayBookTitle(block.text);
    return (block.level || 2) <= 2 ? (
      <h2 data-reader-block id={block.id} key={block.id}>
        {title}
      </h2>
    ) : (
      <h3 data-reader-block id={block.id} key={block.id}>
        {title}
      </h3>
    );
  }
  if (block.role === "quote") {
    return (
      <blockquote key={block.id} id={block.id} data-reader-block>
        <p><InlineText block={block} /></p>
      </blockquote>
    );
  }
  return (
    <p
      key={block.id}
      id={block.id}
      data-reader-block
      className={block.role === "caption" ? "figure-caption" : undefined}
      style={{ whiteSpace: "pre-line" }}
    >
      <InlineText block={block} />
    </p>
  );
}

export function renderBookBlocks(blocks: BookBlock[]): ReactNode[] {
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
          <li key={entry.id} id={entry.id} data-reader-block>
            <span className="list-marker">{entry.list.marker}</span>
            {entry.role === "quote" ? (
              <blockquote>
                <p><InlineText block={entry} /></p>
              </blockquote>
            ) : (
              <span><InlineText block={entry} /></span>
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
  const notes = book.notes.filter(note => note.chapterId === chapter.id);
  const references = new Map<string, string[]>();
  for (const block of chapter.blocks) {
    if (block.type !== "paragraph" && block.type !== "heading") continue;
    block.runs?.forEach((run, index) => {
      if (run.noteId) references.set(run.noteId, [...(references.get(run.noteId) || []), `${block.id}-ref-${index}`]);
    });
  }
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
    <main id="main-content" className="reader-page">
      <ReaderShell key={chapter.id} currentId={chapter.id} items={items}
        revision={chapter.source?.sha256 ?? book.source.sha256}
        headings={chapter.blocks.flatMap(block => block.type === "heading" ? [{ id: block.id, title: displayBookTitle(block.text) }] : [])}
      >
        <article>
          <p className="eyebrow" style={{ marginBottom: 18 }}>
            {chapter.part ? displayBookTitle(chapter.part) : "Право на решение"}
          </p>
          <h1 className="reading-title">{displayBookTitle(chapter.title)}</h1>
          <p className="reading-meta">
            <span>{getChapterReadingMinutes(chapter)} мин чтения · {chapter.contentKind === "outline" ? "Авторское содержание · версия " + chapter.version : "Авторский текст · версия " + chapter.version}</span>
            {chapter.download && <a className="reading-download" href={assetPath(chapter.download.docx)} download aria-label={`Скачать DOCX: ${chapter.title}`}>Скачать DOCX ↓</a>}
          </p>
          <div className="reading-copy">
            {renderBookBlocks(chapter.blocks)}
            {notes.length > 0 && <section className="reading-notes" aria-labelledby={`${chapter.id}-notes-heading`}>
              <h2 id={`${chapter.id}-notes-heading`}>{chapter.notesHeading || "Примечания"}</h2>
              <ol style={{ listStyleType: "decimal" }}>
                {notes.map(note => <li id={note.id} key={note.id} value={Number(note.number) || undefined}>
                  {renderBookBlocks(note.blocks)}
                  <div className="note-backlinks">{(references.get(note.id) || []).map((id, index) => <a key={id} href={`#${id}`} aria-label={`Вернуться к ссылке ${note.number}${index ? `, вхождение ${index + 1}` : ""}`}>↩ К тексту{index ? ` ${index + 1}` : ""}</a>)}</div>
                </li>)}
              </ol>
            </section>}
          </div>
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
                <small>К СОДЕРЖАНИЮ</small>
                Вернуться к содержанию ↗
              </Link>
            )}
          </nav>
        </article>
        {book.releaseId && <OpenEditorialReader chapterId={chapter.id} revision={book.releaseId} />}
      </ReaderShell>
    </main>
  );
}
