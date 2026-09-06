import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export function getOpenEditorialManifesto() {
  const bytes = fs.readFileSync(path.join(process.cwd(), "docs/open-editorial/OPEN_EDITORIAL_MANIFESTO.md"));
  const markdown = bytes.toString("utf8").replace(/^\uFEFF/, "");
  const blocks: { id: string; kind: "heading" | "paragraph" | "quote" | "rule"; text: string; depth?: number }[] = [];
  let paragraph: string[] = [];
  const add = (kind: typeof blocks[number]["kind"], text: string, depth?: number) => blocks.push({ id: "oe-manifesto-" + (blocks.length + 1), kind, text, depth });
  const flush = () => { if (paragraph.length) add("paragraph", paragraph.join(" ")); paragraph = []; };
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!line.trim()) flush();
    else if (heading) { flush(); add("heading", heading[2], heading[1].length); }
    else if (/^---\s*$/.test(line)) { flush(); add("rule", ""); }
    else if (line.startsWith("> ")) { flush(); add("quote", line.slice(2)); }
    else paragraph.push(line);
  }
  flush();
  return { markdown, hash: createHash("sha256").update(bytes).digest("hex"), blocks, sections: blocks.filter(b => b.kind === "heading" && /^\d+\./.test(b.text)) };
}
