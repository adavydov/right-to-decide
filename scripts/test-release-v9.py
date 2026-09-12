"""Negative v9 gate and dispatcher checks. Fixtures stay in memory; no release is created."""
from __future__ import annotations
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import release_v9 as release

ROOT = Path(__file__).resolve().parents[1]
SUPPLEMENTS = [{"path": "appendices/scenario-passport-v1.6.md", "id": "appendix-d"}]

class EditionNine(unittest.TestCase):
    def fixture(self):
        # Deliberately synthetic schema data, never written as editorial evidence.
        def criteria():
            return [{"id": key, "score": 3, "reason": "Schema test only"} for key in release.CRITERIA]
        paths = [release.input_path(i) for i in range(20)] + [SUPPLEMENTS[0]["path"]]
        entries = [{"path": p, "sha256": "a" * 64, "decision": "accepted-agent-editorial",
                    "unresolvedRequiredChanges": 0, "author": "fixture-writer", "independentReviewer": "fixture-reader",
                    "review": "fixture-review.md", "receipt": "fixture-receipt.json", "criteria": criteria()} for p in paths]
        entries[-1]["id"] = "appendix-d"
        return {"schemaVersion": 1, "edition": "9.0", "decision": "accepted-local-editorial-edition", "date": "2000-01-01",
                "texts": entries[:20], "supplements": entries[20:],
                "checks": [{"path": "fixture-review.md", "sha256": "b" * 64}, {"path": "fixture-receipt.json", "sha256": "c" * 64}],
                "wholeBook": {kind: {"path": "fixture-review.md", "sha256": "b" * 64, "decision": "pass",
                                     "unresolvedRequiredChanges": 0, "author": "fixture-writer", "independentReviewer": "fixture-reader",
                                     **({"criteria": criteria()} if kind == "criteria" else {})} for kind in release.WHOLE_BOOK}}

    def test_exact_selection_and_independence(self):
        release.validate_acceptance(self.fixture(), SUPPLEMENTS)
        mutations = [
            lambda a: a["texts"].pop(), lambda a: a["texts"].reverse(),
            lambda a: a["texts"][1].update(path=a["texts"][0]["path"]),
            lambda a: a["supplements"].clear(), lambda a: a["supplements"][0].update(id="appendix-a"),
            lambda a: a["texts"][0].update(independentReviewer="fixture-writer"),
            lambda a: a["texts"][0].update(receipt="unreviewed.json"),
            lambda a: a["texts"][0].update(unresolvedRequiredChanges=1),
            lambda a: a["wholeBook"].pop("withoutSpace"),
            lambda a: a["wholeBook"]["spaceOnly"].update(author=""),
            lambda a: a["wholeBook"]["criteria"].update(independentReviewer="fixture-writer"),
            lambda a: a["wholeBook"]["continuousReading"].update(sha256="d" * 64),
            lambda a: a["checks"].append(copy.deepcopy(a["checks"][0])),
        ]
        for mutate in mutations:
            changed = self.fixture(); mutate(changed)
            with self.subTest(mutation=mutations.index(mutate)), self.assertRaises(ValueError):
                release.validate_acceptance(changed, SUPPLEMENTS)

    def test_twelve_criteria_have_no_average_or_unexplained_na(self):
        good = self.fixture()["texts"][0]["criteria"]
        for score in (0, 1, 2, 5, True, 3.0, "3", None):
            changed = copy.deepcopy(good); changed[0]["score"] = score
            with self.subTest(score=score), self.assertRaises(ValueError): release.validate_criteria(changed)
        changed = copy.deepcopy(good); changed[0].update(score="N/A", reason="")
        with self.assertRaises(ValueError): release.validate_criteria(changed)
        changed[0]["reason"] = "Function is inapplicable in this schema fixture"
        release.validate_criteria(changed)
        for changed in (good[:-1], list(reversed(good)), [None] * 12):
            with self.assertRaises(ValueError): release.validate_criteria(changed)

    def test_below_threshold_fails_before_metadata_projection_or_writes(self):
        acceptance = self.fixture(); acceptance["texts"][0]["criteria"][0]["score"] = 2
        data = {release.BASE / "acceptance-v9.json": acceptance,
                release.BASE / "supplements.json": {"appendices": SUPPLEMENTS}}
        args = argparse.Namespace(edition="v9", check=False, chapters="1-18", epilogue=True)
        with patch.object(release, "read", side_effect=lambda p: data[p]), \
             patch.object(release.release_metadata, "read_metadata") as metadata, \
             patch.object(release.outline, "build") as projection, \
             patch.object(release.chapter_docx_v7, "build") as docx, \
             patch.object(Path, "mkdir") as mkdir, patch.object(Path, "write_bytes") as write:
            with self.assertRaisesRegex(ValueError, "below 3/4"):
                release.main(args, argparse.ArgumentParser(), lambda value: list(range(1, 19)))
            for operation in (metadata, projection, docx, mkdir, write): operation.assert_not_called()

    def dispatcher(self):
        spec = importlib.util.spec_from_file_location("v9_dispatcher_test", ROOT / "scripts/publish-manuscript.py")
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        return module

    def test_explicit_and_saved_v9_use_v9_gate(self):
        module = self.dispatcher()
        for args, selected in ((["--edition", "v9", "--check"], "8.0"), (["--check"], "9.0")):
            with self.subTest(args=args), patch.object(sys, "argv", ["publisher", *args]), \
                 patch.object(Path, "exists", return_value=True), patch.object(Path, "read_text", return_value=json.dumps({"editionVersion": selected})), \
                 patch.object(release, "main") as gate, patch.object(module, "build") as legacy:
                module.main(); gate.assert_called_once(); legacy.assert_not_called()

    def test_saved_unknown_edition_cannot_fall_back_to_legacy(self):
        module = self.dispatcher()
        with patch.object(sys, "argv", ["publisher", "--check"]), patch.object(Path, "exists", return_value=True), \
             patch.object(Path, "read_text", return_value=json.dumps({"editionVersion": "99.0"})), patch.object(module, "build") as legacy:
            with self.assertRaisesRegex(SystemExit, "No verified publisher"): module.main()
            legacy.assert_not_called()

    def test_ci_runs_the_selected_release_gate_before_export(self):
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        self.assertTrue(package["scripts"]["check"].startswith("npm run check:source &&"))
        self.assertIn("python scripts/test-release-v9.py", package["scripts"]["check:source"])
        self.assertTrue(package["scripts"]["check:source"].endswith("npm run check:release"))
        self.assertEqual(package["scripts"]["check:release"], "python scripts/check-selected-release.py")
        dispatcher = (ROOT / "scripts/check-selected-release.py").read_text(encoding="utf-8")
        self.assertIn("['scripts/publish-manuscript.py', '--check']", dispatcher)
        self.assertIn("book.get('editionVersion') == '10.0'", dispatcher)
        workflow = (ROOT / ".github/workflows/deploy-pages.yml").read_text(encoding="utf-8")
        self.assertLess(workflow.index("run: npm run check"), workflow.index("uses: actions/upload-pages-artifact"))
        self.assertIn("NEXT_PUBLIC_EDITORIAL_MODE: static", workflow)
        self.assertIn("needs: build", workflow)

if __name__ == "__main__": unittest.main()
