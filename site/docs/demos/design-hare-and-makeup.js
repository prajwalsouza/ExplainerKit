import {scene} from '../../runtime/src/core/index.js';
import {importSVG} from '../../runtime/src/import/svg.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {colour, css, ground} from './_kit.js';

const WIDTH = 520;
const HEIGHT = 260;
const PARTS = [
  {id: 'Ears', label: 'ears', x: 259, y: 62, w: 112, h: 84},
  {id: 'Nose', label: 'nose', x: 260, y: 149, w: 52, h: 44},
  {id: 'Tie', label: 'bow tie', x: 260, y: 204, w: 104, h: 44},
];

const CSS = `
.ek-makeup-card { border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.ek-makeup-picture { position: relative; aspect-ratio: 520 / 260; }
.ek-makeup-picture canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; }
.ek-makeup-picture button { position: absolute; z-index: 1; transform: translate(-50%, -50%); border: 1px dashed transparent; border-radius: 14px; background: transparent; cursor: pointer; }
.ek-makeup-picture button:hover, .ek-makeup-picture button[aria-pressed="true"] { border-color: var(--ink); }
.ek-makeup-status { padding: .6rem 1rem .8rem; margin: 0; font-size: .875rem; }
`;

function rabbit(fur, lining, nose, tie) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 260">
    <g id="Ears" data-name="Rabbit ears">
      <path d="M240 120 C219 102 207 53 224 30 C245 17 256 69 257 109 Z" fill="${fur}"/>
      <path d="M266 111 C267 70 275 16 298 28 C316 48 299 99 283 121 Z" fill="${fur}"/>
      <ellipse cx="235" cy="60" rx="7" ry="21" fill="${lining}"/>
      <ellipse cx="286" cy="60" rx="7" ry="21" fill="${lining}"/>
    </g>
    <ellipse id="Face" cx="260" cy="144" rx="63" ry="47" fill="${fur}"/>
    <g id="Eyes" fill="#29232a"><circle cx="239" cy="136" r="4"/><circle cx="281" cy="136" r="4"/></g>
    <path id="Nose" d="M247 146 Q260 139 273 146 Q263 164 260 163 Q257 164 247 146 Z" fill="${nose}"/>
    <g id="Tie" data-name="Bow tie" fill="${tie}">
      <path d="M251 204 Q232 180 215 190 L215 219 Q236 224 253 210 Z"/>
      <path d="M268 204 Q289 180 306 190 L306 219 Q284 224 267 210 Z"/>
      <circle cx="260" cy="204" r="10"/>
    </g>
  </svg>`;
}

export default function hareAndMakeup(stage, ctx) {
  css('design-hare-and-makeup', CSS);
  stage.innerHTML = '<div class="ek-makeup-card"><div class="ek-makeup-picture"></div><p class="ek-makeup-status" role="status"></p></div>';
  const picture = stage.querySelector('.ek-makeup-picture');
  const status = stage.querySelector('.ek-makeup-status');
  const raw = rabbit(colour(ctx, -78, 36, 67), colour(ctx, 24, 47, 78), colour(ctx, 20, 61, 48), colour(ctx, 129, 41, 37));
  const asset = importSVG(raw);
  const drawing = scene({width: WIDTH, height: HEIGHT});
  const instance = drawing.instance(drawing.component(asset.blueprint));
  const renderer = createCanvasRenderer(picture, {label: 'A rabbit with separately editable ears, nose and bow tie'});
  const events = new AbortController();
  const paintTheme = () => { picture.style.background = ground(ctx); };
  const offTheme = ctx.onTheme(paintTheme);
  for (const {id, label, x, y, w, h} of PARTS) {
    const part = asset.parts.find(part => part.sourceId === id);
    const handle = instance.part(part.path);
    const button = document.createElement('button');
    let faded = false;
    button.type = 'button';
    button.setAttribute('aria-label', `Change the opacity of the ${label}`);
    button.setAttribute('aria-pressed', 'false');
    button.style.left = `${100 * x / WIDTH}%`;
    button.style.top = `${100 * y / HEIGHT}%`;
    button.style.width = `${100 * w / WIDTH}%`;
    button.style.height = `${100 * h / HEIGHT}%`;
    button.addEventListener('click', () => {
      faded = !faded;
      handle.set({opacity: faded ? .32 : 1});
      button.setAttribute('aria-pressed', String(faded));
      renderer.render(drawing.sample());
      status.textContent = `Opacity for the ${label} is now ${faded ? 32 : 100}%.`;
    }, {signal: events.signal});
    picture.append(button);
  }
  paintTheme();
  renderer.render(drawing.sample());
  status.textContent = 'Choose a part of the rabbit to change its opacity.';
  return () => {
    events.abort();
    offTheme();
    renderer.dispose();
  };
}
