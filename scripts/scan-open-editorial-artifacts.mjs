import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
const root=process.cwd();
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);}
assert.ok(existsSync(join(root,'out')),'Build static export before scanning.');
const compiled=walk(join(root,'out'));
const logs=existsSync(join(root,'docs/open-editorial/verification'))?walk(join(root,'docs/open-editorial/verification')).filter(p=>p.endsWith('.txt')):[];
const patterns=[
 ['editorial-credential',/oe_(?:human|agent|internal)_[A-Za-z0-9_-]{43}/],
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['supabase-secret-key',/sb_secret_[A-Za-z0-9_-]{20,}/],
 ['synthetic-private-note',/PRIVATE-NOTE-NEVER-EXPORT|REVIEW-ERASURE-PRIVATE-MARKER/],
];
const findings=[];
for(const file of [...compiled,...logs]){
 const bytes=readFileSync(file),text=bytes.toString('utf8');
 if(/\.sqlite(?:-wal|-shm)?$|\.token\.json$|(?:^|[\\/])\.env(?:\.local)?$/.test(file)||bytes.subarray(0,15).toString()==='SQLite format 3')findings.push({path:relative(root,file),kind:'private-file'});
 for(const [kind,pattern]of patterns)if(pattern.test(text))findings.push({path:relative(root,file),kind});
}
const result={date:new Date().toISOString().slice(0,10),status:findings.length?'FAIL':'PASS',static_files:compiled.length,test_trace_files:logs.length,findings,scope:'Current static export and available test trace files only; no unrelated environment secrets or private browser/session stores were read.'};
mkdirSync(join(root,'docs/open-editorial/verification'),{recursive:true});
writeFileSync(join(root,'docs/open-editorial/verification/artifact-security-scan.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
assert.equal(findings.length,0,'Possible sensitive artifact; report contains paths/categories only, never matched values.');
