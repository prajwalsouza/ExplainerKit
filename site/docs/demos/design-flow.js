// The design processes as flowcharts you can open. Each process is a list of stages (EXPLAINER_STAGES and the others
// from explainerkit/design), grouped into phases that share a colour. Inside a stage, steps that run in order are joined
// by curves; steps that run in parallel share a lane; a loop curves back to its first step. Choose any step to read
// what it is for, its method, the shape its answer must fit and the exact prompt renderPrompt builds for it.
// Nothing is sent to a model here.
import { EXPLAINER_STAGES, FABLE_STAGES, OPERATIONS, SERIES_STAGES, renderPrompt } from '../../runtime/src/design/index.js';
import { hsla, toHex } from '../../runtime/src/color/index.js';
import { css } from './_kit.js';
import EXAMPLES from './design-examples.js';

const PROCESSES = [
  ['Explainer', EXPLAINER_STAGES, 'designExplainer: a topic in, a reviewed narration script out.'],
  ['Fable', FABLE_STAGES, 'designFable: a topic in, a short story whose plot runs on the science.'],
  ['Series', SERIES_STAGES, 'designSeries: subtopics or learning objectives in, one stitched piece or a series out.'],
];
// Phase hues: an analogous run from blue through violet to a warm close, with a green for shaping a series.
const PHASES = {
  discover: { name: 'Discover', h: 212 },
  research: { name: 'Research', h: 262 },
  shape: { name: 'Shape', h: 168 },
  write: { name: 'Write', h: 22 },
  refine: { name: 'Refine', h: 340 },
};
const BRIEF = { topic: 'colour science', audience: 'curious adults with no specialist knowledge', goals: 'curiosity and real understanding', minutes: 10 };
const byName = Object.fromEntries(Object.values(OPERATIONS).flatMap((group) => Object.entries(group)));

const NODE_H = 34, GAP_X = 12, GAP_Y = 14, CHAIN_GAP = 34, STACK_GAP = 22, CARD_PAD = 20, TITLE_H = 36, PART_GAP = 28, STAGE_GAP = 36, LANE_PAD = 16;

const CSS = `
.df { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 28px; padding: 20px 0 8px; font-size: 14px; }
@media (max-width: 920px) { .df { grid-template-columns: 1fr; } }
.df-tabs { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.df-tabs button { font: 600 13px var(--sans); color: var(--muted); background: none; border: 1px solid var(--line); border-radius: 999px; padding: 7px 16px; cursor: pointer; transition: color .15s, border-color .15s; }
.df-tabs button:hover { color: var(--ink); }
.df-tabs button[aria-pressed="true"] { color: var(--ink); border-color: var(--ink); }
.df-tabs .what { flex-basis: 100%; color: var(--muted); font-size: 13px; margin-top: 6px; }
.df-chart { min-width: 0; }
.df-chart svg { display: block; width: 100%; overflow: visible; }
.df-chart .card { stroke-width: 1; }
.df-chart .lane { fill: none; stroke-width: 1.2; stroke-dasharray: 1 5; stroke-linecap: round; }
.df-chart .edge { fill: none; stroke: var(--faint); stroke-width: 1.4; stroke-linecap: round; opacity: .8; transition: stroke .15s, opacity .15s; }
.df-chart .edge.loop { stroke-dasharray: 1 5; stroke-width: 1.8; }
.df-chart .edge.on { stroke-width: 2; opacity: 1; }
.df-chart .badge text, .df-chart .stage-title, .df-chart .stage-note, .df-chart .pill text { pointer-events: none; }
.df-chart .badge text { font: 650 11px var(--sans); text-anchor: middle; dominant-baseline: central; fill: #fff; }
.df-chart .stage-title { font: 600 13.5px var(--sans); fill: var(--ink); }
.df-chart .stage-note { font: 500 12px var(--sans); fill: var(--muted); }
.df-chart .node { cursor: pointer; outline: none; }
.df-chart .node rect { stroke-width: 1; transition: stroke-width .12s; }
.df-chart .node text { font: 500 12.5px var(--mono); fill: var(--ink); dominant-baseline: central; text-anchor: middle; pointer-events: none; }
.df-chart .node .variant { font: 500 11px var(--sans); fill: var(--muted); }
.df-chart .node .globe { fill: none; stroke-width: 1.2; }
.df-chart .node:hover rect, .df-chart .node:focus-visible rect { stroke-width: 1.8; }
.df-chart .node.on rect { stroke-width: 2.2; }
.df-chart .pill text { font: 600 11px var(--sans); dominant-baseline: central; text-anchor: middle; }
.df-key { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 14px; font-size: 12px; color: var(--muted); align-items: center; }
.df-key i { display: inline-block; width: 22px; height: 12px; border-radius: 6px; vertical-align: -2px; margin-right: 6px; }
.df-key .sep { width: 1px; height: 14px; background: var(--line); }
.df-detail { border-left: 1px solid var(--line); padding: 2px 0 0 24px; min-width: 0; position: sticky; top: 16px; align-self: start; max-height: calc(100vh - 32px); overflow: auto; }
@media (max-width: 920px) { .df-detail { position: static; max-height: none; border-left: 0; padding: 18px 0 0; border-top: 1px solid var(--line); } }
.df-detail .chip { display: inline-block; font: 600 11px var(--sans); letter-spacing: .04em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; margin-bottom: 10px; }
.df-detail h3 { margin: 0 0 3px; font: 650 18px var(--mono); color: var(--ink); }
.df-detail .kind { font-size: 12.5px; color: var(--muted); margin-bottom: 12px; }
.df-detail p { margin: 0 0 10px; color: var(--ink); line-height: 1.55; }
.df-detail h5 { margin: 18px 0 8px; font: 600 11.5px var(--sans); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.df-detail ol { margin: 0; padding-left: 20px; color: var(--ink); line-height: 1.55; }
.df-detail ol li { margin-bottom: 6px; white-space: pre-wrap; }
.df-shape { font: 12.5px/1.7 var(--mono); color: var(--ink); white-space: pre; overflow-x: auto; padding: 10px 12px; border-radius: 10px; background: var(--code-bg); }
.df-shape .t { color: var(--muted); }
.df-prompt summary, .df-example summary { cursor: pointer; font: 600 13px var(--sans); margin-top: 16px; }
.df-example .from { font-size: 12px; color: var(--muted); margin: 8px 0; }
.df-tree { font: 12.5px/1.6 var(--sans); color: var(--ink); padding: 10px 12px; border-radius: 10px; background: var(--code-bg); overflow-x: auto; }
.df-tree ul { list-style: none; margin: 0; padding-left: 14px; border-left: 1px solid var(--line); }
.df-tree > ul { padding-left: 0; border-left: 0; }
.df-tree li { margin: 3px 0; }
.df-tree .k { font: 600 11.5px var(--mono); color: var(--muted); margin-right: 6px; }
.df-tree .more { color: var(--muted); font-style: italic; }
.df-prompt pre { max-height: 380px; overflow: auto; white-space: pre-wrap; font-size: 12px; }
`;

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** A real output as a small tree: field names in mono, values as text, lists as numbered children. */
function exampleTree(value) {
  if (value === null || typeof value !== 'object') {
    const text = String(value);
    return text.startsWith('… ') ? `<span class="more">${escape(text)}</span>` : escape(text);
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [typeof v === 'string' && v.startsWith('… ') ? '' : `${i + 1}`, v]) : Object.entries(value);
  return `<ul>${entries.map(([k, v]) => `<li>${k ? `<span class="k">${escape(k)}</span>` : ''}${exampleTree(v)}</li>`).join('')}</ul>`;
}

function shapeText(shape, name = 'output', depth = 0) {
  const pad = '  '.repeat(depth), field = name ? `${name}: ` : '';
  if (shape.kind === 'object')
    return [`${pad}${field}<span class="t">record</span>`, ...Object.entries(shape.fields).map(([k, v]) => shapeText(v, k, depth + 1))].join('\n');
  if (shape.kind === 'array') {
    const count = shape.min === shape.max ? `${shape.min}` : `${shape.min}–${shape.max}`;
    if (shape.item.kind === 'object') return [`${pad}${field}<span class="t">list of ${count}, each a record</span>`, ...Object.entries(shape.item.fields).map(([k, v]) => shapeText(v, k, depth + 1))].join('\n');
    return `${pad}${field}<span class="t">list of ${count} × ${shapeText(shape.item, '', 0).trim().replace(/<[^>]+>/g, '')}</span>`;
  }
  const words = shape.json.description?.match(/At most about (\d+) words/)?.[1];
  const type = { string: words ? `text, about ${words} words` : 'text', number: 'number', boolean: 'true or false', enum: `one of ${shape.values?.join(' | ')}` }[shape.kind] ?? shape.kind;
  return `${pad}${field}<span class="t">${type}</span>`;
}

/** Colours for one phase, from explainerkit/color, lifted for the dark page. */
function palette(phase, dark) {
  const h = PHASES[phase]?.h ?? 212;
  const hex = (s, l) => toHex(hsla(h, s, l)).slice(0, 7);
  return dark
    ? { accent: hex(62, 66), card: hex(30, 15), cardEdge: hex(30, 26), node: hex(38, 24), nodeEdge: hex(45, 46), ink: hex(40, 86), lane: hex(40, 40) }
    : { accent: hex(58, 48), card: hex(50, 97.5), cardEdge: hex(40, 88), node: hex(62, 93), nodeEdge: hex(45, 74), ink: hex(50, 30), lane: hex(40, 72) };
}

/** A smooth vertical S-curve from (x0, y0) down to (x1, y1). */
const sCurve = (x0, y0, x1, y1) => {
  if (Math.abs(x1 - x0) < 1) return `M${x0} ${y0}L${x1} ${y1}`;
  const k = Math.max(14, (y1 - y0) * 0.55);
  return `M${x0} ${y0}C${x0} ${y0 + k} ${x1} ${y1 - k} ${x1} ${y1}`;
};

/**
 * Lay a process out top to bottom as stage cards. A card holds a title, then up to three parts: the steps it runs
 * `first` (a chain), its main steps (a lane when they run in parallel, otherwise a chain) and the steps it runs
 * `then` (a chain). Curves join each part to the next and each card to the next.
 */
function layout(stages, width, measure) {
  const nodes = [], edges = [], cards = [], lanes = [], loops = [];
  const x0 = CARD_PAD, inner = width - CARD_PAD * 2;
  let y = 0, previous = null;
  const box = (stage, name, variant = null) => {
    const op = byName[name];
    const w = Math.ceil(Math.max(measure(name), variant ? measure(variant) * 0.85 : 0) + 30 + (op?.search ? 16 : 0));
    return { name, variant, op, phase: stage.phase, maybe: stage.when?.[name] ?? null, w, h: variant ? NODE_H + 12 : NODE_H };
  };
  const place = (boxes, top, left, span) => {
    const rows = [[]];
    let used = 0;
    for (const b of boxes) {
      if (rows.at(-1).length && used + b.w > span) {
        rows.push([]);
        used = 0;
      }
      rows.at(-1).push(b);
      used += b.w + GAP_X;
    }
    let rowTop = top;
    for (const row of rows) {
      const total = row.reduce((sum, b) => sum + b.w, 0) + GAP_X * (row.length - 1), height = Math.max(...row.map((b) => b.h));
      let x = left + (span - total) / 2;
      for (const b of row) {
        Object.assign(b, { x, y: rowTop + (height - b.h) / 2 });
        nodes.push(b);
        x += b.w + GAP_X;
      }
      rowTop += height + GAP_Y;
    }
    return rowTop - GAP_Y;
  };
  const centre = (b) => b.x + b.w / 2;
  // A chain runs left to right when it fits on one row, with room for an arrow between boxes. When it does not fit,
  // it stacks straight down the middle, so no arrow has to double back.
  const chain = (boxes, top) => {
    const total = boxes.reduce((sum, b) => sum + b.w, 0) + CHAIN_GAP * (boxes.length - 1);
    let bottom;
    if (total <= inner) {
      let x = x0 + (inner - total) / 2;
      const height = Math.max(...boxes.map((b) => b.h));
      for (const b of boxes) {
        Object.assign(b, { x, y: top + (height - b.h) / 2 });
        nodes.push(b);
        x += b.w + CHAIN_GAP;
      }
      bottom = top + height;
      for (let i = 1; i < boxes.length; i++) {
        const a = boxes[i - 1], b = boxes[i], ym = a.y + a.h / 2;
        edges.push({ d: `M${a.x + a.w + 5} ${ym}L${b.x - 7} ${ym}`, ops: [a.name, b.name], phase: b.phase });
      }
    } else {
      let y = top;
      for (const b of boxes) {
        Object.assign(b, { x: x0 + (inner - b.w) / 2, y });
        nodes.push(b);
        y += b.h + STACK_GAP;
      }
      bottom = y - STACK_GAP;
      for (let i = 1; i < boxes.length; i++) {
        const a = boxes[i - 1], b = boxes[i];
        edges.push({ d: `M${centre(a)} ${a.y + a.h + 4}L${centre(b)} ${b.y - 6}`, ops: [a.name, b.name], phase: b.phase });
      }
    }
    const first = boxes[0], last = boxes.at(-1);
    return { bottom, entry: [centre(first), first.y - 6], exit: [centre(last), last.y + last.h + 4], enter: [first.name], leave: [last.name], phase: first.phase };
  };
  const lane = (boxes, top) => {
    const bottom = place(boxes, top + LANE_PAD, x0 + LANE_PAD, inner - LANE_PAD * 2) + LANE_PAD;
    lanes.push({ x: x0, y: top, w: inner, h: bottom - top, phase: boxes[0].phase });
    const names = boxes.map((b) => b.name);
    return { bottom, entry: [width / 2, top - 3], exit: [width / 2, bottom + 2], enter: names, leave: names, phase: boxes[0].phase };
  };
  const link = (from, to) => edges.push({ d: sCurve(from.exit[0], from.exit[1], to.entry[0], to.entry[1]), ops: [...from.leave, ...to.enter], phase: to.phase });
  stages.forEach((stage, k) => {
    const top = y;
    const noted = Boolean(stage.each || stage.loop);
    let at = top + CARD_PAD + TITLE_H + (noted ? 16 : 0);
    const parts = [];
    if (stage.first?.length) {
      parts.push(chain(stage.first.map((n) => box(stage, n)), at));
      at = parts.at(-1).bottom + PART_GAP;
    }
    const main = stage.ops.flatMap((n) => (stage.variants?.[n] ?? [null]).map((v) => box(stage, n, v)));
    parts.push(stage.parallel ? lane(main, at) : chain(main, at));
    if (stage.loop) {
      // Around the right-hand side, from the last step back into the first, clear of every box in between.
      const first = main[0], last = main.at(-1), ly = last.y + last.h / 2, fy = first.y + first.h / 2;
      const right = Math.min(x0 + inner - 6, Math.max(...main.map((b) => b.x + b.w)) + 34);
      edges.push({ d: `M${last.x + last.w + 5} ${ly}C${right} ${ly} ${right} ${fy} ${first.x + first.w + 7} ${fy}`, ops: [first.name, last.name], phase: stage.phase, loop: true });
      loops.push({ x: right - 2, y: (ly + fy) / 2, rounds: stage.loop, phase: stage.phase });
    }
    if (stage.then?.length) parts.push(chain(stage.then.map((n) => box(stage, n)), parts.at(-1).bottom + PART_GAP));
    for (let i = 1; i < parts.length; i++) link(parts[i - 1], parts[i]);
    if (previous) link(previous, parts[0]);
    previous = parts.at(-1);
    const bottom = previous.bottom + CARD_PAD;
    cards.push({ y: top, h: bottom - top, stage, k });
    y = bottom + STAGE_GAP;
  });
  return { nodes, edges, cards, lanes, loops, height: y - STAGE_GAP + 2 };
}

export default async function designFlow(stage, ctx) {
  css('design-flow', CSS);
  const uid = `df${Math.random().toString(36).slice(2, 8)}`;
  stage.innerHTML = `<div class="df"><div class="df-tabs" role="group" aria-label="Process"></div><div class="df-chart"><svg role="group" aria-label="Process flowchart"></svg><div class="df-key"></div></div><div class="df-detail" aria-live="polite"></div></div>`;
  const tabs = stage.querySelector('.df-tabs'), chart = stage.querySelector('.df-chart'), svg = chart.querySelector('svg'), key = chart.querySelector('.df-key'), detail = stage.querySelector('.df-detail');
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `500 12.5px ${getComputedStyle(document.body).getPropertyValue('--mono') || 'ui-monospace, monospace'}`;
  const measure = (text) => probe.measureText(text).width;
  let process = 0, chosen = 'propose-seeds', width = 0;
  const phaseOf = (name) => PROCESSES[process][1].find((s) => [...(s.first ?? []), ...s.ops, ...(s.then ?? [])].includes(name))?.phase ?? 'discover';

  // An example from a real run, open by default: what this step actually returned for a real brief.
  const example = (name, colours) => {
    const found = EXAMPLES[name];
    if (!found) return '';
    return `<details class="df-example" open><summary style="color:${colours.accent}">Example output from a real run</summary><p class="from">For the topic “${escape(found.brief?.topic ?? '')}”, trimmed: long text is shortened and lists show their first three items.</p><div class="df-tree">${exampleTree(found.output)}</div></details>`;
  };

  function show(name) {
    chosen = name;
    const op = byName[name], phase = phaseOf(name), colours = palette(phase, ctx.dark());
    svg.querySelectorAll('.node').forEach((n) => {
      const on = n.dataset.op === name;
      n.classList.toggle('on', on);
      n.setAttribute('aria-pressed', String(on));
      n.querySelector('rect').setAttribute('stroke', on ? palette(n.dataset.phase, ctx.dark()).accent : n.dataset.edge);
    });
    svg.querySelectorAll('.edge').forEach((e) => {
      const on = (e.dataset.ops ?? '').split(' ').includes(name);
      e.classList.toggle('on', on);
      e.style.stroke = on ? palette(e.dataset.phase, ctx.dark()).accent : '';
      e.setAttribute('marker-end', `url(#${uid}-${on ? e.dataset.phase : 'plain'})`);
    });
    if (!op) return;
    const kind = op.kind === 'measure' ? 'Measure: plain code, the same answer every time' : `Model operation${op.search ? ' that searches the web' : ''}${op.effort ? `, ${op.effort} effort` : ''}`;
    detail.innerHTML =
      `<span class="chip" style="background:${colours.node};color:${colours.ink}">${PHASES[phase]?.name ?? phase}</span><h3>${escape(op.name)}</h3><div class="kind">${kind}</div><p>${escape(op.purpose)}</p>` +
      (op.kind === 'model'
        ? `<h5>Role</h5><p>${escape(op.role)}</p><h5>Method</h5><ol>${op.method.map((m) => `<li>${escape(m)}</li>`).join('')}</ol>` +
          (op.examples.length ? `<h5>Examples given to the model</h5><ol>${op.examples.map((m) => `<li>${escape(m)}</li>`).join('')}</ol>` : '') +
          example(op.name, colours) +
          `<h5>The answer must fit</h5><div class="df-shape">${shapeText(op.output)}</div>` +
          `<details class="df-prompt"><summary style="color:${colours.accent}">Show the full prompt</summary><pre><code>${escape(renderPrompt(op, { brief: BRIEF }))}</code></pre><p class="kind">This is renderPrompt with only the brief as input. In a run, later operations also receive the results of earlier steps, appended as further Input sections.</p></details>`
        : example(op.name, colours) + (op.output ? `<h5>Its result has the shape</h5><div class="df-shape">${shapeText(op.output)}</div>` : ''));
  }

  function drawChart() {
    width = Math.max(280, chart.clientWidth);
    const dark = ctx.dark();
    const [, stages] = PROCESSES[process];
    const { nodes, edges, cards, lanes, loops, height } = layout(stages, width, measure);
    svg.setAttribute('viewBox', `-1 -1 ${width + 2} ${height + 2}`);
    svg.style.height = `${height + 2}px`;
    const used = [...new Set(stages.map((s) => s.phase))];
    const marker = (id, colour) => `<marker id="${uid}-${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1.5 8.5 5 1 8.5" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker>`;
    const faint = getComputedStyle(document.body).getPropertyValue('--faint').trim() || '#999';
    const defs = `<defs>${marker('plain', faint)}${used.map((p) => marker(p, palette(p, dark).accent)).join('')}</defs>`;
    const cardSvg = cards
      .map(({ y, h, stage: s, k }) => {
        const c = palette(s.phase, dark), notes = [s.each ? `once per ${s.each}, all at once` : '', s.loop ? `${s.loop} rounds` : ''].filter(Boolean).join(' · ');
        return `<rect class="card" x="0" y="${y}" width="${width}" height="${h}" rx="16" fill="${c.card}" stroke="${c.cardEdge}"/>`;
      })
      .join('');
    // Titles go above the curves, haloed in their card's colour so a connector passing behind never cuts the words.
    const titleSvg = cards
      .map(({ y, stage: s, k }) => {
        const c = palette(s.phase, dark), notes = [s.each ? `once per ${s.each}, all at once` : '', s.loop ? `${s.loop} rounds` : ''].filter(Boolean).join(' · ');
        const halo = `stroke="${c.card}" stroke-width="7" stroke-linejoin="round" paint-order="stroke"`;
        return `<g class="badge"><circle cx="${CARD_PAD + 11}" cy="${y + CARD_PAD + 10}" r="11" fill="${c.accent}"/><text x="${CARD_PAD + 11}" y="${y + CARD_PAD + 10.5}">${k + 1}</text></g><text class="stage-title" x="${CARD_PAD + 30}" y="${y + CARD_PAD + 14}" ${halo}>${escape(s.title)}</text>${notes ? `<text class="stage-note" x="${CARD_PAD + 30}" y="${y + CARD_PAD + 32}" ${halo}>${escape(notes)}</text>` : ''}`;
      })
      .join('');
    const laneSvg = lanes.map((l) => `<rect class="lane" x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="13" stroke="${palette(l.phase, dark).lane}"/>`).join('');
    const edgeSvg = edges.map((e) => `<path class="edge${e.loop ? ' loop' : ''}" data-ops="${(e.ops ?? []).join(' ')}" data-phase="${e.phase}" d="${e.d}" marker-end="url(#${uid}-plain)"/>`).join('');
    const loopSvg = loops
      .map((l) => {
        const c = palette(l.phase, dark);
        return `<g class="pill"><rect x="${l.x - 16}" y="${l.y - 10}" width="32" height="20" rx="10" fill="${c.node}" stroke="${c.nodeEdge}"/><text x="${l.x}" y="${l.y + 0.5}" fill="${c.ink}">× ${l.rounds}</text></g>`;
      })
      .join('');
    const nodeSvg = nodes
      .map((n) => {
        const c = palette(n.phase, dark), model = n.op?.kind === 'model';
        const fill = model ? c.node : 'var(--panel)', edge = model ? c.nodeEdge : 'var(--line)';
        const textX = n.x + (n.w - (n.op?.search ? 16 : 0)) / 2, mid = n.y + (n.variant ? n.h / 2 - 7 : n.h / 2);
        const globe = n.op?.search ? `<g class="globe" stroke="${c.accent}" transform="translate(${n.x + n.w - 19} ${n.y + n.h / 2})"><circle r="5"/><path d="M-5 0H5M0 -5C2.6 -2 2.6 2 0 5M0 -5C-2.6 -2 -2.6 2 0 5"/></g>` : '';
        const label = `${n.name}${n.variant ? ` (${n.variant})` : ''}`;
        return `<g class="node" data-op="${n.name}" data-phase="${n.phase}" data-edge="${edge}" tabindex="0" role="button" aria-pressed="false" aria-label="${escape(`${label}, ${model ? 'model operation' : 'measure'}${n.op?.search ? ', searches the web' : ''}${n.maybe ? `, ${n.maybe}` : ''}`)}"><title>${escape(n.maybe ? `${n.op?.purpose ?? ''} (${n.maybe})` : (n.op?.purpose ?? ''))}</title><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.h / 2}" fill="${fill}" stroke="${edge}"${n.maybe ? ' stroke-dasharray="4 3"' : ''}/><text x="${textX}" y="${mid}">${escape(n.name)}</text>${n.variant ? `<text class="variant" x="${textX}" y="${mid + 14}">${escape(n.variant)}</text>` : ''}${globe}</g>`;
      })
      .join('');
    svg.innerHTML = defs + cardSvg + laneSvg + edgeSvg + titleSvg + loopSvg + nodeSvg;
    key.innerHTML =
      used.map((p) => `<span><i style="background:${palette(p, dark).node};box-shadow:inset 0 0 0 1px ${palette(p, dark).nodeEdge}"></i>${PHASES[p]?.name ?? p}</span>`).join('') +
      `<span class="sep"></span><span><i style="background:var(--panel);box-shadow:inset 0 0 0 1px var(--line)"></i>measure (plain code)</span><span><i style="background:none;outline:1px dashed var(--faint);outline-offset:-1px"></i>only sometimes</span><span>◍ searches the web</span><span>dotted lane: runs in parallel</span>`;
    if (!stages.some((s) => [...(s.first ?? []), ...s.ops, ...(s.then ?? [])].includes(chosen))) chosen = stages.flatMap((s) => s.ops).find((n) => byName[n]?.kind === 'model');
    show(chosen);
  }

  function draw() {
    const [, , what] = PROCESSES[process];
    tabs.innerHTML = PROCESSES.map(([name], i) => `<button type="button" aria-pressed="${i === process}" data-i="${i}">${name}</button>`).join('') + `<div class="what">${escape(what)}</div>`;
    drawChart();
  }

  const events = new AbortController();
  tabs.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]');if (b) { process = Number(b.dataset.i);draw(); } }, { signal: events.signal });
  svg.addEventListener('click', (e) => { const n = e.target.closest('.node');if (n) show(n.dataset.op); }, { signal: events.signal });
  svg.addEventListener('keydown', (e) => {
    const n = e.target.closest('.node');
    if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault();show(n.dataset.op); }
  }, { signal: events.signal });
  const resize = new ResizeObserver(() => { if (Math.abs(chart.clientWidth - width) > 4) drawChart(); });
  resize.observe(chart);
  const offTheme = ctx.onTheme(() => drawChart());
  draw();
  return () => { events.abort();resize.disconnect();offTheme(); };
}
