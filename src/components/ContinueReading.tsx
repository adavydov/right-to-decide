"use client";
import Link from "next/link";
import { displayBookTitle } from "@/lib/book-display";
import { useReadingPreference } from "@/lib/reading-storage";
export function ContinueReading({ validIds, revision, allowLegacy = false }: { validIds: string[]; revision: string; allowLegacy?: boolean }) {
  const raw = useReadingPreference("right-to-decide-reading");
  let last: { id: string; title: string } | null = null;
  try {
    const saved = JSON.parse(raw || "null");
    if (saved && (saved.revision === revision || (allowLegacy && saved.revision === undefined)) && validIds.includes(saved.id) && typeof saved.title === "string")
      last = saved;
  } catch {}
  return last ? (
    <div
      style={{
        marginTop: 32,
        paddingTop: 24,
        borderTop: "1px solid var(--border)",
      }}
    >
      <p className="eyebrow" style={{ marginBottom: 12 }}>
        Вы остановились здесь
      </p>
      <Link className="text-link" href={"/read/" + last.id + "/"}>
        Продолжить: {displayBookTitle(last.title)} ↗
      </Link>
    </div>
  ) : null;
}
