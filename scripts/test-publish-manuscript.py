"""Release boundary tests; fixtures stay in memory and never become book chapters."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("publish_manuscript", Path(__file__).with_name("publish-manuscript.py"))
assert spec and spec.loader
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseBoundaries(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = json.loads(release.outline.build()[release.BOOK])

    def chapter(self, number):
        return next(c for c in self.base["chapters"] if c["kind"] == "chapter" and c["number"] == number)

    def source(self, number, body="Проверочный абзац — только в памяти теста."):
        return ("# " + self.chapter(number)["title"] + "\n\n" + body + "\n").encode("utf-8")

    def test_explicit_selection_preserves_foundation_and_other_chapters(self):
        untouched = copy.deepcopy(self.base)
        book, sources = release.assemble(self.base, [1], {1: self.source(1), 2: self.source(2)})
        self.assertEqual(self.base, untouched)
        self.assertEqual(book["chapters"][:2], self.base["chapters"][:2])
        self.assertEqual(book["parts"], self.base["parts"])
        self.assertEqual(book["chapters"][3:], self.base["chapters"][3:])
        self.assertEqual([s["number"] for s in sources], [1])
        self.assertEqual(book["statistics"]["availableChapters"], 1)
        self.assertEqual(book["statistics"]["plannedChapters"], 17)

    def test_complete_release_contains_all_eighteen_chapters(self):
        numbers = list(range(1, 19))
        book, sources = release.assemble(self.base, numbers, {n: self.source(n) for n in numbers})
        self.assertEqual(len(sources), 18)
        self.assertEqual(book["statistics"]["plannedChapters"], 0)
        self.assertTrue(all(c["status"] == "available" for c in book["chapters"] if c["id"] != "epilogue"))
        self.assertEqual(book["chapters"][-1]["id"], "epilogue")
        self.assertEqual(book["chapters"][-1]["status"], "planned")

    def test_architecture_matches_constitution_and_retains_epilogue(self):
        self.assertEqual(self.base["version"], "5.0")
        self.assertEqual(self.base["parts"][2]["title"], "Часть III. Инженерная школа как место изобретения деятельности")
        self.assertEqual(self.base["chapters"][-1]["title"], "Эпилог. Следующий вопрос — не наш")
        source = (release.ROOT / release.outline.SOURCE).read_bytes()
        self.assertEqual(source, release.outline.source_projection())

    def test_paragraphs_subheadings_and_separators_keep_order(self):
        body = "Первый абзац.\nСтрока того же абзаца.\n\n## Новый вопрос\n\n⸻\n\nПоследний абзац."
        chapter = release.parse_chapter(self.source(1, body), self.chapter(1))
        self.assertEqual([b["text"] for b in chapter["blocks"]],
                         ["Первый абзац.\nСтрока того же абзаца.", "Новый вопрос", "⸻", "Последний абзац."])
        self.assertEqual(chapter["blocks"][1]["level"], 2)

    def test_wrong_or_empty_source_never_becomes_available(self):
        for raw in [self.source(2), b"# Wrong title\n\nText", self.source(1, ""), self.source(1, "## Only a heading"), self.source(1, "- Unsupported list")]:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                release.parse_chapter(raw, self.chapter(1))

    def test_source_change_updates_revision_without_changing_block_anchors(self):
        first, _ = release.assemble(self.base, [1], {1: self.source(1, "Один абзац.")})
        second, _ = release.assemble(self.base, [1], {1: self.source(1, "Исправленный абзац.")})
        self.assertNotEqual(first["source"]["sha256"], second["source"]["sha256"])
        self.assertEqual(first["chapters"][2]["blocks"][0]["id"], second["chapters"][2]["blocks"][0]["id"])

    def test_release_selection_cannot_escape_current_architecture(self):
        self.assertEqual(release.chapter_selection("1-3,5"), [1, 2, 3, 5])
        for value in ["0", "19", "3-1", "1,1", "1-3,3", "../chapter-01", ""]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                release.chapter_selection(value)


if __name__ == "__main__":
    unittest.main()
