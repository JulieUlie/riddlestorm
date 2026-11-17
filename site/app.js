(() => {
  'use strict';
  const D = window.RS_DATA;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SYMF = '"Noto Sans Symbols 2", "Noto Sans Symbols", "Segoe UI Symbol", serif';
  const SANS = '"IBM Plex Sans", system-ui, sans-serif';
  const SERIF = 'Spectral, Georgia, serif';
  const EMOF = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  // Emoji are tinted gold so they sit in the storm's palette; a lit word shows its true colours.
  const EMO_TINT = 'sepia(0.75) saturate(1.5) hue-rotate(-8deg) brightness(1.05)';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Seeded random so the layout is the same on every visit.
  let seed = 20261117;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  /* ================= data + scoring ================= */
  const ids = Object.keys(D.concepts);
  const items = [
    ...D.riddles.map((r, i) => ({ id: 'r' + i, kind: 'riddle', text: r.q, orig: r.o, answer: r.a, culture: r.c, src: r.src, m: r.m })),
    ...D.sayings.map((s, i) => ({ id: 's' + i, kind: 'saying', text: s.t, orig: s.o !== s.t ? s.o : '', answer: s.n, culture: s.c, src: s.src || 'Saying', m: s.m }))
  ];
  items.forEach(it => it.m.forEach(k => { if (!D.concepts[k]) console.warn('Unknown meaning', k, 'in', it.id); }));

  const langOf = {};
  D.languages.forEach(L => L.cultures.forEach(c => { langOf[c] = L; }));
  const langAttr = c => {
    const code = langOf[c] ? langOf[c].code : (D.codes[c] || '');
    return `${code ? ` lang="${code}"` : ''}${D.rtl.includes(c) ? ' dir="rtl"' : ''}`;
  };

  const stats = {};
  ids.forEach(id => { stats[id] = { id, items: [], cultures: new Map(), links: new Map() }; });
  items.forEach(it => it.m.forEach(a => {
    const s = stats[a];
    s.items.push(it);
    s.cultures.set(it.culture, (s.cultures.get(it.culture) || 0) + 1);
    it.m.forEach(b => { if (b !== a) s.links.set(b, (s.links.get(b) || 0) + 1); });
  }));
  ids.forEach(id => {
    const s = stats[id];
    s.R = s.items.length; s.C = s.cultures.size; s.B = s.links.size;
    s.raw = s.R + 2 * s.C + 0.5 * s.B;
  });
  const maxRaw = Math.max(...ids.map(id => stats[id].raw));
  ids.forEach(id => { stats[id].score = Math.round(100 * stats[id].raw / maxRaw); });
  const ranked = ids.slice().sort((a, b) => stats[b].raw - stats[a].raw || a.localeCompare(b));
  ranked.forEach((id, i) => { stats[id].rank = i + 1; });
  const HIGH = 12; // the most symbolic words (gold score, extra glow)
  const isHigh = id => stats[id].rank <= HIGH;
  const symOf = id => D.concepts[id].e;
  const label = id => D.concepts[id].label;
  const cultureCount = new Set(items.map(i => i.culture)).size;

  /* ================= static sections ================= */
  const chip = id => `<button type="button" class="chip" data-word="${id}"><span class="emo">${symOf(id)}</span>${esc(label(id))}</button>`;

  $('#rankList').innerHTML = ranked.map(id => {
    const s = stats[id];
    const c = D.concepts[id];
    const hay = [c.label, ...c.evokes, ...c.angles, c.note].join(' ').toLowerCase();
    return `<li class="${isHigh(id) ? 'hi' : ''}" data-hay="${esc(hay)}"><button type="button" data-word="${id}">
      <span class="r-n">${s.rank}</span>
      <span class="r-sym emo" aria-hidden="true">${symOf(id)}</span>
      <span class="r-main"><span class="r-word">${esc(label(id))}</span>
        <span class="r-meta">${s.R} uses · ${s.C} cultures · ${s.B} links</span>
        <span class="r-evokes">${c.evokes.map(esc).join(' · ')}</span>
        <span class="r-bar"><i style="width:${s.score}%"></i></span></span>
      <span class="r-score">${s.score}</span></button></li>`;
  }).join('');

  $('#langGrid').innerHTML = D.languages.map(L => {
    const its = items.filter(i => L.cultures.includes(i.culture))
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'saying' ? -1 : 1));
    const counts = {};
    its.forEach(i => i.m.forEach(k => { counts[k] = (counts[k] || 0) + 1; }));
    const leans = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || stats[b].raw - stats[a].raw).slice(0, 3);
    const dir = L.dir ? ` dir="${L.dir}"` : '';
    return `<article class="lang">
      <header><h3>${esc(L.name)}</h3><span class="native" lang="${L.code}"${dir}>${esc(L.native)}</span></header>
      <div class="leans">Leans on<div class="chips">${leans.map(chip).join('')}</div></div>
      <ul>${its.map(i => `<li>
        <span class="kind ${i.kind}">${i.kind === 'riddle' ? 'Riddle' : 'Saying'}</span>
        ${i.orig ? `<p class="orig" lang="${L.code}"${dir}>${esc(i.orig)}</p>` : ''}
        <p class="trans">${esc(i.text)}</p>
        ${i.kind === 'riddle'
          ? `<details><summary>Answer</summary>${esc(i.answer)}</details>`
          : `<p class="note">${esc(i.answer)}</p>`}
        <div class="chips">${i.m.map(chip).join('')}</div>
      </li>`).join('')}</ul>
    </article>`;
  }).join('');

  // Atlas search: word, what it evokes, opportunities, symbol note.
  const search = $('#atlasSearch'), atlasCount = $('#atlasCount');
  const filterAtlas = () => {
    const q = search.value.trim().toLowerCase();
    let n = 0;
    document.querySelectorAll('#rankList li').forEach(li => {
      const hit = !q || li.dataset.hay.includes(q);
      li.hidden = !hit; if (hit) n++;
    });
    atlasCount.textContent = q ? `${n} of ${ids.length} words` : `${ids.length} words`;
  };
  search.addEventListener('input', filterAtlas);
  filterAtlas();

  $('#countLine').textContent = `${D.riddles.length} riddles and ${D.sayings.length} sayings from ${cultureCount} cultures, tagged with ${ids.length} meanings.`;

  /* ================= drawer + mind map ================= */
  const drawer = $('#drawer'), drawerBody = $('#drawerBody');
  let sel = null, lastFocus = null;

  function mindmap(id) {
    const s = stats[id], c = D.concepts[id];
    const linked = [...s.links.entries()].sort((a, b) => b[1] - a[1] || stats[b[0]].raw - stats[a[0]].raw).slice(0, 5);
    const cults = [...s.cultures.entries()].sort((a, b) => b[1] - a[1]);
    const cultLeaves = cults.slice(0, 5).map(([k, v]) => ({ t: v > 1 ? `${k} ×${v}` : k }));
    if (cults.length > 5) cultLeaves.push({ t: `+${cults.length - 5} more` });
    const br = [
      { t: 'Evokes', col: '#8fb8ff', leaves: c.evokes.map(t => ({ t })) },
      { t: 'Opportunities', col: '#f0c96a', leaves: c.angles.map(t => ({ t })) },
      { t: 'Linked words', col: '#a9c4ee', leaves: linked.map(([b]) => ({ t: symOf(b) + ' ' + label(b), id: b })) },
      { t: 'Cultures', col: '#f0cd96', leaves: cultLeaves }
    ];
    const W = 392, LH = 22, colX = [12, 206];
    const topN = Math.max(br[0].leaves.length, br[1].leaves.length);
    const botN = Math.max(br[2].leaves.length, br[3].leaves.length);
    const yC = topN * LH + 64;
    const H = yC + 44 + botN * LH + 18;
    let out = `<svg class="mindmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mind map of ${esc(c.label)}">`;
    br.forEach((b, i) => {
      const x = colX[i % 2], top = i < 2;
      const hubY = top ? yC - 34 : yC + 44;
      const sx = x + 6;
      // curve from the centre to the hub
      out += `<path d="M${W / 2} ${yC} C ${W / 2} ${(yC + hubY) / 2}, ${sx} ${(yC + hubY) / 2}, ${sx} ${hubY + (top ? 6 : -16)}" fill="none" stroke="${b.col}" stroke-opacity=".55" stroke-width="1.5"/>`;
      out += `<text class="mm-hub" x="${x + 14}" y="${hubY}" style="fill:${b.col}">${esc(b.t)}</text>`;
      if (b.leaves.length) {
        const lastY = top ? hubY - b.leaves.length * LH : hubY + b.leaves.length * LH;
        out += `<line x1="${sx}" y1="${top ? hubY - 4 : hubY + 6}" x2="${sx}" y2="${lastY - 4}" stroke="${b.col}" stroke-opacity=".35"/>`;
      }
      b.leaves.forEach((l, j) => {
        const y = top ? hubY - (j + 1) * LH : hubY + (j + 1) * LH;
        out += `<line x1="${sx}" y1="${y - 4}" x2="${sx + 8}" y2="${y - 4}" stroke="${b.col}" stroke-opacity=".35"/>`;
        out += l.id
          ? `<text class="mm-leaf mm-link" x="${x + 18}" y="${y}" data-word="${l.id}" tabindex="0" role="button">${esc(l.t)}</text>`
          : `<text class="mm-leaf" x="${x + 18}" y="${y}">${esc(l.t)}</text>`;
      });
    });
    const pillW = c.label.length * 11 + 58;
    out += `<rect x="${W / 2 - pillW / 2}" y="${yC - 18}" width="${pillW}" height="36" rx="18" fill="#16213d" stroke="#8fb8ff" stroke-opacity=".8"/>`;
    out += `<text x="${W / 2}" y="${yC + 6}" text-anchor="middle" style="font-weight:600;font-size:17px"><tspan style="font-family:${EMOF.replace(/"/g, "'")}">${symOf(id)}</tspan> ${esc(c.label)}</text>`;
    return out + '</svg>';
  }

  function openWord(id) {
    if (!D.concepts[id]) return;
    if (drawer.hidden) lastFocus = document.activeElement;
    sel = id;
    const s = stats[id];
    const list = s.items.slice().sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'riddle' ? -1 : 1));
    drawerBody.innerHTML = `
      <div class="d-head"><span class="d-sym emo lit" aria-hidden="true">${symOf(id)}</span>
        <div><h2>${esc(label(id))}</h2><span class="d-rank">#${s.rank} of ${ids.length}${isHigh(id) ? ' · high symbolism' : ''}</span></div></div>
      <p class="d-symnote">${D.concepts[id].sign ? `<span class="d-sign">${D.concepts[id].sign}</span>` : ''}${esc(D.concepts[id].note)}</p>
      <div class="d-stats">
        <div><b>${s.score}</b><span>weight</span></div>
        <div><b>${s.R}</b><span>uses</span></div>
        <div><b>${s.C}</b><span>cultures</span></div>
        <div><b>${s.B}</b><span>links</span></div>
      </div>
      <h3>Mind map</h3>
      ${mindmap(id)}
      <h3>Riddles &amp; sayings</h3>
      <ul class="d-items">${list.map(i => {
        return `<li class="${i.kind}">
          <p class="q">${esc(i.text)}</p>
          ${i.orig ? `<p class="src"${langAttr(i.culture)}>${esc(i.orig)}</p>` : ''}
          <span class="src">${i.kind === 'riddle' ? 'Riddle' : 'Saying'} · ${esc(i.culture)}${i.src && i.src !== 'Saying' ? ' · ' + esc(i.src) : ''}</span>
          <details><summary>${i.kind === 'riddle' ? 'Answer' : 'Meaning'}</summary>${esc(i.answer)}</details>
        </li>`;
      }).join('')}</ul>`;
    drawer.hidden = false;
    drawer.scrollTop = 0;
    $('#drawerClose').focus({ preventScroll: true });
  }
  function closeWord() {
    if (drawer.hidden) return;
    drawer.hidden = true; sel = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $('#drawerClose').addEventListener('click', closeWord);

  // Any element with data-word opens that word.
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-word]');
    if (t) { e.preventDefault(); openWord(t.dataset.word); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (pinned) unpin(); else closeWord(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('svg [data-word]')) {
      e.preventDefault(); openWord(e.target.dataset.word);
    }
  });

  /* ================= storm ================= */
  const stormEl = $('#storm');
  const cv = $('#stormCanvas'), ctx = cv.getContext('2d');
  const tip = $('#tip'), strikeBtn = $('#strike');
  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, rx = 0, ry = 0, k = 1;

  // The storm shows the heaviest words; the rest live in the atlas below.
  const STORM_N = 32, STORM_N_SMALL = 20;
  const sids = ranked.slice(0, STORM_N);
  // Force layout in a unit square: linked words pull together, all words push apart.
  const idx = Object.fromEntries(sids.map((id, i) => [id, i]));
  const P = sids.map(() => ({ x: rnd() * 2 - 1, y: rnd() * 2 - 1 }));
  for (let it = 0; it < 500; it++) {
    const F = P.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y;
      const d2 = dx * dx + dy * dy + 1e-4, d = Math.sqrt(d2), f = 0.012 / d2;
      F[i].x += dx / d * f; F[i].y += dy / d * f; F[j].x -= dx / d * f; F[j].y -= dy / d * f;
    }
    sids.forEach((a, i) => stats[a].links.forEach((w, b) => {
      const j = idx[b]; if (j === undefined || j <= i) return;
      const dx = P[j].x - P[i].x, dy = P[j].y - P[i].y, d = Math.hypot(dx, dy) || 1e-3;
      const f = (d - 0.4) * 0.006 * w;
      F[i].x += dx / d * f; F[i].y += dy / d * f; F[j].x -= dx / d * f; F[j].y -= dy / d * f;
    }));
    const step = 0.6 * (1 - it / 500) + 0.05;
    P.forEach((p, i) => {
      p.x += clamp(F[i].x - p.x * 0.01, -0.05, 0.05) * step;
      p.y += clamp(F[i].y - p.y * 0.01, -0.05, 0.05) * step;
    });
  }
  const ext = a => [Math.min(...a), Math.max(...a)];
  const [x0, x1] = ext(P.map(p => p.x)), [y0, y1] = ext(P.map(p => p.y));

  const nodes = sids.map((id, i) => ({
    id, s: stats[id],
    nx: ((P[i].x - x0) / (x1 - x0 || 1)) * 2 - 1,
    ny: ((P[i].y - y0) / (y1 - y0 || 1)) * 2 - 1,
    x: 0, y: 0, fs: 14, w: 0, top: 0, bot: 0, ph: rnd() * 6.28, glow: 0, show: true
  }));

  function shortText(t) {
    let s = '';
    for (const w of t.split(' ')) {
      if ((s + ' ' + w).trim().length > 42) return s.trim() + '…';
      s += ' ' + w;
    }
    return s.trim();
  }
  const frags = items.map(it => ({
    it, label: shortText(it.text),
    r0: 0.16 + Math.pow(rnd(), 0.75) * 0.86, a: rnd() * Math.PI * 2,
    sp: 0.6 + rnd() * 0.8, ph: rnd() * 6.28, x: 0, y: 0, w: 0, frozen: false, glow: 0, show: true, keep: rnd()
  }));
  const streaks = Array.from({ length: 110 }, () => ({
    r: 0.04 + rnd() * 1.1, a: rnd() * Math.PI * 2, sp: 0.7 + rnd() * 1.6, len: 0.05 + rnd() * 0.16, bucket: Math.floor(rnd() * 3)
  }));

  const nodeFont = n => `600 ${n.fs}px ${SANS}`;
  const fragFont = f => `${f.it.kind === 'riddle' ? 'italic ' : ''}${Math.round(13 * k + 1)}px ${SERIF}`;

  // Text, emoji and glows are drawn once into small canvases and reused every frame:
  // blur and colour filters are the expensive part of canvas text, so they are baked in here.
  function sprite(text, font, color, { blur = 0, glow = '', filter = '', size = 14 } = {}) {
    ctx.font = font;
    const pad = Math.ceil(blur * 1.2) + 4;
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2, h = Math.ceil(size * 1.5) + pad * 2;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
    if (filter) g.filter = filter;
    if (blur) { g.shadowColor = glow; g.shadowBlur = blur; }
    g.fillText(text, w / 2, h / 2);
    return { c, w, h };
  }
  const blit = (sp, x, y) => ctx.drawImage(sp.c, x - sp.w / 2, y - sp.h / 2, sp.w, sp.h);

  function resize() {
    const r = stormEl.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    k = clamp(W / 1300, 0.78, 1.1);
    cx = W / 2; cy = H * 0.55; rx = W * 0.52; ry = H * 0.5;

    // measure
    const small = W < 720;
    const fsz = Math.round(13 * k + 1);
    frags.forEach(f => {
      f.show = !small || f.keep < 0.5;
      ctx.font = fragFont(f); f.w = ctx.measureText(f.label).width;
      if (!f.show) return;
      const rgb = f.it.kind === 'riddle' ? '169,196,238' : '240,205,150';
      const txt = f.it.kind === 'saying' ? '\u201c' + f.label + '\u201d' : f.label;
      f.spr = sprite(txt, fragFont(f), `rgb(${rgb})`, { size: fsz });
      f.sprGlow = sprite(txt, fragFont(f), `rgb(${rgb})`, { size: fsz, blur: 12, glow: `rgba(${rgb},.8)` });
    });
    const spanX = W < 720 ? W * 0.4 : W * 0.37, spanY = H * 0.29;
    nodes.forEach(n => {
      n.show = n.s.rank <= (small ? STORM_N_SMALL : STORM_N);
      n.fs = Math.round((13 + n.s.score * 0.15) * k);
      ctx.font = nodeFont(n);
      n.w = ctx.measureText(label(n.id)).width;
      n.top = n.fs * 0.75 + n.fs * 1.2;
      n.bot = n.fs * 0.45;
      n.x = cx + n.nx * spanX; n.y = cy + n.ny * spanY;
      if (!n.show) return;
      const esz = Math.round(n.fs * 1.05), ef = `${esz}px ${EMOF}`;
      n.emo = sprite(symOf(n.id), ef, '#fff', { size: esz, filter: EMO_TINT, blur: isHigh(n.id) ? 8 : 4, glow: 'rgba(240,201,106,.55)' });
      n.emoLit = sprite(symOf(n.id), ef, '#fff', { size: esz, blur: 22, glow: 'rgba(143,184,255,.9)' });
      n.lab = sprite(label(n.id), nodeFont(n), 'rgb(230,235,245)', { size: n.fs, blur: 8, glow: 'rgba(7,10,18,.9)' });
      n.labLit = sprite(label(n.id), nodeFont(n), '#fff', { size: n.fs, blur: 20, glow: '#8fb8ff' });
    });

    // push labels apart, keep them clear of the intro text and the bottom bar
    const intro = $('.storm-intro').getBoundingClientRect();
    const ob = { l: intro.left - r.left - 8, r: intro.right - r.left + 8, t: 0, b: intro.bottom - r.top + 8 };
    const minY = 70, maxY = H - 96;
    for (let it = 0; it < 120; it++) {
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (!a.show) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          if (!b.show) continue;
          const ox = (a.w + b.w) / 2 + 14 - Math.abs(a.x - b.x);
          const oyA = a.y < b.y ? (a.y + a.bot) - (b.y - b.top) : (b.y + b.bot) - (a.y - a.top);
          const oy = oyA + 8;
          if (ox > 0 && oy > 0) {
            if (ox < oy) { const s = (a.x < b.x ? -1 : 1) * ox / 2; a.x += s; b.x -= s; }
            else { const s = (a.y < b.y ? -1 : 1) * oy / 2; a.y += s; b.y -= s; }
          }
        }
        // intro box
        if (a.x + a.w / 2 > ob.l && a.x - a.w / 2 < ob.r && a.y - a.top < ob.b) a.y += (ob.b - (a.y - a.top)) * 0.5;
        a.x = clamp(a.x, a.w / 2 + 12, W - a.w / 2 - 12);
        a.y = clamp(a.y, minY + a.top, maxY - a.bot);
      }
    }
  }

  /* ---- lightning ---- */
  let lit = null, nextStrike = 0, lastStrikeId = null, hover = null, pinned = null;

  function boltPath(x0, y0, x1, y1, rough) {
    let pts = [[x0, y0], [x1, y1]];
    for (let lvl = 0; lvl < 6; lvl++) {
      const next = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        const len = Math.hypot(bx - ax, by - ay);
        next.push([(ax + bx) / 2 + (Math.random() - 0.5) * len * rough, (ay + by) / 2 + (Math.random() - 0.5) * len * rough * 0.3], pts[i]);
      }
      pts = next;
    }
    return pts;
  }
  function strike(id) {
    const n = nodes[idx[id]];
    const tx = n.x, ty = n.y - n.top + 4;
    const sx = clamp(tx + (Math.random() - 0.5) * W * 0.3, 0, W);
    const main = boltPath(sx, -10, tx, ty, 0.45);
    const fork = main[Math.floor(main.length * (0.35 + Math.random() * 0.25))];
    const branch = boltPath(fork[0], fork[1], fork[0] + (Math.random() - 0.5) * 220, fork[1] + 80 + Math.random() * 120, 0.5);
    lit = { id, t0: performance.now(), bolts: [main, branch] };
    lastStrikeId = id;
    const s = stats[id];
    strikeBtn.innerHTML = `<span class="s-sym emo lit" aria-hidden="true">${symOf(id)}</span><b>${esc(label(id))}</b> · weight ${s.score}<small>In ${s.R} riddles and sayings from ${s.C} cultures. Open its mind map →</small>`;
    strikeBtn.dataset.word = id;
    strikeBtn.hidden = false;
  }
  function pickStrike() {
    // Heavier words are struck more often.
    const pool = nodes.filter(n => n.show).slice(0, 16).map(n => n.id).filter(id => id !== lastStrikeId);
    const wts = pool.map(id => Math.pow(stats[id].score, 2));
    let r = Math.random() * wts.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= wts[i]; if (r <= 0) return pool[i]; }
    return pool[0];
  }

  /* ---- tooltip ---- */
  function tipHTML(f, isPinned) {
    const it = f.it;
    return `${isPinned ? '<button class="t-close" type="button" aria-label="Close">×</button>' : ''}
      <p class="t-text">${esc(it.text)}</p>
      ${it.orig ? `<p class="t-orig"${langAttr(it.culture)}>${esc(it.orig)}</p>` : ''}
      <p class="t-src">${it.kind === 'riddle' ? 'Riddle' : 'Saying'} · ${esc(it.culture)}${it.src && it.src !== 'Saying' ? ' · ' + esc(it.src) : ''}</p>
      ${isPinned
        ? `<p class="t-answer"><b>${it.kind === 'riddle' ? 'Answer' : 'Meaning'}:</b> ${esc(it.answer)}</p>`
        : ''}
      <div class="chips">${it.m.map(chip).join('')}</div>
      ${isPinned ? '' : `<p class="t-hint">Click to ${it.kind === 'riddle' ? 'reveal the answer' : 'read its meaning'}</p>`}`;
  }
  function placeTip(px, py) {
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = px + 18, y = py + 18;
    if (x + tw > W - 8) x = px - tw - 18;
    if (y + th > H - 8) y = py - th - 18;
    tip.style.left = clamp(x, 8, W - tw - 8) + 'px';
    tip.style.top = clamp(y, 60, H - th - 8) + 'px';
  }
  function showTip(f, px, py) {
    tip.className = 'tip ' + f.it.kind;
    tip.innerHTML = tipHTML(f, false);
    tip.hidden = false;
    placeTip(px, py);
  }
  function pin(f, px, py) {
    if (pinned) pinned.frozen = false;
    pinned = f; f.frozen = true;
    tip.className = 'tip pinned ' + f.it.kind;
    tip.innerHTML = tipHTML(f, true);
    tip.hidden = false;
    placeTip(px, py);
    tip.querySelector('.t-close').addEventListener('click', unpin);
  }
  function unpin() {
    if (pinned) pinned.frozen = false;
    pinned = null; tip.hidden = true;
  }

  function hitTest(px, py) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (!n.show) continue;
      if (Math.abs(px - n.x) < n.w / 2 + 6 && py > n.y - n.top && py < n.y + n.bot + 4) return { node: n };
    }
    for (let i = frags.length - 1; i >= 0; i--) {
      const f = frags[i];
      if (!f.show) continue;
      if (Math.abs(px - f.x) < f.w / 2 + 4 && Math.abs(py - f.y) < 10 * k + 2) return { frag: f };
    }
    return null;
  }
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const [px, py] = local(e);
    const h = hitTest(px, py);
    if (hover && hover !== pinned) hover.frozen = false;
    hover = null;
    cv.style.cursor = h ? 'pointer' : '';
    if (h && h.frag) {
      hover = h.frag; hover.frozen = true;
      if (!pinned) showTip(h.frag, px, py);
    } else if (!pinned) tip.hidden = true;
    hoverNode = h && h.node ? h.node.id : null;
  });
  cv.addEventListener('pointerleave', () => {
    if (hover && hover !== pinned) hover.frozen = false;
    hover = null; hoverNode = null;
    if (!pinned) tip.hidden = true;
  });
  cv.addEventListener('click', e => {
    const [px, py] = local(e);
    const h = hitTest(px, py);
    if (h && h.node) { unpin(); openWord(h.node.id); }
    else if (h && h.frag) pin(h.frag, px, py);
    else unpin();
  });
  let hoverNode = null;

  /* ---- render loop ---- */
  let visible = true, last = performance.now(), T = 0, started = false;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(stormEl);

  function drawBolt(pts, width, alpha) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = `rgba(143,184,255,${alpha * 0.5})`; ctx.lineWidth = width * 4;
    ctx.shadowColor = '#8fb8ff'; ctx.shadowBlur = 24;
    ctx.stroke();
    ctx.strokeStyle = `rgba(244,247,255,${alpha})`; ctx.lineWidth = width;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible || document.hidden || !W) return;
    const speed = reduce ? 0.15 : 1;
    T += dt * speed;

    // strikes: automatic while nothing is selected or hovered
    if (started && !sel && !hoverNode && now > nextStrike) {
      strike(pickStrike());
      nextStrike = now + (reduce ? 7000 : 3600 + Math.random() * 1800);
    }
    const le = lit ? (now - lit.t0) / 1000 : 99;
    const litStrength = lit ? (le < 2.4 ? 1 : Math.max(0, 1 - (le - 2.4) / 1.0)) : 0;
    if (lit && litStrength === 0) lit = null;
    const focus = sel || hoverNode || (lit && lit.id);
    const focusStrength = sel || hoverNode ? 1 : litStrength;

    ctx.clearRect(0, 0, W, H);

    // flash
    if (lit && le < 0.3 && !reduce) {
      ctx.fillStyle = `rgba(190,210,255,${0.09 * (1 - le / 0.3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // wind streaks
    ctx.lineCap = 'round'; ctx.lineWidth = 1;
    for (let b = 0; b < 3; b++) {
      ctx.strokeStyle = `rgba(150,180,230,${0.05 + b * 0.035})`;
      ctx.beginPath();
      for (const s of streaks) {
        if (s.bucket !== b) continue;
        s.a += dt * speed * s.sp * 0.16 / Math.sqrt(s.r);
        const a0 = s.a - s.len / Math.sqrt(s.r);
        ctx.moveTo(cx + Math.cos(a0) * s.r * rx, cy + Math.sin(a0) * s.r * ry);
        ctx.ellipse(cx, cy, s.r * rx, s.r * ry, 0, a0, s.a);
      }
      ctx.stroke();
    }

    // fragments orbit the eye of the storm
    for (const f of frags) {
      if (!f.frozen) f.a += dt * speed * 0.085 * f.sp / Math.sqrt(f.r0);
      const r = f.r0 + 0.03 * Math.sin(T * 0.5 + f.ph);
      f.x = cx + Math.cos(f.a) * r * rx;
      f.y = cy + Math.sin(f.a) * r * ry;
      const on = focus && f.it.m.includes(focus);
      f.glow += ((on ? focusStrength : 0) - f.glow) * Math.min(1, dt * 8);
    }

    // threads from the focused word to its riddles
    const fn = focus !== null && idx[focus] !== undefined ? nodes[idx[focus]] : null;
    if (fn && fn.show && focusStrength > 0) {
      const n = fn;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(143,184,255,${0.28 * focusStrength})`;
      ctx.beginPath();
      for (const f of frags) if (f.show && f.glow > 0.05) {
        ctx.moveTo(n.x, n.y - n.fs * 0.3);
        ctx.quadraticCurveTo((n.x + f.x) / 2, (n.y + f.y) / 2 - 30, f.x, f.y);
      }
      ctx.stroke();
    }

    for (const f of frags) {
      if (!f.show || !f.spr) continue;
      const isHover = f === hover || f === pinned;
      ctx.globalAlpha = isHover ? 1 : focus ? 0.13 + 0.85 * f.glow : 0.27;
      blit(f.glow > 0.3 || isHover ? f.sprGlow : f.spr, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // bolts
    if (lit && !reduce && (le < 0.09 || (le > 0.14 && le < 0.34))) {
      drawBolt(lit.bolts[0], 2, 1 - le);
      drawBolt(lit.bolts[1], 1, 0.7 - le);
    }

    // words
    for (const n of nodes) {
      if (!n.show) continue;
      const on = n.id === focus;
      n.glow += ((on ? focusStrength : 0) - n.glow) * Math.min(1, dt * 7);
      const y = n.y + Math.sin(T * 0.6 + n.ph) * 3;
      const dim = focus && !on ? 0.4 : 1;
      if (n.glow > 0.02) {
        const g = ctx.createRadialGradient(n.x, y - n.top / 2, 0, n.x, y - n.top / 2, n.w * 0.9 + 40);
        g.addColorStop(0, `rgba(143,184,255,${0.22 * n.glow})`);
        g.addColorStop(1, 'rgba(143,184,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(n.x - n.w - 60, y - n.top - 60, n.w * 2 + 120, n.top + 120);
      }
      if (!n.emo) continue;
      // symbol: gold-tinted emoji; it crossfades to its true colours while the word is lit
      const ey = y - n.fs * 1.12, ea = (isHigh(n.id) ? 0.95 : 0.8) * dim;
      if (n.glow < 0.98) { ctx.globalAlpha = ea * (1 - n.glow); blit(n.emo, n.x, ey); }
      if (n.glow > 0.02) { ctx.globalAlpha = n.glow; blit(n.emoLit, n.x, ey); }
      const la = Math.min(1, 0.6 + n.s.score * 0.004) * dim;
      if (n.glow < 0.98) { ctx.globalAlpha = la * (1 - n.glow); blit(n.lab, n.x, y); }
      if (n.glow > 0.02) { ctx.globalAlpha = n.glow; blit(n.labLit, n.x, y); }
      ctx.globalAlpha = 1;
    }
  }

  new ResizeObserver(() => resize()).observe(stormEl);
  resize();
  requestAnimationFrame(frame);

  // Re-measure once the web fonts (and the symbol fonts) are in.
  const allSyms = Object.values(D.concepts).map(c => c.sign || '').join('');
  Promise.race([
    Promise.all([
      document.fonts.load(`600 20px "IBM Plex Sans"`),
      document.fonts.load(`italic 14px Spectral`),
      document.fonts.load(`20px "Noto Sans Symbols 2"`, allSyms),
      document.fonts.load(`20px "Noto Sans Symbols"`, allSyms)
    ]),
    new Promise(r => setTimeout(r, 2500))
  ]).catch(() => {}).then(resize);

  /* ================= loader ================= */
  function runLoader() {
    const el = $('#loader'), c = $('#loaderCanvas'), g = c.getContext('2d');
    const total = reduce ? 500 : 1250, litAt = reduce ? 80 : 780;
    let done = false;
    document.body.classList.add('loading');
    // Always start at the storm, and never leave the loader up if frames are throttled.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (!location.hash) scrollTo(0, 0);
    setTimeout(() => finish(), total + 200);

    const words = [];
    items.forEach(it => it.text.split(/\s+/).forEach(w => {
      const clean = w.replace(/[^\p{L}'-]/gu, '');
      if (clean.length > 3) words.push({ w: clean, kind: it.kind });
    }));
    for (let i = words.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [words[i], words[j]] = [words[j], words[i]]; }
    const ps = words.slice(0, 150).map(o => ({
      ...o, a: Math.random() * Math.PI * 2, r: 0.55 + Math.random() * 0.75, sp: 0.6 + Math.random() * 0.9, d: Math.random() * 0.5
    }));
    // a few concept words fly in as well
    ranked.slice(0, 8).forEach(id => ps.push({ w: label(id), kind: 'concept', a: Math.random() * 6.28, r: 0.9 + Math.random() * 0.3, sp: 0.8, d: 0.1 }));
    let bolt = null;

    function size() {
      const d = Math.min(2, devicePixelRatio || 1);
      c.width = innerWidth * d; c.height = innerHeight * d;
      g.setTransform(d, 0, 0, d, 0, 0);
    }
    size(); addEventListener('resize', size);
    const t0 = performance.now();

    function draw(now) {
      if (done) return;
      const e = now - t0, w = innerWidth, h = innerHeight, mx = w / 2, my = h / 2;
      const R = Math.max(w, h) * 0.62;
      g.clearRect(0, 0, w, h);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const p = Math.min(1, e / litAt);
      if (!reduce && p < 1) {
        for (const q of ps) {
          const pp = clamp((p - q.d * 0.4) / (1 - q.d * 0.4), 0, 1);
          const ease = pp * pp * (3 - 2 * pp);
          const r = q.r * (1 - ease * 0.985) * R;
          const ang = q.a + (pp * 2.2 + pp * pp * 5) * q.sp;
          const x = mx + Math.cos(ang) * r, y = my + Math.sin(ang) * r * 0.62;
          const alpha = Math.min(1, pp * 4) * (1 - Math.pow(pp, 6));
          if (q.kind === 'concept') { g.font = `600 ${Math.round(16 + 8 * (1 - pp))}px ${SANS}`; g.fillStyle = `rgba(240,201,106,${alpha})`; }
          else { g.font = `${q.kind === 'riddle' ? 'italic ' : ''}${Math.round(12 + 7 * (1 - pp))}px ${SERIF}`; g.fillStyle = `rgba(${q.kind === 'riddle' ? '169,196,238' : '240,205,150'},${alpha * 0.85})`; }
          g.fillText(q.w, x, y);
        }
        // swirl streaks
        g.lineWidth = 1;
        for (let i = 0; i < 40; i++) {
          const rr = ((i * 0.137 + e * 0.0002) % 1) * R * (1 - p * 0.6);
          const a0 = i * 2.4 + e * 0.002 * (1 + p * 3);
          g.strokeStyle = `rgba(150,180,230,${0.12 * (1 - p * 0.5)})`;
          g.beginPath(); g.ellipse(mx, my, rr, rr * 0.62, 0, a0, a0 + 0.5); g.stroke();
        }
      }
      if (e >= litAt) {
        el.classList.add('lit');
        const le = (e - litAt) / 1000;
        if (!reduce) {
          if (!bolt) bolt = boltPathLoader(mx + (Math.random() - 0.5) * w * 0.2, -10, mx, my - 50);
          if (le < 0.35) {
            g.fillStyle = `rgba(220,232,255,${0.5 * (1 - le / 0.35)})`;
            g.fillRect(0, 0, w, h);
          }
          if (le < 0.1 || (le > 0.16 && le < 0.4)) {
            g.beginPath(); bolt.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
            g.shadowColor = '#8fb8ff'; g.shadowBlur = 30;
            g.strokeStyle = 'rgba(244,247,255,.95)'; g.lineWidth = 3; g.stroke();
            g.shadowBlur = 0;
          }
          // ring of light spreading out
          const rr = le * Math.max(w, h) * 0.9;
          g.strokeStyle = `rgba(143,184,255,${Math.max(0, 0.35 - le * 0.3)})`; g.lineWidth = 2;
          g.beginPath(); g.ellipse(mx, my, rr, rr * 0.62, 0, 0, Math.PI * 2); g.stroke();
        }
      }
      if (e >= total) return finish();
      requestAnimationFrame(draw);
    }
    function boltPathLoader(x0, y0, x1, y1) {
      let pts = [[x0, y0], [x1, y1]];
      for (let lvl = 0; lvl < 6; lvl++) {
        const n = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
          const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
          n.push([(ax + bx) / 2 + (Math.random() - 0.5) * len * 0.45, (ay + by) / 2], pts[i]);
        }
        pts = n;
      }
      return pts;
    }
    function finish() {
      if (done) return;
      done = true;
      el.classList.add('lit', 'done');
      document.body.classList.remove('loading');
      if (!location.hash) scrollTo(0, 0);
      removeEventListener('resize', size);
      started = true;
      nextStrike = performance.now() + 700;
      setTimeout(() => el.remove(), 350);
    }
    $('#skip').addEventListener('click', finish);
    el.addEventListener('click', finish);
    addEventListener('keydown', function onKey(ev) { if (ev.key === 'Escape' || ev.key === 'Enter') { finish(); removeEventListener('keydown', onKey); } });
    requestAnimationFrame(draw);
  }
  runLoader();
  // Small hook for the banner script (scripts/og.mjs).
  window.RS = { strike, cultureCount, riddles: D.riddles.length, sayings: D.sayings.length, words: ids.length };
})();
