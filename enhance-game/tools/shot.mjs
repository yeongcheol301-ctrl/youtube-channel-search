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
await page.screenshot({ path: out + 'forge.png', fullPage: true });
// 꾹 눌러 연속 강화
await page.evaluate(() => { const st = JSON.parse(localStorage.getItem('enhance-save-v2') || 'null'); return st; });
const eb = await page.$('#view .enhance-btn:not([disabled])');
if (eb) { const bx = await eb.boundingBox(); await page.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await page.mouse.down(); await page.waitForTimeout(1500); await page.screenshot({ path: out + 'hold.png' }); await page.mouse.up(); }
await page.click('.info-btn[data-type="axe"]');
await page.waitForTimeout(500);
await page.screenshot({ path: out + 'info.png' });
await page.mouse.click(195, 30);
await page.waitForTimeout(300);
console.log('info closed by backdrop:', await page.$eval('#modal', (m) => m.hidden));
await page.click('.tabs [data-tab="mine"]');
for (let i = 0; i < 8; i++) { await page.click('.tap-vein'); await page.waitForTimeout(60); }
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
