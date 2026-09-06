"""Boundaries for edition 8.0; test prose and receipts never enter manuscript files."""
from __future__ import annotations
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import manuscript_v7
import manuscript_v8
import release_v8

class EditionEight(unittest.TestCase):
    def acceptance(self):
        return {
            "edition": "8.0", "decision": "accepted-local-editorial-edition",
            "texts": [{"path": release_v8.input_path(i), "sha256": "a" * 64,
                       "author": "writer", "independentReviewer": "reviewer",
                       "review": "independent-review.md", "decision": "accepted-agent-editorial"} for i in range(20)],
            "checks": [{"path": "independent-review.md", "sha256": "b" * 64}],
            "wholeBook": {key: {"path": "independent-review.md", "sha256": "b" * 64}
                          for key in ("continuousReading", "withoutSpace", "spaceOnly", "criteria")}
        }

    def test_new_anchor_namespace_preserves_every_word_and_note(self):
        raw = "# Проверка\n\nСлово **точно**[1].\n\n## Источники\n\n[1] [Источник](https://example.org/source).\n".encode()
        old = manuscript_v7.parse(raw, "chapter-01")
        new = manuscript_v8.parse(raw, "chapter-01")
        self.assertEqual(json.dumps(new, ensure_ascii=False).replace("manuscript-v8-", "manuscript-v7-"),
                         json.dumps(old, ensure_ascii=False))
        self.assertNotEqual(new[1][0]["id"], old[1][0]["id"])
        self.assertEqual(new[1][0]["runs"][-2]["noteId"], new[2][0]["id"])

    def test_literal_anchor_like_prose_is_not_rewritten(self):
        raw = b"# Test\n\nThe string manuscript-v7-chapter-01 stays literal.\n"
        self.assertEqual(manuscript_v8.parse(raw, "chapter-01")[1][0]["text"],
                         "The string manuscript-v7-chapter-01 stays literal.")

    def test_missing_notes_remain_a_failure(self):
        for body in ("Text[1].", "Text.\n\n## Источники\n\n[1] Unused."):
            with self.subTest(body=body), self.assertRaises(ValueError):
                manuscript_v8.parse(("# Test\n\n" + body).encode(), "chapter-01")

    def test_exact_selection_and_independence(self):
        release_v8.validate_acceptance(self.acceptance())
        mutations = [
            lambda a: a["texts"].pop(),
            lambda a: a["texts"].reverse(),
            lambda a: a["texts"][1].update(path=a["texts"][0]["path"]),
            lambda a: a["texts"][0].update(independentReviewer="writer"),
            lambda a: a["texts"][0].update(review="unreviewed.md"),
            lambda a: a["wholeBook"].pop("spaceOnly"),
            lambda a: a["wholeBook"]["criteria"].update(sha256="c" * 64),
            lambda a: a.update(decision="draft"),
        ]
        for mutate in mutations:
            changed = self.acceptance()
            mutate(changed)
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                release_v8.validate_acceptance(changed)

    def test_changed_source_review_or_selection_cannot_refresh_silently(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(release_v8, "ROOT", Path(folder)):
            for name in ("source.md", "review.md"):
                p = Path(folder) / name
                p.write_bytes(b"accepted")
                digest = release_v8.outline.sha(p.read_bytes())
                self.assertEqual(release_v8.checked(name, digest), b"accepted")
                p.write_bytes(b"changed")
                with self.assertRaises(ValueError):
                    release_v8.checked(name, digest)
            relative, receipt = release_v8.selection_for([{"path": "review.md", "sha256": "a" * 64}])
            p = Path(folder) / relative
            p.parent.mkdir(parents=True)
            p.write_bytes(release_v8.outline.encoded(receipt))
            with self.assertRaises(ValueError):
                release_v8.selection_for([{"path": "review.md", "sha256": "b" * 64}])

    def test_paths_cannot_escape_public_repository(self):
        for value in ("../book-memory/source.md", "../../private", str(release_v8.ROOT / "CONSTITUTION.md")):
            with self.subTest(value=value), self.assertRaises(ValueError):
                release_v8.local(value)

if __name__ == "__main__":
    unittest.main()
