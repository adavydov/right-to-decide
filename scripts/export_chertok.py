#!/usr/bin/env python3
"""Publish a bounded Chertok projection; original files remain in the private corpus."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
AS_OF = "2026-09-06"
VOLUMES = {1: (19, 294), 2: (16, 298), 3: (16, 398), 4: (16, 437)}
TOPIC_GROUPS = [
    (["Становление инженера"], {1:[3,4,5],2:[1,2,4,5,12],3:[2,3],4:[13]}),
    (["Проверка и право возразить"], {1:[7,9,11,12,19],2:[7,13,14],3:[5,6,7,9,11,13],4:[7,11]}),
    (["Цена результата","Организация общей работы"], {1:[6,8,16],2:[6,8],3:[14],4:[6]}),
    (["Организация общей работы"], {1:[13,14,15,17,18],2:[9],3:[12],4:[4,9,14]}),
    (["Организация общей работы","Цена результата"], {1:[2,10],2:[3,10,11,15],3:[4,8,10],4:[2,3,5,8,12]}),
    (["Проверка и право возразить","Организация общей работы"], {2:[16],3:[15,16],4:[10]}),
    (["Память и документы"], {1:[1],3:[1],4:[1,15,16]}),
]
TOPICS = {f"CHERTOKRU-PDF-V{v}-C{n:02d}": topics
          for topics, groups in TOPIC_GROUPS for v, nums in groups.items() for n in nums}
LOCATOR_NOTE = ("CHERTOKRU-PDF-V2:PDF0003 обозначает третью страницу файла второй книги. "
                "Это порядковые страницы предоставленных русских PDF, а не печатная пагинация. "
                "Состав томов и страницы других изданий на них не переносятся.")
REVIEW_NOTE = ("Цитаты сверены с русским PDF; указанные фрагменты прочитаны в контексте. "
               "Повторная проверка другим ИИ охватывает содержательные поля всех карточек и выбранные "
               "страницы источника. Полное внимательное чтение четырёх томов и независимое историческое "
               "подтверждение событий не заявлены. Переносы строк в цитатах сведены к пробелам; "
               "речь в мемуарах не становится стенограммой.")

def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+"\n", encoding="utf-8", newline="\n")

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def norm(value):
    return re.sub(r"\s+", " ", value).strip()

def capability(value):
    if isinstance(value, str):
        return value
    assert set(value) <= {"status", "change", "evidence_limit"}, value.keys()
    return "\n\n".join(value[k] for k in ("change", "evidence_limit") if value.get(k))

def source_record(card_ids):
    return {
        "id":"source-01","number":1,"title":"Ракеты и люди. Четыре книги",
        "authors":["Борис Евсеевич Черток"],"category":"Инженерные воспоминания",
        "edition":"Москва: Машиностроение, 1999. Четыре русских PDF; выходные сведения книг 1–3 указывают второе издание.",
        "languages":["ru"],"materialNote":(
            "Предоставлены четыре русских PDF: 294, 298, 398 и 437 страниц файла. "
            "Карточки опираются на этот оригинал. Разбиение электронных файлов отличается от печатных изданий; "
            "полные книги и извлечения здесь не распространяются."),
        "availability":"provided","reading":"not-claimed",
        "readingNote":("Для подготовки карточек извлечены все 1 427 страниц русских PDF. Содержательно прочитаны "
                       "выбранные фрагменты и подготовлены 67 карточек с 99 опорными цитатами. "
                       "Полное внимательное чтение томов и постраничная сверка с бумажными экземплярами не заявлены."),
        "links":[],"cardIds":card_ids,
    }

def merge_chertok(sources, cards, corpus):
    """Preserve every unrelated published source/card and replace only source-01."""
    edits = read(SITE/"scripts/chertok-public-edits.json")
    attributions = edits["attributions"]
    validation = read(corpus/"reviews/chertok-originals-2026-09-06/validation.json")
    assert validation["status"] == "passed" and validation["total_cards"] == 67
    assert validation["total_quotes"] == 99
    checked = {v["volume"]:v for v in validation["volumes"]}
    result=[]; proofs=[]; quote_count=0
    for v, (card_count, page_count) in VOLUMES.items():
        folder=corpus/f"books/chertok-rakety-i-lyudi-ru-pdf-v{v}"
        meta=read(folder/"book.json")
        originals=list((folder/"source").glob("*.pdf"))
        assert len(originals)==1
        assert sha(originals[0]) == meta["sha256"] == checked[v]["source_sha256"]
        digest=sha(folder/"cards/cards.json")
        assert digest == checked[v]["card_file_sha256"]
        index=read(folder/"reviews/context-review-index.json")
        assert any(p["cards_file_name"]=="cards.json" and p["cards_file_sha256"]==digest and
                   p["status"]=="sampled_context_review_passed_not_full_corpus" for p in index["parts"])
        pages={p["id"]:p for p in map(json.loads,(folder/"extracted/pages.jsonl").read_text(encoding="utf-8-sig").splitlines())}
        assert len(pages)==page_count
        batch=read(folder/"cards/cards.json")["cards"]
        assert len(batch)==card_count
        for c in batch:
            cid=c["id"]
            assert cid in TOPICS and len(attributions[cid])==len(c["quotes"])
            assert all(pid in pages for pid in c["source_paragraph_ids"])
            quotes=[]
            for q, voice in zip(c["quotes"],attributions[cid]):
                pids=q.get("paragraph_ids") or [q["paragraph_id"]]
                assert set(pids) <= set(c["source_paragraph_ids"])
                assert norm(q["text"]) in norm(" ".join(pages[pid]["text"] for pid in pids))
                quotes.append({"text":norm(q["text"]),"attribution":voice,"paragraphIds":pids})
                quote_count+=1
            sections=c["source_section"]
            if isinstance(sections,str):
                sections=[sections]
            context=c["context"]
            if c.get("source_voice") and c["source_voice"] not in context:
                context+="\n\n"+c["source_voice"]
            interpretation=edits.get("interpretation_overrides",{}).get(cid,c["interpretation"])
            interpretation=re.sub(r"^(Наша интерпретация|Наш вывод|Наше чтение):\s*","",interpretation)
            result.append({
                "id":cid,"sourceId":"source-01","title":c["title"],
                "topics":TOPICS[cid],"tags":[s.replace("_"," ") for s in c["tags"]],
                "sections":[f"Книга {v}"]+sections,"paragraphIds":c["source_paragraph_ids"],
                "locatorKind":"pdf-page","locatorNote":LOCATOR_NOTE,
                "context":context,"observation":c["observation"],"interpretation":interpretation,
                "quotes":quotes,"capability":capability(c["observed_change_in_capability"]),
                "workProcedure":edits.get("work_procedure_overrides",{}).get(cid,c["change_in_work_procedure"]),
                "limits":c["limits"],
                "review":{"date":AS_OF,"sourceCorrespondence":"checked",
                          "historicalCorroboration":"not-established","note":REVIEW_NOTE},
            })
        proofs.append({"volume":v,"sourceSha256":meta["sha256"],"cardsSha256":digest,
                       "cards":len(batch),"pages":page_count})
    assert len(result)==len(TOPICS)==67 and quote_count==99
    serialized=json.dumps(result,ensure_ascii=False)
    for forbidden in [r"(?<![A-Za-z])[A-Za-z]:[\\/]",r"file://",r"book-memory",r"source_sha256",
                      r"proposed_pipeline_use",r"reading_scope",r"Для агентов",r"Для агента"]:
        assert not re.search(forbidden,serialized,re.I),forbidden
    unrelated_cards=[c for c in cards if c["sourceId"]!="source-01"]
    assert len(unrelated_cards)==30
    assert len(sources)==48 and sum(s["id"]=="source-01" for s in sources)==1
    replacement=source_record([c["id"] for c in result])
    sources=[replacement if s["id"]=="source-01" else s for s in sources]
    cards=unrelated_cards+result
    assert len({c["id"] for c in cards})==97
    return sources,cards,{"date":AS_OF,"cards":67,"quotes":quote_count,"volumes":proofs,
                         "scope":"Explicit public projection; source files and private workflow fields excluded."}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus",type=Path,default=SITE.parent/"book-memory")
    args=parser.parse_args()
    library=read(SITE/"src/data/library.json")
    evidence=read(SITE/"src/data/evidence-cards.json")
    library["sources"],evidence["cards"],audit=merge_chertok(library["sources"],evidence["cards"],args.corpus.resolve())
    library["asOf"]=max(library["asOf"],AS_OF)
    evidence["asOf"]=max(evidence["asOf"],AS_OF)
    write(SITE/"src/data/library.json",library)
    write(SITE/"src/data/evidence-cards.json",evidence)
    audit_path=args.corpus/"reviews/chertok-originals-2026-09-06/publication-validation.json"
    audit["outputs"]={name:sha(SITE/"src/data"/name) for name in ["library.json","evidence-cards.json"]}
    write(audit_path,audit)
    print(json.dumps({"sources":48,"cards":97,"newCards":67,"newQuotes":99},ensure_ascii=False))

if __name__=="__main__":
    main()
