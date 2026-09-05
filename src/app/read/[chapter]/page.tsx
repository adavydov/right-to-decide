import { notFound } from "next/navigation";
import { ChapterView } from "@/components/ChapterView";
import { getChapter, readingChapters } from "@/lib/book";
import { displayBookTitle } from "@/lib/book-display";
import { siteConfig } from "@/lib/site-config";
export function generateStaticParams() {
  return readingChapters
    .filter((c) => c.status === "available")
    .map((c) => ({ chapter: c.id }));
}
export const dynamicParams = false;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter: id } = await params;
  const c = getChapter(id);
  return {
    title: c ? displayBookTitle(c.title) : "Раздел не найден",
    alternates: { canonical: siteConfig.publicUrl + "/read/" + id + "/" },
  };
}
export default async function ReadingPage({
  params,
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter: id } = await params;
  const c = getChapter(id);
  if (!c || c.status !== "available") notFound();
  return <ChapterView chapter={c} />;
}
