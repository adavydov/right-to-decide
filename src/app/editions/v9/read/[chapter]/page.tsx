import { notFound } from "next/navigation";
import archive from "@/data/edition-v9.json";
import type { Book } from "@/lib/book";
import { ChapterView } from "@/components/ChapterView";
export const dynamicParams = false;
export function generateStaticParams() { return archive.chapters.filter(c => c.status === "available").map(c => ({ chapter: c.id })); }
export async function generateMetadata({ params }: { params: Promise<{ chapter: string }> }) { const { chapter } = await params; return { title: "9.0 · " + archive.chapters.find(c => c.id === chapter)?.title, robots: { index: false, follow: true } }; }
export default async function Page({ params }: { params: Promise<{ chapter: string }> }) {
  const { chapter: id } = await params;
  const source = archive as Book;
  const chapter = source.chapters.find(c => c.id === id);
  if (!chapter || chapter.status !== "available") notFound();
  return <ChapterView chapter={chapter} sourceBook={source} routePrefix="/editions/v9/read/" contentsHref="/editions/v9/" archived />;
}
