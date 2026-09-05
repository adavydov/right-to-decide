import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=(process.env.SITE_URL || 'http://127.0.0.1:3210/right-to-decide').replace(/\/$/,'');
const out='docs/design-references/publication-2026-09-05';
fs.mkdirSync(out,{recursive:true});
const library=JSON.parse(fs.readFileSync('src/data/library.json','utf8')).sources;
const cards=JSON.parse(fs.readFileSync('src/data/evidence-cards.json','utf8')).cards;
const report={base,status:'running',at:new Date().toISOString(),checks:[],layouts:[],errors:[]};
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{if(r.status()>=400 && r.url().startsWith(base+'/'))report.errors.push(r.status()+' '+r.url());});
async function open(route){await page.goto(base+route,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);}
async function check(name,fn){console.log('Running: '+name);await fn();report.checks.push(name);console.log('Passed: '+name);}
try {
  for(const width of [1440,768,390]) {
    await page.setViewportSize({width,height:width===390?844:1000});
    for(const [name,route] of [['home','/'],['contents','/contents/'],['authors','/authors/'],['library','/library/'],['wiki','/wiki/'],['card','/wiki/'+cards[0].id+'/']]) {
      await open(route);
      const layout=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,h1:document.querySelector('h1')?.textContent,font:getComputedStyle(document.body).fontFamily}));
      assert.ok(layout.width<=width+1,`${width} ${name} overflow ${layout.width}`);
      assert.ok(layout.h1?.trim(),name+' heading');
      const image=page.locator('img');
      await image.evaluateAll(imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return img.decode().catch(()=>{});})));
      assert.ok(await image.evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),name+' all images loaded');
      await page.screenshot({path:path.join(out,`site-${width}-${name}.jpg`),type:'jpeg',quality:70,fullPage:false});
      if(['home','card'].includes(name))await page.screenshot({path:path.join(out,`site-${width}-${name}-full.png`),fullPage:true});
      report.layouts.push({width,name,...layout});
      console.log('Layout: '+width+' '+name);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await check('Mobile menu opens, navigates, closes, and Escape returns hidden state',async()=>{
    await open('/');
    await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
    await page.locator('#book-navigation').getByRole('link',{name:'Библиотека',exact:true}).click();
    await page.waitForURL('**/library/');
    assert.equal(await page.getByRole('button',{name:'Открыть меню',exact:true}).getAttribute('aria-expanded'),'false');
    await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
    await page.screenshot({path:path.join(out,'site-mobile-menu.jpg'),type:'jpeg',quality:70});
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button',{name:'Открыть меню',exact:true}).getAttribute('aria-expanded'),'false');
  });
  await check('Library search, AND filter, empty state, reset, and literal source/card route',async()=>{
    await open('/library/');
    const field=page.getByRole('searchbox',{name:'Найти источник',exact:true});
    await field.fill('Грабин');
    await page.waitForFunction(()=>document.querySelector('#library-results')?.querySelectorAll(':scope > ol > li').length===1);
    await page.getByRole('button',{name:'С карточками вики',exact:true}).click();
    assert.match(await page.getByRole('status').innerText(),/Показано 1 из 48/);
    await page.locator('#library-results details').filter({hasText:'30 карточек в вики'}).locator('summary').click();
    const link=page.locator('#library-results a[href*="/wiki/"]').first();
    await link.click(); await page.waitForURL('**/wiki/**');
    assert.match(await page.locator('main').innerText(),/Грабин/);
    await open('/library/');
    await page.getByRole('button',{name:'Имеется полный текст',exact:true}).click();
    assert.match(await page.getByRole('status').innerText(),new RegExp('Показано '+library.filter(s=>['complete','provided'].includes(s.availability)).length+' из 48'));
    await field.fill('небывалыйисточник987');
    await page.getByRole('heading',{name:'Источников по этому запросу нет'}).waitFor();
    await page.getByRole('button',{name:'Сбросить поиск и фильтр'}).click();
    assert.match(await page.getByRole('status').innerText(),/Показано 48 из 48/);
  });
  await check('Wiki search, filter and detail retain quotations and context limits',async()=>{
    await open('/wiki/');
    const field=page.getByRole('searchbox').first();
    await field.fill('небывалаякарточка987');
    assert.equal(await page.locator('main a[href*="/wiki/"]').count(),0);
    await field.fill('');
    const select=page.locator('main select');
    if(await select.count()){const options=await select.locator('option').allTextContents();assert.ok(options.length>1);await select.selectOption({index:1});}
    const entry=page.locator('main a[href*="/wiki/"]').first();
    const destination=await entry.getAttribute('href');
    await entry.click();await page.waitForURL(url=>url.pathname===destination);
    const id=new URL(page.url()).pathname.split('/').filter(Boolean).at(-1);
    const card=cards.find(c=>c.id===id);assert.ok(card);
    const text=await page.locator('main').innerText();
    const norm=s=>s.replace(/\s+/g,' ').trim();
    for(const quote of card.quotes)assert.ok(norm(text).includes(norm(quote.text)),'Exact quote '+id);
    for(const limit of card.limits)assert.ok(norm(text).includes(norm(limit)),'Complete limit '+id);
    assert.ok(norm(text).includes(norm(card.context)),'Context '+id);
    const sourceLink=page.locator('main a[href*="/library/#"]').first();await sourceLink.click();
    await page.waitForURL('**/library/#*');
    const target=decodeURIComponent(new URL(page.url()).hash.slice(1));
    assert.ok(await page.locator(`[id="${target}"]`).count(),'Source deep link');
  });
  await check('Book navigation has the declared edition and preserves current reader',async()=>{
    await open('/');await page.locator('main').getByRole('link',{name:'Читать книгу',exact:false}).first().click();
    await page.waitForURL('**/read/');assert.match(await page.locator('main').innerText(),/4 сентября 2026/);
    await page.getByRole('link',{name:/Читать (введение|предисловие)/}).click();
    await page.getByTestId('reader').waitFor();
    await page.getByTestId('reader-toolbar').getByRole('button',{name:'Настройки чтения',exact:true}).click();
    await page.getByRole('dialog',{name:'Настройки чтения',exact:true}).waitFor();
    await page.keyboard.press('Escape');
  });
  assert.deepEqual(report.errors,[],'No browser exceptions or missing own resources');
  report.status='passed';
  console.log('Publication QA passed: '+report.layouts.length+' layouts, '+report.checks.length+' interaction checks.');
} catch(e) {report.status='failed';report.failure=e.stack||String(e);console.error(report.failure);await page.screenshot({path:path.join(out,'site-failure.jpg'),type:'jpeg',quality:70}).catch(()=>{});process.exitCode=1;}
finally {fs.writeFileSync('docs/research/publication-2026-09-05/browser-qa.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
