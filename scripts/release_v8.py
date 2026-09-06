"""Publish only edition 8.0 sources with independent, exact-byte editorial receipts."""
from __future__ import annotations
import copy
import json
from pathlib import Path
import re
import constitution_contents as outline
import manuscript_v8
import manuscript_v7
import chapter_docx_v7

ROOT = Path(__file__).resolve().parents[1]
BASE = Path("manuscript/2026-09-06-depth-revision")
BOOK = Path("src/data/book.json")
BASELINE_BOOK = Path("docs/open-editorial/identity-transitions/archives/literary-manuscript-v7.1-163743358797/book.json")
BASELINE_RELEASE = Path("manuscript/2026-09-06-davydov-cases/release-manifest.json")
GENERATORS = ["scripts/publish-manuscript.py", "scripts/release_v8.py", "scripts/manuscript_v8.py",
              "scripts/manuscript_v7.py", "scripts/chapter_docx_v7.py", "scripts/manuscript_markdown.py",
              "scripts/chapter_docx.py", "scripts/build-reading-v8.py"]
AUTHOR_INSTRUCTION = "пиши новую литературную редакцию и публикуй"

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

def validate_acceptance(acceptance):
    if acceptance.get("edition") != "8.0" or acceptance.get("decision") != "accepted-local-editorial-edition":
        raise ValueError("Missing independent acceptance of edition 8.0")
    entries = acceptance.get("texts", [])
    if [entry.get("path") for entry in entries] != [input_path(i) for i in range(20)]:
        raise ValueError("Acceptance requires exactly twenty ordered, unique source paths")
    checks = {entry["path"]: entry for entry in acceptance.get("checks", [])}
    if len(checks) != len(acceptance.get("checks", [])) or not checks:
        raise ValueError("Missing or duplicate pinned editorial checks")
    for entry in entries:
        if entry.get("decision") != "accepted-agent-editorial" or not entry.get("author") or not entry.get("independentReviewer") or entry["author"] == entry["independentReviewer"]:
            raise ValueError("An author cannot accept their own source: " + entry["path"])
        if entry.get("review") not in checks:
            raise ValueError("Independent review is not pinned: " + entry["path"])
    for kind in ("continuousReading", "withoutSpace", "spaceOnly", "criteria"):
        entry = acceptance.get("wholeBook", {}).get(kind, {})
        if entry.get("path") not in checks or entry.get("sha256", "").lower() != checks[entry["path"]]["sha256"].lower():
            raise ValueError("Whole-book evidence is missing or not pinned: " + kind)
    return checks

def evidence():
    acceptance_path = BASE / "acceptance-v8.json"
    acceptance = read(acceptance_path)
    checks = validate_acceptance(acceptance)
    baseline = read(BASELINE_RELEASE)
    checked(BASELINE_BOOK, baseline["bookSha256"])
    if read(BASELINE_BOOK).get("releaseId") != "literary-manuscript-v7.1-163743358797":
        raise ValueError("Unexpected fixed baseline edition")
    pinned = [record(acceptance_path), record("CONSTITUTION.md"), record(BASELINE_BOOK), record(BASELINE_RELEASE)]
    for entry in checks.values():
        path = local(entry["path"], BASE)
        checked(path, entry["sha256"])
        pinned.append(record(path))
    for key in ("authorDecision", "policyCompletedBeforeProse"):
        path = local(acceptance[key], BASE)
        if not (ROOT / path).read_text("utf-8-sig").strip():
            raise ValueError("Empty author/policy evidence")
        pinned.append(record(path))
    for path in ("docs/editorial/AUTHOR-DECISION-2026-09-06-MERIT.md",
                 "docs/editorial/MERIT-01-v1.0.md", "docs/editorial/MERIT-01-v1.0-validation.md"):
        pinned.append(record(path))
    assembly_path = BASE / "reading/assembly-v8.json"
    assembly = read(assembly_path)
    if assembly.get("edition") != "8.0" or assembly.get("published") is not False:
        raise ValueError("Missing local reading assembly for 8.0")
    if [entry.get("order") for entry in assembly.get("inputs", [])] != list(range(20)):
        raise ValueError("The reading assembly must contain ordered sections 0-19")
    pinned.append(record(assembly_path))
    for key in ("builder", "converter", "adapter"):
        path = local(assembly[key])
        checked(path, assembly[key + "Sha256"])
        pinned.append(record(path))
    sources, reviews = [], []
    for order, (entry, accepted) in enumerate(zip(assembly["inputs"], acceptance["texts"])):
        if entry["path"] != input_path(order) or entry.get("edition") != "8.0":
            raise ValueError("Unexpected selected source path or edition")
        path = local(entry["path"], BASE)
        checked(path, entry["sha256"])
        checked(path, accepted["sha256"])
        ident = identifier(order)
        sources.append({**entry, "id": ident, "path": path.as_posix(), "sha256": entry["sha256"].lower()})
        reviews.append({"id": ident, "author": accepted["author"], "reviewer": accepted["independentReviewer"],
                        **record(local(accepted["review"], BASE)), "status": "independent-editorial-review",
                        "constitutionVersion": "1.2.1", "policySupplement": "MERIT-01 1.0"})
    if {entry.get("name") for entry in assembly.get("outputs", [])} != {"right-to-decide-v8.0" + suffix for suffix in (".md", ".docx", ".pdf")}:
        raise ValueError("Complete reading Markdown, Word and PDF are required")
    reading = []
    for entry in assembly["outputs"]:
        path = BASE / "reading" / entry["name"]
        checked(path, entry["sha256"], entry["bytes"])
        pinned.append(record(path))
        reading.append({**entry, "sourcePath": path.as_posix(), "sha256": entry["sha256"].lower()})
    required = ("allInputHashesStable", "globalNoteDefinitionsSequential", "privatePathsAbsent",
                "completeVisibleTextMatchesMarkdown", "completePdfTextMatchesDocx")
    if any(assembly.get("checks", {}).get(key) is not True for key in required):
        raise ValueError("Reading artifact verification is incomplete")
    return assembly, acceptance, sources, reviews, reading, pinned

def selection_for(pinned):
    path = BASE / "publication-selection.json"
    selection = {"schemaVersion": 1, "editionVersion": "8.0", "authorInstruction": AUTHOR_INSTRUCTION,
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
    book = copy.deepcopy(json.loads(foundation[BOOK]))
    outputs = {path: raw for path, raw in foundation.items() if path != BOOK}
    by_id = {entry["id"]: entry for entry in sources}
    previous_book = read(BASELINE_BOOK)
    previous_chapters = {chapter["id"]: chapter for chapter in previous_book["chapters"]}
    preserved_sources = []
    book["notes"] = []
    downloads, expected_note_map = [], []
    for index, chapter in enumerate(book["chapters"]):
        source = by_id.get(chapter["id"])
        if source is None:
            continue
        previous = previous_chapters[chapter["id"]]
        unchanged = source["sha256"] == previous["source"]["sha256"]
        parser_ = manuscript_v7 if unchanged else manuscript_v8
        title, blocks, notes, notes_heading = parser_.parse((ROOT / source["path"]).read_bytes(), chapter["id"], source["title"])
        if unchanged:
            previous_notes = [note for note in previous_book["notes"] if note.get("chapterId") == chapter["id"]]
            if blocks != previous["blocks"] or notes != previous_notes:
                raise ValueError("An unchanged source differs from its fixed baseline projection")
            blocks, notes = copy.deepcopy(previous["blocks"]), copy.deepcopy(previous_notes)
            preserved_sources.append({"id": chapter["id"], **previous["source"]})
        if chapter["kind"] == "chapter" and title != chapter["title"]:
            raise ValueError("Chapter title differs from constitutional architecture")
        chapter = {**chapter, "title": title, "blocks": blocks, "version": "8.0", "contentKind": "manuscript",
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
        docx_path = Path("public/book/chapters") / (chapter["id"] + "-v8.0.docx")
        outputs[docx_path] = raw
        chapter["download"] = {"docx": "/" + docx_path.relative_to("public").as_posix(), "sha256": outline.sha(raw), "bytes": len(raw)}
        downloads.append({"id": chapter["id"], "path": docx_path.as_posix(), "sha256": outline.sha(raw), "sourceSha256": source["sha256"]})
        book["chapters"][index] = chapter
    if expected_note_map != assembly["noteMap"] or len(book["notes"]) != assembly["noteCount"]:
        raise ValueError("Web notes differ from the accepted reading assembly")
    reading_downloads, book_downloads = [], {}
    for item in reading:
        if not item["name"].endswith((".docx", ".pdf")):
            continue
        public_path = Path("public/book") / item["name"]
        outputs[public_path] = checked(item["sourcePath"], item["sha256"], item["bytes"])
        kind = Path(item["name"]).suffix[1:]
        item_record = {"path": "/" + public_path.relative_to("public").as_posix(), "sha256": item["sha256"], "bytes": item["bytes"]}
        book_downloads[kind] = item_record
        reading_downloads.append({"kind": kind, **item_record, "sourcePath": item["sourcePath"]})
    chapter_sources = [{"id": c["id"], "number": c["number"], **c["source"]} for c in book["chapters"] if c["id"] in by_id and c["id"] != "prologue"]
    contents_source = next(c["source"] for c in book["chapters"] if c["id"] == "contents")
    prologue = book["chapters"][0]
    constitution = {**record("CONSTITUTION.md"), "version": "1.2.1"}
    generators = [record(path) for path in GENERATORS]
    identity = {"selection": selection, "constitution": constitution, "contents": contents_source, "sources": sources,
                "reviews": reviews, "generators": generators, "downloads": downloads, "readingDownloads": reading_downloads}
    source_hash = outline.sha(outline.encoded(identity))
    book.update({"edition": "2026-09-06", "editionVersion": "8.0", "contentKind": "manuscript",
                 "releaseId": "literary-manuscript-v8.0-" + source_hash[:12], "downloads": book_downloads,
                 "source": {"filename": manifest_path.name, "path": manifest_path.as_posix(),
                            "format": "markdown-manuscript", "sha256": source_hash, "importer": "scripts/publish-manuscript.py",
                            "textPolicy": "Редакция 8.0. Тексты прошли независимую агентную редакционную проверку по Конституции 1.2.1 и MERIT-01. Сайт, Word и PDF собраны из зафиксированных исходников. Читательское тестирование, внешняя экспертиза и проведённый пилот не заявляются."}})
    blocks = [b for c in book["chapters"] for b in c["blocks"]] + [b for n in book["notes"] for b in n["blocks"]]
    text = "\n\n".join("\n".join("\t".join(row) for row in b["rows"]) if b["type"] == "table" else b["text"] for b in blocks)
    book["statistics"] = {"sections": len(book["chapters"]), "chapters": 18, "parts": 6, "availableChapters": 18,
                          "plannedChapters": 0, "blocks": len(blocks), "notes": len(book["notes"]),
                          "words": len(re.findall(r"\S+", text)), "characters": len(text)}
    selection_raw = outline.encoded(selection)
    manifest = {"schemaVersion": 4, "releaseId": book["releaseId"], "editionVersion": "8.0", "architectureVersion": "5.1",
                "chapterNumbers": list(range(1, 19)), "includesEpilogue": True, "chapters": chapter_sources,
                "authorContents": contents_source, "prologue": prologue["source"], "constitution": constitution,
                "prologueSelection": {**prologue["source"], "version": "8.0", "status": "accepted"},
                "masterPrologue": {**record("manuscript/2026-09-05-rebuild/prologue-v2.0.md"), "version": "2.0"},
                "acceptanceStatus": "independent-editorial-review", "acceptance": record(BASE / "acceptance-v8.json"),
                "assembly": record(BASE / "reading/assembly-v8.json"), "noteCount": len(book["notes"]),
                "baselineBook": record(BASELINE_BOOK), "baselineRelease": record(BASELINE_RELEASE), "preservedSources": preserved_sources,
                "selection": {"path": selection_path.as_posix(), "sha256": outline.sha(selection_raw)},
                "reviews": reviews, "wholeBookReviewScope": acceptance["wholeBook"],
                "downloads": downloads, "readingDownloads": reading_downloads, "archive": record(outline.ARCHIVE),
                "bookSha256": outline.sha(outline.encoded(book)), "generators": generators,
                "published": True, "newAuthorAcceptanceClaimed": False,
                "scope": "Двадцать зафиксированных текстов редакции 8.0 по прямому поручению написать и опубликовать новую редакцию."}
    outputs.update({BOOK: outline.encoded(book), manifest_path: outline.encoded(manifest), selection_path: selection_raw})
    return outputs

def main(args, parser, chapter_selection):
    if args.edition not in {None, "v8"}:
        parser.error("Choose --edition v8")
    if not args.check and (not args.chapters or chapter_selection(args.chapters) != list(range(1, 19)) or not args.epilogue):
        parser.error("A v8 release requires --chapters 1-18 --epilogue")
    if args.check and not (ROOT / BASE / "publication-selection.json").exists():
        raise ValueError("No pinned v8 publication selection")
    outputs = build()
    for relative, raw in outputs.items():
        target = ROOT / relative
        if args.check:
            if target.read_bytes() != raw:
                raise ValueError("Generated v8 release differs: " + relative.as_posix())
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
    print("MANUSCRIPT V8.0 SOURCE, NOTES AND DOWNLOAD CHECK OK" if args.check else "MANUSCRIPT V8.0 BUILT: 20 sections")
