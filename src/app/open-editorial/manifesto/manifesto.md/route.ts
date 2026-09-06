import { getOpenEditorialManifesto } from "@/lib/open-editorial-manifesto";
export const dynamic="force-static";
export function GET(){return new Response(getOpenEditorialManifesto().markdown,{headers:{"Content-Type":"text/markdown; charset=utf-8","Content-Disposition":'inline; filename="OPEN_EDITORIAL_MANIFESTO.md"'}});}
