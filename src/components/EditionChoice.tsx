import Link from "next/link";
import { book } from "@/lib/book";

export function EditionChoice({ archived = false }: { archived?: boolean }) {
  return <nav aria-label="Выбор редакции" style={{ display: "flex", gap: "12px 24px", flexWrap: "wrap", margin: "20px 0" }}>
    <Link className="text-link" href="/contents/" aria-current={!archived ? "page" : undefined}>Текущая редакция {book.editionVersion}</Link>
    <Link className="text-link" href="/editions/v9/" aria-current={archived ? "page" : undefined}>Редакция 9.0 · сохранённый текст</Link>
  </nav>;
}
