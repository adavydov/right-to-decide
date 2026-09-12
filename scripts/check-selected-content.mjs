import fs from 'node:fs';
const book = JSON.parse(fs.readFileSync('src/data/book.json', 'utf8'));
await import(book.editionVersion === '10.0' ? './validate-content-v10.mjs' : './validate-content.mjs');
