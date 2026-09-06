"""Release tests exercise loss, substitution and malformed-source boundaries."""
from __future__ import annotations
import copy
from io import BytesIO
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import manuscript_v7
import chapter_docx_v7
import release_v7


class ProjectionBoundaries(unittest.TestCase):
    def parse(self, body):
        return manuscript_v7.parse(("# Глава 1. Проверка\n\n" + body).encode(), "chapter-01")

    def test_every_note_form_and_repeated_reference_survives(self):
        title, blocks, notes, heading = self.parse("Первый[1], снова[1] и второй[2].\n\n## Источники и примечания\n\n[1] Первая [ссылка](https://example.org/first).\n\n2. Второй *источник*.")
        self.assertEqual([n["number"] for n in notes], [1, 2])
        self.assertEqual(sum(bool(r.get("noteId")) for r in blocks[0]["runs"]), 3)
        self.assertEqual(notes[0]["blocks"][0]["runs"][1]["href"], "https://example.org/first")
        chapter = {"id": "chapter-01", "title": title, "version": "7.0", "blocks": blocks, "notesHeading": heading}
        raw = chapter_docx_v7.build(chapter, notes)
        self.assertEqual(raw, chapter_docx_v7.build(chapter, notes))
        with ZipFile(BytesIO(raw)) as package:
            doc = ET.fromstring(package.read("word/document.xml"))
        self.assertEqual(len(doc.findall(".//{" + chapter_docx_v7.W + "}bookmarkStart")), 2)
        self.assertEqual(len([n for n in doc.findall(".//{" + chapter_docx_v7.W + "}hyperlink") if n.get("{" + chapter_docx_v7.W + "}anchor")]), 3)

    def test_missing_duplicate_and_unreferenced_notes_are_rejected(self):
        for body in ["Текст[1].", "Текст[2].\n\n## Примечания\n\n[1] Первый.",
                     "Текст[1].\n\n## Примечания\n\n[1] Первый.\n\n1. Повтор.",
                     "Текст.\n\n## Примечания\n\n[1] Неиспользованный."]:
            with self.subTest(body=body), self.assertRaises(ValueError):
                self.parse(body)

    def test_numeric_code_and_link_labels_are_not_note_references(self):
        _, blocks, notes, _ = self.parse("Код `[1]`, источник [2](https://example.org/source).")
        self.assertEqual(notes, [])
        self.assertTrue(any(r.get("code") and r["text"] == "[1]" for r in blocks[0]["runs"]))
        self.assertTrue(any(r.get("href") == "https://example.org/source" and r["text"] == "2" for r in blocks[0]["runs"]))
        self.assertFalse(any(r.get("noteId") for r in blocks[0]["runs"]))

    def test_general_method_note_is_never_dropped(self):
        _, blocks, notes, _ = self.parse("Основной текст.\n\n## Источники и примечания\n\nУсловие модели.\n\nПредел вывода.")
        self.assertEqual([b["text"] for b in blocks], ["Основной текст.", "Источники и примечания", "Условие модели.", "Предел вывода."])
        self.assertEqual(notes, [])

    def test_table_values_emphasis_and_word_cells_survive(self):
        title, blocks, notes, _ = self.parse("Расчёт.\n\n| Назначение | Сумма |\n|---|---:|\n| Поддержка | 720 |\n| **Один цикл** | **1 200** |")
        table = blocks[1]
        self.assertEqual(table["rows"][-1], ["Один цикл", "1 200"])
        self.assertTrue(table["cellRuns"][-1][0][0]["strong"])
        chapter = {"id": "chapter-01", "title": title, "version": "7.0", "blocks": blocks}
        raw = chapter_docx_v7.build(chapter, notes)
        with ZipFile(BytesIO(raw)) as package:
            doc = ET.fromstring(package.read("word/document.xml"))
        self.assertEqual(len(doc.findall(".//{" + chapter_docx_v7.W + "}tbl")), 1)
        self.assertEqual(len(doc.findall(".//{" + chapter_docx_v7.W + "}tc")), 6)

    def test_unsafe_links_and_malformed_tables_fail(self):
        for body in ["[Источник](javascript:alert)", "[Источник](https://user:secret@example.org/)",
                     "Текст.\n\n| A | B |\n|---|---|\n| C |"]:
            with self.subTest(body=body), self.assertRaises(ValueError):
                self.parse(body)


class EvidenceBoundaries(unittest.TestCase):
    def test_changed_input_or_review_is_not_accepted(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(release_v7, "ROOT", Path(directory)):
            for filename in ["chapter.md", "review.md"]:
                file = Path(directory) / filename
                file.write_bytes(b"accepted")
                digest = release_v7.outline.sha(file.read_bytes())
                self.assertEqual(release_v7.checked(filename, digest.upper()), b"accepted")
                file.write_bytes(b"changed")
                with self.assertRaises(ValueError):
                    release_v7.checked(filename, digest)

    def test_pinned_selection_cannot_silently_refresh(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(release_v7, "ROOT", Path(directory)):
            relative, selection = release_v7.selection_for("7.1", [{"path": "review.md", "sha256": "first"}])
            target = Path(directory) / relative
            target.parent.mkdir(parents=True)
            target.write_bytes(release_v7.outline.encoded(selection))
            with self.assertRaises(ValueError):
                release_v7.selection_for("7.1", [{"path": "review.md", "sha256": "second"}])

    def test_repository_escape_is_rejected(self):
        for value in ["../private.md", "../../book-memory/source.md", str(release_v7.ROOT / "CONSTITUTION.md")]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                release_v7.local(value)

    def test_complete_baseline_and_patch_match_accepted_note_inventories(self):
        for edition, count in [("7.0", 20), ("7.1", 22)]:
            if not (release_v7.ROOT / release_v7.EDITIONS[edition][0]).exists():
                continue
            outputs = release_v7.build(edition)
            book = json.loads(outputs[release_v7.BOOK])
            self.assertEqual(len(book["notes"]), count)
            self.assertEqual(len([c for c in book["chapters"] if c.get("contentKind") == "manuscript"]), 20)
            self.assertEqual(len([p for p in outputs if p.as_posix().startswith("public/book/chapters/")]), 20)
            self.assertEqual(set(book["downloads"]), {"docx", "pdf"})
            if edition == "7.1":
                self.assertEqual([c["id"] for c in book["chapters"] if c.get("version") == "7.1"], ["chapter-12", "chapter-14", "chapter-17"])


if __name__ == "__main__":
    unittest.main()