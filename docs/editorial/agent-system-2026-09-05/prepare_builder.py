from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
workspace=Path(r'C:\Users\Алексей\Documents\ChatGPT\Ньютон книги')
oldbase=workspace/'docs/research/monograph-2026-09-05'
base=workspace/'docs/editorial/agent-system-2026-09-05'
text=(oldbase/'build_research_docx.py').read_text(encoding='utf-8-sig')
text=text.replace(str(oldbase),str(base))
text=text.replace('right-to-decide-research-2026-09-05.md','editorial-agent-architecture.md')
text=text.replace('right-to-decide-research-2026-09-05.docx','editorial-agent-architecture.docx')
text=text.replace('Право на решение · Редакционное исследование · ','Право на решение · Проект агентной редакции · ')
text=text.replace('Право на решение: редакционное исследование для горизонта 2036–2041','Право на решение: проект агентной редакции')
text=text.replace('Анализ рукописи, свежие исследования и рекомендации','Роли, общая память, управление, проверки и пилот')
text=text.replace('def add_inline(p,text):','def add_inline(p,text):\n    text=text.replace(chr(96), "")')
text=text.replace('for row in table.rows:\n            for cell in row.cells:', 'for row in table.rows:\n            keep=OxmlElement("w:cantSplit");row._tr.get_or_add_trPr().append(keep)\n            for cell in row.cells:')
builder=base/'build_design_docx.py'
builder.write_text(text,encoding='utf-8')
exec(compile(text,str(builder),'exec'))
