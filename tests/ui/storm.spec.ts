import { test as base, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Google Fonts are blocked so the tests never depend on the network; the page must work with fallback fonts. */
async function offlineFonts(page: Page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
}
/** Page errors and console errors are collected and must stay empty. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  // the blocked Google Fonts requests show up as "Failed to load resource"; everything else counts
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return errors;
}
/** Waits until the intro is gone and the storm is running. */
async function ready(page: Page) {
  await expect(page.locator('#loader')).toHaveCount(0, { timeout: 8_000 });
  await page.waitForFunction(() => (window as any).RS && (window as any).RS.nodes().length > 0);
}
/** Canvas coordinates -> page coordinates. */
async function at(page: Page, x: number, y: number) {
  const box = (await page.locator('#stormCanvas').boundingBox())!;
  return { x: box.x + x, y: box.y + y };
}

const test = base.extend<{ storm: Page; errors: string[] }>({
  errors: async ({ page }, use) => { await use(watchErrors(page)); },
  storm: async ({ page, errors }, use) => {
    await offlineFonts(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await ready(page);
    await use(page);
    expect(errors, 'no console or page errors').toEqual([]);
  },
});

test.describe('Intro', () => {
  test('plays briefly, then shows the storm from the top @mobile', async ({ page }) => {
    const errors = watchErrors(page);
    await offlineFonts(page);
    // 'load' can come after the short intro on a busy machine, so look at the intro from DOMContentLoaded on
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loader')).toBeAttached();
    await ready(page);
    // the page measures how long the intro was up: about 1.25 s, well under the old 4 s
    const introMs = await page.evaluate(() => (window as any).RS.introMs());
    expect(introMs).toBeGreaterThan(400);
    expect(introMs).toBeLessThan(2_500);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await expect(page.locator('body')).not.toHaveClass(/loading/);
    expect(errors).toEqual([]);
  });

  test('Skip ends it at once', async ({ page }) => {
    await offlineFonts(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // press Skip from inside the page right away, before the intro could end by itself
    const skipped = await page.evaluate(() => { const b = document.querySelector('#skip') as HTMLElement | null; b?.click(); return performance.now(); });
    await expect(page.locator('#loader')).toHaveCount(0, { timeout: 1_000 });
    expect(skipped).toBeGreaterThan(0);
  });

  test('is even shorter with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await offlineFonts(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loader')).toHaveCount(0, { timeout: 1_500 });
  });
});

test.describe('Storm', () => {
  test('draws the storm with the heaviest words @mobile', async ({ storm }) => {
    const lit = await storm.evaluate(() => {
      const c = document.querySelector('#stormCanvas') as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++;
      return n;
    });
    expect(lit).toBeGreaterThan(2_000);
    const shown = await storm.evaluate(() => (window as any).RS.nodes().map((n: any) => n.id));
    const isPhone = (storm.viewportSize()!.width) < 720;
    expect(shown).toHaveLength(isPhone ? 20 : 32);
    expect(shown).toContain('time'); // the heaviest word is always in the storm
  });

  test('lightning strikes a word, and its caption opens the mind map @mobile', async ({ storm }) => {
    await storm.evaluate(() => (window as any).RS.strike('time'));
    const strike = storm.locator('#strike');
    await expect(strike).toBeVisible();
    await expect(strike).toContainText('Time');
    await expect(strike).toContainText(/In \d+ riddles and sayings from \d+ cultures/);
    await strike.click();
    await expect(storm.locator('#drawer')).toBeVisible();
    await expect(storm.locator('#drawer h2')).toHaveText('Time');
  });

  test('clicking a word on the canvas opens its mind map', async ({ storm }) => {
    const n = await storm.evaluate(() => (window as any).RS.nodes().find((n: any) => n.id === 'word'));
    const p = await at(storm, n.x, n.y);
    await storm.mouse.click(p.x, p.y);
    await expect(storm.locator('#drawer h2')).toHaveText('Word');
  });

  test('hovering a riddle shows it, clicking reveals the answer', async ({ page }) => {
    // reduced motion slows the storm down so the pointer can follow a riddle
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await offlineFonts(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await ready(page);
    // wait for a riddle in clear space: away from the words, with nothing drawn on top of it
    const target = await (await page.waitForFunction(() => {
      const RS = (window as any).RS, W = innerWidth, H = innerHeight;
      const nodes = RS.nodes(), frags = RS.frags();
      return frags.find((f: any, i: number) => f.kind === 'riddle' && f.x > 200 && f.x < W - 200 && f.y > 220 && f.y < H - 140 &&
        nodes.every((n: any) => Math.hypot(n.x - f.x, n.y - f.y) > 60) &&
        // nothing drawn later (= on top) covers the point the pointer goes to
        frags.every((o: any, j: number) => j <= i || Math.abs(o.y - f.y) > 24 || Math.abs(o.x - f.x) > o.w / 2 + 12)) || false;
    }, null, { timeout: 15_000 })).jsonValue() as any;
    expect(target, 'a riddle away from the words').toBeTruthy();
    const p = await at(page, target.x, target.y);
    await page.mouse.move(p.x, p.y);
    const tip = page.locator('#tip');
    await expect(tip).toBeVisible();
    await expect(tip.locator('.t-text')).toHaveText(target.text);
    await expect(tip.locator('.t-answer')).toHaveCount(0);
    await page.mouse.click(p.x, p.y);
    await expect(tip).toHaveClass(/pinned/);
    await expect(tip.locator('.t-answer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
    // a pinned tooltip does not stay behind at a stale spot when the window changes size
    await page.mouse.click(p.x, p.y);
    await expect(tip).toHaveClass(/pinned/);
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(tip).toBeHidden();
  });

  test('the intro text sits on a shade, so riddles drifting behind it stay out of the way', async ({ storm }) => {
    const bg = await storm.evaluate(() => getComputedStyle(document.querySelector('.storm-intro')!, '::before').backgroundColor);
    expect(bg).toMatch(/rgba\(7, 10, 18, 0\.[89]\d*\)/);
  });

  test('draws a frame in a few milliseconds', async ({ storm }) => {
    const avg = await storm.evaluate(() => new Promise<number>(res => {
      const raf = window.requestAnimationFrame.bind(window), costs: number[] = [];
      window.requestAnimationFrame = cb => raf(t => { const s = performance.now(); cb(t); costs.push(performance.now() - s); });
      setTimeout(() => res(costs.slice(5).reduce((a, b) => a + b, 0) / Math.max(1, costs.length - 5)), 2_000);
    }));
    expect(avg).toBeLessThan(4);
  });
});

test.describe('Mind map drawer', () => {
  test('shows the symbol, stats, four branches and every riddle that uses the word @mobile', async ({ storm }) => {
    await storm.locator('#rankList [data-word="time"]').click();
    const d = storm.locator('#drawer');
    await expect(d).toBeVisible();
    await expect(d.locator('.d-sym')).toHaveText('⏳');
    await expect(d.locator('.d-sign')).toHaveText('♄');
    await expect(d.locator('.mm-hub')).toHaveText(['Evokes', 'Opportunities', 'Linked words', 'Cultures']);
    const uses = Number(await d.locator('.d-stats div').nth(1).locator('b').textContent());
    await expect(d.locator('.d-items li')).toHaveCount(uses);
    await expect(d.locator('.d-stats div').first().locator('b')).toHaveText('100');
  });

  test('a linked word opens that word', async ({ storm }) => {
    await storm.locator('#rankList [data-word="time"]').click();
    const link = storm.locator('#drawer .mm-link').first();
    const target = await link.getAttribute('data-word');
    await link.click();
    await expect(storm.locator('#drawer h2')).not.toHaveText('Time');
    await expect(storm.locator('#drawer .d-sym')).toHaveText(await storm.evaluate(id => (window as any).RS_DATA.concepts[id].e, target));
  });

  test('is opaque, so the page never shows through @mobile', async ({ storm }) => {
    await storm.locator('#rankList [data-word="time"]').click();
    const bg = await storm.locator('#drawer').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/^rgb\(/);
  });

  test('linked words in the mind map work from the keyboard', async ({ storm }) => {
    await storm.locator('#rankList [data-word="time"]').click();
    const link = storm.locator('#drawer .mm-link').first();
    const target = await link.getAttribute('data-word');
    // focus sits on the close button; one Tab reaches the first linked word
    await expect(storm.locator('#drawerClose')).toBeFocused();
    await storm.keyboard.press('Tab');
    await expect(link).toBeFocused();
    expect(await link.evaluate(el => getComputedStyle(el).textDecorationLine)).toContain('underline');
    await storm.keyboard.press('Enter');
    await expect(storm.locator('#drawer h2')).toHaveText(await storm.evaluate(id => (window as any).RS_DATA.concepts[id].label, target));
  });

  test('Escape closes it and gives focus back', async ({ storm }) => {
    const row = storm.locator('#rankList [data-word="water"]');
    await row.focus();
    await storm.keyboard.press('Enter');
    await expect(storm.locator('#drawer')).toBeVisible();
    await expect(storm.locator('#drawerClose')).toBeFocused();
    await storm.keyboard.press('Escape');
    await expect(storm.locator('#drawer')).toBeHidden();
    await expect(row).toBeFocused();
  });

  test('also opens words that are too light for the storm', async ({ storm }) => {
    const light = await storm.evaluate(() => {
      const shown = new Set((window as any).RS.nodes().map((n: any) => n.id));
      return Object.keys((window as any).RS_DATA.concepts).find(id => !shown.has(id))!;
    });
    await storm.locator(`#rankList [data-word="${light}"]`).click();
    await expect(storm.locator('#drawer h2')).toBeVisible();
    await expect(storm.locator('#drawer .d-items li').first()).toBeVisible();
  });
});

test.describe('Word atlas', () => {
  test('ranks all 50 words by weight, with a symbol each @mobile', async ({ storm }) => {
    const rows = storm.locator('#rankList li');
    await expect(rows).toHaveCount(50);
    const scores = (await storm.locator('#rankList .r-score').allTextContents()).map(Number);
    expect(scores[0]).toBe(100);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    const syms = await storm.locator('#rankList .r-sym').allTextContents();
    expect(syms.every(s => s.trim().length > 0)).toBe(true);
    await expect(storm.locator('#atlasCount')).toHaveText('50 words');
    // the stats line keeps to one line of its own ("39 / links" used to break apart)
    const lh = await storm.locator('#rankList .r-meta').first().evaluate(el => parseFloat(getComputedStyle(el).lineHeight));
    for (const h of await storm.locator('#rankList .r-meta').evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) {
      expect(h).toBeLessThan(lh * 1.5);
    }
  });

  test('search filters by word, feeling or market', async ({ storm }) => {
    const search = storm.locator('#atlasSearch');
    await search.fill('trust');
    await expect(storm.locator('#atlasCount')).toHaveText('4 of 50 words');
    await expect(storm.locator('#rankList li:not([hidden]) .r-word')).toHaveText(['Word', 'Secret', 'Friend', 'Mother']);
    await search.fill('solar');
    await expect(storm.locator('#rankList li:not([hidden]) .r-word')).toHaveText(['Sun']);
    await search.fill('zzzz');
    await expect(storm.locator('#atlasCount')).toHaveText('0 of 50 words');
    await search.fill('');
    await expect(storm.locator('#rankList li:not([hidden])')).toHaveCount(50);
  });
});

test.describe('Five languages', () => {
  test('shows five languages with originals in the right script and direction @mobile', async ({ storm }) => {
    const cards = storm.locator('.lang');
    await expect(cards).toHaveCount(5);
    await expect(cards.locator('h3')).toHaveText(['Swahili', 'Chinese', 'Russian', 'Arabic', 'Spanish']);
    const arabic = cards.filter({ hasText: 'العربية' });
    const orig = arabic.locator('.orig').first();
    await expect(orig).toHaveAttribute('dir', 'rtl');
    await expect(orig).toHaveAttribute('lang', 'ar');
    await expect(cards.filter({ hasText: 'Chinese' }).locator('.orig').first()).toHaveAttribute('lang', 'zh');
  });

  test('each card shows four texts and folds out the rest @mobile', async ({ storm }) => {
    const card = storm.locator('.lang').first();
    const all = await card.locator('ul > li').count();
    await expect(card.locator('ul > li:visible')).toHaveCount(4);
    const more = card.locator('.lang-more');
    await expect(more).toHaveText(`Show ${all - 4} more`);
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(card.locator('ul > li:visible')).toHaveCount(all);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(more).toHaveText('Show fewer');
    await more.click();
    await expect(card.locator('ul > li:visible')).toHaveCount(4);
  });

  test('meaning chips open the word', async ({ storm }) => {
    const chip = storm.locator('.lang .leans .chip').first();
    const id = await chip.getAttribute('data-word');
    await chip.click();
    await expect(storm.locator('#drawer h2')).toHaveText(await storm.evaluate(i => (window as any).RS_DATA.concepts[i].label, id));
  });
});

test.describe('Quality', () => {
  test('the header turns solid below the storm @mobile', async ({ storm }) => {
    const top = storm.locator('header.top');
    await expect(top).not.toHaveClass(/solid/);
    await storm.locator('#ranking').evaluate(el => el.scrollIntoView({ behavior: 'instant' }));
    await expect(top).toHaveClass(/solid/);
    await storm.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect(top).not.toHaveClass(/solid/);
  });

  test('no horizontal scrolling @mobile', async ({ storm }) => {
    expect(await storm.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });

  test('passes an axe accessibility scan @mobile', async ({ storm }) => {
    const r = await new AxeBuilder({ page: storm }).analyze();
    expect(r.violations.map(v => `${v.id}: ${v.nodes.length}× ${v.nodes[0]?.target}`)).toEqual([]);
  });

  test('passes an axe scan with the drawer open', async ({ storm }) => {
    await storm.locator('#rankList [data-word="time"]').click();
    const r = await new AxeBuilder({ page: storm }).include('#drawer').analyze();
    expect(r.violations.map(v => `${v.id}: ${v.nodes.length}× ${v.nodes[0]?.target}`)).toEqual([]);
  });
});
