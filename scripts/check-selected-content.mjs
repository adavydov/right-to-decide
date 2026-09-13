import fs from 'node:fs';
const book = JSON.parse(fs.readFileSync('src/data/book.json', 'utf8'));
if (book.editionVersion === '10.1') {
  const { validate } = await import('./validate-content-v10-1.mjs');
  validate();
} else {
  await import(book.editionVersion === '10.0' ? './validate-content-v10.mjs' : './validate-content.mjs');
}
