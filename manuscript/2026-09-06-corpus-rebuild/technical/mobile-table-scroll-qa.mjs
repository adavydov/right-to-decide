import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const bookBytes = fs.readFileSync("src/data/book.json");
const book = JSON.parse(bookBytes);
const tables = book.chapters.find(c => c.id === "appendix-d").blocks.filter(b => b.type === "table");
const directory = "docs/design-references/literary-v9.0";
const report = { status: "running", at: new Date().toISOString(), releaseId: book.releaseId, bookSha256: createHash("sha256").update(bookBytes).digest("hex"), viewport: {width:390,height:844}, browser:"Microsoft Edge, headless; fresh isolated context", tables:[], errors:[], cssChanged:false };
const browser = await chromium.launch({headless:true,channel:"msedge"});
try {
  const page = await browser.newPage({viewport:report.viewport,reducedMotion:"reduce"});
  page.on("pageerror", e => report.errors.push(e.message));
  const response=await page.goto("http://127.0.0.1:3217/right-to-decide/read/appendix-d/",{waitUntil:"networkidle"});
  assert.equal(response.status(),200);
  await page.evaluate(() => document.fonts.ready);
  for (const index of [0,2]) {
    const block=tables[index];
    const wrapper=page.locator('[id="'+block.id+'"]');
    await wrapper.scrollIntoViewIfNeeded();
    const before=await wrapper.evaluate(el=>({className:el.className,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,scrollLeft:el.scrollLeft,overflowX:getComputedStyle(el).overflowX}));
    assert.ok(["auto","scroll"].includes(before.overflowX));
    assert.ok(before.scrollWidth>before.clientWidth);
    await wrapper.evaluate(el=>{el.scrollLeft=el.scrollWidth-el.clientWidth});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const after=await wrapper.evaluate(el=>{
      const table=el.querySelector("table"),last=el.querySelector("tr:last-child > :last-child");
      const w=el.getBoundingClientRect(),t=table.getBoundingClientRect(),c=last.getBoundingClientRect();
      return {scrollLeft:el.scrollLeft,maxScrollLeft:el.scrollWidth-el.clientWidth,wrapper:{left:w.left,right:w.right},table:{left:t.left,right:t.right},lastCell:{left:c.left,right:c.right,text:last.textContent},viewportWidth:innerWidth,documentWidth:document.documentElement.scrollWidth};
    });
    assert.ok(after.scrollLeft>0);
    assert.ok(Math.abs(after.scrollLeft-after.maxScrollLeft)<=1);
    assert.ok(after.table.right<=after.wrapper.right+1);
    assert.ok(after.lastCell.left>=after.wrapper.left-1 && after.lastCell.right<=after.wrapper.right+1);
    assert.ok(after.wrapper.left>=0 && after.wrapper.right<=after.viewportWidth+1);
    assert.ok(after.documentWidth<=after.viewportWidth+1);
    assert.equal(after.lastCell.text,block.rows.at(-1).at(-1));
    const allCells=await wrapper.locator("tr").evaluateAll(rows=>rows.map(r=>[...r.children].map(c=>c.textContent)));
    assert.deepEqual(allCells,block.rows);
    const screenshot=directory+"/table-appendix-d-"+index+"-390-right.png";
    const normalViewport=page.viewportSize();
    const box=await wrapper.boundingBox();
    const screenshotViewport={width:normalViewport.width,height:Math.max(normalViewport.height,Math.ceil(box.height)+300)};
    await page.setViewportSize(screenshotViewport);
    await wrapper.evaluate(el=>el.scrollIntoView({block:"center",behavior:"instant"}));
    await wrapper.screenshot({path:screenshot});
    await page.setViewportSize(normalViewport);
    const afterScreenshot=await wrapper.evaluate(el=>el.scrollLeft);
    assert.equal(afterScreenshot,after.scrollLeft);
    report.tables.push({index,id:block.id,before,after,allCellsMatch:true,rightEdgeAndLastCellVisible:true,screenshot,screenshotViewport,scrollLeftAfterScreenshot:afterScreenshot});
  }
  assert.deepEqual(report.errors,[]);
  report.status="passed";
} catch(error) {
  report.status="failed"; report.failure=String(error.stack||error); throw error;
} finally {
  fs.writeFileSync(directory+"/mobile-table-scroll-qa.json",JSON.stringify(report,null,2)+"\n");
  await browser.close();
}
console.log(JSON.stringify(report,null,2));
