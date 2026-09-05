"""Test release boundaries and lossless DOCX conversion with ephemeral fixtures."""
from io import BytesIO
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile, ZipInfo

import chapter_docx
import manuscript_markdown
import release_v6


class ChapterExports(unittest.TestCase):
    def test_adjacent_note_markers_and_defined_numeric_references_are_distinct(self):
        title, blocks = manuscript_markdown.parse(b'# Test\n\nThermal.[1][2][3]\n', "fixture", "Test")
        self.assertEqual(blocks[0]["text"], "Thermal.[1][2][3]")
        self.assertNotIn("runs", blocks[0])
        for label in ["source", "1"]:
            raw = ("# Test\n\n[" + label + "][2]\n\n[2]: https://example.org\n").encode()
            _, linked = manuscript_markdown.parse(raw, "fixture", "Test")
            self.assertEqual(linked[0]["runs"], [{"text": label, "href": "https://example.org"}])
        with self.assertRaisesRegex(ValueError, "Undefined Markdown reference"):
            manuscript_markdown.parse(b'# Test\n\n[source][2]\n', "fixture", "Test")

    def test_docx_bytes_do_not_depend_on_the_zip_creator_platform(self):
        title, blocks = manuscript_markdown.parse(b'# Test\n\nStable package.\n', "fixture", "Test")
        chapter = {"id": "fixture", "title": title, "version": "6.0", "blocks": blocks}
        packages = []
        for platform in [0, 3]:
            def zip_info(name, timestamp):
                info = ZipInfo(name, timestamp)
                info.create_system = platform
                return info
            with patch.object(chapter_docx, "ZipInfo", zip_info):
                packages.append(chapter_docx.build(chapter))
        self.assertEqual(packages[0], packages[1])
        with ZipFile(BytesIO(packages[0])) as package:
            self.assertTrue(all(info.create_system == 3 for info in package.infolist()))

    def test_markdown_links_emphasis_lists_and_docx_keep_the_same_text(self):
        raw = b'# Test\n\nA **strong** and *emphasized* [source][1].\n\n---\n\n## References\n\n1. [Inline](https://example.org/paper)\n2. Next item.\n\n[1]: https://example.org/reference "Reference title"\n'
        title, blocks = manuscript_markdown.parse(raw, "fixture", "Test")
        chapter = {"id": "fixture", "title": title, "version": "6.0", "blocks": blocks}
        self.assertEqual(blocks[0]["text"], "A strong and emphasized source.")
        self.assertEqual(blocks[3]["list"]["marker"], "1.")
        raw = chapter_docx.build(chapter)
        self.assertEqual(raw, chapter_docx.build(chapter))
        chapter_docx.verify(raw, chapter)
        with ZipFile(BytesIO(raw)) as package:
            self.assertIn(b'https://example.org/reference', package.read("word/_rels/document.xml.rels"))

    def test_unsafe_or_missing_links_and_unsupported_markup_are_rejected(self):
        for prose in ["[x](javascript:alert(1))", "[x](https://user:password@example.org)", "[x][missing]", "![image](https://example.org/x)", "```python\nprint(1)\n```", "# Another title"]:
            with self.subTest(prose=prose), self.assertRaises(ValueError):
                manuscript_markdown.parse(("# Test\n\n" + prose).encode(), "fixture", "Test")

    def test_master_prologue_exports_without_changing_the_manuscript(self):
        path = release_v6.ROOT / release_v6.PROLOGUE
        original = path.read_bytes()
        title, blocks = manuscript_markdown.parse(original, "prologue", "Пролог")
        chapter_docx.build({"id": "prologue", "title": title, "version": "2.0", "blocks": blocks})
        self.assertEqual(path.read_bytes(), original)
        self.assertEqual(sum(bool(r.get("href")) for b in blocks for r in b.get("runs", [])), 2)

    def test_acceptance_applies_only_to_exact_source_and_review_files(self):
        source_root = release_v6.ROOT
        foundation = release_v6.outline.build()
        base = json.loads(foundation[release_v6.BOOK])
        chapter = next(c for c in base["chapters"] if c["id"] == "chapter-01")
        raw = ("# " + chapter["title"] + "\n\nEphemeral release-boundary fixture, never published.\n").encode()
        with tempfile.TemporaryDirectory(prefix="right-to-decide-export-test-") as directory:
            root = Path(directory)
            paths = [release_v6.PROLOGUE, Path("CONSTITUTION.md"), release_v6.outline.ARCHIVE,
                     *[Path("scripts") / name for name in ["publish-manuscript.py", "release_v6.py", "manuscript_markdown.py", "chapter_docx.py"]]]
            for path in paths:
                (root / path).parent.mkdir(parents=True, exist_ok=True)
                (root / path).write_bytes((source_root / path).read_bytes())
            source = root / release_v6.DIRECTORY / "chapter-01.md"
            source.parent.mkdir(parents=True, exist_ok=True)
            source.write_bytes(raw)
            review = Path("review-fixture.md")
            (root / review).write_text("Ephemeral independent-review fixture.", encoding="utf-8")
            review_hash = release_v6.outline.sha((root / review).read_bytes())
            accepted = {"schemaVersion": 1, "reviewer": "independent-test-reviewer", "chapters": [
                {"id": "chapter-01", "status": "accepted", "sha256": release_v6.outline.sha(raw), "review": review.as_posix(), "reviewSha256": review_hash}]}
            (root / release_v6.ACCEPTANCE).write_text(json.dumps(accepted), encoding="utf-8")
            with patch.object(release_v6, "ROOT", root), patch.object(release_v6.outline, "build", return_value=foundation):
                output = release_v6.build([1])
                book = json.loads(output[release_v6.BOOK])
                self.assertEqual(book["statistics"]["availableChapters"], 1)
                self.assertEqual(book["chapters"][-1]["status"], "planned")
                self.assertEqual(len([p for p in output if p.suffix == ".docx"]), 2)
                addition = release_v6.PROLOGUE.with_name("prologue-v2.1.md")
                addition_raw = "# Пролог\n\nEphemeral addition fixture.\n".encode()
                (root / addition).write_bytes(addition_raw)
                accepted["prologue"] = {"path": addition.as_posix(), "version": "2.1", "status": "accepted",
                                        "sha256": release_v6.outline.sha(addition_raw), "review": review.as_posix(), "reviewSha256": review_hash}
                (root / release_v6.ACCEPTANCE).write_text(json.dumps(accepted), encoding="utf-8")
                with_addition = json.loads(release_v6.build([1])[release_v6.BOOK])
                self.assertEqual(with_addition["chapters"][0]["version"], "2.1")
                self.assertEqual((root / release_v6.PROLOGUE).read_bytes(), (source_root / release_v6.PROLOGUE).read_bytes())
                (root / addition).write_bytes(addition_raw + b"Unreviewed change.\n")
                with self.assertRaisesRegex(ValueError, "exact Markdown revision"):
                    release_v6.build([1])
                del accepted["prologue"]
                (root / release_v6.ACCEPTANCE).write_text(json.dumps(accepted), encoding="utf-8")
                source.write_bytes(raw + b"\nNew unreviewed paragraph.\n")
                with self.assertRaisesRegex(ValueError, "exact Markdown revision"):
                    release_v6.build([1])
                source.write_bytes(raw)
                (root / review).write_text("Requires revision; not the accepted review.", encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "independent review changed"):
                    release_v6.build([1])
                (root / review).write_text("", encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "review file is empty"):
                    release_v6.build([1])


if __name__ == "__main__":
    unittest.main()
