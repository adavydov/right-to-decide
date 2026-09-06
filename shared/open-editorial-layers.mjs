/** Extract only the author's approved registry; incomplete historical lists stay unresolved. */
export function extractLayerRegistry(constitution, sourceSha256) {
  const start=constitution.indexOf("## 5. Девять слоёв одного исследования");
  const end=constitution.indexOf("\n## 6.",start);
  const section=start<0?"":constitution.slice(start,end<0?undefined:end);
  const headings=[...section.matchAll(/^### (С\d{2})\. (.+)$/gm)];
  const base={registry_version:"constitution-1.2.1",source_reference:"CONSTITUTION.md §5",source_sha256:sourceSha256};
  if(headings.length!==9||new Set(headings.map(h=>h[1])).size!==9)
    return {...base,registry_status:"unresolved",items:[]};
  const items=headings.map((h,i)=>{
    const text=section.slice(h.index+h[0].length,headings[i+1]?.index??section.length);
    const description=text.match(/\*\*(?:Вопрос|Несущий вопрос)\.\*\*\s*([^\r\n]+)/)?.[1]??text.match(/#### Несущий вопрос\s+([^\r\n]+)/)?.[1];
    return {id:h[1],title:h[2].trim(),description,order:i+1,source_reference:"CONSTITUTION.md §5 "+h[1],registry_version:"constitution-1.2.1",active:true};
  });
  if(items.some(item=>!item.description))return {...base,registry_status:"unresolved",items:[]};
  return {registry_status:"confirmed",...base,items};
}
