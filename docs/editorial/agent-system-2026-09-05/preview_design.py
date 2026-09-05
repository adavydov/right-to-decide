from pathlib import Path
import subprocess, tempfile, sys, importlib.util, json
from pypdf import PdfReader
sys.stdout.reconfigure(encoding='utf-8')
base=Path(__file__).resolve().parent
binary=Path(r'C:\Program Files\LibreOffice\program\soffice.exe')
profile=Path(tempfile.mkdtemp(prefix='right-to-decide-editorial-lo-')).resolve()
args=[str(binary),'-env:UserInstallation='+profile.as_uri(),'--headless','--convert-to','pdf','--outdir',str(base),str(base/'editorial-agent-architecture.docx')]
r=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=60,creationflags=subprocess.CREATE_NO_WINDOW)
pdf=base/'editorial-agent-architecture.pdf'
if r.returncode or not pdf.exists():
    print(json.dumps({'returncode':r.returncode,'stdout':r.stdout,'stderr':r.stderr},ensure_ascii=False));raise SystemExit(1)
reader=PdfReader(pdf)
print(json.dumps({'pdf':str(pdf),'pages':len(reader.pages),'page_text_lengths':[len(p.extract_text() or '') for p in reader.pages],'fitz':bool(importlib.util.find_spec('fitz')),'pdfium':bool(importlib.util.find_spec('pypdfium2'))},ensure_ascii=False))
if importlib.util.find_spec('fitz'):
    import fitz
    with fitz.open(pdf) as rendered:
        for number in [0,2]:
            if number<len(rendered):
                target=base/f'preview-page-{number+1}.png'
                rendered[number].get_pixmap(matrix=fitz.Matrix(1.25,1.25)).save(target)
                print(str(target))
