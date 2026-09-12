"""Edition 10 adapter over the frozen, tested v9 block/inline parser."""
import hashlib
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'manuscript/2026-09-06-corpus-rebuild/technical'))
import manuscript_v9 as legacy

def runs(block):
    return [r for row in block.get('cellRuns', []) for cell in row for r in cell] if block['type'] == 'table' else block.get('runs', [])

def parse(raw, identifier, expected_title=None):
    text = raw.decode('utf-8-sig').replace('\r\n', '\n').replace('\r', '\n').strip()
    if re.search(r'<[/!A-Za-z]|!\[|\[\^|(?m:^---\s*\n\w+:)', text):
        raise ValueError('HTML, images, YAML and caret footnotes are outside the manuscript format')
    first, _, body = text.partition('\n')
    if not first.startswith('# ') or not body.strip():
        raise ValueError(identifier + ': title and prose required')
    title = first[2:]
    clean = lambda value: re.sub(r'^Глава \d+\.\s*', '', value).rstrip('.')
    if expected_title and clean(title) != clean(expected_title):
        raise ValueError(identifier + ': title differs from chapters.json')
    numbered = re.match(r'^Глава (\d+)\.', title)
    if numbered and identifier != f'chapter-{int(numbered[1]):02d}':
        raise ValueError('Chapter heading number differs from file ID')
    heading = legacy.NOTE_HEADING.search(body)
    definitions, current = {}, None
    if heading:
        main = body[:heading.start()].strip()
        for line in body[heading.end():].strip().splitlines():
            match = re.fullmatch(r'\[(\d+)\]\s+(.+)', line)
            if match:
                current = match[1]
                if current in definitions: raise ValueError('Duplicate note ' + current)
                definitions[current] = [match[2]]
            elif current is not None: definitions[current].append(line)
            elif line.strip(): raise ValueError('Note definition must begin with [1]')
    else: main = body
    if list(definitions) != [str(i) for i in range(1, len(definitions) + 1)]:
        raise ValueError('Local notes must be ordered [1] through [N]')
    prefix = 'manuscript-v10-' + identifier + '-' + hashlib.sha256(raw).hexdigest()[:12]
    note_ids = {n: prefix + '-note-' + n for n in definitions}
    blocks = legacy.parse_blocks(main, prefix, note_ids)
    if not any(b['type'] == 'paragraph' and b.get('role') != 'separator' for b in blocks):
        raise ValueError('Narrative prose required')
    notes = [{'id': note_ids[n], 'kind': 'endnote', 'chapterId': identifier, 'number': int(n), 'sourceId': n,
              'blocks': legacy.parse_blocks('\n'.join(lines).strip(), note_ids[n])} for n, lines in definitions.items()]
    if any(b['type'] == 'table' for note in notes for b in note['blocks']):
        raise ValueError('Tables belong in the chapter, not a note')
    used = {r['noteId'] for b in blocks for r in runs(b) if 'noteId' in r}
    if used != set(note_ids.values()): raise ValueError('Note references and definitions differ')
    return title, blocks, notes, heading[1] if heading else None
