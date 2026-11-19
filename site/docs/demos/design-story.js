// Static HTML is also rendered by the documentation build, so the walkthrough
// remains readable without JavaScript. ExplainerKit owns scrolling, timing,
// step placement, smoothing and beat navigation for the enhanced presentation.
import {hsla, toHex} from '../../runtime/src/color/index.js';
import {attachStory} from '../../runtime/src/story/index.js';
import FILMS from './design-film-data.js';
import {FILM_CSS, VIEWS, mountDesignFilm} from './design-film.js';
import {css} from './_kit.js';

const escape = value => String(value).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const FORMS = [['fable', 'Fable'], ['explainer', 'Explainer'], ['series', 'Series']];
const READINGS = {fable: 'fable-ledger', explainer: 'explainer-colour', series: 'series-sound'};
const HUES = {discover: 212, research: 262, shape: 168, write: 22, refine: 340};

export const STORY_CSS = `${FILM_CSS}
figure.demo[data-demo="design-story"] { grid-template-columns: minmax(0, 1fr); }
figure.demo[data-demo="design-story"] > .stage { min-width: 0; }
.ds { min-width: 0; }
.ds-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 18px; }
.ds-tabs button { font: 600 14px var(--sans); padding: 10px 18px; border: 1px solid var(--line); border-radius: 24px; color: var(--ink); background: var(--ground); cursor: pointer; }
.ds-tabs button[aria-pressed="true"] { background: var(--ink); color: var(--ground); border-color: var(--ink); }
.ds-form > summary { cursor: pointer; font: 600 20px var(--display); padding: 18px 0; list-style: none; }
.ds-form > summary::-webkit-details-marker { display: none; }
.ds-form > summary::before { content: ''; display: inline-block; width: 8px; height: 8px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); margin-right: 14px; }
.ds-form[open] > summary::before { transform: rotate(45deg); }
.ds.enhanced .ds-form > summary { display: none; }
.ds-intro { margin-bottom: 22px; }
.ds-intro h3 { margin: 0 0 8px; font: 650 clamp(24px, 3vw, 32px)/1.2 var(--display); }
.ds-intro p { margin: 0 0 12px; }
.ds-beats { position: sticky; top: 12px; z-index: 3; background: var(--ground); border-block: 1px solid var(--line); padding: 10px 0; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: thin; }
.ds-beats a { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; padding: 8px 10px; color: var(--muted); font-size: 12px; text-decoration: none; border-radius: 5px; }
.ds-beats a[aria-current="step"] { color: var(--ink); background: var(--code-bg); font-weight: 650; }
.ds-step { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.6fr); gap: clamp(24px, 4vw, 48px); align-items: start; min-height: 68vh; padding: 48px 0 64px; border-bottom: 1px solid var(--line); scroll-margin-top: 92px; }
.ds-copy { padding-top: 12px; }
.ds-copy .ds-number { font: 600 12px var(--mono); color: var(--muted); }
.ds-copy h4 { font: 650 23px/1.2 var(--display); margin: 10px 0 20px; }
.ds-copy p { font-size: 15px; line-height: 1.7; margin: 0 0 22px; }
.ds-copy .ds-note { font-size: 12px; color: var(--muted); }
.ds-snapshot { position: sticky; top: 92px; container-type: inline-size; min-width: 0; padding: 22px 0; color: var(--ink); --ph: var(--phase-light); }
:root.dark .ds-snapshot { --ph: var(--phase-dark); }
.ds-snapshot > .dpf { display: grid; gap: 18px; }
.ds-snapshot .dpf-item { grid-template-columns: minmax(0, 1fr) 70px; padding-inline: 8px; }
.ds-snapshot .dpf-item .tagline { grid-column: 1 / -1; text-align: left; min-width: 0; }
.ds-snapshot .dpf-claims .dpf-item { grid-template-columns: 18px minmax(0, 1fr); }
.ds-snapshot .doms { grid-column: 2; justify-content: flex-start; }
.ds-snapshot .dpf-list { gap: 12px; }
.ds-snapshot .dpf-row, .ds-snapshot .dpf-topics, .ds-snapshot .dpf-chapters { grid-template-columns: 1fr; }
.ds-snapshot .dpf-counts { flex-wrap: wrap; }
.ds-snapshot .dpf-counts .dpf-box { min-width: 70px; }
.ds-snapshot .dpf-fields div { grid-template-columns: 65px minmax(0, 1fr); font-size: 15px; }
.ds-snapshot .dpf-fields div:first-child { font-size: 23px; }
.ds-snapshot .dpf [data-grow] { width: calc(var(--growth) * 100%); }
.ds-snapshot .tagline { display: flex; gap: 12px; }
.ds-snapshot .dpf [data-axis="y"] { width: auto; height: calc(var(--growth) * 100%); }
.ds-snapshot .dpf-item[data-hi], .ds-snapshot .dpf-box[data-hi] { box-shadow: inset 0 0 0 1px var(--ph); }
.ds-snapshot .dpf-titles [data-hi] { color: var(--ink); font-size: 23px; }
.ds-snapshot .dpf-line.old { text-decoration: line-through; }
.ds-snapshot .dpf-type { min-height: 0; font-size: 15px; }
.ds-end { padding: 24px 0; }
@media (max-width: 1100px) {
  .ds-step { grid-template-columns: 1fr; min-height: 0; gap: 8px; padding-block: 32px; }
  .ds-snapshot { position: static; padding: 0 0 12px; }
  .ds-copy p { max-width: 65ch; }
}
@media (max-width: 760px) { .ds-beats { top: 62px; } .ds-step { scroll-margin-top: 140px; } }
.ds-pin { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.6fr); column-gap: 32px; padding-top: 70px; background: var(--ground); }
.ds-pin > .ds-beats { grid-column: 1 / -1; position: static; margin-bottom: 20px; }
.ds-film { grid-column: 2; min-width: 0; container-type: inline-size; }
.ds-copy-panel { grid-column: 1; grid-row: 2; display: grid; align-content: start; padding-top: 26px; }
.ds-film .dpf-top, .ds-film .dpf-chain, .ds-film .dpf-bar, .ds-film .dpf-read-stage { display: none; }
.ds-film .dpf-screen { background: transparent; border: 0; border-radius: 0; }
.ds-film .dpf-stage { height: clamp(330px, 49vh, 500px); }
.ds-film .dpf-cap { display: none; }
.ds-film .dpf-view { inset: 12px 10px 24px; }
.ds-film .dpf-item { grid-template-columns: minmax(0, 1fr) 65px; }
.ds-film .dpf-item .tagline { grid-column: 1 / -1; text-align: left; display: flex; gap: 12px; }
.ds-film .dpf-claims .dpf-item { grid-template-columns: 18px minmax(0, 1fr); }
.ds-film .dpf-claims .doms { grid-column: 2; justify-content: flex-start; }
.ds-film .dpf-fields div { grid-template-columns: 70px minmax(0, 1fr); font-size: 15px; }
.ds-film .dpf-counts { flex-wrap: wrap; }
.ds-film .dpf-counts .dpf-box { min-width: 70px; }
.ds-film .dpf-type { font-size: 15px; }
.ds.enhanced .ds-snapshot { display: none; }
.ds.enhanced .ds-step { display: block; grid-area: 1 / 1; min-height: 0; padding: 0; border: 0; opacity: 0; visibility: hidden; transition: opacity .25s; pointer-events: none; }
.ds.enhanced .ds-step.active { opacity: 1; visibility: visible; pointer-events: auto; }
@media (max-width: 1100px) {
  .ds-pin { display: block; }
  .ds-copy-panel { padding-top: 14px; max-height: 35vh; overflow-y: auto; }
  .ds-copy { padding-top: 0; }
  .ds-copy h4 { font-size: 19px; margin-block: 6px 10px; }
  .ds-copy p { font-size: 14px; margin-bottom: 10px; }
  .ds-film .dpf-stage { height: clamp(180px, 32vh, 330px); }
}
@media (prefers-reduced-motion: reduce) { .ds.enhanced .ds-step { transition: none; } }
`;

function snapshot(scene, index) {
  // These trusted view templates already escape all recorded strings. Keep the
  // complete text and final geometry instead of the film's typewriter timing.
  return VIEWS[scene.view.type](scene.view, 7 + index * 31)
    .replace(/data-text="([^"]*)"><\/div>/g, 'data-text="$1">$1</div>')
    .replace(/data-grow="([^"]*)"/g, 'data-grow="$1" style="--growth:$1"');
}

export function storyMarkup() {
  return `<div class="ds">${FORMS.map(([form, label]) => {
    const film = FILMS[form];
    return `<details class="ds-form" data-story-form="${form}" ${form === 'fable' ? 'open' : ''}><summary>${label}</summary>
      <header class="ds-intro"><h3>${escape(film.title)}</h3><p>${label} · ${escape(film.topic)} · ${film.scenes.length} stages</p><a href="design-reading-${READINGS[form]}.html">Read the complete ${form === 'fable' ? 'fable' : 'script'}</a> · <a href="#read-complete-examples">Browse all six examples</a></header>
      <nav class="ds-beats" aria-label="${label} story beats">${film.scenes.map((s, i) => `<a href="#run-${form}-${s.id}"><span>${String(i + 1).padStart(2, '0')}</span>${escape(s.title)}</a>`).join('')}</nav>
      ${film.scenes.map((s, i) => `<section class="ds-step" id="run-${form}-${s.id}" tabindex="-1"><div class="ds-copy"><span class="ds-number">${String(i + 1).padStart(2, '0')} / ${String(film.scenes.length).padStart(2, '0')} · ${escape(s.phase)}</span><h4>${escape(s.title)}</h4>${s.beats.map(b => `<p>${escape(b)}</p>`).join('')}${s.note ? `<p class="ds-note">${escape(s.note)}</p>` : ''}</div><div class="ds-snapshot" style="--phase-light:${toHex(hsla(HUES[s.phase], 58, 42))};--phase-dark:${toHex(hsla(HUES[s.phase], 58, 70))}"><div class="dpf">${snapshot(s, i)}</div></div></section>`).join('')}
      <p class="ds-end"><a href="design-reading-${READINGS[form]}.html">Continue to the complete ${form === 'fable' ? 'fable' : 'script'} →</a></p></details>`;
  }).join('')}</div>`;
}

export default function designStory(stage, ctx) {
  css('design-story', STORY_CSS);
  if (!stage.querySelector('.ds')) stage.innerHTML = storyMarkup();
  const root = stage.querySelector('.ds');
  const forms = [...root.querySelectorAll('.ds-form')];
  const events = new AbortController();
  const tabs = document.createElement('div');
  tabs.className = 'ds-tabs';
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Choose a recorded process');
  tabs.innerHTML = FORMS.map(([id, label]) => `<button type="button" data-story-select="${id}" aria-pressed="${id === 'fable'}">${label}</button>`).join('');
  root.prepend(tabs);
  root.classList.add('enhanced');
  let active = null;
  const detach = () => {
    if (!active) return;
    const {story, film, region, nav, steps} = active;
    story.dispose();
    film.dispose();
    steps.forEach(step => { step.inert = false; step.removeAttribute('aria-hidden'); step.classList.remove('active'); });
    region.before(nav, ...steps);
    region.remove();
    active = null;
  };
  const select = form => {
    if (active?.form === form) return;
    detach();
    forms.forEach(el => { el.open = el.dataset.storyForm === form; });
    tabs.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.storySelect === form)));
    const details = forms.find(el => el.dataset.storyForm === form);
    const nav = details.querySelector('.ds-beats');
    const steps = [...details.querySelectorAll('.ds-step')];
    const region = Object.assign(document.createElement('div'), {className: 'ds-region'});
    const pin = Object.assign(document.createElement('div'), {className: 'ds-pin'});
    const mount = Object.assign(document.createElement('div'), {className: 'ds-film'});
    const copy = Object.assign(document.createElement('div'), {className: 'ds-copy-panel'});
    nav.before(region);
    copy.append(...steps);
    pin.append(nav, mount, copy);
    region.append(pin);
    const film = mountDesignFilm(mount, ctx, {form, scroll: true});
    const acts = film.timeline.map((entry, i) => {
      steps[i].dataset.act = entry.scene.id;
      return {id: entry.scene.id, from: entry.start, to: entry.start + entry.duration,
        length: `${Math.max(120, entry.scene.beats.length * 45)}vh`,
        holds: [{at: entry.start + entry.duration - 1, length: '32vh'}]};
    });
    const story = attachStory(film.player, {
      element: region, sticky: pin, acts,
      smoothing: .18, snap: false, arrival: 'jump',
      onAct(id) {
        steps.forEach(step => {
          const current = step.dataset.act === id;
          step.classList.toggle('active', current);
          step.inert = !current;
          step.setAttribute('aria-hidden', String(!current));
        });
        nav.querySelectorAll('a').forEach(link => {
          if (link.hash === `#run-${form}-${id}`) link.setAttribute('aria-current', 'step');
          else link.removeAttribute('aria-current');
        });
      },
    });
    active = {form, story, film, region, nav, steps};
  };
  const followHash = () => {
    const target = document.getElementById(location.hash.slice(1));
    const form = target?.closest('.ds-form');
    if (!form || !root.contains(form)) return;
    select(form.dataset.storyForm);
    const index = active.steps.indexOf(target);
    if (index < 0) return;
    const entry = active.film.timeline[index];
    active.story.seekTime(entry.start + entry.duration - 1, {hold: 'center'});
    active.story.refresh();
    target.focus({preventScroll: true});
  };
  tabs.addEventListener('click', event => {
    const button = event.target.closest('[data-story-select]');
    if (button) select(button.dataset.storySelect);
  }, {signal: events.signal});
  root.addEventListener('click', event => {
    const link = event.target.closest('.ds-beats a');
    if (!link) return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    followHash();
  }, {signal: events.signal});
  addEventListener('hashchange', followHash, {signal: events.signal});
  let arrival;
  const arrive = () => { clearTimeout(arrival); arrival = setTimeout(followHash, 0); };
  addEventListener('pageshow', arrive, {signal: events.signal});
  select('fable');
  // Browser fragment restoration follows pageshow. Resolve the beat afterward.
  if (document.readyState === 'complete') arrive();
  return () => { clearTimeout(arrival); events.abort(); detach(); tabs.remove(); root.classList.remove('enhanced'); };
}
