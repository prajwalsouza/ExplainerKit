// The insight map: insight engineering laid over the script itself. Surprise lands at a line, not across a section, so
// the timeline draws it as a trace with a spike at each line the first-time-viewer audit quoted, scaled to this
// script's own range (its flattest moment to its strongest). Section strips sit under the trace, sized by length. Every
// eureka is marked at the line where it clicks, and arcs under the strips run into it from the sections it cites; a
// source can itself be an earlier eureka. Coloured arcs above join each cue where it is planted to where it is said
// again; grey arcs join sections to the earlier ones the viewer remembered. The narration below carries the same marks
// as coloured text. Choosing a eureka tells its cascade: the line it rests on in each source section, in script order,
// what each adds, and the line where it clicks, with sources that are eurekas opening into their own cascades. A
// eureka happens in a particular head, so each script is audited once per viewer (a newcomer, someone familiar with the
// topic, an expert), each reading with what they already know; switch viewers to see where the eureka lands for whom,
// and where it does not land at all. The scripts and audits are real runs (see design-insight-sample.js).
import { hsla, adjust, toHex } from '../../runtime/src/color/index.js';
import { locateQuote } from '../../runtime/src/design/index.js';
import { css } from './_kit.js';
import { icon } from './design-icons.js';
import SAMPLES from './design-insight-sample.js';

const CSS = `
.dim { padding: 18px 0 6px; font-size: 14px; }
.dim-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
.dim-bar .group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.dim-bar .sep { width: 1px; height: 22px; background: var(--line); margin: 0 4px; }
.dim-bar button { font: 600 12.5px var(--sans); color: var(--muted); background: none; border: 1px solid var(--line); border-radius: 999px; padding: 6px 13px; cursor: pointer; display: inline-flex; gap: 7px; align-items: center; }
.dim-bar button[aria-pressed="true"] { color: var(--ink); border-color: var(--ink); }
.dim-bar button[aria-pressed="false"] svg { opacity: .45; }
.dim-bar .layers svg { width: 16px; height: 12px; overflow: visible; }
.dim-who { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; margin: 0 0 10px; font-size: 12.5px; color: var(--muted); }
.dim-who .viewers { display: flex; gap: 4px; padding: 3px; border-radius: 999px; background: var(--code-bg); }
.dim-who .viewers button { font: 600 12.5px var(--sans); color: var(--muted); background: none; border: 0; border-radius: 999px; padding: 5px 12px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
.dim-who .viewers button[aria-pressed="true"] { color: var(--ink); background: var(--panel); box-shadow: 0 1px 2px rgb(0 0 0 / .08); }
.dim-who .lands { font-weight: 650; }
.dim-persona { font-size: 13px; color: var(--muted); margin: 0 0 12px; max-width: 80ch; line-height: 1.55; }
.dim-persona b { color: var(--ink); font-weight: 600; }
.dim-sum { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12.5px; color: var(--muted); margin: 4px 0 8px; }
.dim-sum b { color: var(--ink); font-weight: 650; }
.dim-key { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0 0 6px; font-size: 12.5px; color: var(--muted); }
.dim-key { flex-direction: column; gap: 4px; }
.dim-key .row { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.dim-key span.term { font-weight: 600; cursor: help; }
.dim-key sup { font: 600 9px var(--sans); color: var(--muted); margin-left: 2px; }
.dim-key span.cue { font-weight: 600; background: var(--code-bg); border-radius: 3px; padding: 1px 3px; }
.dim-time { position: relative; }
.dim-time svg { display: block; width: 100%; overflow: visible; }
.dim-time .seg, .dim-time .eu-mark { cursor: pointer; }
.dim-time text { font: 600 10.5px var(--sans); fill: var(--muted); text-anchor: middle; }
.dim-time .seg.on text { fill: var(--ink); font-weight: 750; }
.dim-time .tag { font: 650 10.5px var(--sans); }
.dim-detail { margin: 12px 0 18px; padding: 18px 20px; border-radius: 14px; background: var(--code-bg); color: var(--ink); }
.dim-detail .head { display: flex; gap: 8px; align-items: center; font: 650 12.5px var(--sans); color: var(--muted); margin-bottom: 6px; }
.dim-detail .insight { font: 600 18px/1.45 var(--display); letter-spacing: -.01em; margin: 0 0 14px; max-width: 62ch; }
.dim-detail .sub { font: 600 12.5px var(--sans); color: var(--muted); margin: 14px 0 8px; }
.dim-detail .small { font-size: 13px; color: var(--muted); line-height: 1.55; margin: 4px 0; max-width: 72ch; }
.dim-detail .small b { color: var(--ink); font-weight: 600; }
.dim-quote { font: 15.5px/1.6 var(--sans); color: var(--ink); margin: 0; max-width: 70ch; }
.dim-quote::before { content: "“"; } .dim-quote::after { content: "”"; }
.dim-flow { position: relative; display: grid; gap: 12px; margin: 0; padding: 0 0 0 22px; list-style: none; }
.dim-flow::before { content: ""; position: absolute; left: 5px; top: 8px; bottom: 8px; width: 2px; border-radius: 2px; background: var(--rail); }
.dim-flow > li { position: relative; }
.dim-flow > li::before { content: ""; position: absolute; left: -21px; top: 6px; width: 10px; height: 10px; border-radius: 50%; background: var(--code-bg); border: 2px solid var(--rail); }
.dim-flow > li.eu::before { border-radius: 2px; transform: rotate(45deg); }
.dim-flow > li.click::before { background: var(--rail); }
.dim-flow .where { font: 650 12px var(--sans); color: var(--muted); margin-bottom: 2px; display: flex; gap: 6px; align-items: center; }
.dim-flow .where button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; font-weight: 600; border-radius: 3px; padding: 2px 4px; background: var(--code-bg); }
.dim-flow .adds { font-size: 13.5px; color: var(--muted); margin-top: 3px; max-width: 70ch; }
.dim-flow details { margin-top: 8px; }
.dim-flow summary { font: 600 12.5px var(--sans); color: var(--muted); cursor: pointer; }
.dim-flow details > .dim-flow { margin-top: 10px; }
.dim-text { display: grid; gap: 6px; }
.dim-sec { position: relative; padding: 12px 16px 12px 46px; border-radius: 12px; border: 1px solid transparent; cursor: pointer; }
.dim-sec:hover { background: var(--code-bg); }
.dim-sec.on { border-color: var(--line); background: var(--code-bg); }
.dim-sec .n { position: absolute; left: 14px; top: 13px; font: 650 12px var(--mono); color: var(--muted); }
.dim-sec p { margin: 0 0 8px; font: 15.5px/1.7 var(--sans); color: var(--ink); }
.dim-sec p:last-child { margin-bottom: 0; }
.dim-sec .note { font: 600 13px var(--sans); margin-top: 6px; }
.dim-sec .star { margin-right: 3px; }
`;

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const words = (text) => String(text).toLowerCase().match(/[a-z0-9.']+/g) ?? [];
const STOP = new Set('the a an and or of to in on at for with by from is are was were it its this that as into than then their there they them our your you we not no but if so which what when how why who has have had do does under over'.split(' '));

/** Where a cue is said: exact phrase matches, or failing that whole sentences holding three quarters of its words. */
function cueSpans(text, cue) {
  const spans = [], lower = text.toLowerCase(), phrase = cue.toLowerCase();
  for (let at = lower.indexOf(phrase); at >= 0; at = lower.indexOf(phrase, at + phrase.length)) spans.push([at, at + phrase.length]);
  if (spans.length) return spans;
  const need = words(cue).filter((w) => !STOP.has(w));
  if (!need.length) return spans;
  for (const m of text.matchAll(/[^.!?]+[.!?]*/g)) {
    const have = new Set(words(m[0]));
    if (need.filter((w) => have.has(w)).length / need.length >= 0.75) spans.push([m.index, m.index + m[0].length]);
  }
  return spans;
}

const LAYER_ICONS = {
  surprise: (c) => `<svg viewBox="0 0 16 12" aria-hidden="true"><path d="M0 11H4L6 9L8 1L10 9L12 11H16" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
  cues: (c) => `<svg viewBox="0 0 16 12" aria-hidden="true"><path d="M1 11C1 2 15 2 15 11" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><circle cx="1" cy="11" r="1.6" fill="${c}"/><circle cx="15" cy="11" r="1.6" fill="${c}"/></svg>`,
  recalls: (c) => `<svg viewBox="0 0 16 12" aria-hidden="true"><path d="M1 11C1 3 15 3 15 11" fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="2 2.6" stroke-linecap="round"/></svg>`,
  leak: (c) => `<svg viewBox="0 0 16 12" aria-hidden="true"><path d="M8 0V12" stroke="${c}" stroke-width="1.8" stroke-dasharray="2.4 2"/><path d="M8 1H14L12.5 3.5L14 6H8" fill="${c}"/></svg>`,
  lost: (c) => `<svg viewBox="0 0 16 12" aria-hidden="true"><path d="M1 9.5c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="2.5" r="1.6" fill="${c}"/></svg>`,
  eurekas: (c) => `<svg viewBox="0 0 16 12" aria-hidden="true"><path d="M8 0.5L9.6 4.3L13.7 4.6L10.6 7.2L11.6 11.2L8 9L4.4 11.2L5.4 7.2L2.3 4.6L6.4 4.3Z" fill="${c}"/></svg>`,
};
const STAR = 'M8 0.5L9.6 4.3L13.7 4.6L10.6 7.2L11.6 11.2L8 9L4.4 11.2L5.4 7.2L2.3 4.6L6.4 4.3Z';

export default async function designInsight(stage, ctx) {
  css('design-insight', CSS);
  const samples = ctx.samples ?? SAMPLES;
  const layers = { surprise: true, cues: true, recalls: !ctx.samples, leak: true, lost: true, eurekas: true };
  let sample = 0, selected = -1, width = 0, viewer = null;
  stage.innerHTML = `<div class="dim"><div class="dim-bar"><div class="group" role="group" aria-label="Script"${samples.length === 1 ? ' hidden' : ''}>${samples.map((s, i) => `<button type="button" data-sample="${i}" aria-pressed="${i === 0}">${icon(s.topic)}${escape(s.topic)}</button>`).join('')}</div>${samples.length > 1 ? '<span class="sep"></span>' : ''}<div class="group layers" role="group" aria-label="Layers"></div></div><div class="dim-who"></div><div class="dim-persona"></div><div class="dim-sum"></div><div class="dim-key"></div><div class="dim-time"><svg role="img" aria-label="Insight timeline"></svg></div><div class="dim-detail" aria-live="polite"></div><div class="dim-text"></div></div>`;
  const who = stage.querySelector('.dim-who'), personaLine = stage.querySelector('.dim-persona');
  const bar = stage.querySelector('.layers'), sum = stage.querySelector('.dim-sum'), key = stage.querySelector('.dim-key'), time = stage.querySelector('.dim-time'), svg = time.querySelector('svg'), detail = stage.querySelector('.dim-detail'), body = stage.querySelector('.dim-text');

  // Colours from explainerkit/color: a warm hue for surprise, a gold for eurekas, a red for the leak, a hue per cue.
  const hex = (h, s, l) => toHex(hsla(h, s, l)).slice(0, 7);
  const colours = () => {
    const dark = ctx.dark();
    return {
      dark,
      heat: (v) => hex(18, 40 + v * 45, dark ? 80 - v * 14 : 40 + (1 - v) * 4),
      surprise: hex(18, 82, dark ? 64 : 52),
      aha: hex(42, 90, dark ? 60 : 42),
      leak: hex(356, 70, dark ? 66 : 48),
      lost: hex(330, 60, dark ? 70 : 46),
      recall: dark ? '#77746f' : '#b3afa8',
      strip: dark ? '#2e2c2a' : '#e8e2d8',
      ground: dark ? '#1c1b1a' : '#fbf9f5',
      cue: (k, n) => hex((200 + (k * 300) / Math.max(1, n)) % 360, 65, dark ? 68 : 42),
    };
  };

  function model() {
    const base = samples[sample];
    const personas = base.audience?.personas ?? [];
    if (!personas.some((p) => p.id === viewer)) viewer = base.target ?? personas[0]?.id ?? null;
    const reading = base.audience?.readings.find((r) => r.persona === viewer);
    const s = reading ? { ...base, audit: reading.audit, measures: reading.measures } : base;
    const n = s.sections.length, aha = (s.audit.aha.section ?? 0) - 1;
    const audit = s.sections.map((_, i) => s.audit.sections.find((a) => a.section === i + 1) ?? null);
    const leakAt = audit.findIndex((a) => a?.couldStateInsight);
    const moment = audit.map((a, i) => (a ? locateQuote(s.sections[i].narration, a.moment) : null));
    const scores = audit.map((a) => a?.surprise ?? 0), low = Math.min(...scores), high = Math.max(...scores);
    const relative = scores.map((v) => (high > low ? (v - low) / (high - low) : 0));
    const cues = s.cues.map((c, k) => {
      const where = s.sections.map((sec) => cueSpans(sec.narration, c.cue));
      const at = where.map((spans, i) => (spans.length ? i : -1)).filter((i) => i >= 0);
      return { ...c, k, where, at, planted: at.find((i) => i < aha) ?? -1, fires: at.includes(aha) };
    });
    const text = (i) => s.sections[i]?.narration ?? '';
    const eurekas = (s.audit.eurekas ?? [])
      .map((e) => ({
        ...e,
        at: e.section - 1,
        span: locateQuote(text(e.section - 1), e.line),
        because: e.because.map((b) => ({ ...b, span: locateQuote(text(b.section - 1), b.quote) })),
      }))
      .sort((a, b) => a.at - b.at);
    const byId = new Map(eurekas.map((e) => [e.id, e]));
    const main = eurekas.find((e) => e.kind === 'main') ?? eurekas.find((e) => e.at === aha) ?? null;
    const lost = audit.map((a, i) => (a?.lost ?? []).map((l) => ({ ...l, span: locateQuote(s.sections[i].narration, l.quote) })));
    return { lost, s, base, personas, persona: personas.find((p) => p.id === viewer) ?? null, n, aha, audit, leakAt, moment, relative, cues, eurekas, byId, main };
  }

  /** Every section a eureka rests on, following citations through earlier eurekas. */
  function ancestry(m, e, out = new Set(), seen = new Set()) {
    if (!e || seen.has(e.id)) return out;
    seen.add(e.id);
    out.add(e.at);
    for (const b of e.because) {
      out.add(b.section - 1);
      if (b.eureka) ancestry(m, m.byId.get(b.eureka), out, seen);
    }
    return out;
  }

  function drawLayers() {
    const c = colours();
    const items = [['surprise', 'Surprise', c.surprise], ['cues', 'Cues', c.cue(0, 3)], ['recalls', 'Recalls', c.recall], ['leak', 'Early guesses', c.leak], ['lost', 'Confusing lines', c.lost], ['eurekas', 'Eurekas', c.aha]]
      .filter(([id]) => id !== 'cues' || samples[sample].cues.length);
    bar.innerHTML = items.map(([id, label, colour]) => `<button type="button" data-layer="${id}" aria-pressed="${layers[id]}">${LAYER_ICONS[id](colour)}${label}</button>`).join('');
  }

  const LEVEL = { newcomer: 'Newcomer', familiar: 'Familiar', expert: 'Expert' };
  const LEVEL_ICON = { newcomer: 'seed', familiar: 'brief', expert: 'claim' };

  function drawViewers(m) {
    if (!m.personas.length) { who.innerHTML = ''; personaLine.innerHTML = ''; return; }
    const rows = m.base.audience.summary.rows, c = colours();
    const landed = (id) => rows.find((r) => r.persona === id)?.lands;
    who.innerHTML = `<span>Read as</span><div class="viewers" role="group" aria-label="Viewer">${m.personas.map((p) => `<button type="button" data-viewer="${escape(p.id)}" aria-pressed="${p.id === viewer}">${icon(LEVEL_ICON[p.level] ?? 'brief', { size: 14 })}${escape(LEVEL[p.level] ?? p.level)}${p.target ? ' · target' : ''}</button>`).join('')}</div><span>The eureka lands for ${m.personas.map((p) => `<span class="lands" style="color:${landed(p.id) ? c.aha : c.leak}">${landed(p.id) ? '✓' : '✗'} ${escape((LEVEL[p.level] ?? p.level).toLowerCase())}</span>`).join(', ')}</span>`;
    const p = m.persona;
    const clause = (t) => escape(String(t).trim().replace(/[.;]+$/, '').replace(/^./, (ch) => ch.toLowerCase()));
    personaLine.innerHTML = p ? `<b>${escape(p.name)}.</b> Already knows: ${p.knows.slice(0, 3).map(clause).join('; ')}.${p.believes?.length ? ` Believes: ${clause(p.believes[0])}.` : ''}` : '';
  }

  function drawSummary(m) {
    const me = m.s.measures, verified = m.cues.filter((q) => q.planted >= 0 && q.fires).length;
    sum.innerHTML = [
      m.aha >= 0 ? `<span>Main insight in part <b>${m.aha + 1}</b> of ${m.n}</span>` : '<span><b>No eureka lands</b> for this viewer</span>',
      `<span><b>${m.eurekas.length}</b> moments of insight</span>`,
      m.main ? `<span><b>${me.graph?.main?.sources ?? 0}</b> earlier ${me.graph?.main?.sources === 1 ? 'part feeds' : 'parts feed'} the main insight</span>` : '',
      m.relative.includes(1) ? `<span>Strongest surprise in section <b>${m.relative.indexOf(1) + 1}</b></span>` : '',
      m.cues.length ? `<span><b>${verified}</b> of ${m.cues.length} cues said again at the eureka</span>` : '',
      m.aha < 0 ? '' : `<span>${m.leakAt >= 0 && m.leakAt < m.aha ? `Guessable from section <b>${m.leakAt + 1}</b>` : 'Not guessable before the eureka'}</span>`,
      `<span>${m.lost.flat().length ? `Got lost <b>${m.lost.flat().length}</b> ${m.lost.flat().length === 1 ? 'time' : 'times'}` : 'Never got lost'}</span>`,
    ].join('');
    const c = colours();
    const cueRow = layers.cues && m.cues.length ? `<div class="row"><span>Cues</span>${m.cues.map((q) => `<span class="cue" style="color:${c.cue(q.k, m.cues.length)}">${escape(q.cue)}</span>`).join('')}</div>` : '';
    // The words a viewer has to hold: each term or coined label, coloured by whether the script ever pictured it.
    const terms = (m.base.terms?.measures.terms ?? []).filter((t) => t.uses.length);
    const termRow = terms.length ? `<div class="row"><span>Words to hold</span>${terms.map((t) => `<span class="term" style="color:${t.problems.length ? c.lost : 'inherit'}" title="${escape(t.problems.length ? `${t.problems.join('; ')}. Plainly: ${t.plain}` : `Pictured first. Plainly: ${t.plain}`)}">${escape(t.term)}${t.kind === 'coined' ? '<sup>coined</sup>' : ''}</span>`).join('')}</div>` : '';
    key.innerHTML = cueRow + termRow;
  }

  function drawTimeline(m) {
    width = Math.max(300, time.clientWidth);
    const c = colours(), n = m.n;
    const lengths = m.s.sections.map((sec) => sec.narration.length || 1), total = lengths.reduce((a, b) => a + b, 0);
    const gap = 3, usable = width - gap * (n - 1);
    const traceH = 46, arcRoom = 92, top = 26, traceBase = top + arcRoom + traceH, barY = traceBase + 4, barH = 8;
    let x = 0;
    const segs = lengths.map((len, i) => {
      const w = (len / total) * usable, seg = { i, x, w, cx: x + w / 2, len };
      x += w + gap;
      return seg;
    });
    // A point in the script: section i, character `ch`.
    const px = (i, ch) => segs[i].x + (Math.max(0, Math.min(segs[i].len, ch)) / segs[i].len) * segs[i].w;
    const mid = (i, span) => (span ? px(i, (span[0] + span[1]) / 2) : segs[i].cx);
    const chosen = m.eurekas.find((e) => e.at === selected) ?? null, lit = chosen ? ancestry(m, chosen) : null;
    const arcUp = (x0, x1, base, h, stroke, extra) => `<path d="M${x0} ${base}C${x0} ${base - h} ${x1} ${base - h} ${x1} ${base}" fill="none" stroke="${stroke}" stroke-linecap="round" ${extra}/>`;

    let out = '';
    // Arcs above the trace: recalls between sections, cues between the places they are said.
    const arcBase = traceBase - traceH - 4;
    if (layers.recalls)
      m.audit.forEach((a, i) => (a?.recalls ?? []).forEach((r) => {
        if (r >= 1 && r - 1 < i) out += arcUp(segs[r - 1].cx, segs[i].cx, arcBase, Math.min(arcRoom - 6, 10 + (i - r + 1) * 9), c.recall, `stroke-width="1.2" stroke-dasharray="2 4" opacity="${lit ? 0.3 : 1}"`);
      }));
    if (layers.cues)
      for (const q of m.cues) {
        const target = q.fires ? m.aha : q.at.find((i) => i > q.planted) ?? -1;
        if (q.planted < 0 || target <= q.planted) continue;
        const x0 = mid(q.planted, q.where[q.planted][0]), x1 = mid(target, q.where[target][0]), col = c.cue(q.k, m.cues.length);
        out += arcUp(x0, x1, arcBase, Math.min(arcRoom - 4, 14 + (target - q.planted) * 10 + q.k * 3), col, `stroke-width="2" opacity="${lit ? 0.3 : 1}"`);
        out += `<circle cx="${x0}" cy="${arcBase}" r="2.4" fill="${col}"/><circle cx="${x1}" cy="${arcBase}" r="2.4" fill="${col}"/>`;
      }
    // The surprise trace: a spike at each quoted line, its height relative to this script's range.
    if (layers.surprise) {
      const peaks = segs.map((seg) => ({ x: mid(seg.i, m.moment[seg.i]), v: m.relative[seg.i] }));
      const sigma = Math.max(5, width / 160), steps = Math.ceil(width / 2);
      let d = `M0 ${traceBase}`;
      for (let k = 0; k <= steps; k++) {
        const xx = (k / steps) * width;
        const y = peaks.reduce((acc, p) => Math.max(acc, (0.06 + 0.94 * p.v) * Math.exp(-(((xx - p.x) / sigma) ** 2))), 0);
        d += `L${xx.toFixed(1)} ${(traceBase - y * traceH).toFixed(1)}`;
      }
      out += `<defs><linearGradient id="dim-heat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.surprise}" stop-opacity=".5"/><stop offset="1" stop-color="${c.surprise}" stop-opacity=".03"/></linearGradient></defs>`;
      out += `<path d="${d}L${width} ${traceBase}Z" fill="url(#dim-heat)"/><path d="${d}" fill="none" stroke="${c.surprise}" stroke-width="1.6" stroke-linejoin="round"/>`;
      for (const [i, p] of peaks.entries())
        if (p.v >= 0.75) out += `<text class="tag" x="${p.x}" y="${traceBase - traceH * (0.06 + 0.94 * p.v) - 6}" style="fill:${c.surprise}">${m.audit[i].surprise}</text>`;
    }
    // Section strips, each with a tall invisible hit area over its stretch of trace.
    out += segs.map((seg) => {
      const leak = layers.leak && m.leakAt >= 0 && seg.i >= m.leakAt && (m.aha < 0 || seg.i < m.aha);
      return `<g class="seg${seg.i === selected ? ' on' : ''}" data-i="${seg.i}" tabindex="0" role="button" aria-label="Section ${seg.i + 1}" opacity="${lit && !lit.has(seg.i) ? 0.35 : 1}"><rect x="${seg.x}" y="${barY - traceH - 6}" width="${seg.w}" height="${traceH + barH + 24}" fill="transparent"/><rect x="${seg.x}" y="${barY}" width="${seg.w}" height="${barH}" rx="3" fill="${leak ? c.leak : c.strip}" fill-opacity="${leak ? 0.28 : 1}" stroke="${seg.i === selected ? 'var(--ink)' : 'none'}"/><text x="${seg.cx}" y="${barY + barH + 13}">${seg.i + 1}</text></g>`;
    }).join('');
    // Eurekas: the main star on a stem, small ones as diamonds, each at its line; citation arcs hang below from the
    // cited line in each source.
    const below = barY + barH + 22;
    let depth = 0;
    if (layers.eurekas) {
      for (const e of m.eurekas) {
        const on = !lit || (chosen && ancestry(m, chosen).has(e.at) && (e === chosen || ancestryIds(m, chosen).has(e.id))), ex = mid(e.at, e.span);
        for (const b of e.because) {
          const from = b.section - 1;
          if (from >= e.at || from < 0) continue;
          const sx = mid(from, b.span), h = Math.min(70, 12 + (e.at - from) * 8);
          depth = Math.max(depth, h);
          out += `<path d="M${sx} ${below}C${sx} ${below + h} ${ex} ${below + h} ${ex} ${below}" fill="none" stroke="${c.aha}" stroke-width="${e === chosen || (!lit && e === m.main) ? 2.2 : 1.4}" stroke-linecap="round" opacity="${on ? (lit ? 1 : e === m.main ? 0.85 : 0.45) : 0.08}"${b.eureka ? '' : ' stroke-dasharray="1 4"'}/>`;
        }
      }
      for (const e of m.eurekas) {
        const on = !lit || lit.has(e.at), ex = mid(e.at, e.span), y = barY + barH / 2;
        if (e === m.main)
          out += `<path d="M${ex} ${y}L${ex} ${top + 4}" stroke="${c.aha}" stroke-width="1.6"/><g class="eu-mark" data-i="${e.at}"><circle cx="${ex}" cy="${top - 4}" r="9" fill="${c.aha}"/><path transform="translate(${ex - 6.4} ${top - 10.5}) scale(.8)" d="${STAR}" fill="${c.ground}"/></g><text class="tag" x="${ex}" y="${top - 18}" style="fill:${c.aha}">eureka</text>`;
        out += `<g class="eu-mark" data-i="${e.at}" opacity="${on ? 1 : 0.3}"><rect x="${ex - 4.5}" y="${y - 4.5}" width="9" height="9" transform="rotate(45 ${ex} ${y})" fill="${e === m.main ? c.aha : c.ground}" stroke="${c.aha}" stroke-width="1.8"/></g>`;
      }
    }
    if (layers.leak && m.leakAt >= 0 && (m.aha < 0 || m.leakAt < m.aha)) {
      const s = segs[m.leakAt], lx = s.x + s.w, bottom = below + (layers.eurekas ? depth : 0) + 8;
      out += `<path d="M${lx} ${bottom}L${lx} ${barY - 2}" stroke="${c.leak}" stroke-width="1.4" stroke-dasharray="3 3"/><text class="tag" x="${lx + 5}" y="${bottom + 4}" style="fill:${c.leak};text-anchor:start">ending guessable from here</text>`;
    }
    const height = below + (layers.eurekas ? depth : 0) + 26;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.height = `${height}px`;
    svg.innerHTML = out;
  }

  /** The ids of every eureka a eureka rests on, itself included. */
  function ancestryIds(m, e, out = new Set()) {
    if (!e || out.has(e.id)) return out;
    out.add(e.id);
    for (const b of e.because) if (b.eureka) ancestryIds(m, m.byId.get(b.eureka), out);
    return out;
  }

  /** One section's narration as coloured text: its surprising line, eureka lines, cues, and the chosen cascade. */
  function sectionHTML(m, i, c) {
    const text = m.s.sections[i].narration, len = text.length;
    const colour = new Array(len).fill(''), under = new Array(len).fill(''), bold = new Array(len).fill(false), starAt = new Map();
    const paint = ([a, b], fn) => { for (let k = Math.max(0, a); k < Math.min(len, b); k++) fn(k); };
    if (layers.surprise && m.moment[i] && m.relative[i] >= 0.25) {
      const v = m.relative[i];
      paint(m.moment[i], (k) => { colour[k] = c.heat(v); });
    }
    if (layers.cues)
      for (const q of m.cues) for (const sp of q.where[i]) paint(sp, (k) => { colour[k] = c.cue(q.k, m.cues.length); under[k] = c.cue(q.k, m.cues.length); });
    if (layers.lost)
      for (const l of m.lost[i]) if (l.span) paint(l.span, (k) => { colour[k] = c.lost; under[k] = `${c.lost} dotted`; });
    if (layers.eurekas) {
      for (const e of m.eurekas.filter((x) => x.at === i && x.span)) {
        paint(e.span, (k) => { colour[k] = c.aha; bold[k] = true; });
        starAt.set(e.span[0], e);
      }
      // The chosen eureka's cascade: every line it cites, through the eurekas it rests on, highlighted in gold.
      const chosen = m.eurekas.find((e) => e.at === selected);
      if (chosen)
        for (const id of ancestryIds(m, chosen))
          for (const b of m.byId.get(id).because) if (b.section - 1 === i && b.span) paint(b.span, (k) => { under[k] = c.aha; });
    }
    let html = '', run = '', style = null;
    const flush = () => { if (run) html += style ? `<span style="${style}">${escape(run)}</span>` : escape(run); run = ''; };
    for (let k = 0; k < len; k++) {
      if (starAt.has(k)) {
        flush();
        const e = starAt.get(k);
        html += `<span class="star" title="${e === m.main ? 'Eureka' : 'Small eureka'} ${escape(e.id)}">${icon('star', { size: 13, colour: c.aha })}</span>`;
      }
      const st = [colour[k] && `color:${colour[k]}`, bold[k] && 'font-weight:600', under[k] && `background:${toHex(adjust(under[k].replace(' dotted', ''), {a: .13}))};border-radius:2px${under[k].endsWith('dotted') ? ';font-style:italic' : ''}`].filter(Boolean).join(';') || null;
      if (st !== style || text[k] === '\n') { flush(); style = st; }
      run += text[k];
    }
    flush();
    return html.split(/\n\s*\n/).map((p) => `<p>${p}</p>`).join('');
  }

  function drawText(m) {
    const c = colours();
    body.innerHTML = m.s.sections.map((_, i) => {
      const note = layers.leak && i === m.leakAt && (m.aha < 0 || m.leakAt < m.aha) ? `<div class="note" style="color:${c.leak}">After this section this viewer could already state the ending.</div>` : '';
      return `<section class="dim-sec${i === selected ? ' on' : ''}" data-i="${i}"><span class="n">${i + 1}</span>${sectionHTML(m, i, c)}${note}</section>`;
    }).join('');
  }

  /** The words a citation quotes, as found in the narration (or as the audit gave them when they cannot be found). */
  const quoteOf = (m, section, span, given) => (span ? m.s.sections[section - 1].narration.slice(span[0], span[1]) : given || '');

  /**
   * A eureka's cascade in script order: the line it rests on in each earlier section and what that adds, then the line
   * where it clicks. A source that is itself a eureka opens into its own cascade the first time it appears.
   */
  function cascadeHTML(m, e, seen) {
    const sources = e.because.filter((b) => b.section - 1 < e.at).sort((a, b) => a.section - b.section);
    const trigger = e.because.find((b) => b.section - 1 === e.at);
    const items = sources.map((b) => {
      const sub = b.eureka ? m.byId.get(b.eureka) : null, open = sub && !seen.has(sub.id);
      if (open) seen.add(sub.id);
      const where = `<button type="button" data-go="${b.section - 1}">Section ${b.section}</button>${sub ? ` · ${icon('star', { size: 12 })} itself a eureka` : ''}`;
      const nested = open ? `<details><summary>How section ${b.section} got there</summary><p class="small"><b>${escape(sub.insight)}</b></p>${cascadeHTML(m, sub, seen)}</details>` : '';
      return `<li class="${sub ? 'eu' : ''}"><div class="where">${where}</div><p class="dim-quote">${escape(quoteOf(m, b.section, b.span, b.quote))}</p><div class="adds">${escape(b.gives)}</div>${nested}</li>`;
    });
    const line = quoteOf(m, e.section, e.span, e.line);
    items.push(`<li class="click"><div class="where"><button type="button" data-go="${e.at}">Section ${e.section}</button> · it clicks</div><p class="dim-quote" style="color:var(--rail);font-weight:600">${escape(line)}</p>${trigger ? `<div class="adds">${escape(trigger.gives)}</div>` : ''}</li>`);
    return `<ol class="dim-flow">${items.join('')}</ol>`;
  }

  function showDetail(m, i) {
    selected = i;
    drawTimeline(m);
    drawText(m);
    const c = colours();
    detail.style.setProperty('--rail', c.aha);
    const a = m.audit[i], e = m.eurekas.find((x) => x.at === i);
    if (!a) {
      detail.innerHTML = m.aha < 0 ? `<div class="head">${icon('question', { colour: c.leak })}No eureka for this viewer</div><p class="insight">${escape(m.s.audit.aha.insight)}</p>` : '<p class="small">Choose a section on the timeline or in the text.</p>';
      return;
    }
    const feeds = m.eurekas.filter((x) => x !== e && x.because.some((b) => b.section - 1 === i && b.section - 1 < x.at));
    const feedsLine = feeds.length ? `<p class="small">This section feeds ${feeds.map((x) => `<b>${x === m.main ? 'the eureka' : `eureka ${escape(x.id)}`}</b> in section ${x.section}`).join(' and ')}.</p>` : '';
    const lostHere = m.lost[i].length ? `<p class="small" style="color:${c.lost}">${m.lost[i].map((l) => `<b style="color:inherit">Got lost at</b> “${escape(l.quote)}”${/[.!?]$/.test(l.quote.trim()) ? '' : '.'} ${escape(l.why)}`).join('<br>')}</p>` : '';
    const viewer = lostHere + `<p class="small"><b>A first-time viewer expected</b> ${escape(a.expected.replace(/^I expect(ed)? /i, ''))} <b>Surprise</b> ${a.surprise}, ${Math.round(m.relative[i] * 100)}% of this script's range. ${escape(a.why)}</p>`;
    if (e) {
      const head = `<div class="head">${icon('star', { colour: c.aha })}${e === m.main ? 'The main insight' : 'What clicks here'} · part ${e.section}</div>`;
      detail.innerHTML = `${head}<p class="insight">${escape(e.insight)}</p><div class="sub">How it comes together</div>${cascadeHTML(m, e, new Set([e.id]))}${feedsLine}<div class="sub">The viewer here</div>${viewer}`;
    } else {
      const quote = a.moment ? `<p class="dim-quote">${escape(quoteOf(m, i + 1, m.moment[i], a.moment))}</p>` : '';
      detail.innerHTML = `<div class="head">${icon('spark', { colour: c.surprise })}Section ${i + 1} · its moment</div>${quote}${viewer}${feedsLine}`;
    }
  }

  function draw() {
    const m = model();
    drawLayers();
    drawSummary(m);
    drawViewers(m);
    showDetail(m, selected >= 0 && selected < m.n ? selected : (m.main?.at ?? m.aha));
  }

  const events = new AbortController();
  stage.querySelector('.dim-bar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.sample) {
      sample = Number(b.dataset.sample);
      selected = -1;
      stage.querySelectorAll('[data-sample]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    } else layers[b.dataset.layer] = !layers[b.dataset.layer];
    draw();
  }, { signal: events.signal });
  who.addEventListener('click', (e) => {
    const b = e.target.closest('[data-viewer]');
    if (!b) return;
    viewer = b.dataset.viewer;
    selected = -1;
    draw();
  }, { signal: events.signal });
  const pickSection = (e) => {
    const t = e.target.closest('[data-i]');
    if (t) showDetail(model(), Number(t.dataset.i));
  };
  svg.addEventListener('click', pickSection, { signal: events.signal });
  svg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault();pickSection(e); } }, { signal: events.signal });
  body.addEventListener('click', pickSection, { signal: events.signal });
  detail.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) body.querySelector(`.dim-sec[data-i="${go.dataset.go}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, { signal: events.signal });
  const resize = new ResizeObserver(() => { if (Math.abs(time.clientWidth - width) > 4) drawTimeline(model()); });
  resize.observe(time);
  const offTheme = ctx.onTheme(() => draw());
  draw();
  return () => { events.abort();resize.disconnect();offTheme(); };
}
