import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

// The dataset (site/data.js) is plain JavaScript that sets window.RS_DATA; load it without a browser.
const sandbox: { window: any } = { window: {} };
runInNewContext(readFileSync(fileURLToPath(new URL('../../site/data.js', import.meta.url)), 'utf8'), sandbox);
const D = sandbox.window.RS_DATA;
const ids = Object.keys(D.concepts);
const items = [...D.riddles.map((r: any) => ({ ...r, kind: 'riddle', text: r.q })), ...D.sayings.map((s: any) => ({ ...s, kind: 'saying', text: s.t }))];

test.describe('Dataset', () => {
  test('is large enough: 50+ words, 50+ riddles, 60+ sayings', () => {
    expect(ids.length).toBeGreaterThanOrEqual(50);
    expect(D.riddles.length).toBeGreaterThanOrEqual(50);
    expect(D.sayings.length).toBeGreaterThanOrEqual(60);
  });

  test('every riddle and saying only uses known words, with no duplicates', () => {
    for (const it of items) {
      expect(it.m.length, it.text).toBeGreaterThan(0);
      for (const m of it.m) expect(ids, `"${m}" in "${it.text}"`).toContain(m);
      expect(new Set(it.m).size, `duplicate meaning in "${it.text}"`).toBe(it.m.length);
    }
  });

  test('no riddle or saying appears twice', () => {
    const texts = items.map(i => (i.o || i.text).toLowerCase());
    const dupes = texts.filter((t, i) => texts.indexOf(t) !== i);
    expect(dupes).toEqual([]);
  });

  test('every item has a culture and an answer or meaning', () => {
    for (const r of D.riddles) { expect(r.c, r.q).toBeTruthy(); expect(r.a, r.q).toBeTruthy(); expect(r.src, r.q).toBeTruthy(); }
    for (const s of D.sayings) { expect(s.c, s.t).toBeTruthy(); expect(s.n, s.t).toBeTruthy(); expect(s.o, s.t).toBeTruthy(); }
  });

  test('every word has a label, a symbol, a note, 4 associations and 3 opportunities', () => {
    for (const id of ids) {
      const c = D.concepts[id];
      expect(c.label, id).toBeTruthy();
      expect(c.e, id).toMatch(/\p{Extended_Pictographic}/u);
      expect(c.note, id).toBeTruthy();
      expect(c.evokes, id).toHaveLength(4);
      expect(c.angles, id).toHaveLength(3);
    }
  });

  test('every word has its own symbol', () => {
    const emoji = ids.map(id => D.concepts[id].e);
    expect(emoji.filter((e, i) => emoji.indexOf(e) !== i)).toEqual([]);
  });

  test('every word is used at least twice, so it can be compared', () => {
    const uses: Record<string, number> = {};
    for (const it of items) for (const m of it.m) uses[m] = (uses[m] || 0) + 1;
    expect(ids.filter(id => (uses[id] || 0) < 2)).toEqual([]);
  });

  test('the five languages each have riddles or sayings, and right-to-left scripts are marked', () => {
    expect(D.languages).toHaveLength(5);
    for (const L of D.languages) {
      const own = items.filter(i => L.cultures.includes(i.c));
      expect(own.length, L.name).toBeGreaterThanOrEqual(5);
    }
    // Arabic, Persian and Hebrew originals must be in a right-to-left script and flagged as such
    for (const it of items.filter(i => i.o && ['Arabic', 'Persian', 'Hebrew'].includes(i.c))) {
      expect(it.o, it.text).toMatch(/[֐-ۿ]/);
      expect(D.rtl).toContain(it.c);
    }
  });
});
