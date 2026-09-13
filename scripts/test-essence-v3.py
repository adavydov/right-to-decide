"""Regression checks for importing the author's Essence revision without prose edits."""
import hashlib
import re
import unittest
from pathlib import Path

import essence_v3


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'manuscript/v10-1/essence/source-v3.md'
AUTHOR_SHA256 = '150182c07baa24ddc37cc53174623239d3d5cf7f986653237360cbcfff8060d1'
CHAPTERS = ['P00'] + [f'C{i:02d}' for i in range(1, 12)] + ['C11A', 'C11B'] + [f'C{i:02d}' for i in range(12, 25)] + ['E00']


def body_runs(data):
    return [run for step in data['steps'] for paragraph in step['paragraphRuns'] for run in paragraph]


class EssenceImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = SOURCE.read_bytes()
        cls.text = cls.raw.decode('utf-8-sig')
        cls.base = essence_v3.read(ROOT / 'src/data/essence-v10-1.json')
        cls.data = essence_v3.project(cls.raw, cls.base)

    def project_text(self, text):
        return essence_v3.project(text.encode('utf-8'), self.base)

    def test_author_source_is_byte_exact(self):
        self.assertEqual(hashlib.sha256(self.raw).hexdigest(), AUTHOR_SHA256)

    def test_complete_section_architecture_and_author_endings(self):
        self.assertEqual(self.data['schemaVersion'], 2)
        self.assertEqual(self.data['contentRevision'], '3')
        self.assertEqual([step['chapterId'] for step in self.data['steps']], CHAPTERS)
        self.assertEqual([step['id'] for step in self.data['steps']], [f'{i:02d}' for i in range(1, 29)])
        self.assertEqual(self.data['steps'][0]['title'], 'Пусть всё получится')
        self.assertEqual(self.data['steps'][0]['paragraphs'][0], 'Сначала машины сделали английских ткачей богаче.')
        self.assertEqual(self.data['steps'][-1]['title'], 'Мы дали начало')
        self.assertEqual(self.data['steps'][-1]['paragraphs'][-1], 'Мы не стали последним разумом. Мы стали причиной, по которой разум смог пойти дальше.')
        self.assertTrue(any(run.get('strong') for run in self.data['steps'][-1]['paragraphRuns'][-1]))
        self.assertFalse(any('fork' in step or 'insight' in step for step in self.data['steps']))

    def test_footnotes_resolve_and_runs_preserve_visible_paragraphs(self):
        notes = self.data['notes']
        self.assertEqual(len(notes), 7)
        self.assertEqual([note['number'] for note in notes], list(range(1, 8)))
        self.assertEqual(len({note['id'] for note in notes}), 7)
        note_ids = {note['id'] for note in notes}
        refs = [run for run in body_runs(self.data) if 'noteId' in run]
        source_refs = re.findall(r'\[\^[A-Za-z0-9_-]+\](?!:)', self.text)
        self.assertEqual(len(refs), len(source_refs))
        self.assertEqual({run['noteId'] for run in refs}, note_ids)
        for step in self.data['steps']:
            self.assertEqual(len(step['paragraphs']), len(step['paragraphRuns']))
            for plain, runs in zip(step['paragraphs'], step['paragraphRuns']):
                self.assertEqual(plain, ''.join(run['text'] for run in runs))
                self.assertNotIn('[^', plain)
        for note in notes:
            self.assertEqual(note['text'], ''.join(run['text'] for run in note['runs']))

    def test_reference_link_keeps_emphasis_inside_label(self):
        runs = [run for note in self.data['notes'] for run in note['runs']]
        nash = [run for run in runs if run.get('href') == 'https://www.cs.upc.edu/~ia/nash51.pdf']
        self.assertTrue(nash)
        self.assertEqual(''.join(run['text'] for run in nash), 'Non-Cooperative Games')
        self.assertTrue(all(run.get('emphasis') is True for run in nash))

    def test_repeated_note_reference_reuses_one_note(self):
        repeated = self.project_text(self.text.replace('[^allen]', '[^allen][^allen]', 1))
        note_id = repeated['notes'][0]['id']
        before = sum(run.get('noteId') == note_id for run in body_runs(self.data))
        after = sum(run.get('noteId') == note_id for run in body_runs(repeated))
        self.assertEqual(after, before + 1)
        self.assertEqual(len(repeated['notes']), 7)

    def test_bad_note_definitions_and_references_are_rejected(self):
        cases = {
            'missing definition': re.sub(r'^\[\^allen\]:[^\r\n]*(?:\r?\n)?', '', self.text, flags=re.M),
            'unknown reference': self.text.replace('Потом научилась.', 'Потом научилась.[^missing]', 1),
            'duplicate definition': self.text + '\n\n[^allen]: Дублирующее примечание.\n',
        }
        for reason, changed in cases.items():
            with self.subTest(reason=reason), self.assertRaises(ValueError):
                self.project_text(changed)

    def test_missing_duplicate_and_misordered_sections_are_rejected(self):
        cases = {
            'missing section': self.text.replace('## 28. Мы дали начало', '### 28. Мы дали начало', 1),
            'duplicate section': self.text.replace('## 28. Мы дали начало', '## 27. Мы дали начало', 1),
            'misordered section': self.text.replace('## 02. Продолжить?', '## 29. Продолжить?', 1),
        }
        for reason, changed in cases.items():
            with self.subTest(reason=reason), self.assertRaises(ValueError):
                self.project_text(changed)

    def test_unsafe_reference_links_are_rejected(self):
        good = 'https://www.cs.upc.edu/~ia/nash51.pdf'
        for unsafe in ['javascript:alert', 'data:text/plain,unsafe', 'file:///C:/private.txt', 'https://user:secret@example.org/doc']:
            with self.subTest(url=unsafe), self.assertRaises(ValueError):
                self.project_text(self.text.replace(good, unsafe, 1))


if __name__ == '__main__':
    unittest.main()
