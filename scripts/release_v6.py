"""Build literary releases with an explicit constitutional basis and exact acceptance."""
from __future__ import annotations

import copy
import json
from pathlib import Path
import re

import chapter_docx
import constitution_contents as outline
import manuscript_markdown

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = Path("manuscript/2026-09-05-rebuild/chapters-v6")
MANIFEST = DIRECTORY / "release-manifest.json"
ACCEPTANCE = DIRECTORY / "acceptance.json"
PROLOGUE = Path("manuscript/2026-09-05-rebuild/prologue-v2.0.md")
BOOK = Path("src/data/book.json")


def local_path(value):
    relative = Path(value)
    resolved = (ROOT / relative).resolve()
    if relative.is_absolute() or not resolved.is_relative_to(ROOT.resolve()):
        raise ValueError("Release evidence must be a file within the site repository")
    return relative


def parsed_chapter(chapter, relative, version):
    raw = (ROOT / relative).read_bytes()
    title, blocks = manuscript_markdown.parse(raw, chapter["id"], chapter["title"])
    return {**chapter, "title": chapter["title"] if chapter["kind"] == "chapter" else title,
            "blocks": blocks, "version": version, "contentKind": "manuscript", "status": "available",
            "publicationStatus": "published", "source": {"path": relative.as_posix(), "sha256": outline.sha(raw)}}


def verified_review(chapter, review, default_reviewer):
    if review.get("status") != "accepted" or review.get("sha256") != chapter["source"]["sha256"]:
        raise ValueError(chapter["id"] + ": missing acceptance for the exact Markdown revision")
    review_path = local_path(review["review"])
    review_raw = (ROOT / review_path).read_bytes()
    if not review_raw.strip():
        raise ValueError(chapter["id"] + ": independent review file is empty")
    if outline.sha(review_raw) != review.get("reviewSha256"):
        raise ValueError(chapter["id"] + ": independent review changed since acceptance")
    return {"id": chapter["id"], "reviewer": review.get("reviewer", default_reviewer),
            "path": review_path.as_posix(), "sha256": outline.sha(review_raw)}


def build(numbers, include_epilogue=False):
    if not numbers or numbers != sorted(set(numbers)) or any(n not in range(1, 19) for n in numbers):
        raise ValueError("Select at least one unique numbered chapter within 1-18")
    foundation = outline.build()
    book = copy.deepcopy(json.loads(foundation[BOOK]))
    acceptance_raw = (ROOT / ACCEPTANCE).read_bytes()
    acceptance = json.loads(acceptance_raw)
    if acceptance.get("schemaVersion") != 1 or not acceptance.get("reviewer"):
        raise ValueError("acceptance.json needs schemaVersion 1 and an independent reviewer")
    constitution_version = acceptance.get("constitutionVersion", "1.1")
    prologue_selection = acceptance.get("prologue", {
        "path": PROLOGUE.as_posix(), "version": "2.0", "status": "author-approved-master"})
    prologue_path = local_path(prologue_selection["path"])
    if not re.fullmatch(r"\d+(?:\.\d+)+", prologue_selection["version"]):
        raise ValueError("Prologue version must be an explicit numeric edition")
    entries = acceptance.get("chapters", [])
    accepted = {entry["id"]: entry for entry in entries}
    if len(accepted) != len(entries):
        raise ValueError("Duplicate chapter in acceptance.json")
    selected = {f"chapter-{n:02d}" for n in numbers} | ({"epilogue"} if include_epilogue else set())
    sources, reviews, downloads = [], [], []
    outputs = {path: raw for path, raw in foundation.items() if path != BOOK}
    for index, chapter in enumerate(book["chapters"]):
        if chapter["id"] == "prologue":
            chapter = parsed_chapter(chapter, prologue_path, prologue_selection["version"])
            if prologue_path == PROLOGUE and chapter["version"] == "2.0":
                chapter["editorialStatus"] = "author-approved-master"
            else:
                reviews.append(verified_review(chapter, prologue_selection, acceptance["reviewer"]))
                chapter["editorialStatus"] = "independently-reviewed-author-requested-addition"
        elif chapter["id"] in selected:
            chapter = parsed_chapter(chapter, DIRECTORY / (chapter["id"] + ".md"), "6.0")
            review = accepted.get(chapter["id"], {})
            verified = verified_review(chapter, review, acceptance["reviewer"])
            basis = review.get("constitutionVersion", constitution_version)
            if "constitutionBasis" in review:
                basis_record = review["constitutionBasis"]
                basis_path = local_path(basis_record["path"])
                if outline.sha((ROOT / basis_path).read_bytes()) != basis_record["sha256"]:
                    raise ValueError(chapter["id"] + ": constitutional review basis changed")
                verified["constitutionBasis"] = basis_record
            supporting = []
            for extra in review.get("supportingReviews", []):
                extra_path = local_path(extra["path"])
                extra_raw = (ROOT / extra_path).read_bytes()
                if not extra_raw.strip():
                    raise ValueError(chapter["id"] + ": supporting review is empty")
                if outline.sha(extra_raw) != extra.get("sha256"):
                    raise ValueError(chapter["id"] + ": supporting review changed since acceptance")
                supporting.append({"path": extra_path.as_posix(), "sha256": outline.sha(extra_raw)})
            if supporting:
                verified["supportingReviews"] = supporting
            chapter["editorialStatus"] = "constitution-" + basis + "-reviewed"
            sources.append({"id": chapter["id"], "number": chapter["number"], **chapter["source"]})
            reviews.append({**verified, "constitutionVersion": basis})
        if chapter["status"] == "available" and chapter["contentKind"] == "manuscript":
            docx_path = Path("public/book/chapters") / (chapter["id"] + "-v" + chapter["version"] + ".docx")
            raw = chapter_docx.build(chapter)
            outputs[docx_path] = raw
            chapter["download"] = {"docx": "/" + docx_path.relative_to("public").as_posix(), "sha256": outline.sha(raw), "bytes": len(raw)}
            downloads.append({"id": chapter["id"], "path": docx_path.as_posix(), "sha256": outline.sha(raw),
                              "sourceSha256": chapter["source"]["sha256"]})
        book["chapters"][index] = chapter
    prologue_source = book["chapters"][0]["source"]
    contents_source = book["chapters"][1]["source"]
    book_reviews = acceptance.get("bookReviews", [])
    if numbers == list(range(1, 19)) and include_epilogue:
        required = {"argument-without-space", "space-continuity"}
        if {item.get("id") for item in book_reviews} != required or len(book_reviews) != 2:
            raise ValueError("A complete book requires both independent whole-book reviews")
    for item in book_reviews:
        review_path = local_path(item["path"])
        review_raw = (ROOT / review_path).read_bytes()
        if item.get("status") != "accepted" or outline.sha(review_raw) != item.get("sha256"):
            raise ValueError("Whole-book review is not accepted at its exact revision: " + item["id"])
        expected_hashes = {"prologue": prologue_source["sha256"], **{s["id"]: s["sha256"] for s in sources}}
        if item.get("sourceHashes") != expected_hashes:
            raise ValueError("Whole-book review does not cover this exact text selection: " + item["id"])
    constitution = {"path": "CONSTITUTION.md", "version": constitution_version,
                    "sha256": outline.sha((ROOT / "CONSTITUTION.md").read_bytes())}
    master_prologue = {"path": PROLOGUE.as_posix(), "version": "2.0", "sha256": outline.sha((ROOT / PROLOGUE).read_bytes())}
    identity = {"constitution": constitution, "contents": contents_source, "prologue": prologue_source,
                "prologueSelection": prologue_selection,
                "chapters": sources, "reviews": reviews, "bookReviews": book_reviews}
    source_hash = outline.sha(outline.encoded(identity))
    book["contentKind"] = "manuscript"
    book["editionVersion"] = "6.0"
    book["releaseId"] = "literary-manuscript-v6-" + source_hash[:12]
    book["source"] = {"filename": MANIFEST.name, "path": MANIFEST.as_posix(), "format": "markdown-manuscript", "sha256": source_hash,
                      "importer": "scripts/publish-manuscript.py", "textPolicy": "Редакция 6.0. Действующая конституция " + constitution_version + "; основание приёмки каждой главы указано отдельно. Опубликован пролог " + prologue_selection["version"] + ", мастер 2.0 сохранён. Главы включены после независимого редакционного чтения и сверки точной версии; DOCX и сайт собраны из одного Markdown."}
    blocks = [b for c in book["chapters"] for b in c["blocks"]]
    text = "\n\n".join(b["text"] for b in blocks)
    book["statistics"] = {"sections": len(book["chapters"]), "chapters": 18, "parts": 6,
                          "availableChapters": len(numbers), "plannedChapters": 18 - len(numbers),
                          "blocks": len(blocks), "notes": 0, "words": len(re.findall(r"\S+", text)), "characters": len(text)}
    manifest = {"schemaVersion": 2, "releaseId": book["releaseId"], "editionVersion": "6.0", "architectureVersion": "5.1",
                "chapterNumbers": numbers, "includesEpilogue": include_epilogue, "chapters": sources,
                "authorContents": contents_source, "prologue": prologue_source, "constitution": constitution,
                "prologueSelection": prologue_selection, "masterPrologue": master_prologue,
                "acceptanceStatus": "independent-editorial-review", "acceptance": {"path": ACCEPTANCE.as_posix(), "sha256": outline.sha(acceptance_raw)},
                "reviews": reviews, "bookReviews": book_reviews, "downloads": downloads,
                "archive": {"path": outline.ARCHIVE.as_posix(), "sha256": outline.sha((ROOT / outline.ARCHIVE).read_bytes())},
                "bookSha256": outline.sha(outline.encoded(book)),
                "generators": [{"path": "scripts/" + name, "sha256": outline.sha((ROOT / "scripts" / name).read_bytes())}
                               for name in ["publish-manuscript.py", "release_v6.py", "manuscript_markdown.py", "chapter_docx.py"]],
                "scope": "Пересборка явно выбранных глав с сохранением конституционной основы их приёмки. Новая редакция конституции не означает ретроактивной переработки или приёмки прежних глав. Агентная проверка не объявляется внешней экспертизой или проведённым практическим пилотом."}
    outputs[BOOK] = outline.encoded(book)
    outputs[MANIFEST] = outline.encoded(manifest)
    return outputs


def main(args, parser, chapter_selection):
    if args.check:
        saved = json.loads((ROOT / MANIFEST).read_text("utf-8"))
        numbers = saved["chapterNumbers"]
        epilogue = saved["includesEpilogue"]
    else:
        if not args.chapters:
            parser.error("Edition v6 requires --chapters with the complete reviewed release selection")
        numbers = chapter_selection(args.chapters)
        epilogue = args.epilogue
        if (ROOT / MANIFEST).exists():
            previous = json.loads((ROOT / MANIFEST).read_text("utf-8"))
            if not set(previous["chapterNumbers"]).issubset(numbers) or (previous["includesEpilogue"] and not epilogue):
                raise ValueError("Keep every section already published in edition v6")
    outputs = build(numbers, epilogue)
    for relative, raw in outputs.items():
        target = ROOT / relative
        if args.check:
            if target.read_bytes() != raw:
                raise ValueError("Generated v6 release differs: " + relative.as_posix())
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
    print("MANUSCRIPT V6 SOURCE AND DOCX CHECK OK" if args.check else "MANUSCRIPT V6 BUILT: " + ", ".join(map(str, numbers)) + ("; epilogue" if epilogue else ""))
