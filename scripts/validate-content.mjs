import fs from "node:fs";
import path from "node:path";

const requiredFiles = [
  "src/app/page.tsx",
  "src/data/content.ts",
  "src/data/author.ts",
  "src/lib/site-config.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.resolve(file))) {
    throw new Error(`Missing required content file: ${file}`);
  }
}

const corpus = requiredFiles.map((file) => fs.readFileSync(path.resolve(file), "utf8")).join("\n");
const requiredPhrases = [
  "Право на решение",
  "Инженерное образование как система когнитивного допуска",
  "ИИ удешевляет ответ",
  "Алексей Михайлович Давыдов",
];

for (const phrase of requiredPhrases) {
  if (!corpus.includes(phrase)) {
    throw new Error(`Required phrase missing: ${phrase}`);
  }
}

console.log(`Content validation passed: ${requiredPhrases.length} anchors found.`);
