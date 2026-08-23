import fs from "node:fs";
import path from "node:path";

const indexPath = path.resolve("out/index.html");
if (!fs.existsSync(indexPath)) {
  throw new Error("Static export is missing out/index.html");
}

const html = fs.readFileSync(indexPath, "utf8");
for (const phrase of ["Право на решение", "Когнитивный допуск", "Об авторе"]) {
  if (!html.includes(phrase)) {
    throw new Error(`Exported HTML is missing: ${phrase}`);
  }
}

console.log("Static export validation passed.");

