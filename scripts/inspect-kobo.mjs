import fs from "node:fs";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.PLAYWRIGHT_MODULE || "playwright");
const folder="docs/design-references/kobo-reader";
fs.mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"msedge"});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto("https://help.kobo.com/hc/en-us/articles/35996239522967",{waitUntil:"domcontentloaded",timeout:60000});
  const data=await page.locator("article").evaluate(e=>({text:e.innerText,images:[...e.querySelectorAll("img")].map(i=>({src:i.src,alt:i.alt})),styles:{font:getComputedStyle(e).fontFamily,color:getComputedStyle(e).color}}));
  fs.writeFileSync("docs/research/kobo-public-reference.json",JSON.stringify(data,null,2));
  await page.screenshot({path:folder+"/kobo-public-guide.png",fullPage:true});
  console.log(JSON.stringify(data));
  await page.goto("https://help.kobo.com/hc/article_attachments/25994485979543",{waitUntil:"load",timeout:60000});
  await page.screenshot({path:folder+"/kobo-reader-reference.png"});
} finally { await browser.close(); }
