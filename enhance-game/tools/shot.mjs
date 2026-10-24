// 휴대폰 크기로 화면을 열어 흐름을 눌러 보고 탭별 스크린샷을 남긴다. 사용: node tools/shot.mjs http://localhost:8123/
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2];
const out = new URL('../shots/', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForSelector('.buy');
await page.screenshot({ path: out + 'splash.png' });
await page.click('#splash');
await page.click('[data-act="buy"][data-type="sword"]');
await page.evaluate(() => {});
for (let i = 0; i < 3; i++) { await page.waitForTimeout(1100); }
for (let i = 0; i < 20; i++) { await page.waitForTimeout(1000); const b = await page.$('#view .enhance-btn:not([disabled])'); if (b) await b.click(); }
await page.click('[data-act="toggle-loc"]');
await page.screenshot({ path: out + 'forge.png', fullPage: true });
for (const tab of ['mine', 'boss', 'book', 'shop']) {
  await page.click(`.tabs [data-tab="${tab}"]`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + tab + '.png', fullPage: true });
}
await page.click('.tabs [data-tab="boss"]');
await page.click('[data-act="challenge"]');
await page.waitForTimeout(3000);
await page.click('.tabs [data-tab="shop"]');
await page.click('[data-act="open-odds"]');
await page.waitForTimeout(200);
await page.screenshot({ path: out + 'odds.png' });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
console.log(JSON.stringify({ errors, overflow }));
await browser.close();
