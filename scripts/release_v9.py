"""Publish only edition 9.0 sources with independent, exact-byte editorial receipts."""
from __future__ import annotations
import copy
import json
from pathlib import Path
import re
import constitution_contents as outline
import manuscript_v8
import manuscript_v7
import chapter_docx_v7
import sys
from datetime import date
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "manuscript/2026-09-06-corpus-rebuild/technical"))
import manuscript_v9
import release_metadata

ROOT = Path(__file__).resolve().parents[1]
BASE = Path("manuscript/2026-09-06-corpus-rebuild")
BOOK = Path("src/data/book.json")
BASELINE_BOOK = Path("docs/open-editorial/identity-transitions/archives/literary-manuscript-v8.0-f3c9128893a3/book.json")
BASELINE_RELEASE = Path("manuscript/2026-09-06-depth-revision/release-manifest.json")
GENERATORS = ["scripts/publish-manuscript.py", "scripts/release_v9.py", "scripts/manuscript_v8.py",
              "scripts/manuscript_v7.py", "scripts/chapter_docx_v7.py", "scripts/manuscript_markdown.py",
              "scripts/chapter_docx.py", str(BASE / "build-reading.py"),
              str(BASE / "technical/manuscript_v9.py"), str(BASE / "technical/release_metadata.py")]
AUTHOR_INSTRUCTION = "Ну все, все готово, пересобирай книгу и публикуй все"

def local(value, base=Path()):
    relative = Path(value)
    resolved = (ROOT / base / relative).resolve()
    if relative.is_absolute() or not resolved.is_relative_to(ROOT.resolve()):
        raise ValueError("Release evidence must stay within the site repository")
    return resolved.relative_to(ROOT.resolve())

def read(relative):
    return json.loads((ROOT / relative).read_text("utf-8-sig"))

def record(relative):
    relative = local(relative)
    return {"path": relative.as_posix(), "sha256": outline.sha((ROOT / relative).read_bytes())}

def checked(relative, digest, size=None):
    relative = local(relative)
    raw = (ROOT / relative).read_bytes()
    if not re.fullmatch(r"[a-fA-F0-9]{64}", str(digest)) or outline.sha(raw) != str(digest).lower():
        raise ValueError("Pinned source changed: " + relative.as_posix())
    if size is not None and len(raw) != size:
        raise ValueError("Pinned source length changed: " + relative.as_posix())
    return raw

def identifier(order):
    return "prologue" if order == 0 else "epilogue" if order == 19 else f"chapter-{order:02d}"

def input_path(order):
    ident = identifier(order)
    return ("chapters/" if 1 <= order <= 18 else "") + ident + ".md"

CRITERIA = ("qualityOfThought", "argumentDramaturgy", "strongContradiction", "grounding",
            "scenarioHonesty", "futureMechanism", "realAuthorship", "threeResults",
            "multipleLayers", "livingLanguage", "chapterValue", "actionability")
WHOLE_BOOK = ("continuousReading", "withoutSpace", "spaceOnly", "criteria")

def require(condition, message):
    if not condition:
        raise ValueError(message)

def validate_criteria(criteria):
    require(isinstance(criteria, list) and len(criteria) == 12, "Exactly 12 criteria are required")
    require(all(isinstance(item, dict) for item in criteria), "Criteria must be records")
    require([item.get("id") for item in criteria] == list(CRITERIA), "Criteria must be ordered and unique")
    for item in criteria:
        score = item.get("score")
        require((type(score) is int and score in (3, 4)) or score == "N/A", "Applicable criterion below 3/4")
        require(isinstance(item.get("reason"), str) and bool(item["reason"].strip()), "Every score and N/A needs its substantive reason")

def validate_acceptance(acceptance, supplements):
    require(acceptance.get("schemaVersion") == 1 and acceptance.get("edition") == "9.0"
            and acceptance.get("decision") == "accepted-local-editorial-edition", "Missing independent acceptance of edition 9.0")
    require(isinstance(acceptance.get("date"), str), "Actual acceptance date is required")
    require(date.fromisoformat(acceptance["date"]).isoformat() == acceptance["date"], "Invalid acceptance date")
    texts = acceptance.get("texts", [])
    require([e.get("path") for e in texts] == [input_path(i) for i in range(20)], "Acceptance requires exactly 20 ordered literary sources")
    extra = acceptance.get("supplements", [])
    require([(e.get("path"), e.get("id")) for e in extra] == [(e["path"], e["id"]) for e in supplements], "Appendix acceptance differs from explicit selection")
    all_entries = texts + extra
    require(len({e["path"] for e in all_entries}) == len(all_entries), "Duplicate accepted source")
    checks_list = acceptance.get("checks", [])
    checks = {e["path"]: e for e in checks_list}
    require(checks and len(checks) == len(checks_list), "Missing or duplicate pinned editorial checks")
    for entry in all_entries:
        require(entry.get("decision") == "accepted-agent-editorial" and entry.get("unresolvedRequiredChanges") == 0,
                "A source has no final acceptance or an unresolved required change: " + entry["path"])
        require(entry.get("author") and entry.get("independentReviewer") and entry["author"] != entry["independentReviewer"], "An author cannot accept their own source")
        require(entry.get("review") in checks and entry.get("receipt") in checks, "Final review or integrator receipt is not pinned")
        validate_criteria(entry.get("criteria"))
    for kind in WHOLE_BOOK:
        item = acceptance.get("wholeBook", {}).get(kind, {})
        require(item.get("path") in checks and item.get("sha256") == checks[item["path"]]["sha256"], "Missing pinned whole-book review: " + kind)
        require(item.get("decision") == "pass" and item.get("unresolvedRequiredChanges") == 0
                and item.get("author") and item.get("independentReviewer") and item["independentReviewer"] != item["author"], "Unaccepted whole-book review: " + kind)
    validate_criteria(acceptance["wholeBook"]["criteria"].get("criteria"))
    return checks, all_entries

def evidence():
    # Intentionally first: no projection, directories or documents before acceptance.
    acceptance_path = BASE / "acceptance-v9.json"
    acceptance = read(acceptance_path)
    supplement_path = BASE / "supplements.json"
    supplements = read(supplement_path).get("appendices")
    require(supplements == [{"path": "appendices/scenario-passport-v1.6.md", "id": "appendix-d"}], "Unexpected reader supplement selection")
    checks, accepted_sources = validate_acceptance(acceptance, supplements)
    metadata, metadata_record = release_metadata.read_metadata(ROOT, BASE / "release-metadata.json")
    require(acceptance["date"] <= metadata["releaseDate"], "Release date precedes final acceptance")
    baseline = read(BASELINE_RELEASE)
    checked(BASELINE_BOOK, baseline["bookSha256"])
    require(read(BASELINE_BOOK).get("releaseId") == "literary-manuscript-v8.0-f3c9128893a3", "Unexpected published baseline")
    pinned = [record(acceptance_path), record("CONSTITUTION.md"), record(BASELINE_BOOK), record(BASELINE_RELEASE),
              record(supplement_path), metadata_record]
    for item in checks.values():
        path = local(item["path"], BASE)
        checked(path, item["sha256"])
        pinned.append(record(path))
    for key in ("authorDecision", "policyCompletedBeforeProse"):
        path = local(acceptance[key], BASE)
        require(bool((ROOT / path).read_text("utf-8-sig").strip()), "Empty author/policy evidence")
        pinned.append(record(path))
    for policy in ("docs/editorial/AUTHOR-DECISION-2026-09-06-MERIT.md", "docs/editorial/MERIT-01-v1.0.md",
                   "docs/editorial/ACCEPTANCE-01-v3.0.md", "docs/editorial/LITERARY-POLICY-02-v1.0.md"):
        pinned.append(record(policy))
    assembly_path = BASE / "reading/assembly-v9.json"
    assembly = read(assembly_path)
    require(assembly.get("edition") == "9.0" and assembly.get("published") is False, "Missing local reading assembly for 9.0")
    require(assembly.get("releaseDate") == metadata["releaseDate"] and assembly.get("releaseMetadata") == metadata_record, "Reading date and release metadata differ")
    require(assembly.get("supplementsSelection") == record(supplement_path), "Supplement selection changed after assembly")
    inputs = assembly.get("inputs", [])
    require(len(inputs) == 21 and [e.get("order") for e in inputs] == list(range(21)), "Exactly 20 literary texts plus appendix D are required")
    pinned.append(record(assembly_path))
    for key in ("builder", "converter", "adapter", "parser"):
        path = local(assembly[key])
        checked(path, assembly[key + "Sha256"])
        pinned.append(record(path))
    require(assembly["parser"] == str(BASE / "technical/manuscript_v9.py").replace("\\", "/"), "Unexpected reader parser")
    meta_reader = record(BASE / "technical/release_metadata.py")
    require(assembly.get("releaseMetadataReader") == meta_reader, "Metadata reader changed after assembly")
    pinned.append(meta_reader)
    sources, reviews = [], []
    for order, (entry, accepted) in enumerate(zip(inputs, accepted_sources)):
        expected_path = input_path(order) if order < 20 else supplements[0]["path"]
        ident = identifier(order) if order < 20 else "appendix-d"
        require(entry.get("path") == expected_path and entry.get("id") == ident and entry.get("edition") == "9.0"
                and entry.get("kind") == ("literary" if order < 20 else "appendix"), "Unexpected assembly source")
        path = local(entry["path"], BASE)
        raw = checked(path, entry["sha256"])
        checked(path, accepted["sha256"])
        manuscript_v9.parse(raw, ident, entry["title"])
        receipt = read(local(accepted["receipt"], BASE))
        require(receipt.get("version") == "9.0" and receipt.get("text") == accepted["path"]
                and receipt.get("sha256", "").lower() == accepted["sha256"].lower()
                and receipt.get("decision") == "accepted-agent-editorial" and receipt.get("author") == accepted["author"], "Integrator receipt does not accept the exact source")
        require(accepted["independentReviewer"] in receipt.get("independentReviewers", [])
                and accepted["author"] not in receipt.get("independentReviewers", []), "Independent reviewer does not match receipt")
        require(receipt.get("criteria_authority") == accepted["review"] and receipt.get("criteria") == [c["score"] for c in accepted["criteria"]], "Final criteria differ from integrator receipt")
        require(accepted["review"] in receipt.get("reviews", []) and all(p in checks for p in receipt.get("reviews", [])), "All final specialist reports must be pinned")
        sources.append({**entry, "id": ident, "path": path.as_posix(), "sha256": entry["sha256"].lower()})
        reviews.append({"id": ident, "author": accepted["author"], "reviewer": accepted["independentReviewer"],
                        **record(local(accepted["review"], BASE)), "status": "independent-editorial-review",
                        "constitutionVersion": "1.2.1", "policySupplement": "MERIT-01 1.0"})
    source_set = outline.sha(outline.encoded([{ "path": e["path"], "sha256": e["sha256"].lower()} for e in accepted_sources]))
    for kind in WHOLE_BOOK:
        require(acceptance["wholeBook"][kind].get("sourceSetSha256") == source_set, "Whole-book review refers to a different source set")
    names = {"right-to-decide-v9.0" + suffix for suffix in (".md", ".docx", ".pdf")}
    require(len(assembly.get("outputs", [])) == 3 and {e.get("name") for e in assembly["outputs"]} == names, "Complete reading MD/DOCX/PDF required")
    reading = []
    for entry in assembly["outputs"]:
        path = BASE / "reading" / entry["name"]
        checked(path, entry["sha256"], entry["bytes"])
        pinned.append(record(path))
        reading.append({**entry, "sourcePath": path.as_posix(), "sha256": entry["sha256"].lower()})
    required = ("allInputHashesStable", "globalNoteDefinitionsSequential", "privatePathsAbsent", "completeVisibleTextMatchesMarkdown", "completePdfTextMatchesDocx")
    require(all(assembly.get("checks", {}).get(k) is True for k in required), "Reading verification incomplete")
    return assembly, acceptance, sources, reviews, reading, pinned

def selection_for(pinned):
    path = BASE / "publication-selection.json"
    selection = {"schemaVersion": 1, "editionVersion": "9.0", "authorInstruction": AUTHOR_INSTRUCTION,
                 "scope": "Новая редакция после независимой агентной приёмки; выпуск по прямому поручению автора.",
                 "newAuthorAcceptanceClaimed": False, "inputs": pinned}
    if (ROOT / path).exists() and read(path) != selection:
        raise ValueError("Pinned publication selection differs; issue an explicit new release receipt")
    return path, selection

def build():
    assembly, acceptance, sources, reviews, reading, pinned = evidence()
    selection_path, selection = selection_for(pinned)
    manifest_path = BASE / "release-manifest.json"
    foundation = outline.build()
    book = copy.deepcopy(read(BASELINE_BOOK))
    outputs = {path: raw for path, raw in foundation.items() if path != BOOK}
    by_id = {entry["id"]: entry for entry in sources}
    previous_book = read(BASELINE_BOOK)
    previous_chapters = {chapter["id"]: chapter for chapter in previous_book["chapters"]}
    preserved_sources = []
    require("appendix-d" not in {c["id"] for c in book["chapters"]}, "Reader appendix ID collides with baseline")
    extra = by_id["appendix-d"]
    book["chapters"].append({"id": "appendix-d", "number": "Д", "kind": "appendix", "part": None, "title": extra["title"], "blocks": []})
    book["notes"] = []
    downloads, expected_note_map = [], []
    for index, chapter in enumerate(book["chapters"]):
        source = by_id.get(chapter["id"])
        if source is None:
            continue
        previous = previous_chapters.get(chapter["id"])
        unchanged = previous is not None and source["sha256"] == previous["source"]["sha256"]
        parser_ = (manuscript_v7 if previous["blocks"][0]["id"].startswith("manuscript-v7-") else manuscript_v8) if unchanged else manuscript_v9
        title, blocks, notes, notes_heading = parser_.parse((ROOT / source["path"]).read_bytes(), chapter["id"], source["title"])
        if unchanged:
            previous_notes = [note for note in previous_book["notes"] if note.get("chapterId") == chapter["id"]]
            if blocks != previous["blocks"] or notes != previous_notes:
                raise ValueError("An unchanged source differs from its fixed baseline projection")
            blocks, notes = copy.deepcopy(previous["blocks"]), copy.deepcopy(previous_notes)
            preserved_sources.append({"id": chapter["id"], **previous["source"]})
        if chapter["kind"] == "chapter" and title != chapter["title"]:
            raise ValueError("Chapter title differs from constitutional architecture")
        chapter = {**chapter, "title": title, "blocks": blocks, "version": "1.6" if chapter["kind"] == "appendix" else "9.0", "contentKind": "manuscript",
                   "status": "available", "publicationStatus": "published",
                   "editorialStatus": "constitution-1.2.1-merit-01-reviewed",
                   "source": {"path": source["path"], "sha256": source["sha256"]}}
        if notes:
            chapter["notesHeading"] = notes_heading
        for note in notes:
            expected_note_map.append({"input": assembly["inputs"][source["order"]]["path"],
                                      "local": str(note["number"]), "global": len(book["notes"]) + 1})
            book["notes"].append(note)
        raw = chapter_docx_v7.build(chapter, notes)
        docx_path = Path("public/book/chapters") / (chapter["id"] + "-v9.0.docx")
        outputs[docx_path] = raw
        chapter["download"] = {"docx": "/" + docx_path.relative_to("public").as_posix(), "sha256": outline.sha(raw), "bytes": len(raw)}
        downloads.append({"id": chapter["id"], "path": docx_path.as_posix(), "sha256": outline.sha(raw), "sourceSha256": source["sha256"]})
        book["chapters"][index] = chapter
    if expected_note_map != assembly["noteMap"] or len(book["notes"]) != assembly["noteCount"]:
        raise ValueError("Web notes differ from the accepted reading assembly")
    reading_downloads, book_downloads = [], {}
    for item in reading:
        if not item["name"].endswith((".md", ".docx", ".pdf")):
            continue
        public_path = Path("public/book") / item["name"]
        outputs[public_path] = checked(item["sourcePath"], item["sha256"], item["bytes"])
        kind = Path(item["name"]).suffix[1:]
        item_record = {"path": "/" + public_path.relative_to("public").as_posix(), "sha256": item["sha256"], "bytes": item["bytes"]}
        book_downloads[kind] = item_record
        reading_downloads.append({"kind": kind, **item_record, "sourcePath": item["sourcePath"]})
    chapter_sources = [{"id": c["id"], "number": c["number"], **c["source"]} for c in book["chapters"] if c["id"] in by_id and (c["kind"] == "chapter" or c["id"] == "epilogue")]
    supplement_sources = [{"id": c["id"], "version": c["version"], **c["source"]} for c in book["chapters"] if c["id"] in by_id and c["kind"] == "appendix"]
    contents_source = next(c["source"] for c in book["chapters"] if c["id"] == "contents")
    prologue = book["chapters"][0]
    constitution = {**record("CONSTITUTION.md"), "version": "1.2.1"}
    generators = [record(path) for path in GENERATORS]
    identity = {"selection": selection, "constitution": constitution, "contents": contents_source, "sources": sources,
                "reviews": reviews, "generators": generators, "downloads": downloads, "readingDownloads": reading_downloads}
    source_hash = outline.sha(outline.encoded(identity))
    book.update({"edition": assembly["releaseDate"], "editionVersion": "9.0", "contentKind": "manuscript",
                 "releaseId": "literary-manuscript-v9.0-" + source_hash[:12], "downloads": book_downloads,
                 "source": {"filename": manifest_path.name, "path": manifest_path.as_posix(),
                            "format": "markdown-manuscript", "sha256": source_hash, "importer": "scripts/publish-manuscript.py",
                            "textPolicy": "Редакция 9.0. Тексты прошли независимую агентную редакционную проверку по Конституции 1.2.1 и MERIT-01. Сайт, Word и PDF собраны из зафиксированных исходников. Читательское тестирование, внешняя экспертиза и проведённый пилот не заявляются."}})
    blocks = [b for c in book["chapters"] for b in c["blocks"]] + [b for n in book["notes"] for b in n["blocks"]]
    text = "\n\n".join("\n".join("\t".join(row) for row in b["rows"]) if b["type"] == "table" else b["text"] for b in blocks)
    book["statistics"] = {"sections": len(book["chapters"]), "chapters": 18, "parts": 6, "availableChapters": 18,
                          "plannedChapters": 0, "blocks": len(blocks), "notes": len(book["notes"]),
                          "words": len(re.findall(r"\S+", text)), "characters": len(text)}
    selection_raw = outline.encoded(selection)
    manifest = {"schemaVersion": 5, "releaseDate": assembly["releaseDate"], "releaseId": book["releaseId"], "editionVersion": "9.0", "architectureVersion": "5.1",
                "chapterNumbers": list(range(1, 19)), "includesEpilogue": True, "chapters": chapter_sources, "supplements": supplement_sources,
                "authorContents": contents_source, "prologue": prologue["source"], "constitution": constitution,
                "prologueSelection": {**prologue["source"], "version": "9.0", "status": "accepted"},
                "masterPrologue": {**record("manuscript/2026-09-05-rebuild/prologue-v2.0.md"), "version": "2.0"},
                "acceptanceStatus": "independent-editorial-review", "acceptance": record(BASE / "acceptance-v9.json"),
                "assembly": record(BASE / "reading/assembly-v9.json"), "noteCount": len(book["notes"]),
                "baselineBook": record(BASELINE_BOOK), "baselineRelease": record(BASELINE_RELEASE), "preservedSources": preserved_sources,
                "selection": {"path": selection_path.as_posix(), "sha256": outline.sha(selection_raw)},
                "reviews": reviews, "wholeBookReviewScope": acceptance["wholeBook"],
                "downloads": downloads, "readingDownloads": reading_downloads, "archive": record(outline.ARCHIVE),
                "bookSha256": outline.sha(outline.encoded(book)), "generators": generators,
                "published": True, "newAuthorAcceptanceClaimed": False,
                "scope": "Двадцать зафиксированных текстов редакции 9.0 и отдельно принятое приложение Д 1.6 по прямому поручению написать и опубликовать новую редакцию."}
    outputs.update({BOOK: outline.encoded(book), manifest_path: outline.encoded(manifest), selection_path: selection_raw})
    return outputs

def main(args, parser, chapter_selection):
    if args.edition not in {None, "v9"}:
        parser.error("Choose --edition v9")
    if not args.check and (not args.chapters or chapter_selection(args.chapters) != list(range(1, 19)) or not args.epilogue):
        parser.error("A v9 release requires --chapters 1-18 --epilogue")
    outputs = build()
    for relative, raw in outputs.items():
        target = ROOT / relative
        if args.check:
            if target.read_bytes() != raw:
                raise ValueError("Generated v9 release differs: " + relative.as_posix())
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
    print("MANUSCRIPT V9.0 SOURCE, NOTES AND DOWNLOAD CHECK OK" if args.check else "MANUSCRIPT V9.0 BUILT: 20 literary sections and appendix D")
