import fs from "node:fs";
import path from "node:path";

// Next.js 16.3.2 joins platform-native path.relative() output into segment paths.
// On Windows its static-export encoder replaces "/" but leaves backslashes.
// Keep the original files and add the flat aliases requested by the browser.
// Linux exports are already flat, so this pass is a no-op there.
const root = path.resolve("out");
let added = 0;
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = path.join(directory, entry.name);
    if (!entry.name.startsWith("__next.")) {
      visit(child);
      continue;
    }
    for (const relative of fs.readdirSync(child, { recursive: true })) {
      const source = path.join(child, relative);
      if (!fs.statSync(source).isFile()) continue;
      const name = entry.name + "." + relative.split(path.sep).join(".");
      const destination = path.join(directory, name);
      const data = fs.readFileSync(source);
      if (fs.existsSync(destination)) {
        if (!fs.readFileSync(destination).equals(data)) {
          throw new Error("Conflicting Next.js static segment: " + destination);
        }
      } else {
        fs.writeFileSync(destination, data);
        added++;
      }
    }
  }
}
visit(root);
console.log("Static segment aliases: " + added + " added; existing files preserved.");
