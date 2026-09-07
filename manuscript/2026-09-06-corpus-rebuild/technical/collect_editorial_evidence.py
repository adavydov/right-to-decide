"""Collect existing editorial judgments; never create a whole-book acceptance."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re

CRITERIA = ("qualityOfThought", "argumentDramaturgy", "strongContradiction", "grounding",
            "scenarioHonesty", "futureMechanism", "realAuthorship", "threeResults",
            "multipleLayers", "livingLanguage", "chapterValue", "actionability")

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def local(base, value):
    path = (base / value).resolve()
    if not path.is_relative_to(base.resolve()) or not path.is_file():
        raise ValueError("Missing or nonlocal editorial evidence: " + value)
    return path

def criteria_from_review(path, expected):
    candidates = []
    for block in re.split(r"\n\s*\n", path.read_text(encoding="utf-8-sig")):
        rows = []
        for line in block.splitlines():
            if not line.strip().startswith("|"):
                continue
            cells = [x.strip() for x in line.strip().strip("|").split("|")]
            if len(cells) < 3:
                continue
            score = cells[-2].strip("* ")
            if re.fullmatch(r"[34](?:\s*/\s*4)?|N/A", score):
                rows.append({"score": "N/A" if score == "N/A" else int(score[0]), "reason": cells[-1]})
        if len(rows) == 12:
            candidates.append(rows)
    if not candidates:
        raise ValueError("No full table of 12 criteria: " + str(path))
    rows = candidates[-1]
    if [x["score"] for x in rows] != expected or any(not x["reason"] for x in rows):
        raise ValueError("Final table differs from accepted receipt: " + str(path))
    return [{"id": ident, **row} for ident, row in zip(CRITERIA, rows)]

def collect(base, include_appendix=False):
    ids = ["prologue"] + [f"chapter-{n:02}" for n in range(1, 19)] + ["epilogue"]
    if include_appendix:
        ids += ["appendix-d"]
    entries, checks = [], {}
    for ident in ids:
        receipt_rel = f"reviews/{ident}-integrator-acceptance.json"
        receipt_path = local(base, receipt_rel)
        receipt = json.loads(receipt_path.read_text(encoding="utf-8-sig"))
        expected_path = (f"chapters/{ident}.md" if ident.startswith("chapter-") else
                         "appendices/scenario-passport-v1.6.md" if ident == "appendix-d" else ident + ".md")
        if (receipt.get("version") != "9.0" or receipt.get("text") != expected_path
                or receipt.get("decision") != "accepted-agent-editorial"):
            raise ValueError("Unaccepted or wrong source: " + ident)
        text_path = local(base, expected_path)
        if sha(text_path) != receipt["sha256"]:
            raise ValueError("Accepted source has changed: " + ident)
        author = receipt["author"]
        reviewers = receipt["independentReviewers"]
        if not reviewers or author in reviewers:
            raise ValueError("Missing independent judgment: " + ident)
        authority = receipt["criteria_authority"]
        if authority not in receipt["reviews"]:
            raise ValueError("Criteria authority is not a recorded review: " + ident)
        for relative in receipt["reviews"] + [receipt_rel]:
            path = local(base, relative)
            checks[relative] = {"path": relative, "sha256": sha(path)}
        criteria = criteria_from_review(local(base, authority), receipt["criteria"])
        # The literary reviewer owns these table judgments; the receipt must name them.
        if "release_pipeline" not in reviewers:
            raise ValueError("Unexpected criteria reviewer; resolve explicitly: " + ident)
        entries.append({"id": ident, "path": expected_path, "sha256": sha(text_path),
                        "author": author, "independentReviewer": "release_pipeline",
                        "review": authority, "receipt": receipt_rel, "decision": receipt["decision"],
                        "unresolvedRequiredChanges": 0, "criteria": criteria})
    return {"schemaVersion": 1, "edition": "9.0", "status": "individual-editorial-evidence-only",
            "scope": "Exact existing receipts and final table reasons; no whole-book acceptance is created.",
            "texts": entries[:20], "supplements": entries[20:], "checks": list(checks.values())}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--include-appendix", action="store_true")
    args = parser.parse_args()
    base = Path(__file__).resolve().parents[1]
    result = collect(base, args.include_appendix)
    target = base / "technical/individual-editorial-evidence.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"status": result["status"], "texts": len(result["texts"]),
                      "appendices": len(result["supplements"]), "checks": len(result["checks"])}))
