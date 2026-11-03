const DATA_URL = 'data/shortlist-2026.json';
const METALS_URL = 'data/metals-2026.json';
const CLOSE_DATE = '09/10/2026'; // cierre de inscripciones, bases 2026
const TOTAL_ENTRIES_APPROX = 800; // inscripciones totales del festival, dato aproximado

// Premios mayores 2026. `agency` es el nombre tal como figura en el shortlist;
// `idea` marca los premios que van a una pieza, no a la empresa; `brand` los que van a un anunciante.
const WINNERS = [
  { award: 'Agencia del Año', agency: 'ONIRIA TBWA' },
  { award: 'Agencia Independiente del Año', agency: 'VEINTITRÉS' },
  { award: 'Anunciante del Año', brand: 'CERVEPAR' },
  { award: 'Gran Tatakua', agency: 'EL CREATIVO', idea: 'SMASHED RACTIS' },
];

// Productoras go to the annex, not the main review: the rules also give them points in Mensajes
// Audiovisuales and de Audio for pieces entered by agencies, and the shortlist doesn't name them
// there, so their score can't be rebuilt from public data.
const PRODUCTORAS = new Set(['THE LAB', 'SYNCHRO', 'HEI FILMS', 'BARRACO FILMS', 'RENOVATIO FILMS', 'GUARANI FILMS', 'SUENA POLENTA']);
const PRODUCTORA_DEL_ANO = 'THE LAB';
// Escala de puntos de las bases 2026. Un metal reemplaza el punto de finalista.
const POINTS = { gran: 15, oro: 9, plata: 6, bronce: 3, finalista: 1 };
const MEDALS = ['oro', 'plata', 'bronce'];
const MEDAL_LABEL = { oro: 'Oro', plata: 'Plata', bronce: 'Bronce' };

const awardsFor = (name) => WINNERS.filter((w) => w.agency === name).map((w) => w.award);

const gs = new Intl.NumberFormat('es-PY');

// index stays null until someone picks a participant; the printer starts without paper
const state = { rows: [], metals: [], agencies: [], index: null, costMode: 'metal' };

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function money(amountGs) {
  return gs.format(Math.round(amountGs));
}

function compact(amountGs) {
  return `${(amountGs / 1e6).toLocaleString('es-PY', { maximumFractionDigits: 1 })}M`;
}

function mostCommon(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

const countMetals = (list) => Object.fromEntries(MEDALS.map((m) => [m, list.filter((x) => x.medal === m).length]));
const metalTotal = (m) => m.oro + m.plata + m.bronce;

function groupByAgency(rows, metals) {
  const byAgency = new Map();
  for (const row of rows) {
    if (!byAgency.has(row.agency)) byAgency.set(row.agency, []);
    byAgency.get(row.agency).push(row);
  }
  return [...byAgency].map(([name, entries]) => {
    const byIdea = new Map();
    for (const e of entries) {
      if (!byIdea.has(e.title)) byIdea.set(e.title, []);
      byIdea.get(e.title).push(e);
    }
    const ideas = [...byIdea].map(([title, list]) => {
      const medals = countMetals(metals.filter((m) => m.agency === name && m.title === title));
      const gran = WINNERS.some((w) => w.agency === name && w.idea === title);
      return {
        title,
        brand: mostCommon(list.map((e) => e.brand)),
        entries: list,
        total: list.reduce((s, e) => s + e.feeGs, 0),
        medals,
        gran,
        finalistOnly: list.length - metalTotal(medals),
      };
    }).sort((a, b) => b.total - a.total || a.title.localeCompare(b.title));
    const medals = countMetals(metals.filter((m) => m.agency === name));
    const metalCount = metalTotal(medals);
    const grans = ideas.filter((d) => d.gran).length;
    const total = entries.reduce((s, e) => s + e.feeGs, 0);
    const points = MEDALS.reduce((s, m) => s + medals[m] * POINTS[m], 0)
      + (entries.length - metalCount) * POINTS.finalista + grans * POINTS.gran;
    return {
      name,
      entries,
      ideas,
      total,
      medals,
      metalCount,
      grans,
      points,
      perMetal: metalCount ? total / metalCount : null,
      perPoint: total / points,
      blocks: new Set(entries.map((e) => e.block)).size,
    };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function renderHero(rows) {
  const total = rows.reduce((s, r) => s + r.feeGs, 0);
  $('.fold-top [data-hero-total]').textContent = money(total);
  refreshFoldClone();
  const stats = {
    total: `≈${gs.format(TOTAL_ENTRIES_APPROX)}`,
    entries: rows.length,
    entrants: state.agencies.length,
    ideas: new Set(rows.map((r) => r.title)).size,
    metals: state.metals.length,
  };
  for (const [key, value] of Object.entries(stats)) $(`[data-stat="${key}"]`).textContent = value;

  // Percentages and the note are festival-wide (productoras included), like the ≈800 they divide by
  const finalists = state.allRows.length;
  const metals = state.allMetals.length;
  const pct = (n) => `≈${Math.round((n / TOTAL_ENTRIES_APPROX) * 100)}%`;
  $('[data-pct="finalists"]').textContent = pct(finalists);
  $('[data-pct="metals"]').textContent = pct(metals);
  $('[data-floor-note]').textContent =
    `* De las ≈${gs.format(TOTAL_ENTRIES_APPROX)} inscripciones del festival, ≈${TOTAL_ENTRIES_APPROX - finalists} no quedaron y su costo por participante no es público: la inversión real de cada uno es mayor. Los recibos son solo de agencias; las productoras van aparte, en el anexo. Cálculo independiente, no es un recuento oficial del Festival Tatakua.`;
}

// Hero receipt: starts folded in three like an accordion and unfolds once (hover, click, tap or
// keyboard), then stays open. The middle and bottom thirds are clones of the receipt, each clipped
// to its slice; the bottom panel hangs from the middle one so their rotations add up. When the
// animation ends the clones are dropped and the real receipt is shown whole, so its link works.
const fold = { ready: false, done: false };

function foldPanel(slice, cls) {
  const panel = document.createElement('div');
  panel.className = cls;
  const clip = document.createElement('div');
  clip.className = 'fold-slice';
  const clone = $('.fold-top .hero-receipt').cloneNode(true);
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  clone.style.setProperty('--slice', slice);
  const shade = document.createElement('span');
  shade.className = 'fold-shade';
  clip.append(clone, shade);
  panel.append(clip);
  return panel;
}

function refreshFoldClone() {
  if (!fold.ready || fold.done) return;
  const middle = foldPanel(1, 'fold-mid');
  middle.append(foldPanel(2, 'fold-end'));
  $('[data-fold-rest]').replaceChildren(middle);
}

function setupFold() {
  const hero = $('.hero');
  const wrap = $('.hero-paper');
  const real = $('.fold-top .hero-receipt');
  const rest = $('[data-fold-rest]');
  const button = $('[data-unfold]');

  const measure = () => {
    const full = real.offsetHeight;
    hero.style.setProperty('--full', `${full}px`);
    hero.style.setProperty('--third', `${full / 3}px`);
  };
  new ResizeObserver(measure).observe(real);
  measure();

  fold.ready = true;
  refreshFoldClone();
  wrap.classList.add('fold-ready');
  button.hidden = false;

  const finish = () => {
    if (fold.done) return;
    fold.done = true;
    wrap.classList.remove('fold-ready');
    wrap.classList.add('is-done');
    rest.replaceChildren();
  };
  const open = () => {
    if (wrap.classList.contains('is-open')) return;
    const hadFocus = document.activeElement === button;
    button.hidden = true;
    if (hadFocus) real.querySelector('a').focus({ preventScroll: true });
    wrap.classList.add('is-open');
    if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return finish();
    // The bottom panel finishes last
    rest.addEventListener('transitionend', (ev) => {
      if (ev.propertyName === 'transform' && ev.target.classList.contains('fold-end')) finish();
    });
    setTimeout(finish, 2200); // in case transitionend never fires
  };

  // Only the receipt reacts, not the space reserved below it for the open receipt. The unfold
  // button sits over the folded receipt (beside it in the markup), so it needs its own listeners.
  for (const el of [$('[data-fold]'), button]) {
    el.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') open(); });
    el.addEventListener('click', open);
  }

  // Visitors who scroll on without opening it get it opened for them, filling the reserved space
  const onScroll = () => {
    if (window.scrollY < 120) return;
    window.removeEventListener('scroll', onScroll);
    open();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // the page may load already scrolled
}

// Metal chips, plus a hollow chip for finalist entries without a metal (1 point each), so the
// points next to them add up visibly: a bronze (3) and a finalist (1) read as 4. A Gran Tatakua
// gets its own chip first; its 15 points add to the gold it also won.
function medalPips(m, finalists = 0, grans = 0) {
  const gran = grans
    ? [`<span class="pip pip-gran" title="Gran Tatakua"><span class="visually-hidden">Gran Tatakua </span>${grans}</span>`]
    : [];
  const metals = MEDALS.filter((k) => m[k]).map((k) =>
    `<span class="pip pip-${k}" title="${MEDAL_LABEL[k]}"><span class="visually-hidden">${MEDAL_LABEL[k]} </span>${m[k]}</span>`);
  const finalist = finalists
    ? [`<span class="pip pip-finalista" title="Finalista sin metal"><span class="visually-hidden">Finalistas sin metal </span>${finalists}</span>`]
    : [];
  return `<span class="pips">${[...gran, ...metals, ...finalist].join('')}</span>`;
}

function brandCard(w, unit) {
  const totals = new Map();
  for (const r of state.rows) totals.set(r.brand, (totals.get(r.brand) ?? 0) + r.feeGs);
  const rank = [...totals.values()].sort((a, b) => b - a).indexOf(totals.get(w.brand)) + 1;
  const entries = state.rows.filter((r) => r.brand === w.brand);
  const byAgency = new Map();
  for (const r of entries) byAgency.set(r.agency, (byAgency.get(r.agency) ?? 0) + r.feeGs);
  const split = [...byAgency].sort((a, b) => b[1] - a[1])
    .map(([name, gs]) => `<li><span>${esc(name)}</span><span>${compact(gs)}</span></li>`).join('');
  return `
    <div class="winner">
      <span class="winner-award">${esc(w.award)}</span>
      <span class="winner-name">${esc(w.brand)}</span>
      <span class="winner-amount">${unit} ${money(totals.get(w.brand))}</span>
      <span class="winner-medals">${(() => {
        const medals = countMetals(state.metals.filter((m) => entries.some((r) => r.title === m.title && r.agency === m.agency)));
        return medalPips(medals, entries.length - metalTotal(medals));
      })()}</span>
      <span class="winner-meta">${entries.length} finalistas · ${new Set(entries.map((r) => r.title)).size} ideas · #${rank} de ${totals.size} marcas</span>
      <ul class="winner-split" aria-label="Por agencia">${split}</ul>
    </div>`;
}

function renderWinners() {
  const rankOf = (name) => state.agencies.findIndex((a) => a.name === name);
  const unit = '<span class="currency">Gs.</span>';
  $('[data-winners]').innerHTML = WINNERS.map((w) => {
    if (w.brand) return brandCard(w, unit);
    const i = rankOf(w.agency);
    const a = state.agencies[i];
    if (!a) return '';
    const idea = w.idea && a.ideas.find((d) => d.title === w.idea);
    if (idea) {
      return `
      <div class="winner">
        <span class="winner-award">${esc(w.award)}</span>
        <span class="winner-name">${esc(idea.title)}</span>
        <span class="winner-by">${esc(a.name)} · ${esc(idea.brand)}</span>
        <span class="winner-amount">${unit} ${money(idea.total)}</span>
        <span class="winner-medals">${medalPips(idea.medals, idea.finalistOnly, 1)}</span>
        <span class="winner-meta">${idea.entries.length} finalistas con esta idea · Gs. ${money(idea.total / metalTotal(idea.medals))} por metal</span>
        <span class="winner-meta">Inversión total de ${esc(a.name)}: Gs. ${money(a.total)}</span>
      </div>`;
    }
    return `
      <div class="winner">
        <span class="winner-award">${esc(w.award)}</span>
        <span class="winner-name">${esc(a.name)}</span>
        <span class="winner-amount">${unit} ${money(a.total)}</span>
        <span class="winner-medals">${medalPips(a.medals, a.entries.length - a.metalCount, a.grans)}</span>
        <span class="winner-meta">${a.entries.length} finalistas · #${i + 1} en inversión</span>
        <span class="winner-meta">Gs. ${money(a.perMetal)} por metal · Gs. ${money(a.perPoint)} por punto</span>
      </div>`;
  }).join('');
}

function renderCostRanking() {
  const byMetal = state.costMode === 'metal';
  const key = byMetal ? 'perMetal' : 'perPoint';
  const list = state.agencies.filter((a) => a.metalCount > 0).sort((a, b) => b[key] - a[key]);
  const max = list[0][key];
  $('[data-cost-list]').innerHTML = list.map((a) => `
    <li class="cost-row">
      <span class="cost-name">${awardsFor(a.name).length ? '<span class="star">★</span> ' : ''}${esc(a.name)}</span>
      <span class="cost-bar" style="--len: ${(a[key] / max).toFixed(4)}"></span>
      <span class="cost-value">Gs. ${money(a[key])}</span>
      <span class="cost-meta">${medalPips(a.medals, a.entries.length - a.metalCount, a.grans)}<span>${a.points} pts · ${compact(a.total)}</span></span>
    </li>`).join('');
  document.querySelectorAll('[data-cost-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.costMode === state.costMode)));
}

// Short labels for the award stamps on the wall tickets
const AWARD_STAMP = {
  'Agencia del Año': 'AÑO',
  'Agencia Independiente del Año': 'INDIE',
  'Productora del Año': 'PROD',
  'Gran Tatakua': 'GT',
};

function strHash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// One printed line per finalist entry, as tall as its fee, so the lines add up to the ticket's
// spend. Metals are known per idea, so an idea's first entries carry its metals, best first.
function ticketLines(a, max) {
  const lines = [];
  for (const idea of a.ideas) {
    const medals = MEDALS.flatMap((m) => Array(idea.medals[m]).fill(m));
    idea.entries.forEach((e, k) => {
      const width = 45 + (strHash(`${idea.title}${k}`) % 46);
      const medal = medals[k] ? ` data-medal="${medals[k]}"` : '';
      lines.push(`<i style="--h: ${(e.feeGs / max).toFixed(5)}; --w: ${width}%"${medal}></i>`);
    });
  }
  return lines.join('');
}

// Annex: productoras with what can be stated from public data. Investment in their name and metals
// in their name only; no points, cost per metal or ranking, since their full score isn't public.
function renderAnnex() {
  const list = state.productoras;
  const max = list[0].total;
  $('[data-annex-list]').innerHTML = list.map((a) => {
    const codes = [...new Set(a.entries.map((e) => e.subcategoryCode))].join(', ');
    const award = a.name === PRODUCTORA_DEL_ANO ? '<span class="star">★</span> ' : '';
    return `
    <li class="cost-row">
      <span class="cost-name">${award}${esc(a.name)}</span>
      <span class="cost-bar" style="--len: ${(a.total / max).toFixed(4)}"></span>
      <span class="cost-value">Gs. ${money(a.total)}</span>
      <span class="cost-meta">${medalPips(a.medals, a.entries.length - a.metalCount)}<span>${a.entries.length} ${a.entries.length === 1 ? 'finalista' : 'finalistas'} en ${esc(codes)}${a.name === PRODUCTORA_DEL_ANO ? ' · Productora del Año' : ''}</span></span>
    </li>`;
  }).join('');
}

function renderWall() {
  const max = state.agencies[0].total;
  $('[data-wall]').innerHTML = state.agencies.map((a, i) => {
    const awards = awardsFor(a.name);
    const tilt = ((strHash(a.name) % 9) - 4) * 0.25;
    const label = `${a.name}${awards.map((w) => `, ${w}`).join('')}: ${a.entries.length} finalistas, ${a.metalCount} metales, ${money(a.total)} guaraníes`;
    return `
    <div class="ticket-slot" role="listitem" style="--i: ${i}">
      <button type="button" class="ticket" data-index="${i}" style="--tilt: ${tilt}deg"
        aria-label="${esc(label)}" aria-pressed="${i === state.index}">
        <span class="ticket-clip" aria-hidden="true"></span>
        <span class="ticket-paper" aria-hidden="true">
          <span class="ticket-head">
            <span class="ticket-no">Nº ${String(i + 1).padStart(2, '0')}</span>
            <span class="ticket-name">${esc(a.name)}</span>
          </span>
          <span class="ticket-lines">${ticketLines(a, max)}</span>
          <span class="ticket-total"><span>Total</span><b>${compact(a.total)}</b></span>
          ${awards.length ? `<span class="ticket-stamp">${AWARD_STAMP[awards[0]] ?? '★'}</span>` : ''}
        </span>
      </button>
    </div>`;
  }).join('');
}

// The wall has no scrollbar, so a mouse can drag it sideways. Trackpads and touch scroll natively.
function setupWallDrag() {
  const wall = $('[data-wall]');
  let start = null;
  let dragged = false;

  wall.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
    start = { x: ev.clientX, left: wall.scrollLeft, id: ev.pointerId };
    dragged = false;
  });
  wall.addEventListener('pointermove', (ev) => {
    if (!start) return;
    const dx = ev.clientX - start.x;
    if (!dragged && Math.abs(dx) < 5) return; // small jitter is still a click
    if (!dragged) {
      dragged = true;
      wall.setPointerCapture(start.id);
      wall.classList.add('is-dragging');
    }
    wall.scrollLeft = start.left - dx;
  });
  const end = () => {
    start = null;
    wall.classList.remove('is-dragging');
  };
  wall.addEventListener('pointerup', end);
  wall.addEventListener('pointercancel', end);
  // A drag must not also open the ticket it started on
  wall.addEventListener('click', (ev) => {
    if (!dragged) return;
    dragged = false;
    ev.stopPropagation();
    ev.preventDefault();
  }, true);
}

// The summary sits under the shorter tickets on the right when it can: it drops just below the
// lowest ticket it overlaps and the stage grows to fit it. If it would have to clear the first
// (tallest) ticket, it stacks under the wall instead. Tickets get shorter left to right and
// scrolling only moves them left, so checking them as laid out at the start of the scroll covers
// every scroll position.
function placeWallStats() {
  const stage = $('[data-wall-stage]');
  const wall = $('[data-wall]');
  stage.classList.add('is-overlay');
  stage.style.removeProperty('--stats-top');
  stage.style.removeProperty('min-block-size');
  const panel = $('[data-wall-stats]').getBoundingClientRect();
  const wallTop = wall.getBoundingClientRect().top;
  const gap = 24;
  let lowest = wallTop;
  let blocked = false;
  [...wall.querySelectorAll('.ticket-slot')].forEach((slot, i) => {
    const r = slot.getBoundingClientRect(); // the drop-in animation only moves slots vertically
    const left = r.left + wall.scrollLeft;
    if (left < panel.right + gap && left + r.width > panel.left - gap) {
      if (i === 0) blocked = true;
      lowest = Math.max(lowest, wallTop + slot.offsetHeight);
    }
  });
  if (blocked) {
    stage.classList.remove('is-overlay');
    return;
  }
  const top = lowest - stage.getBoundingClientRect().top + gap;
  stage.style.setProperty('--stats-top', `${top}px`);
  stage.style.minBlockSize = `${top + panel.height}px`;
}

function barcode(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let x = 0;
  const bars = [];
  while (x < 236) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const w = 1 + ((h >>> 3) & 3);
    if ((h >>> 7) & 1) bars.push(`<rect x="${x}" width="${w}" height="44"/>`);
    x += w + 1;
  }
  return `<svg class="barcode" viewBox="0 0 240 44" aria-hidden="true" preserveAspectRatio="none">${bars.join('')}</svg>`;
}

function line(html, cls = '') {
  return `<div class="r-line ${cls}">${html}</div>`;
}

function renderReceipt({ animate = true } = {}) {
  const a = state.agencies[state.index];
  const hasAssumed = a.entries.some((e) => e.format === 'pieza (asumido)');
  const parts = [];

  parts.push(line('Shortlist Tatakua 2026', 'r-center r-small'));
  parts.push(line('<span class="r-stamp">Cuenta no oficial</span>', 'r-center'));
  parts.push(line('No emitida por el Festival Tatakua', 'r-center r-small r-muted'));
  parts.push(line('', 'r-rule'));
  parts.push(line(`<span>TICKET Nº</span><span>0001-${String(state.index + 1).padStart(8, '0')}</span>`, 'r-row r-small'));
  parts.push(line(`<span>FECHA</span><span>${CLOSE_DATE}</span>`, 'r-row r-small'));
  parts.push(line(`<span>CLIENTE</span><span class="r-strong">${esc(a.name)}</span>`, 'r-row'));
  for (const w of WINNERS.filter((w) => w.agency === a.name && !w.idea)) {
    parts.push(line(`<span class="r-award">★ ${esc(w.award)}</span>`, 'r-center'));
  }
  parts.push(line('', 'r-rule'));

  a.ideas.forEach((idea, n) => {
    if (n) parts.push(line('', 'r-rule r-rule-idea'));
    parts.push(line(`<span class="r-idea-no">${String(n + 1).padStart(2, '0')}</span><span class="r-idea">${esc(idea.title)}</span>`, 'r-idea-line'));
    for (const w of WINNERS.filter((w) => w.agency === a.name && w.idea === idea.title)) {
      parts.push(line(`<span class="r-award">★ ${esc(w.award)}</span>`));
    }
    parts.push(line(esc(idea.brand), 'r-small r-muted'));
    const result = [
      ...MEDALS.filter((m) => idea.medals[m]).map((m) => `<span class="r-medal r-medal-${m}">${MEDAL_LABEL[m]}${idea.medals[m] > 1 ? ` ×${idea.medals[m]}` : ''}</span>`),
      ...(idea.finalistOnly ? [`<span class="r-medal">Finalista${idea.finalistOnly > 1 ? ` ×${idea.finalistOnly}` : ''}</span>`] : []),
    ];
    parts.push(line(result.join(''), 'r-result'));
    for (const e of idea.entries) {
      const mark = e.format === 'pieza (asumido)' ? '*' : '';
      // Sin lucro subcategories are just "PIEZA" / "CAMPAÑA" / "ACCIÓN"
      const desc = /^(PIEZA|CAMPAÑA|ACCIÓN)$/.test(e.subcategory) ? `${e.category} — ${e.subcategory}` : e.subcategory;
      parts.push(line(
        `<span class="r-code">${esc(e.subcategoryCode)}</span><span class="r-desc">${esc(desc)}${mark}</span><span class="r-amt">${money(e.feeGs)}</span>`,
        'r-item',
      ));
    }
    if (idea.entries.length > 1) {
      parts.push(line(`<span>SUBTOTAL ×${idea.entries.length}</span><span>${money(idea.total)}</span>`, 'r-row r-subtotal'));
    }
  });

  const perIdea = (a.entries.length / a.ideas.length).toLocaleString('es-PY', { maximumFractionDigits: 1 });
  parts.push(line('', 'r-rule'));
  parts.push(line(`<span>FINALISTAS</span><span>${a.entries.length}</span>`, 'r-row'));
  parts.push(line(`<span>IDEAS DISTINTAS</span><span>${a.ideas.length}</span>`, 'r-row'));
  parts.push(line(`<span>FINALISTAS POR IDEA</span><span>${perIdea}</span>`, 'r-row'));
  parts.push(line(`<span>BLOQUES</span><span>${a.blocks} de 8</span>`, 'r-row'));
  parts.push(line(`<span>METALES</span><span>${a.medals.oro} O · ${a.medals.plata} P · ${a.medals.bronce} B</span>`, 'r-row'));
  parts.push(line(`<span>PUNTOS (ESCALA DEL FESTIVAL)</span><span>${a.points}</span>`, 'r-row'));
  parts.push(line('', 'r-rule r-double'));
  parts.push(line('Inversión solo en finalistas', 'r-small r-strong'));
  parts.push(line(`<span>TOTAL GS.</span><span>${money(a.total)}</span>`, 'r-row r-total'));
  parts.push(line('IVA incluido', 'r-small r-muted r-end'));
  parts.push(line(`<span>POR METAL</span><span>${a.perMetal ? money(a.perMetal) : 'SIN METALES'}</span>`, 'r-row r-per'));
  parts.push(line(`<span>POR PUNTO</span><span>${money(a.perPoint)}</span>`, 'r-row r-per'));
  // Faded olive PAGADO stamp, at a slightly different angle and spot for each participant
  const h = strHash(a.name);
  const rot = (h % 2 ? 1 : -1) * (5 + (h % 9));
  const x = 2 + ((h >>> 4) % 20);
  parts.push(line(`<span class="r-paid" style="--rot: ${rot}deg; --x: ${x}%">PAGADO<small>${CLOSE_DATE.replaceAll('/', ' · ')}</small></span>`, 'r-paid-anchor'));
  parts.push(line('', 'r-rule'));
  parts.push(line('No incluye la inversión en inscripciones que no quedaron finalistas.', 'r-small r-center'));
  if (hasAssumed) parts.push(line('* Subcategoría sin formato: se cobra como pieza.', 'r-small r-center r-muted'));
  parts.push(line(barcode(a.name), 'r-center r-barcode'));
  parts.push(line('No válido como factura', 'r-center r-small r-strong'));
  parts.push(line('Calculado con el shortlist, las bases y los ganadores publicados', 'r-center r-small r-muted'));

  const receipt = $('[data-receipt]');
  const printer = $('.printer');
  receipt.classList.remove('printing');
  printer.classList.remove('is-printing');
  receipt.setAttribute('aria-label', `Ticket de ${a.name}`);
  receipt.innerHTML = parts.join('');
  if (animate && matchMedia('(prefers-reduced-motion: no-preference)').matches) {
    // Feed out of the slot at a steady speed, so a long receipt takes longer to print
    const ms = Math.min(4200, Math.max(1000, receipt.offsetHeight * 1.7));
    receipt.style.setProperty('--feed', `${Math.round(ms)}ms`);
    void receipt.offsetWidth; // restart the print animation
    receipt.classList.add('printing');
    printer.classList.add('is-printing');
  }
}

function select(index, { scroll = false } = {}) {
  const n = state.agencies.length;
  state.index = (index + n) % n;
  $('[data-agency-select]').value = String(state.index);
  document.querySelectorAll('.ticket').forEach((el) => el.setAttribute('aria-pressed', String(Number(el.dataset.index) === state.index)));
  renderReceipt();
  if (scroll) {
    const smooth = matchMedia('(prefers-reduced-motion: no-preference)').matches;
    $('.printer').scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }
}

// Facts from the 2026 rules, used as background texture (data-fine-print = how many repeats)
const FINE_PRINT = 'Festival Tatakua 2026 · Costos de inscripción · Piezas Gs. 660.000 · Campañas Gs. 880.000 · Integradas Gs. 990.000 · Precios con IVA incluido · Recargo por inscripción tardía Gs. 100.000 · Puntuación · Gran Tatakua 15 · Oro 9 · Plata 6 · Bronce 3 · Finalista 1 · Cierre de inscripciones 9 de octubre de 2026 · ';

function fillFinePrint() {
  document.querySelectorAll('[data-fine-print]').forEach((el) => {
    el.textContent = FINE_PRINT.repeat(Number(el.dataset.finePrint));
  });
}

async function init() {
  fillFinePrint();
  setupFold();
  const load = (url) => fetch(url).then((r) => {
    if (!r.ok) throw new Error(`No se pudo cargar ${url} (${r.status})`);
    return r.json();
  });
  const [allRows, { metals: allMetals }] = await Promise.all([load(DATA_URL), load(METALS_URL)]);
  const isProductora = (x) => PRODUCTORAS.has(x.agency);
  const rows = allRows.filter((r) => !isProductora(r));
  const metals = allMetals.filter((m) => !isProductora(m));
  state.allRows = allRows;
  state.allMetals = allMetals;
  state.rows = rows;
  state.metals = metals;
  state.agencies = groupByAgency(rows, metals);
  state.productoras = groupByAgency(allRows.filter(isProductora), allMetals.filter(isProductora));

  $('[data-agency-select]').innerHTML = '<option value="" disabled selected>Elegí un participante</option>' + state.agencies
    .map((a, i) => `<option value="${i}">${String(i + 1).padStart(2, '0')} · ${esc(a.name)}${awardsFor(a.name).length ? ' ★' : ''}</option>`).join('');

  renderHero(rows);
  $('.fold-top [data-hero-barcode]').innerHTML = barcode('cuanto cuesta ganar');
  refreshFoldClone();
  renderWinners();
  renderCostRanking();
  renderAnnex();
  renderWall();

  document.querySelectorAll('[data-cost-mode]').forEach((btn) => btn.addEventListener('click', () => {
    state.costMode = btn.dataset.costMode;
    renderCostRanking();
  }));


  setupWallDrag();
  placeWallStats();
  new ResizeObserver(placeWallStats).observe($('[data-wall]'));
  $('[data-receipt]').addEventListener('animationend', (ev) => {
    if (ev.animationName === 'feed') $('.printer').classList.remove('is-printing');
  });
  $('[data-wall]').addEventListener('click', (ev) => {
    const ticket = ev.target.closest('.ticket');
    if (ticket) select(Number(ticket.dataset.index), { scroll: true });
  });
  $('[data-agency-select]').addEventListener('change', (ev) => select(Number(ev.target.value)));
  document.querySelectorAll('[data-step]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const step = Number(btn.dataset.step);
      select(state.index === null ? (step > 0 ? 0 : -1) : state.index + step);
    }));
}

init().catch((err) => {
  $('[data-receipt]').innerHTML = `<p class="error">${esc(err.message)}. Abrí la página desde un servidor local (ver README).</p>`;
});
