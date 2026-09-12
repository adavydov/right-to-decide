import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_URL || 'http://127.0.0.1:3220/right-to-decide';
const out = 'docs/research/v10-design';
fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true });
const edition = JSON.parse(fs.readFileSync('src/data/book.json','utf8')).editionVersion;
const report = { at: new Date().toISOString(), base, browser: 'Isolated headless Edge; new context, no existing profile', layouts: [], checks: [], errors: [], writes: [] };
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const context = await browser.newContext({ viewport: { width:1440, height:1000 }, reducedMotion:'reduce', acceptDownloads:true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror', error => report.errors.push(error.message));
page.on('response', res => { if (res.status() >= 400 && res.url().startsWith(base)) report.errors.push(res.status() + ' ' + res.url()); });
page.on('request', request => { if (!['GET','HEAD'].includes(request.method())) report.writes.push(request.method() + ' ' + request.url()); });
async function open(route) { await page.goto(base + route, {waitUntil:'networkidle'}); await page.evaluate(async()=>{ await document.fonts.ready; await Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>{});})); }); }
async function shot(name, fullPage=false) { await page.screenshot({ path:path.join(out,'screenshots',name+'.png'), fullPage }); }
async function layout(name, width) {
  const data = await page.evaluate(()=>({ viewport:innerWidth, width:document.documentElement.scrollWidth, bodyFont:getComputedStyle(document.body).fontFamily, h1:document.querySelector('h1')?.textContent, images:[...document.images].map(i=>({src:i.getAttribute('src'),ok:i.complete&&i.naturalWidth>0})), controls:[...document.querySelectorAll('body > header a, body > header button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({name:e.getAttribute('aria-label')||e.textContent.trim(),height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width})) }));
  assert.ok(data.width<=width+1, `${name} horizontal overflow ${data.width}/${width}`);
  assert.ok(data.images.every(i=>i.ok), name+' loaded images');
  assert.ok(data.controls.every(c=>c.height>=43.5), name+' header tap target height');
  report.layouts.push({name,...data});
}
async function panel(name) { await page.getByTestId('reader-toolbar').getByRole('button',{name,exact:true}).click(); return page.getByRole('dialog',{name,exact:true}); }
async function closePanel(name) { await page.keyboard.press('Escape'); await page.getByRole('dialog',{name,exact:true}).waitFor({state:'hidden'}); }
try {
  for (const width of [1440,768,390]) {
    await page.setViewportSize({width,height:width===390?844:1000});
    for (const [name,route] of [['home','/'],['contents','/contents/'],['read','/read/'],['authors','/authors/'],['library','/library/'],['open-editorial','/open-editorial/'],['prologue','/read/prologue/']]) {
      await open(route); await layout(name,width); await shot(`${name}-${width}`);
      if (name==='home') {
        await shot(`home-${width}-full`,true);
        const ratio = await page.locator('img[src*="book-cover-v10"]').evaluate(i=>{const r=i.getBoundingClientRect();return {render:r.width/r.height,natural:i.naturalWidth/i.naturalHeight,fit:getComputedStyle(i).objectFit};});
        assert.ok(Math.abs(ratio.render-ratio.natural)<.001,'Uncropped cover');
        assert.ok((await page.locator('main').innerText()).includes('редакция ' + edition),'Actual release is explicit');
      }
      console.log(`Layout ${width} ${name}`);
    }
  }
  for(const size of [{width:375,height:812},{width:844,height:390}]) { await page.setViewportSize(size); await open('/'); await layout('home-extra',size.width); await shot(`home-${size.width}x${size.height}`); }
  await page.setViewportSize({width:390,height:844}); await open('/');
  const toggle = page.getByRole('button',{name:'Открыть меню',exact:true}); await toggle.click();
  await shot('mobile-menu'); await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'),'false'); assert.equal(await toggle.evaluate(e=>e===document.activeElement),true);
  await toggle.click(); await page.locator('#book-navigation').getByRole('link',{name:'Библиотека',exact:true}).click(); await page.waitForURL('**/library/');
  assert.equal(await toggle.getAttribute('aria-expanded'),'false'); report.checks.push('Mobile navigation, Escape and focus return');
  await open('/read/prologue/');
  let settings=await panel('Настройки чтения');
  await settings.getByRole('slider',{name:'Размер текста',exact:true}).fill('24');
  await settings.getByRole('button',{name:'Сепия',exact:true}).click();
  await settings.getByRole('button',{name:'1,8',exact:true}).click();
  await settings.getByRole('button',{name:'Узкая',exact:true}).click();
  await settings.locator('[data-reader-font-picker-summary]').click();
  await settings.getByRole('button',{name:'Golos Text',exact:true}).click();
  await shot('mobile-reader-settings'); await closePanel('Настройки чтения');
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('.reading-copy').evaluate(e=>getComputedStyle(e).fontSize),'24px');
  assert.equal(await page.getByTestId('reader').getAttribute('data-theme'),'sepia');
  await shot('reader-sepia-390');
  settings=await panel('Настройки чтения'); await settings.getByRole('button',{name:'Тёмная',exact:true}).click(); await closePanel('Настройки чтения'); await shot('reader-dark-390');
  settings=await panel('Настройки чтения'); await settings.getByRole('button',{name:'Сбросить настройки',exact:true}).click(); await closePanel('Настройки чтения');
  report.checks.push('Reader font, size, spacing, width, themes and reload persistence');
  const bookmarks=await panel('Закладки'); await bookmarks.getByRole('button',{name:'Добавить закладку здесь'}).click(); await closePanel('Закладки');
  await page.reload({waitUntil:'networkidle'}); const saved=await panel('Закладки'); assert.ok((await saved.innerText()).includes('Удалить')); await closePanel('Закладки'); report.checks.push('Bookmark persists across reload');
  await page.getByRole('button',{name:'Режим сосредоточенного чтения',exact:true}).click(); await page.getByRole('button',{name:'Показать управление',exact:true}).click(); report.checks.push('Focus reading mode toggles');
  await page.getByText('Личная заметка или черновик замечания',{exact:true}).click();
  await page.getByLabel('Личная заметка',{exact:true}).fill('Проверка дизайна: мысль сохранена локально.');
  await page.getByRole('button',{name:'Сохранить только в этом браузере',exact:true}).click();
  await open('/open-editorial/me/'); assert.ok((await page.locator('main').innerText()).includes('Проверка дизайна: мысль сохранена локально.'));
  await page.reload({waitUntil:'networkidle'}); assert.ok((await page.locator('main').innerText()).includes('Проверка дизайна: мысль сохранена локально.'));
  const noteDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'Скачать все личные заметки',exact:true}).click();
  const exported=await noteDownload; const notes=JSON.parse(fs.readFileSync(await exported.path(),'utf8')); assert.equal(notes.storage,'this-browser-only'); assert.ok(notes.notes.some(n=>n.message.includes('Проверка дизайна'))); report.checks.push('Local note save, reload and actual JSON download');
  await page.getByRole('button',{name:'Сделать отдельный черновик из заметки',exact:true}).click(); await page.waitForURL('**/participate/**');
  await page.waitForLoadState('networkidle');
  assert.ok((await page.getByLabel('Ваше замечание').inputValue()).includes('Проверка дизайна'));
  await shot('draft-390');
  const draftDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'Скачать JSON с привязкой',exact:true}).click();
  const draftFile=await draftDownload; const draft=JSON.parse(fs.readFileSync(await draftFile.path(),'utf8')); assert.equal(draft.state,'local_draft'); assert.ok(draft.target.edition_id.includes('v' + edition)); assert.ok(draft.message.includes('Проверка дизайна')); report.checks.push('Note transfer to draft and actual JSON download retains edition');
  await open('/read/'); const file=page.locator('a[download]').filter({hasText:'Скачать PDF'}); const pdfURL=await file.getAttribute('href'); const response=await context.request.get(new URL(pdfURL,base).href); assert.equal(response.status(),200); assert.equal((await response.body()).subarray(0,4).toString(),'%PDF'); report.checks.push('Current full-book PDF download');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto'); report.checks.push('Reduced motion respected');
  assert.deepEqual(report.errors,[]); assert.deepEqual(report.writes,[]); report.checks.push('No browser errors, failed local assets or network writes');
  report.status='passed';
} catch(error) { report.status='failed'; report.failure=String(error.stack||error); await shot('failure').catch(()=>{}); process.exitCode=1; }
finally { fs.writeFileSync(path.join(out,'browser-qa.json'),JSON.stringify(report,null,2)); await browser.close(); console.log(JSON.stringify({status:report.status,layouts:report.layouts.length,checks:report.checks,failure:report.failure},null,2)); }
