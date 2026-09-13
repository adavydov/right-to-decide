"""Exact, separately versioned projection of the author's Essence revision.

The accepted book release and reader annotation identity stay byte-for-byte intact.
Markdown is data; only the limited inline format below is interpreted.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'manuscript/v10-1/essence/source-v3.md'
PROJECTION = 'src/data/essence-v3.json'
MANIFEST = 'manuscript/v10-1/essence/revision-v3-manifest.json'
REVIEW = 'manuscript/v10-1/essence/review-v3.json'
BASE = 'manuscript/v10-1/release-manifest.json'
IDS = ['P00', *[f'C{i:02d}' for i in range(1, 12)], 'C11A', 'C11B', *[f'C{i:02d}' for i in range(12, 25)], 'E00']


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def record(root, relative):
    raw = (root / relative).read_bytes()
    return {'path': relative, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}


def inline(text, note_ids=None):
    """Parse emphasis, safe links and named notes without accepting raw HTML."""
    if '<' in text or '![' in text or '`' in text:
        raise ValueError('Unsupported inline markup')
    result = []
    def add(run):
        if not run['text']:
            return
        if result and 'noteId' not in run and {k:v for k,v in result[-1].items() if k != 'text'} == {k:v for k,v in run.items() if k != 'text'}:
            result[-1]['text'] += run['text']
        else:
            result.append(run)
    cursor = 0
    token = re.compile(r'\[\^([a-z][a-z0-9-]*)\]|\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*(.+?)\*\*|\*([^*]+)\*')
    for match in token.finditer(text):
        add({'text': text[cursor:match.start()]})
        if match[1]:
            if note_ids is None or match[1] not in note_ids:
                raise ValueError('Undefined note: ' + match[1])
            number, identifier = note_ids[match[1]]
            add({'text': '[' + str(number) + ']', 'noteId': identifier})
        elif match[2]:
            url = urlsplit(match[3])
            if url.scheme not in {'https', 'http'} or not url.netloc or url.username or url.password:
                raise ValueError('Unsafe source link')
            for run in inline(match[2]):
                add({**run, 'href': match[3]})
        else:
            for run in inline(match[4] or match[5], note_ids):
                add({**run, 'strong' if match[4] else 'emphasis': True})
        cursor = match.end()
    add({'text': text[cursor:]})
    if any(re.search(r'\[\^|\]\(|\*', run['text']) for run in result):
        raise ValueError('Unparsed inline markup')
    return result


def project(raw, base_essence):
    text = raw.decode('utf-8-sig').replace('\r\n', '\n').replace('\r', '\n').strip()
    header, separator, body = text.partition('\n## 01. ')
    if not separator:
        raise ValueError('Missing first section')
    match = re.fullmatch(r'# ([^\n]+)\n## ([^\n]+)\n\n\*([^\n]+)\*\n\n> ([^\n]+)\n>\n> ([^\n]+)', header.strip())
    if not match:
        raise ValueError('Unsupported title or epigraph structure')
    if match[2] != base_essence['subtitle']:
        raise ValueError('Subtitle differs from the current book')
    body = '## 01. ' + body
    definitions = list(re.finditer(r'(?m)^\[\^([a-z][a-z0-9-]*)\]: (.+)$', body))
    if not definitions:
        raise ValueError('Notes required')
    notes_tail = body[definitions[0].start():]
    if re.sub(r'(?m)^\[\^[a-z][a-z0-9-]*\]: .+$', '', notes_tail).strip():
        raise ValueError('Unsupported text after notes')
    body = body[:definitions[0].start()].strip()
    note_ids = {m[1]: (i + 1, 'essence-v3-note-' + m[1]) for i, m in enumerate(definitions)}
    if len(note_ids) != len(definitions):
        raise ValueError('Duplicate note definitions')
    notes = []
    for definition in definitions:
        number, identifier = note_ids[definition[1]]
        runs = inline(definition[2])
        notes.append({'id': identifier, 'number': number, 'text': ''.join(r['text'] for r in runs), 'runs': runs})
    headings = list(re.finditer(r'(?m)^## (\d{2})\. (.+)$', body))
    if [m[1] for m in headings] != [f'{i:02d}' for i in range(1, 29)]:
        raise ValueError('Exactly 28 ordered sections required')
    steps = []
    used = set()
    for i, (heading, old) in enumerate(zip(headings, base_essence['steps'])):
        segment = body[heading.end():headings[i + 1].start() if i + 1 < len(headings) else len(body)].strip()
        paragraphs = re.split(r'\n\s*\n', segment)
        if not segment or any('\n' in p or p.startswith(('#', '>')) for p in paragraphs):
            raise ValueError('Unsupported section structure')
        paragraph_runs = [inline(p, note_ids) for p in paragraphs]
        used.update(r['noteId'] for runs in paragraph_runs for r in runs if 'noteId' in r)
        steps.append({'id': heading[1], 'part': old['part'], 'chapterId': IDS[i], 'title': heading[2],
                      'paragraphs': [''.join(r['text'] for r in runs) for runs in paragraph_runs], 'paragraphRuns': paragraph_runs})
    if used != {note['id'] for note in notes}:
        raise ValueError('Unused or missing notes')
    words = len(re.findall(r'\S+', ' '.join(s['title'] + ' ' + ' '.join(s['paragraphs']) for s in steps)))
    low, high = math.ceil(words / 220), math.ceil(words / 180)
    return {'schemaVersion': 2, 'editionVersion': '10.1', 'contentRevision': '3', 'title': 'Суть',
            'bookTitle': match[1], 'subtitle': match[2], 'literaryLabel': match[3],
            'intro': 'Одна история будущего. Весь путь книги, включая финал.',
            'epigraph': {'text': match[4], 'attribution': match[5]},
            'readingMinutes': {'min': low, 'max': high, 'basis': f'{words} слов в заголовках и основном тексте; {low}–{high} минут при 180–220 словах в минуту. Ориентир, не замер чтения; примечания не включены.'},
            'parts': base_essence['parts'], 'steps': steps, 'notes': notes}


def check(root=ROOT):
    manifest = read(root / MANIFEST)
    base = read(root / BASE)
    assert manifest['baseReleaseId'] == base['releaseId'], 'Base release differs'
    assert manifest['baseBookSha256'] == base['bookSha256'], 'Base book differs'
    assert manifest['sourceSetSha256'] == base['sourceSetSha256'], 'Book manuscript differs'
    for key, path in [('source', SOURCE), ('projection', PROJECTION), ('review', REVIEW), ('generator', 'scripts/essence_v3.py')]:
        assert manifest[key] == record(root, path), 'Pinned artifact differs: ' + path
    expected = project((root / SOURCE).read_bytes(), read(root / 'src/data/essence-v10-1.json'))
    assert (root / PROJECTION).read_bytes() == encode(expected), 'Source projection differs'
    review = read(root / REVIEW)
    assert review['decision'] == 'accepted-exact-transfer', 'Independent transfer review missing'
    assert review['reviewer'] != manifest['integrator'], 'Reviewer must differ from integrator'
    assert review['sourceSha256'] == manifest['source']['sha256'], 'Reviewed source differs'
    assert review['projectionSha256'] == manifest['projection']['sha256'], 'Reviewed projection differs'
    print(f"ESSENCE V3 PASS: {len(expected['steps'])} sections, {sum(len(s['paragraphs']) for s in expected['steps'])} paragraphs, {len(expected['notes'])} notes; exact source projection and unchanged book identity.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['project', 'check'])
    args = parser.parse_args()
    if args.command == 'project':
        (ROOT / PROJECTION).write_bytes(encode(project((ROOT / SOURCE).read_bytes(), read(ROOT / 'src/data/essence-v10-1.json'))))
    else:
        check()
