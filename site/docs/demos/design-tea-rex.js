import {scene} from '../../runtime/src/core/index.js';
import {importSVG} from '../../runtime/src/import/svg.js';
import {createSVGRenderer} from '../../runtime/src/renderers/svg.js';
import {paintColor} from './design-stage.js';
import {css} from './_kit.js';

const teaRex = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="245" viewBox="0 0 500 245">
  <path id="handle" d="M215 99 C143 59 130 139 203 145" fill="none" stroke="${paintColor(97, 44, 34)}" stroke-width="19" stroke-linecap="round"/>
  <path id="spout" d="M276 104 C319 84 320 74 322 47 L394 47 Q406 51 404 62 Q401 83 326 90 L304 139 Z" fill="${paintColor(94, 49, 45)}"/>
  <path d="M220 159 L207 200 L240 200 L250 165 M269 163 L269 200 L307 200 L299 157" fill="${paintColor(97, 44, 34)}"/>
  <ellipse id="pot" cx="256" cy="129" rx="62" ry="48" fill="${paintColor(99, 43, 53)}"/>
  <path id="lid" d="M202 93 Q257 54 309 92 Q258 104 202 93 Z" fill="${paintColor(45, 80, 69)}"/>
  <circle cx="361" cy="61" r="4" fill="${paintColor(99, 25, 18)}"/>
  <path d="M373 71 Q380 77 389 70" stroke="${paintColor(99, 25, 18)}" stroke-width="2" fill="none"/>
</svg>`;

const CSS = `
.ek-tea-rex { border: 1px solid var(--line); border-radius: 16px; background: var(--panel); }
.ek-tea-art svg { display: block; width: 100%; height: auto; }
.ek-tea-controls { display: flex; justify-content: center; gap: .5rem; flex-wrap: wrap; padding: 0 .6rem; }
.ek-tea-controls button { font: inherit; background: var(--ground); color: var(--ink); border: 1px solid var(--line); border-radius: 999px; padding: .35rem .85rem; cursor: pointer; }
.ek-tea-controls button[aria-pressed="true"] { border-color: currentColor; }
.ek-tea-status { text-align: center; min-height: 2.5rem; margin: .6rem; font-size: .875rem; }
`;

export default function importedTeaRex(stage) {
  css('design-tea-rex', CSS);
  stage.innerHTML = '<div class="ek-tea-rex"><div class="ek-tea-art"></div><div class="ek-tea-controls" aria-label="Imported SVG parts"></div><p class="ek-tea-status" role="status">Choose a part of Tea Rex.</p></div>';
  const drawing = scene({width: 500, height: 245, label: 'Tea Rex, a dinosaur teapot'});
  const asset = importSVG(teaRex);
  const teapot = drawing.instance(drawing.component(asset.blueprint));
  const renderer = createSVGRenderer(stage.querySelector('.ek-tea-art'));
  const controls = stage.querySelector('.ek-tea-controls');
  const status = stage.querySelector('p');
  const events = new AbortController();
  const parts = new Map(['handle', 'pot', 'lid', 'spout'].map(id => [id, teapot.part(asset.parts.find(entry => entry.id === id).path)]));
  let selected = null;
  for (const id of parts.keys()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = id;
    button.dataset.part = id;
    button.setAttribute('aria-pressed', 'false');
    controls.append(button);
  }
  controls.addEventListener('click', event => {
    const id = event.target.dataset.part;
    if (!parts.has(id)) return;
    selected = selected === id ? null : id;
    for (const [name, part] of parts) part.set({opacity: selected === null || name === selected ? 1 : .25});
    for (const button of controls.children) button.setAttribute('aria-pressed', String(button.dataset.part === selected));
    status.textContent = selected ? `The importer kept “${selected}” as an editable scene part.` : 'All imported parts are visible.';
    renderer.render(drawing.sample());
  }, {signal: events.signal});
  renderer.render(drawing.sample());
  return () => { events.abort(); renderer.dispose(); };
}
