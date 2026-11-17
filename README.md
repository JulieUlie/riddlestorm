# Riddlestorm

**Live:** https://riddlestorm.julietous.workers.dev/ · part of [my web apps](https://apps.julietous.workers.dev/)

![Riddlestorm banner](site/og-20261117c.jpg)

A storm of riddles and sayings from many cultures. Lightning lights up the words they keep returning to, so you can see which words carry the most symbolic weight, and what that weight could mean for ideas and business.

- **Storm** (canvas): riddles (blue, italic) and sayings (gold) orbit the eye of the storm, with the 32 heaviest words (20 on phones). Every few seconds lightning strikes a heavy word and threads light up to every riddle that uses it. Hover a riddle to read it, click to reveal the answer, click a word for its mind map.
- **Mind map** (drawer): what the word evokes, business opportunities, linked words and the cultures that use it.
- **Word atlas**: all 50 words, ranked by `weight = uses + 2 × cultures + ½ × links` (scaled to 100), searchable by word, feeling or market.
- **Symbols**: every word has a thematic emoji (hourglass for time, quill for word, hamsa for hand), tinted gold in the storm and in full colour when lightning lights it up. Where a traditional sign exists (ankh, alchemical elements, planet signs) the word's page shows it too, drawn with Google's Noto symbol fonts.
- **Five languages**: Swahili, Chinese, Russian, Arabic and Spanish riddles and sayings, in the original script, with their meanings.
- Opens with a ~4 s loading animation (riddle words spiral in, lightning, title). Skip with the button, a click or Esc. Shorter and calmer with reduced motion.

## Structure

- `site/index.html`, `style.css`, `app.js`: the page, storm canvas, drawer and sections
- `site/data.js`: riddles, sayings, meanings, symbols and languages
- `scripts/og.mjs`: renders the 1200×630 share banner from the running site

All data is in `site/data.js`; add riddles or sayings there and tag them with meaning ids. Static site, no build step.

Run locally: `python -m http.server 8131 --directory apps/riddlestorm/site` (or launch config "riddlestorm").
Deploy: `npx wrangler deploy` from `apps/riddlestorm`.

## Credits

Riddle and saying texts are short retellings of traditional sources (named per item in the app). Fonts: IBM Plex Sans, Spectral and Noto Sans Symbols via Google Fonts.

## Versions

- **v2** (17 Nov 2026): 50 words (was 25), 79 sayings (was 15) and 53 riddles from 25 cultures; an emoji symbol for every word; searchable word atlas; a 1.5 s intro (was 4 s); faster drawing (text, emoji and glows are cached as small images, so a frame costs under 1 ms of script time).
- **v1** (17 Nov 2026): first release.
