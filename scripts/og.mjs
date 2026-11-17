// Renders Riddlestorm's 1200x630 share banner from the running site.
// Start the dev server first (launch config "riddlestorm", port 8131), then from the project root:
//   node apps/riddlestorm/scripts/og.mjs apps/riddlestorm/site/og-YYYYMMDD.jpg
// Borrows the Playwright install of apps/applytrack.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../applytrack/package.json'));
const { chromium } = require('@playwright/test');

const out = resolve(process.argv[2] || join(here, '../site/og.jpg'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('http://127.0.0.1:8131/', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.keyboard.press('Escape');               // skip the loader
await page.waitForTimeout(1600);
await page.addStyleTag({ content: `
  .top, .storm-intro, .legend, .strike, .tip { display: none !important; }
  .og { position: absolute; right: 48px; bottom: 44px; z-index: 9; width: 510px;
    background: rgba(7,10,18,.84); border: 1px solid #2a3654; border-radius: 18px; padding: 26px 30px;
    box-shadow: 0 20px 60px rgba(0,0,0,.6); backdrop-filter: blur(6px); }
  .og h1 { margin: 0; font: 600 64px/1 Spectral, serif; color: #f4f7ff;
    text-shadow: 0 0 22px rgba(143,184,255,.6); }
  .og p { margin: 12px 0 0; font: 22px/1.4 "IBM Plex Sans", sans-serif; color: #c5cfe3; }
  .og .chips { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
  .og .chips span { font: 500 15px "IBM Plex Sans", sans-serif; color: #e6ebf5; border: 1px solid #3a4a70;
    border-radius: 99px; padding: 4px 12px; background: #0d1322; }
  .og .chips b { font-family: "Noto Sans Symbols 2", "Noto Sans Symbols", serif; color: #f0c96a; font-weight: 400; }
` });
await page.evaluate(() => {
  const d = document.createElement('div');
  d.className = 'og';
  d.innerHTML = `<h1>Riddlestorm</h1>
    <p>Riddles and sayings from many cultures. Lightning shows which words matter most.</p>
    <div class="chips"><span>${RS.riddles} riddles</span><span>${RS.sayings} sayings</span><span>${RS.cultureCount} cultures</span><span><b>♄ ☥ ☿</b> symbols</span></div>`;
  document.querySelector('#storm').appendChild(d);
  RS.strike('time');
});
await page.waitForTimeout(700);                   // let the threads light up fully
await page.evaluate(() => RS.strike('time'));     // strike again so the bolt is visible
await page.waitForTimeout(40);
await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
await browser.close();
console.log('wrote', out);
