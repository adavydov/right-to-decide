"""Optional local end-to-end staging test. Disposable technical fixtures, no install."""
import importlib.util
import json
from pathlib import Path
import tempfile
import release_v10 as release
spec=importlib.util.spec_from_file_location('v10_test_fixture',Path(__file__).with_name('test-release-v10.py'))
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
before=release.sha((release.ROOT/'src/data/book.json').read_bytes())
public_before={p.relative_to(release.ROOT).as_posix():release.sha(p.read_bytes()) for p in (release.ROOT/'public').rglob('*') if p.is_file()}
with tempfile.TemporaryDirectory(prefix='v10-technical-source-') as source_dir, tempfile.TemporaryDirectory(prefix='v10-technical-stage-',dir=release.ROOT) as stage_dir:
    source=Path(source_dir);fixture.technical_sources(source)
    directory=source/'public/research-v10';directory.mkdir(parents=True)
    texts=[]
    for ident in ['INDEX','M01','M02','M03','M04']:
        name='index' if ident=='INDEX' else ident
        target=directory/(name+'.md');target.write_bytes(fixture.FIXTURE)
        texts.append({'id':ident,**release.record(source,target.relative_to(source).as_posix())})
    (directory/'manifest.json').write_bytes(release.encode({'decision':'accepted','reviewer':'technical-fixture-reader','texts':texts,'downloads':[]}))
    libspec=importlib.util.spec_from_file_location('public_library_fixture',Path(__file__).with_name('test-public-library-v10.py'))
    libfixture=importlib.util.module_from_spec(libspec);libspec.loader.exec_module(libfixture)
    libfixture.install_fixture(source)
    teamspec=importlib.util.spec_from_file_location('public_editorial_fixture',Path(__file__).with_name('test-public-editorial-v10.py'))
    teamfixture=importlib.util.module_from_spec(teamspec);teamspec.loader.exec_module(teamfixture)
    teamfixture.install_fixture(source)
    stage=Path(stage_dir)/'uninstalled-technical-fixture'
    release.prepare(source,stage,'editorial/acceptance-v10.json')
    manifest=release.verify(stage)
    report={'status':'PASS','scope':'Disposable technical fixture through prepare and verify; not a manuscript, acceptance or publication',
            'sections':26,'artifacts':len(manifest['artifacts']),'checks':manifest['checks'],'installed':False,'published':False}
    # A single changed byte must invalidate the finished artifact set.
    pdf=stage/'public/book/right-to-decide-v10.0.pdf';pdf.write_bytes(pdf.read_bytes()+b'changed')
    try:release.verify(stage)
    except ValueError:report['tamperedPdfRejected']=True
    else:raise AssertionError('Changed PDF accepted')
assert before==release.sha((release.ROOT/'src/data/book.json').read_bytes())
assert public_before=={p.relative_to(release.ROOT).as_posix():release.sha(p.read_bytes()) for p in (release.ROOT/'public').rglob('*') if p.is_file()}
report['activeV9AndPublicFilesUnchanged']=True
(release.ROOT/'docs/research/v10-pipeline/technical-stage.json').write_bytes(release.encode(report))
print(json.dumps(report,ensure_ascii=False,indent=2))
