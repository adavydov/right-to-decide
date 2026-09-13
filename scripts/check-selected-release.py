"""Dispatch without changing the frozen v9 generator bytes."""
import json
from pathlib import Path
import subprocess
import sys
root = Path(__file__).resolve().parents[1]
book = json.loads((root / 'src/data/book.json').read_text(encoding='utf-8-sig'))
if book.get('editionVersion') == '10.1':
    script = ['scripts/release_v10_1.py', 'check', '--stage', str(root)]
elif book.get('editionVersion') == '10.0':
    script = ['scripts/release_v10.py', 'check', '--stage', str(root)]
else:
    script = ['scripts/publish-manuscript.py', '--check']
raise SystemExit(subprocess.call([sys.executable, *script], cwd=root))
