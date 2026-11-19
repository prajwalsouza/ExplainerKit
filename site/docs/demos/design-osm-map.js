import {hsla, toHex} from '../../runtime/src/color/index.js';
import {parseOverpass} from '../../runtime/src/maps/osm.js';
import {css} from './_kit.js';
import {cityMapURL, featuredPlaces} from './design-city-places.js';

const CSS = `
.ek-osm { overflow: hidden; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); }
.ek-osm [role=group] { display: flex; flex-wrap: wrap; gap: .4rem; padding: .75rem 1rem; }
.ek-osm button { min-height: 2.4rem; padding: .25rem .65rem; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); background: var(--ground); font: inherit; cursor: pointer; }
.ek-osm button[aria-pressed=true] { background: var(--ink); color: var(--ground); }
.ek-osm canvas { display: block; width: 100%; height: auto; max-height: 520px; background: var(--ground); }
.ek-osm-example { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem 1.1rem; padding: .75rem 1rem; }
.ek-osm-example strong { grid-column: 1 / -1; }
.ek-osm-example dl { margin: 0; }
.ek-osm dt { font-size: .82rem; color: var(--muted); }
.ek-osm dd { margin: 0; overflow-wrap: anywhere; font-family: var(--mono); font-size: .85rem; }
.ek-osm-credit { margin: 0; padding: 0 1rem .75rem; color: var(--muted); font-size: .85rem; }
@media (max-width: 480px) { .ek-osm-example { grid-template-columns: 1fr; } }
`;

const examples = [
  {group: 'buildings', label: 'Building footprint', id: 19741083, type: 'way', tags: ['building'],
    describe: (feature) => `ring · ${feature.ring.length} points · ${measurement(feature, 'height')}`},
  {group: 'roads', label: 'Road centerline', id: 20444537, type: 'way', tags: ['highway', 'bridge'],
    describe: (feature) => `points.length=${feature.points.length} · ${measurement(feature, 'width')}`},
  {group: 'water', label: 'Water polygon', id: 2191006, type: 'relation', tags: ['natural', 'water'],
    describe: (feature) => `ring · ${feature.ring.length} points · kind=${feature.kind}`},
];

function measurement(feature, key) {
  return `${key} ${feature[key]} m${feature.inferred.includes(key) ? ' (inferred)' : ''}`;
}

const ink = (h, s, l) => toHex(hsla(h, s, l), {alpha: 'never'});
const palette = {
  light: {land: ink(41, 30, 95), buildings: ink(31, 18, 70), roads: ink(32, 13, 53), water: ink(194, 40, 74), active: ink(15, 75, 42)},
  dark: {land: ink(34, 13, 16), buildings: ink(32, 13, 41), roads: ink(38, 12, 57), water: ink(198, 47, 32), active: ink(33, 86, 69)},
};

function featurePath(feature, project) {
  const path = new Path2D();
  const outline = (points, closed) => {
    path.moveTo(...project(points[0]));
    for (let i = 1; i < points.length; i++) path.lineTo(...project(points[i]));
    if (closed) path.closePath();
  };
  if (feature.points) outline(feature.points, false);
  else {
    outline(feature.ring, true);
    for (const hole of feature.holes ?? []) outline(hole, true);
  }
  return path;
}

export default async function osmMap(stage, {dark, onTheme}) {
  const place = featuredPlaces.find(({id}) => id === 'paris');
  let source;
  try {
    const response = await fetch(cityMapURL(place), {signal: AbortSignal.timeout(10_000)});
    if (!response.ok) throw Error('Map extract unavailable.');
    source = await response.text();
  } catch {
    stage.textContent = 'The Paris map extract could not be loaded. Reload the page to try again.';
    return;
  }
  const osm = parseOverpass(source, {bbox: place.bbox, include: ['buildings', 'roads', 'water']});
  const {elements} = JSON.parse(source);
  const width = 690, height = 420, scale = width / (osm.bbox.x1 - osm.bbox.x0);
  const centerY = -52;
  const project = ({x, y}) => [width / 2 + x * scale, height / 2 - (y - centerY) * scale];
  const layers = Object.fromEntries(
    ['water', 'buildings', 'roads'].map(group => [group, osm[group].map(feature => featurePath(feature, project))]),
  );
  const choices = examples.map(example => {
    const feature = osm[example.group].find(({id}) => id === example.id);
    const entry = elements.find(({id, type}) => id === example.id && type === example.type);
    return {
      ...example,
      feature,
      path: featurePath(feature, project),
      input: example.tags.map(tag => `${tag}=${entry.tags[tag]}`).join(' · '),
    };
  });

  css('design-osm-map', CSS);
  stage.innerHTML = `<div class="ek-osm">
    <div role="group" aria-label="Map features"></div>
    <canvas width="${width}" height="${height}" role="img"></canvas>
    <div class="ek-osm-example" aria-live="polite">
      <strong></strong>
      <dl><dt>OpenStreetMap tags</dt><dd data-input></dd></dl>
      <dl><dt>Parsed feature</dt><dd data-output></dd></dl>
    </div>
    <p class="ek-osm-credit"><a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a></p>
  </div>`;
  const canvas = stage.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const group = stage.querySelector('[role="group"]');
  const title = stage.querySelector('strong');
  const input = stage.querySelector('[data-input]');
  const output = stage.querySelector('[data-output]');
  const events = new AbortController();
  let selected = 0;

  function draw() {
    const colors = dark() ? palette.dark : palette.light;
    ctx.fillStyle = colors.land;
    ctx.fillRect(0, 0, width, height);
    for (const group of ['water', 'buildings']) {
      ctx.fillStyle = colors[group];
      for (const path of layers[group]) ctx.fill(path, 'evenodd');
    }
    ctx.strokeStyle = colors.roads;
    ctx.lineWidth = .8;
    for (const path of layers.roads) ctx.stroke(path);
    ctx.strokeStyle = colors.active;
    ctx.lineWidth = 2.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const {path, group, feature} = choices[selected];
    if (group === 'buildings') {
      ctx.fillStyle = colors.active;
      ctx.fill(path, 'evenodd');
    }
    ctx.stroke(path);
    canvas.setAttribute('aria-label', `A north-up map of Île de la Cité highlighting ${feature.name}`);
  }

  const buttons = choices.map((choice, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = choice.label;
    button.addEventListener('click', () => select(index), {signal: events.signal});
    group.append(button);
    return button;
  });

  function select(index) {
    selected = index;
    const choice = choices[index];
    title.textContent = choice.feature.name;
    input.textContent = choice.input;
    output.textContent = choice.describe(choice.feature);
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    draw();
  }

  select(0);
  const untheme = onTheme(draw);
  return () => { events.abort(); untheme(); };
}
