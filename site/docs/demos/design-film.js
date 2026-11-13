// The process, as a film: one real run of explainerkit/design, stage by stage, showing what the brief turns into at each
// step. Sources arrive as links, ideas as cards, six candidate stories become one, a telling becomes a row of beats
// with cues arcing to the reveal, a draft is typed, a reviewer's fix strikes a line, and each viewer's audit says
// whether the eureka landed. Choose the explainer, the fable or the series. It plays like a video: captions time each
// beat (beats from explainerkit/motion), the clock is ExplainerKit's projection player over a scene, so seeking and
// replaying land on exactly the same frame, entrances use its easings, the scatter of links is seeded with randomAt
// from explainerkit/noise, and the phase colours come from explainerkit/color. Pause to open any link. The scenes and their
// values come from recorded runs (see design-film-data.js).
import { scene } from '../../runtime/src/core/index.js';
import { createProjectionPlayer } from '../../runtime/src/player/index.js';
import { beats, ease } from '../../runtime/src/motion/index.js';
import { randomAt } from '../../runtime/src/noise/index.js';
import { hsla, toHex } from '../../runtime/src/color/index.js';
import { css } from './_kit.js';
import { icon } from './design-icons.js';
import FILMS from './design-film-data.js';

const PHASE_HUE = { discover: 212, research: 262, shape: 168, write: 22, refine: 340 };
const FORMS = [['explainer', 'Explainer'], ['fable', 'Fable'], ['series', 'Series']];
const TITLE_CARD = 1.8;
const ENTER = 0.7;

const CSS = `
.df { padding: 16px 0 4px; }
.df-top { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin-bottom: 12px; }
.df-forms { display: flex; gap: 4px; padding: 3px; border-radius: 999px; background: var(--code-bg); }
.df-forms button { font: 600 12.5px var(--sans); color: var(--muted); background: none; border: 0; border-radius: 999px; padding: 6px 13px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
.df-forms button[aria-pressed="true"] { color: var(--ink); background: var(--panel); box-shadow: 0 1px 2px rgb(0 0 0 / .08); }
.df-about { font-size: 12.5px; color: var(--muted); display: inline-flex; gap: 6px; align-items: center; }
.df-about b { color: var(--ink); font-weight: 600; }
.df-screen { position: relative; border-radius: 16px; background: var(--panel); border: 1px solid var(--line); overflow: hidden; }
.df-chain { display: flex; gap: 6px; align-items: center; padding: 12px 16px 0; min-height: 34px; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent); }
.df-chain button { flex: none; display: inline-flex; gap: 5px; align-items: center; font: 600 11.5px var(--sans); color: var(--muted); background: var(--code-bg); border: 0; border-radius: 999px; padding: 4px 10px; cursor: pointer; white-space: nowrap; transition: opacity .3s; }
.df-chain button.now { color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--ph); }
.df-chain .arrow { flex: none; width: 10px; height: 1.5px; background: var(--line); }
.df-stage { position: relative; height: clamp(380px, 52vw, 470px); padding: 10px 26px 18px; box-sizing: border-box; overflow: hidden; }
.df-card { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; pointer-events: none; }
.df-card .t { font: 650 clamp(24px, 3.4vw, 34px)/1.15 var(--display); letter-spacing: -.03em; color: var(--ink); display: flex; gap: 12px; align-items: center; }
.df-card .t svg { width: 30px; height: 30px; color: var(--ph); }
.df-card .p { font: 650 11px var(--sans); letter-spacing: .08em; text-transform: uppercase; color: var(--ph); margin-bottom: 10px; }
.df-view { position: absolute; inset: 10px 26px 26px; display: flex; flex-direction: column; justify-content: safe center; gap: 10px; overflow: hidden; }
.df-note { position: absolute; left: 26px; right: 26px; bottom: 10px; font-size: 11.5px; color: var(--muted); }
.df-cap { min-height: 52px; padding: 12px 18px 0; font: 16px/1.55 var(--sans); color: var(--ink); text-align: center; text-wrap: balance; }
.df-bar { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 10px 16px 14px; }
.df-play { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); background: var(--ground); color: var(--ink); cursor: pointer; display: grid; place-items: center; }
.df-play svg { width: 14px; height: 14px; fill: currentColor; }
.df-seek { position: relative; height: 22px; display: flex; gap: 3px; align-items: center; cursor: pointer; touch-action: none; }
.df-seek i { display: block; height: 5px; border-radius: 3px; background: var(--line); position: relative; overflow: hidden; }
.df-seek i b { position: absolute; inset: 0 auto 0 0; width: 0; background: var(--ph); }
.df-seek:hover i { height: 7px; }
.df-time { font: 12px var(--mono); color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.df [data-in] { will-change: opacity, transform; }
.df .k { font: 650 10.5px var(--sans); letter-spacing: .06em; text-transform: uppercase; color: var(--ph); }
.df .muted { color: var(--muted); }
.df-fields { display: grid; gap: 12px; max-width: 560px; margin: 0 auto; width: 100%; }
.df-fields div { display: grid; grid-template-columns: 90px 1fr; gap: 12px; align-items: baseline; text-align: left; font-size: 17px; color: var(--ink); }
.df-fields div:first-child { font: 650 clamp(24px, 3vw, 30px)/1.2 var(--display); letter-spacing: -.02em; }
.df-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
.df-box { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; background: var(--ground); text-align: left; font-size: 13.5px; line-height: 1.45; color: var(--ink); transition: box-shadow .3s; }
.df-box.hi { box-shadow: 0 0 0 2px var(--ph); }
.df-box .h { display: flex; gap: 7px; align-items: center; font-weight: 650; margin-bottom: 6px; }
.df-box ul { margin: 6px 0 0; padding-left: 16px; color: var(--muted); font-size: 12.5px; }
.df-links { display: flex; flex-wrap: wrap; gap: 9px 10px; justify-content: center; align-content: center; }
.df-links a { pointer-events: auto; max-width: 260px; display: grid; grid-template-columns: auto 1fr; gap: 2px 7px; text-align: left; text-decoration: none; color: var(--ink); border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; background: var(--ground); font-size: 12px; line-height: 1.35; }
.df-links a:hover { border-color: var(--ph); }
.df-links a svg { grid-row: span 2; color: var(--ph); margin-top: 1px; }
.df-links a b { font: 650 11.5px var(--mono); color: var(--ph); }
.df-cards { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.df-cards .df-box { max-width: 250px; }
.df-big { font: 600 clamp(20px, 2.6vw, 27px)/1.35 var(--display); letter-spacing: -.015em; color: var(--ink); max-width: 30ch; margin: 0 auto; text-align: center; }
.df-big.left { text-align: left; max-width: 46ch; font-size: clamp(17px, 2vw, 21px); }
.df-ladder { display: grid; gap: 14px; max-width: 640px; margin: 0 auto; text-align: left; }
.df-ladder .step { display: grid; grid-template-columns: 22px 1fr; gap: 10px; font-size: 15px; color: var(--ink); line-height: 1.45; }
.df-ladder .step svg { color: var(--ph); margin-top: 3px; }
.df-list { display: grid; gap: 7px; max-width: 680px; margin: 0 auto; width: 100%; }
.df-item { display: grid; grid-template-columns: minmax(0, 1fr) 120px auto; gap: 12px; align-items: center; text-align: left; font-size: 13.5px; color: var(--ink); padding: 7px 10px; border-radius: 10px; transition: background .3s, box-shadow .3s; }
.df-item.hi { box-shadow: inset 0 0 0 1.5px var(--ph); background: var(--ground); }
.df-item .name { font-weight: 600; }
.df-item .sub { color: var(--muted); font-size: 12px; display: block; font-weight: 400; margin-top: 1px; }
.df-item .meter { height: 6px; border-radius: 3px; background: var(--code-bg); overflow: hidden; }
.df-item .meter b { display: block; height: 100%; width: 0; background: var(--ph); border-radius: 3px; }
.df-item .tagline { font: 650 11px var(--sans); color: var(--ph); white-space: nowrap; min-width: 84px; text-align: right; }
.df-claims .df-item { grid-template-columns: 18px minmax(0, 1fr) auto; }
.df-claims .df-item svg { color: var(--ph); }
.df-claims .doms { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.df-claims .doms a { pointer-events: auto; font: 600 10.5px var(--mono); color: var(--muted); text-decoration: none; border: 1px solid var(--line); border-radius: 6px; padding: 2px 6px; }
.df-shapes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; align-items: end; height: 220px; max-width: 620px; margin: 0 auto; width: 100%; }
.df-shapes .col { display: grid; grid-template-rows: 1fr auto auto; gap: 6px; height: 100%; text-align: center; font-size: 13px; }
.df-shapes .pillar { align-self: end; border-radius: 8px 8px 3px 3px; background: var(--ph); opacity: .35; height: 0; transition: opacity .3s; }
.df-shapes .col.hi .pillar { opacity: 1; }
.df-shapes .n { font: 650 18px var(--display); color: var(--ink); }
.df-svg { width: 100%; height: auto; overflow: visible; }
.df-svg text { font: 600 11px var(--sans); fill: var(--muted); text-anchor: middle; }
.df-draft { display: grid; gap: 16px; max-width: 640px; margin: 0 auto; width: 100%; }
.df-strips { display: flex; gap: 4px; }
.df-strips i { flex: 1; height: 8px; border-radius: 3px; background: var(--ph); opacity: .55; }
.df-type { font: 17px/1.65 var(--sans); color: var(--ink); text-align: left; min-height: 6.6em; white-space: pre-wrap; }
.df-type .caret { display: inline-block; width: 2px; height: 1.1em; vertical-align: -.2em; background: var(--ph); margin-left: 1px; }
.df-revise { display: grid; gap: 12px; max-width: 640px; margin: 0 auto; width: 100%; text-align: left; }
.df-counts { display: flex; gap: 10px; justify-content: center; }
.df-counts .df-box { text-align: center; min-width: 110px; }
.df-counts .df-box b { display: block; font: 650 26px var(--display); }
.df-line { font: 16px/1.55 var(--sans); color: var(--ink); padding-left: 14px; border-left: 2px solid var(--line); }
.df-line.old { color: var(--muted); }
.df-line.old.hi { text-decoration: line-through; text-decoration-color: hsl(356 70% 52%); }
.df-line.new { border-left-color: var(--ph); }
.df-titles { display: grid; gap: 6px; text-align: center; }
.df-titles div { font: 600 16px var(--display); color: var(--muted); transition: color .3s, font-size .3s; }
.df-titles div.hi { color: var(--ink); font-size: clamp(22px, 2.8vw, 28px); letter-spacing: -.02em; }
.df-landing { display: grid; gap: 14px; max-width: 680px; margin: 0 auto; width: 100%; text-align: left; }
.df-landing .who { display: flex; gap: 8px; align-items: center; font-weight: 650; font-size: 14px; color: var(--ink); }
.df-landing .strip { display: flex; gap: 3px; margin: 6px 0 4px; }
.df-landing .strip i { flex: 1; height: 8px; border-radius: 3px; background: var(--code-bg); position: relative; }
.df-landing .strip i.aha { background: hsl(42 90% 50%); }
.df-landing .why { font-size: 12.5px; color: var(--muted); line-height: 1.45; }
.df-pairs { display: grid; gap: 10px; max-width: 720px; margin: 0 auto; width: 100%; }
.df-pair { display: grid; grid-template-columns: 1fr 26px 1fr; gap: 8px; align-items: center; text-align: left; font-size: 13px; line-height: 1.4; }
.df-pair svg { color: var(--ph); justify-self: center; }
.df-banned { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 640px; margin: 0 auto; }
.df-banned span { font: 600 14px var(--mono); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 5px 10px; background: var(--ground); }
.df-banned span.hi { color: var(--muted); text-decoration: line-through; text-decoration-color: hsl(356 70% 52%); text-decoration-thickness: 2px; }
.df-plot { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; max-width: 720px; margin: 0 auto 8px; }
.df-plot span { font-size: 12.5px; color: var(--ink); border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; background: var(--ground); }
.df-topics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.df-topics .df-box { font-size: 12px; }
.df-topics .s { color: var(--muted); padding: 2px 0; transition: color .3s; }
.df-topics .s.hi { color: var(--ink); font-weight: 650; }
.df-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; max-width: 680px; margin: 8px auto 0; }
.df-chips span { font-size: 12px; border-radius: 999px; padding: 3px 9px; border: 1px solid var(--line); color: var(--ink); background: var(--ground); }
.df-chips span.cut.hi { color: var(--muted); text-decoration: line-through; }
.df-chapters { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
@media (max-width: 640px) {
  .df-about span { display: none; }
  .df-stage { height: 520px; padding: 8px 14px 16px; }
  .df-view { inset: 8px 14px 18px; }
  .df-shapes { height: 170px; }
  .df-item { grid-template-columns: minmax(0, 1fr) 70px; }
  .df-item .tagline { display: none; }
  .df-links a { max-width: 100%; }
  .df-pair { grid-template-columns: 1fr; }
  .df-pair svg { transform: rotate(90deg); }
}
`;

const escape = (text) => String(text ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const safeUrl = (url) => (/^https?:\/\//.test(url ?? '') ? escape(url) : '#');
const clamp = (v) => Math.max(0, Math.min(1, v));
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const PLAY = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5Z"/></svg>';
const PAUSE = '<svg viewBox="0 0 16 16"><path d="M3.5 2.5h3v11h-3ZM9.5 2.5h3v11h-3Z"/></svg>';

/**
 * Attributes that place an element on the scene's beats: it enters at beat `at` (plus `delay` seconds), leaves at
 * `out`, is highlighted from `hi` and dimmed from `dim`. Beats may be fractional; `type` reveals its text over a beat.
 */
const on = ({ at = 0, delay = 0, out, hi, dim, type, grow } = {}) =>
  [`data-in="${at}"`, delay && `data-delay="${delay}"`, out !== undefined && `data-out="${out}"`, hi !== undefined && `data-hi="${hi}"`, dim !== undefined && `data-dim="${dim}"`, type !== undefined && `data-type="${type}"`, grow !== undefined && `data-grow="${grow}"`].filter(Boolean).join(' ');

/** Each scene's view, as HTML whose elements carry beat attributes. */
const VIEWS = {
  brief: (v) => `<div class="df-fields">${v.fields.map(([k, val], i) => `<div ${on({ at: i ? 0 : 1, delay: i * 0.25 })}><span class="k">${escape(k)}</span><span>${escape(val)}</span></div>`).join('')}</div>`,
  personas: (v) => `<div class="df-row">${v.personas.map((p, i) => `<div class="df-box" ${on({ at: 0, delay: i * 0.3, hi: p.target ? 2 : undefined, dim: p.target ? undefined : 2 })}><div class="h">${icon({ newcomer: 'seed', familiar: 'brief', expert: 'claim' }[p.level] ?? 'brief')}${escape(p.level)}${p.target ? ' · target' : ''}</div>${escape(p.name)}<ul ${on({ at: 1, delay: i * 0.25 })}>${p.knows.map((k) => `<li>${escape(k)}</li>`).join('')}</ul></div>`).join('')}</div>`,
  links: (v, seed) => `<div class="df-links">${v.links.map((l, i) => `<a href="${safeUrl(l.url)}" target="_blank" rel="noopener" style="transform:translate(${((randomAt(seed, i, 1) - 0.5) * 10).toFixed(1)}px,${((randomAt(seed, i, 2) - 0.5) * 10).toFixed(1)}px) rotate(${((randomAt(seed, i, 3) - 0.5) * 2.4).toFixed(2)}deg)" ${on({ at: i < 4 ? 0 : 1, delay: (i % 4) * 0.4 + randomAt(seed, i, 4) * 0.2 })}>${icon('link', { size: 14 })}<b>${escape(l.domain)}</b><span>${escape(l.finding)}</span></a>`).join('')}</div>`,
  cards: (v, seed) => `<div class="df-cards">${v.cards.map((c, i) => `<div class="df-box" style="transform:rotate(${((randomAt(seed, i, 5) - 0.5) * 3).toFixed(2)}deg)" ${on({ at: i < 3 ? 0 : 1, delay: (i % 3) * 0.4 })}><div class="k">${escape(c.kind)}</div>${escape(c.text)}</div>`).join('')}</div>`,
  ladder: (v) => `<div class="df-ladder"><div class="step" ${on({ at: 0, delay: 0.3 })}>${icon('seed')}<span><span class="k">From</span><br>${escape(v.from)}</span></div><div class="step" ${on({ at: 1 })}>${icon('question')}<span><span class="k">To</span><br>${escape(v.to)}</span></div><div class="df-big left" ${on({ at: 1, delay: 1.2, type: 1 })} data-text="${escape(v.question)}"></div></div>`,
  seeds: (v) => `<div class="df-list">${v.seeds.map((s, i) => `<div class="df-item" ${on({ at: 0, delay: i * 0.22, hi: s.chosen ? 1.5 : undefined, dim: s.chosen ? undefined : 2 })}><span><span class="name">${escape(s.name ?? s.id)}</span><span class="sub">${escape(s.seed ?? '')}</span></span><span class="meter"><b ${on({ at: 0, delay: 0.6 + i * 0.22, grow: s.score ?? 0 })}></b></span><span class="tagline">${s.id === v.ranked ? '<span ' + on({ at: 1 }) + '>ranked first</span>' : ''}${s.chosen ? '<span ' + on({ at: 1, delay: 1 }) + '>chosen</span>' : ''}</span></div>`).join('')}</div>`,
  claims: (v) => `<div class="df-list df-claims">${v.claims.map((c, i) => `<div class="df-item" ${on({ at: i < 4 ? 0 : 1, delay: (i % 4) * 0.35, hi: i === 0 ? 1 : undefined })}>${icon('claim', { size: 14 })}<span>${escape(c.claim)}</span><span class="doms">${c.domains.slice(0, 2).map((d) => `<a href="${safeUrl(c.url)}" target="_blank" rel="noopener">${escape(d)}</a>`).join('')}</span></div>`).join('')}</div>`,
  line: (v) => `<div class="df-big" ${on({ at: 0, delay: 0.8, type: 0 })} data-text="${escape(v.line)}"></div>${v.note ? `<div class="muted" style="text-align:center;font-size:13px;max-width:60ch;margin:6px auto 0" ${on({ at: 1 })}>${escape(v.note)}</div>` : ''}`,
  shapes: (v) => { const top = Math.max(...v.shapes.map((s) => s.cascade)); return `<div class="df-shapes">${v.shapes.map((s, i) => `<div class="col" ${on({ at: 0, delay: i * 0.3, hi: s.chosen ? 2 : undefined, dim: s.chosen ? undefined : 2.4 })}><div class="pillar" ${on({ at: 1, delay: i * 0.2, grow: s.cascade / top })} data-axis="y"></div><div class="n" ${on({ at: 1, delay: 0.6 + i * 0.2 })}>${s.cascade}</div><div>${escape(s.shape)}</div></div>`).join('')}</div><div class="muted" style="text-align:center;font-size:12.5px" ${on({ at: 1, delay: 1 })}>earlier moments the reveal recalls</div>`; },
  cascade: (v) => {
    const n = v.beats.length, W = 640, x = (i) => 20 + (i * (W - 40)) / (n - 1), y = 150;
    const arcs = v.cues.map((c, k) => { const h = 30 + (c.to - c.from) * 9 + k * 4; return `<path d="M${x(c.from)} ${y - 8}C${x(c.from)} ${y - h} ${x(c.to)} ${y - h} ${x(c.to)} ${y - 8}" fill="none" stroke="var(--ph)" stroke-width="2" stroke-linecap="round" pathLength="1" ${on({ at: 1, delay: k * 0.35, grow: 1 })} data-axis="draw"/>`; }).join('');
    const dots = v.beats.map((b, i) => `<circle cx="${x(i)}" cy="${y}" r="${i === v.reveal ? 9 : 5}" fill="${i === v.reveal ? 'var(--ph)' : 'var(--ground)'}" stroke="var(--ph)" stroke-width="2" ${on({ at: 0, delay: i * 0.12 })}/>`).join('');
    const star = `<g ${on({ at: 2 })}><text x="${x(v.reveal)}" y="${y + 30}" style="fill:var(--ph);font-weight:700">reveal</text></g>`;
    return `<svg class="df-svg" viewBox="0 0 ${W} 200" aria-label="Beats with cues planted early and recalled at the reveal">${arcs}${dots}${star}</svg><div class="df-chips">${v.cues.map((c, k) => `<span ${on({ at: 1, delay: k * 0.35 })}>${escape(c.cue)}</span>`).join('')}</div>`;
  },
  draft: (v) => `<div class="df-draft"><div class="df-strips">${v.sections.map((_, i) => `<i ${on({ at: 0, delay: i * 0.12 })}></i>`).join('')}</div><div class="df-type" ${on({ at: 1, type: 1 })} data-text="${escape(v.opening)}"></div></div>`,
  revise: (v) => `<div class="df-revise"><div class="df-counts">${v.counts.map(([k, n], i) => `<div class="df-box" ${on({ at: 0, delay: i * 0.3 })}><b>${n}</b>${escape(k)}</div>`).join('')}</div><div class="muted" style="font-size:13px" ${on({ at: 1 })}>${icon('review', { size: 14 })} ${escape(v.problem)}</div><div class="df-line old" ${on({ at: 1, delay: 0.6, hi: 2 })}>${escape(v.before)}</div><div class="df-line new" ${on({ at: 2, delay: 0.5, type: 2 })} data-text="${escape(v.after)}"></div></div>`,
  titles: (v) => `<div class="df-titles">${v.titles.map((t, i) => `<div ${on({ at: 0, delay: i * 0.18, hi: t === v.chosen ? 0.7 : undefined, dim: t === v.chosen ? undefined : 0.7 })}>${escape(t)}</div>`).join('')}</div>`,
  landing: (v) => `<div class="df-landing">${v.readings.map((r, i) => `<div ${on({ at: i < 2 ? 1 : 2, delay: (i % 2) * 0.8 })}><div class="who">${icon(r.aha > 0 ? 'star' : 'question', { colour: r.aha > 0 ? 'hsl(42 90% 48%)' : 'hsl(356 70% 52%)' })}${escape(r.level)}: ${r.aha > 0 ? `lands in section ${r.aha}${r.leaks ? ', seen coming' : ''}` : 'no eureka'}</div><div class="strip">${Array.from({ length: r.of }, (_, k) => `<i class="${k + 1 === r.aha ? 'aha' : ''}"></i>`).join('')}</div><div class="why">${escape(r.why)}</div></div>`).join('')}</div>`,
  pairs: (v) => `<div class="df-row">${v.worlds.map((w, i) => `<div class="df-box" ${on({ at: 0, delay: i * 0.3, hi: w.chosen ? 1 : undefined, dim: w.chosen ? undefined : 1, out: w.chosen ? undefined : 2 })}><div class="h">${icon(w.strategy === 'kingdom' ? 'kingdom' : 'fable')}${escape(w.strategy.replace(/-/g, ' '))}</div>${escape(w.premise)}</div>`).join('')}</div><div class="df-pairs">${v.pairs.map((p, i) => `<div class="df-pair" ${on({ at: 1.4, delay: i * 0.6 })}><span class="muted">${escape(p.real)}</span>${icon('thread')}<span>${escape(p.story)}</span></div>`).join('')}</div>`,
  banned: (v, seed) => `<div class="df-banned">${v.words.map((w, i) => `<span ${on({ at: 0, delay: i * 0.12 + randomAt(seed, i, 6) * 0.2, hi: 0.8 + i * 0.05 })}>${escape(w)}</span>`).join('')}</div>`,
  plot: (v) => `<div class="df-plot">${v.scenes.map((s, i) => `<span ${on({ at: 0, delay: i * 0.2 })}>${i + 1}. ${escape(s)}</span>`).join('')}</div><div class="df-big" ${on({ at: 2, type: 2 })} data-text="${escape(v.punchline)}"></div>`,
  notes: (v) => `<div class="df-list">${v.notes.map((n, i) => `<div class="df-item" style="grid-template-columns:auto 1fr" ${on({ at: 0, delay: i * 0.4 })}><span class="k">${escape(n.severity)}</span><span>${escape(n.text)}</span></div>`).join('')}</div>`,
  list: (v) => `<div class="df-list">${v.items.map((t, i) => `<div class="df-item" style="grid-template-columns:auto 1fr" ${on({ at: 0, delay: i * 0.4 })}><span class="k">o${i + 1}</span><span>${escape(t)}</span></div>`).join('')}</div>`,
  topics: (v) => `<div class="df-topics">${v.topics.map((t, i) => `<div class="df-box" ${on({ at: 0, delay: i * 0.3 })}><div class="h" style="font-size:12.5px">${escape(t.topic)}</div>${t.seeds.map((s, k) => `<div class="s" ${on({ at: 1, delay: k * 0.1 + i * 0.15, hi: s.chosen ? 1.6 : undefined, dim: s.chosen ? undefined : 1.6 })}>${escape(s.name ?? s.id)}</div>`).join('')}</div>`).join('')}</div>`,
  filter: (v) => `<div class="df-big left" style="margin:0 auto" ${on({ at: 1, type: 1 })} data-text="${escape(v.line)}"></div><div class="df-chips">${v.decisions.map((d, i) => `<span class="${d.keep ? '' : 'cut'}" ${on({ at: 0, delay: i * 0.15, hi: d.keep ? undefined : 2, dim: d.keep ? undefined : 2.2 })}>${escape(d.item)}</span>`).join('')}</div><div class="muted" style="text-align:center;font-size:13px" ${on({ at: 2, delay: 0.6 })}>kept ${v.kept} of ${v.of}</div>`,
  chapters: (v) => `<div class="df-chapters">${v.chapters.map((c, i) => `<div class="df-box" ${on({ at: 0, delay: i * 0.5 })}><div class="h">${icon('series', { size: 14 })}${i + 1}. ${escape(c.id)}</div><span class="muted">${escape(c.handOff)}</span></div>`).join('')}</div>`,
};

export default async function designFilm(stage, ctx) {
  css('design-film', CSS);
  let form = 'explainer';
  stage.innerHTML = `<div class="df"><div class="df-top"><div class="df-forms" role="group" aria-label="Form">${FORMS.map(([id, label]) => `<button type="button" data-form="${id}" aria-pressed="${id === form}">${icon(id, { size: 14 })}${label}</button>`).join('')}</div><span class="df-about"></span></div><div class="df-screen"><div class="df-chain" aria-label="What the brief has become so far"></div><div class="df-stage"></div></div><div class="df-cap" aria-live="polite"></div><div class="df-bar"><button type="button" class="df-play" aria-label="Play">${PLAY}</button><div class="df-seek" role="slider" tabindex="0" aria-label="Film position"></div><span class="df-time"></span></div></div>`;
  const root = stage.querySelector('.df'), about = stage.querySelector('.df-about'), chain = stage.querySelector('.df-chain'), view = stage.querySelector('.df-stage'), cap = stage.querySelector('.df-cap'), playButton = stage.querySelector('.df-play'), seekBar = stage.querySelector('.df-seek'), clock = stage.querySelector('.df-time');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => Boolean(ctx.still || media.matches);
  const phaseColour = (phase) => toHex(hsla(PHASE_HUE[phase] ?? 212, 58, ctx.dark() ? 66 : 46)).slice(0, 7);

  let film, timeline, player = null, current = -1, nodes = [];

  /** Lay the film's scenes end to end: each is a title card, then its caption beats. */
  function build() {
    film = FILMS[form];
    let start = 0;
    timeline = film.scenes.map((s, i) => {
      const b = beats(s.beats, { lead: TITLE_CARD, tail: 1.2 });
      const entry = { scene: s, index: i, start, b, duration: b.duration, colour: phaseColour(s.phase) };
      start += b.duration;
      return entry;
    });
    const total = start;
    about.innerHTML = `${icon(film.topic)}<b>${escape(film.topic)}</b> · ${film.scenes.length} stages · <span>${escape(film.title)}</span>`;
    seekBar.innerHTML = timeline.map((t) => `<i style="flex:${t.duration};--ph:${t.colour}" title="${escape(t.scene.title)}"><b></b></i>`).join('');
    chain.innerHTML = '';
    current = -1;
    player?.dispose?.();
    const clockScene = scene({ width: 16, height: 9, duration: total, label: `How ExplainerKit designs ${film.form === 'series' ? 'a series' : `an ${film.form}`}: ${film.title}` });
    player = createProjectionPlayer(clockScene, { project: (_, context) => render(context.time), reducedMotion: still() });
    player.on('play', syncButton);
    player.on('pause', syncButton);
    render(0);
    syncButton();
  }

  const at = (entry, beat) => (beat < 0 ? 0 : entry.b.at(Math.min(beat, entry.b.lines.length - 0.001)));

  /** Draw the scene at film time `t`. Everything is a function of time, so any seek lands on the same frame. */
  function render(t) {
    const total = timeline.at(-1).start + timeline.at(-1).duration;
    t = Math.max(0, Math.min(total, t));
    const k = Math.max(0, timeline.findIndex((x) => t < x.start + x.duration) === -1 ? timeline.length - 1 : timeline.findIndex((x) => t < x.start + x.duration));
    const entry = timeline[k], local = t - entry.start, s = entry.scene;
    if (k !== current) {
      current = k;
      root.style.setProperty('--ph', entry.colour);
      view.innerHTML = `<div class="df-card"><div><div class="p">${escape(s.phase)}</div><div class="t">${icon(s.icon, { size: 30 })}${escape(s.title)}</div></div></div><div class="df-view">${VIEWS[s.view.type](s.view, 7 + k * 31)}</div>${s.note ? `<div class="df-note">${escape(s.note)}</div>` : ''}`;
      nodes = [...view.querySelectorAll('[data-in]')].map((el) => ({ el, at: Number(el.dataset.in), delay: Number(el.dataset.delay ?? 0), out: el.dataset.out, hi: el.dataset.hi, dim: el.dataset.dim, type: el.dataset.type, grow: el.dataset.grow, axis: el.dataset.axis, text: el.dataset.text ?? '' }));
    }
    const instant = still();
    // The title card, then the view.
    const card = view.querySelector('.df-card'), body = view.querySelector('.df-view');
    const cardOut = clamp((local - (TITLE_CARD - 0.5)) / 0.5), cardIn = instant ? 1 : clamp(local / 0.5);
    card.style.opacity = String(cardIn * (1 - cardOut));
    card.style.transform = `translateY(${(-10 * cardOut).toFixed(1)}px)`;
    body.style.opacity = String(clamp((local - TITLE_CARD + 0.3) / 0.4));
    for (const n of nodes) {
      const start = at(entry, n.at) + n.delay;
      const p = instant ? (local >= start ? 1 : 0) : ease.easeOut(clamp((local - start) / ENTER));
      const q = n.out !== undefined ? clamp((local - at(entry, Number(n.out))) / 0.4) : 0;
      const d = n.dim !== undefined ? ease.easeInOut(clamp((local - at(entry, Number(n.dim))) / 0.6)) : 0;
      const opacity = p * (1 - q) * (1 - 0.7 * d);
      if (n.grow !== undefined) {
        const v = Number(n.grow) * p;
        if (n.axis === 'draw') { n.el.style.strokeDasharray = '1'; n.el.style.strokeDashoffset = String(1 - v); n.el.style.opacity = String(p > 0 ? 1 - 0.7 * d : 0); }
        else if (n.axis === 'y') n.el.style.height = `${(v * 100).toFixed(1)}%`;
        else n.el.style.width = `${(v * 100).toFixed(1)}%`;
        continue;
      }
      n.el.style.opacity = opacity.toFixed(3);
      const base = n.el.dataset.base ?? (n.el.dataset.base = n.el.style.transform || '');
      n.el.style.transform = `${base} translateY(${((1 - p) * 10).toFixed(1)}px)`.trim();
      n.el.style.filter = p < 1 ? `blur(${((1 - p) * 4).toFixed(1)}px)` : '';
      if (n.hi !== undefined) n.el.classList.toggle('hi', local >= at(entry, Number(n.hi)));
      if (n.type !== undefined) {
        const from = at(entry, n.at) + n.delay, beat = Math.floor(Number(n.type)), span = (at(entry, beat + 1) - at(entry, beat)) * 0.85 - n.delay;
        const shown = instant ? n.text.length : Math.round(n.text.length * clamp((local - from) / Math.max(0.5, span)));
        const typing = shown > 0 && shown < n.text.length;
        n.el.innerHTML = `${escape(n.text.slice(0, shown))}${typing ? '<span class="caret"></span>' : ''}`;
      }
    }
    // Caption, chain of results so far, seek bar and clock.
    const beat = entry.b.index(local);
    cap.textContent = beat >= 0 ? entry.b.lines[beat] : '';
    chain.innerHTML = timeline.slice(0, k + 1).map((x, i) => {
      const done = i < k || local >= at(entry, entry.b.lines.length - 1);
      return done ? `${i ? '<span class="arrow"></span>' : ''}<button type="button" data-seek="${i}" class="${i === k ? 'now' : ''}" style="--ph:${x.colour}">${icon(x.scene.icon, { size: 12, colour: x.colour })}${escape(x.scene.token)}</button>` : '';
    }).join('');
    chain.scrollLeft = chain.scrollWidth;
    seekBar.querySelectorAll('i').forEach((el, i) => {
      const x = timeline[i];
      el.firstChild.style.width = `${(clamp((t - x.start) / x.duration) * 100).toFixed(1)}%`;
    });
    seekBar.setAttribute('aria-valuenow', String(Math.round(t)));
    seekBar.setAttribute('aria-valuetext', `${s.title}, ${fmt(t)} of ${fmt(total)}`);
    clock.textContent = `${fmt(t)} / ${fmt(total)}`;
    if (player && player.playing && t >= total) player.pause();
  }

  function syncButton() {
    const playing = Boolean(player?.playing);
    playButton.innerHTML = playing ? PAUSE : PLAY;
    playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  const total = () => timeline.at(-1).start + timeline.at(-1).duration;
  const seekTo = (t) => { player.seek(Math.max(0, Math.min(total(), t))); render(player.time); };
  const events = new AbortController(), signal = events.signal;
  playButton.addEventListener('click', () => {
    if (player.playing) player.pause();
    else { if (player.time >= total() - 0.05) seekTo(0); player.play(); }
  }, { signal });
  const fromPointer = (e) => {
    const r = seekBar.getBoundingClientRect();
    seekTo(clamp((e.clientX - r.left) / r.width) * total());
  };
  seekBar.addEventListener('pointerdown', (e) => { seekBar.setPointerCapture(e.pointerId); fromPointer(e); }, { signal });
  seekBar.addEventListener('pointermove', (e) => { if (seekBar.hasPointerCapture(e.pointerId)) fromPointer(e); }, { signal });
  seekBar.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? null : 5;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      if (step) seekTo(player.time + dir * step);
      else seekTo(timeline[Math.max(0, Math.min(timeline.length - 1, current + dir))].start);
    } else if (e.key === ' ') { e.preventDefault(); playButton.click(); }
  }, { signal });
  chain.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seek]');
    if (b) { player.pause(); seekTo(timeline[Number(b.dataset.seek)].start + TITLE_CARD); }
  }, { signal });
  view.addEventListener('click', (e) => { if (e.target.closest('a') && player.playing) player.pause(); }, { signal });
  stage.querySelector('.df-forms').addEventListener('click', (e) => {
    const b = e.target.closest('[data-form]');
    if (!b || b.dataset.form === form) return;
    form = b.dataset.form;
    stage.querySelectorAll('[data-form]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    player.pause();
    build();
  }, { signal });
  const observer = new IntersectionObserver((entries) => { if (!entries[0]?.isIntersecting) player?.pause(); });
  observer.observe(stage);
  document.addEventListener('visibilitychange', () => { if (document.hidden) player?.pause(); }, { signal });
  const offTheme = ctx.onTheme(() => {
    for (const x of timeline) x.colour = phaseColour(x.scene.phase);
    current = -1;
    seekBar.querySelectorAll('i').forEach((el, i) => el.style.setProperty('--ph', timeline[i].colour));
    render(player.time);
  });
  build();
  return () => { events.abort(); observer.disconnect(); offTheme(); player?.dispose?.(); };
}
