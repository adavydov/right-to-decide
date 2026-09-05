import fs from "node:fs";
import path from "node:path";

export const manifestoSource = path.join(process.cwd(), "CONSTITUTION.md");
export const manifestoMarkdownPath = "/manifesto/constitution.md";
export const manifestoWordPath = "/manifesto/Pravo_na_reshenie_Manifest_Constitution_v1.2.1.docx";

type ManifestoBlock = {
  id: string;
  kind: "heading" | "paragraph" | "quote" | "rule";
  text: string;
  depth?: number;
};

// The document uses headings, paragraphs, block quotes and horizontal rules.
// Read the canonical file at build time so the page and MD download cannot drift.
export function getManifesto() {
  const markdown = fs.readFileSync(manifestoSource, "utf8").replace(/^\uFEFF/, "");
  const blocks: ManifestoBlock[] = [];
  let paragraph: string[] = [];
  const add = (kind: ManifestoBlock["kind"], text: string, depth?: number) => {
    blocks.push({ id: `manifesto-block-${blocks.length + 1}`, kind, text, depth });
  };
  const flush = () => {
    if (paragraph.length) add("paragraph", paragraph.join(" "));
    paragraph = [];
  };
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!line.trim()) flush();
    else if (heading) {
      flush();
      add("heading", heading[2], heading[1].length);
    } else if (/^---\s*$/.test(line)) {
      flush();
      add("rule", "");
    } else if (line.startsWith("> ")) {
      flush();
      add("quote", line.slice(2));
    } else paragraph.push(line);
  }
  flush();
  const sections = blocks.filter((block) => block.kind === "heading" && block.depth === 2 && /^(?:\d+\.|Приложение)/u.test(block.text));
  return { blocks, sections };
}
