import fs from "node:fs";
import { manifestoSource } from "@/lib/manifesto";

export const dynamic = "force-static";

export function GET() {
  return new Response(fs.readFileSync(manifestoSource, "utf8"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="CONSTITUTION.md"',
    },
  });
}
