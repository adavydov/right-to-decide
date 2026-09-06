"""Release accepted 7.0/7.1 texts with exact input, review and download receipts."""
from __future__ import annotations
import copy
import json
from pathlib import Path
import re
import constitution_contents as outline
import manuscript_v7
import chapter_docx_v7

ROOT = Path(__file__).resolve().parents[1]
BASE = Path("manuscript/2026-09-06-critic-revision")
PATCH = Path("manuscript/2026-09-06-davydov-cases")
BOOK = Path("src/data/book.json")
EDITIONS = {"7.0": (BASE, "assembly-v7.json", "right-to-decide-v7"),
            "7.1": (PATCH, "assembly-v7.1.json", "right-to-decide-v7.1")}
GENERATORS = ["scripts/publish-manuscript.py", "scripts/release_v7.py", "scripts/manuscript_v7.py",
              "scripts/chapter_docx_v7.py", "scripts/manuscript_markdown.py", "scripts/chapter_docx.py"]


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
    raw = (ROOT / relative).read_bytes()
    return {"path": relative.as_posix(), "sha256": outline.sha(raw)}


def checked(relative, digest, size=None):
    relative = local(relative)
    raw = (ROOT / relative).read_bytes()
    if outline.sha(raw) != str(digest).lower():
        raise ValueError("Pinned source changed: " + relative.as_posix())
    if size is not None and len(raw) != size:
        raise ValueError("Pinned source length changed: " + relative.as_posix())
    return raw


def identifier(order):
    return "prologue" if order == 0 else "epilogue" if order == 19 else f"chapter-{order:02d}"


def evidence(edition):
    directory, assembly_name, _ = EDITIONS[edition]
    acceptance_path = BASE / "acceptance-v7.json"
    acceptance = read(acceptance_path)
    if acceptance.get("edition") != "7.0" or acceptance.get("decision") != "accepted-local-editorial-edition":
        raise ValueError("Missing accepted baseline edition")
    if len(acceptance.get("texts", [])) != 20 or len({entry["path"] for entry in acceptance["texts"]}) != 20:
        raise ValueError("Baseline acceptance must contain twenty unique texts")
    checks = {entry["path"]: entry for entry in acceptance["checks"]}
    if len(checks) != len(acceptance["checks"]):
        raise ValueError("Duplicate baseline evidence")
    pinned = [record(acceptance_path), record("CONSTITUTION.md")]
    for entry in checks.values():
        path = local(entry["path"], BASE)
        checked(path, entry["sha256"])
        pinned.append(record(path))
    accepted = {}
    for entry in acceptance["texts"]:
        path = local(entry["path"], BASE)
        checked(path, entry["sha256"])
        if entry.get("decision") != "accepted-agent-editorial" or not entry.get("independentReviewer") or entry.get("author") == entry.get("independentReviewer"):
            raise ValueError("Missing independent editorial acceptance: " + path.as_posix())
        if entry["review"] not in checks:
            raise ValueError("Review is not pinned by the accepted baseline")
        accepted[path.as_posix()] = entry
    author_decision = local(acceptance["authorDecision"], BASE)
    pinned.append(record(author_decision))
    pinned.append(record(local(acceptance["policyCompletedBeforeProse"], BASE)))
    assembly_path = directory / "reading" / assembly_name
    assembly = read(assembly_path)
    if assembly.get("edition") != edition:
        raise ValueError("Assembly edition differs")
    pinned.append(record(assembly_path))
    if edition == "7.1":
        baseline_path = local(assembly["baselineManifest"], directory)
        checked(baseline_path, assembly["baselineManifestSha256"])
        pinned.append(record(baseline_path))
        review_path = directory / "independent-review.md"
        review_text = (ROOT / review_path).read_text("utf-8-sig")
        review_hashes = dict(re.findall(r"(?m)^\|\s*([^|\r\n]+\.md)\s*\|\s*([a-fA-F0-9]{64})\s*\|", review_text))
        required = {"chapter-12.md", "chapter-14.md", "chapter-17.md", "scenario-passport-v1.3.md"}
        if set(review_hashes) != required or "Содержательных замечаний к окончательным байтам не осталось." not in review_text:
            raise ValueError("The patch requires its positive exact-revision independent review")
        for filename, digest in review_hashes.items():
            checked(directory / filename.strip(), digest)
        pinned.extend([record(review_path), record(directory / "scenario-passport-v1.3.md")])
        builder = local(assembly["builder"], directory)
        checked(builder, assembly["builderSha256"])
        pinned.append(record(builder))
        converter = local(assembly["converter"], directory)
    else:
        converter = local(assembly["converter"], directory / "reading")
    checked(converter, assembly["converterSha256"])
    pinned.append(record(converter))
    if [entry.get("order") for entry in assembly.get("inputs", [])] != list(range(20)):
        raise ValueError("The reading assembly must contain ordered sections 0–19")
    sources, reviews = [], []
    for entry in assembly["inputs"]:
        path = local(entry["path"], directory)
        checked(path, entry["sha256"])
        ident = identifier(entry["order"])
        if edition == "7.1" and entry["order"] in {12, 14, 17}:
            if path != directory / (ident + ".md") or entry.get("edition") != "7.1":
                raise ValueError("Patch selection may replace only chapters 12, 14 and 17")
            review = {"id": ident, "reviewer": "editorial_review", **record(directory / "independent-review.md"),
                      "status": "independent-editorial-review", "constitutionVersion": "1.2.1"}
        else:
            expected = BASE / ("prologue.md" if ident == "prologue" else "chapters-v7/" + ident + ".md")
            if path != expected or path.as_posix() not in accepted:
                raise ValueError("Unaccepted or reordered baseline text: " + ident)
            receipt = accepted[path.as_posix()]
            review = {"id": ident, "reviewer": receipt["independentReviewer"], **record(local(receipt["review"], BASE)),
                      "status": "independent-editorial-review", "constitutionVersion": "1.2.1"}
        sources.append({**entry, "id": ident, "path": path.as_posix(), "sha256": entry["sha256"].lower(),
                        "edition": entry.get("edition", "7.0")})
        reviews.append(review)
    downloads = []
    if {entry.get("name") for entry in assembly["outputs"]} != {EDITIONS[edition][2] + suffix for suffix in (".md", ".docx", ".pdf")}:
        raise ValueError("Complete reading Markdown, Word and PDF are required")
    for entry in assembly["outputs"]:
        path = directory / "reading" / entry["name"]
        checked(path, entry["sha256"], entry["bytes"])
        pinned.append(record(path))
        downloads.append({**entry, "sourcePath": path.as_posix(), "sha256": entry["sha256"].lower()})
    return assembly, acceptance, sources, reviews, downloads, pinned


def selection_for(edition, pinned):
    directory = EDITIONS[edition][0]
    path = directory / "publication-selection.json"
    current = {"schemaVersion": 1, "editionVersion": edition, "authorInstruction": "Обнов сайт",
               "scope": "Выпуск выбранной ранее проверенной редакции; новая литературная авторская приёмка не присваивается.",
               "newAuthorAcceptanceClaimed": False, "inputs": pinned}
    if (ROOT / path).exists() and read(path) != current:
        raise ValueError("Pinned publication selection differs; an explicit new release receipt is required")
    return path, current


def build(edition="7.1"):
    if edition not in EDITIONS:
        raise ValueError("Unsupported literary edition")
    assembly, acceptance, sources, reviews, reading, pinned = evidence(edition)
    selection_path, selection = selection_for(edition, pinned)
    directory = EDITIONS[edition][0]
    manifest_path = directory / "release-manifest.json"
    foundation = outline.build()
    book = copy.deepcopy(json.loads(foundation[BOOK]))
    outputs = {path: raw for path, raw in foundation.items() if path != BOOK}
    by_id = {entry["id"]: entry for entry in sources}
    book["notes"] = []
    downloads, expected_note_map = [], []
    note_number = 0
    for index, chapter in enumerate(book["chapters"]):
        source = by_id.get(chapter["id"])
        if source is None:
            continue
        title, blocks, notes, notes_heading = manuscript_v7.parse((ROOT / source["path"]).read_bytes(), chapter["id"], source["title"])
        if chapter["kind"] == "chapter" and title != chapter["title"]:
            raise ValueError("Chapter title differs from constitutional architecture")
        chapter = {**chapter, "title": title, "blocks": blocks, "version": source["edition"], "contentKind": "manuscript",
                   "status": "available", "publicationStatus": "published", "editorialStatus": "constitution-1.2.1-reviewed",
                   "source": {"path": source["path"], "sha256": source["sha256"]}}
        if notes:
            chapter["notesHeading"] = notes_heading
        book["notes"].extend(notes)
        for note in notes:
            note_number += 1
            expected_note_map.append({"input": assembly["inputs"][source["order"]]["path"], "local": str(note["number"]), "global": note_number})
        raw = chapter_docx_v7.build(chapter, notes)
        docx_path = Path("public/book/chapters") / (chapter["id"] + "-v" + chapter["version"] + ".docx")
        outputs[docx_path] = raw
        chapter["download"] = {"docx": "/" + docx_path.relative_to("public").as_posix(), "sha256": outline.sha(raw), "bytes": len(raw)}
        downloads.append({"id": chapter["id"], "path": docx_path.as_posix(), "sha256": outline.sha(raw), "sourceSha256": source["sha256"]})
        book["chapters"][index] = chapter
    if expected_note_map != assembly["noteMap"] or len(book["notes"]) != assembly["noteCount"]:
        raise ValueError("The web chapter note inventory differs from the accepted reading assembly")
    reading_downloads, book_downloads = [], {}
    for item in reading:
        if not item["name"].endswith((".docx", ".pdf")):
            continue
        public_path = Path("public/book") / item["name"]
        outputs[public_path] = checked(item["sourcePath"], item["sha256"], item["bytes"])
        kind = Path(item["name"]).suffix[1:]
        record_ = {"path": "/" + public_path.relative_to("public").as_posix(), "sha256": item["sha256"], "bytes": item["bytes"]}
        book_downloads[kind] = record_
        reading_downloads.append({"kind": kind, **record_, "sourcePath": item["sourcePath"]})
    chapter_sources = [{"id": c["id"], "number": c["number"], **c["source"]} for c in book["chapters"] if c["id"] in by_id and c["id"] != "prologue"]
    contents_source = next(c["source"] for c in book["chapters"] if c["id"] == "contents")
    prologue = book["chapters"][0]
    constitution = {**record("CONSTITUTION.md"), "version": "1.2.1"}
    generators = [record(path) for path in GENERATORS]
    identity = {"selection": selection, "constitution": constitution, "contents": contents_source,
                "sources": sources, "reviews": reviews, "generators": generators, "downloads": downloads, "readingDownloads": reading_downloads}
    source_hash = outline.sha(outline.encoded(identity))
    book.update({"editionVersion": edition, "contentKind": "manuscript", "releaseId": "literary-manuscript-v" + edition + "-" + source_hash[:12],
                 "downloads": book_downloads, "source": {"filename": manifest_path.name, "path": manifest_path.as_posix(),
                 "format": "markdown-manuscript", "sha256": source_hash, "importer": "scripts/publish-manuscript.py",
                 "textPolicy": "Редакция " + edition + ". Точные ранее проверенные тексты опубликованы по прямому поручению автора. Сайт и отдельные Word содержат те же абзацы, таблицу и примечания; общий Word и PDF сохранены побайтово. Новая авторская литературная приёмка и практический пилот не заявляются."}})
    blocks = [b for c in book["chapters"] for b in c["blocks"]] + [b for n in book["notes"] for b in n["blocks"]]
    text = "\n\n".join("\n".join("\t".join(row) for row in b["rows"]) if b["type"] == "table" else b["text"] for b in blocks)
    book["statistics"] = {"sections": len(book["chapters"]), "chapters": 18, "parts": 6, "availableChapters": 18,
                          "plannedChapters": 0, "blocks": len(blocks), "notes": len(book["notes"]), "words": len(re.findall(r"\S+", text)), "characters": len(text)}
    selection_raw = outline.encoded(selection)
    manifest = {"schemaVersion": 3, "releaseId": book["releaseId"], "editionVersion": edition, "architectureVersion": "5.1",
                "chapterNumbers": list(range(1, 19)), "includesEpilogue": True, "chapters": chapter_sources,
                "authorContents": contents_source, "prologue": prologue["source"], "constitution": constitution,
                "prologueSelection": {**prologue["source"], "version": prologue["version"], "status": "accepted"},
                "masterPrologue": {**record("manuscript/2026-09-05-rebuild/prologue-v2.0.md"), "version": "2.0"},
                "acceptanceStatus": "independent-editorial-review", "acceptance": record(BASE / "acceptance-v7.json"),
                "assembly": record(directory / "reading" / EDITIONS[edition][1]),
                "selection": {"path": selection_path.as_posix(), "sha256": outline.sha(selection_raw)},
                "reviews": reviews, "wholeBookReviewScope": acceptance["wholeBook"],
                "patchReviewScope": "Three changed chapters and their dependent transitions; no new full-book review claimed" if edition == "7.1" else None,
                "downloads": downloads, "readingDownloads": reading_downloads, "archive": record(outline.ARCHIVE),
                "bookSha256": outline.sha(outline.encoded(book)), "generators": generators,
                "published": True, "newAuthorAcceptanceClaimed": False,
                "scope": "Полный выпуск пролога, восемнадцати глав и эпилога по поручению «Обнов сайт». Исторические локальные приёмки и сборки не изменены."}
    outputs.update({BOOK: outline.encoded(book), manifest_path: outline.encoded(manifest), selection_path: selection_raw})
    return outputs


def main(args, parser, chapter_selection):
    edition = {"v7": "7.0", "v7.1": "7.1"}.get(args.edition)
    if edition is None:
        edition = read(BOOK).get("editionVersion")
    if edition not in EDITIONS:
        parser.error("Choose --edition v7 or v7.1")
    if not args.check and (not args.chapters or chapter_selection(args.chapters) != list(range(1, 19)) or not args.epilogue):
        parser.error("A v7 release requires --chapters 1-18 --epilogue")
    directory = EDITIONS[edition][0]
    if args.check and not (ROOT / directory / "publication-selection.json").exists():
        raise ValueError("No pinned v7 publication selection")
    outputs = build(edition)
    for relative, raw in outputs.items():
        target = ROOT / relative
        if args.check:
            if target.read_bytes() != raw:
                raise ValueError("Generated v7 release differs: " + relative.as_posix())
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
    print("MANUSCRIPT V" + edition + (" SOURCE, NOTES AND DOWNLOAD CHECK OK" if args.check else " BUILT: 20 sections"))