from pathlib import Path
import sys, subprocess, tempfile, json
from pypdf import PdfReader
sys.stdout.reconfigure(encoding='utf-8')
base=Path(__file__).resolve().parent
profile=Path(tempfile.mkdtemp(prefix='book-editorial-style-lo-')).resolve()
names=['editorial-agent-architecture','editorial-style']
args=[r'C:\Program Files\LibreOffice\program\soffice.exe','-env:UserInstallation='+profile.as_uri(),'--headless','--convert-to','pdf','--outdir',str(base)]+[str(base/(n+'.docx')) for n in names]
r=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=60,creationflags=subprocess.CREATE_NO_WINDOW)
if r.returncode:print(r.stderr);raise SystemExit(r.returncode)
checks=[]
for n in names:
    pdf=base/(n+'.pdf')
    reader=PdfReader(pdf)
    content='\n'.join(p.extract_text() or '' for p in reader.pages)
    checks.append({'file':pdf.name,'pages':len(reader.pages),'has_style_rule':'STYLE-01' in content,'bytes':pdf.stat().st_size})
import pypdfium2 as pdfium
for n, page, out in [('editorial-style',0,'style-preview-page-1.png'),('editorial-agent-architecture',0,'preview-page-1.png'),('editorial-agent-architecture',2,'preview-page-3.png')]:
    d=pdfium.PdfDocument(str(base/(n+'.pdf')))
    d[page].render(scale=1.15).to_pil().save(base/out)
    d.close()
print(json.dumps(checks,ensure_ascii=False))
