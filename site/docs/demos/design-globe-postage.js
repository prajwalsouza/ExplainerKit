import {scene} from '../../runtime/src/core/index.js';
import {perspectiveCamera} from '../../runtime/src/spatial/index.js';
import {createSVGRenderer} from '../../runtime/src/renderers/svg.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {css} from './_kit.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const CSS = `
.ek-postage-panels { position: absolute; inset: 8% 7% auto; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8%; pointer-events: none; }
.ek-postage-panels div { aspect-ratio: 230 / 152; }
.ek-study-picture .ek-postage-panels :is(svg,canvas) { position: static; display: block; width: 100%; height: auto; border-radius: 0; }
`;
const WIDTH = 230;
const HEIGHT = 152;

export default function globePostage(stage, ctx) {
  css('design-globe-postage', CSS);
  const flap = {name: 'envelope flap along the mail slot', x: 78, y: 244, axis: 'x', minX: 78, maxX: 442};
  const drawing = scene({width: WIDTH, height: HEIGHT, duration: 1});
  const region = drawing.space({camera: perspectiveCamera({z: 260, fov: 49 * Math.PI / 180, near: 1, far: 1000}, {width: WIDTH, height: HEIGHT})});
  const grid = region.surface({mapping: 'equirectangular', radius: 41, wrap: 1, columns: 18, rows: 9, strokeWidth: 1.25, stroke: paintColor(188, 63, 42)});
  grid.to(0, {wrap: 0}, {duration: 1, ease: 'linear'});
  let renderers = [];
  const panels = document.createElement('div');
  panels.className = 'ek-postage-panels';
  panels.innerHTML = '<div data-postage-svg></div><div data-postage-canvas></div>';
  const disposeStudy = dragStudy(stage, ctx, {height: 279, handles: [flap], draw(g, {dark, ink}) {
    const paper = paintColor(39, 33, dark ? 23 : 92);
    const edge = paintColor(43, 28, dark ? 60 : 53, .65);
    for (const x of [36, 280]) {
      g.fillStyle = paper;
      g.strokeStyle = edge;
      g.setLineDash([3, 3]);
      g.beginPath();
      g.roundRect(x, 14, 204, 160, 12);
      g.fill();
      g.stroke();
      g.setLineDash([]);
    }
    label(g, 'SVG', 138, 194, ink, 18);
    label(g, 'Canvas', 382, 194, ink, 18);
    g.strokeStyle = edge;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(flap.minX, flap.y);
    g.lineTo(flap.maxX, flap.y);
    g.stroke();
    disc(g, flap.minX, flap.y, 2.5, edge);
    disc(g, flap.maxX, flap.y, 2.5, edge);
    g.fillStyle = paintColor(43, 67, 68);
    g.beginPath();
    g.roundRect(flap.x - 17, flap.y - 11, 34, 22, 3);
    g.fill();
    g.strokeStyle = paintColor(30, 43, 34);
    g.beginPath();
    g.moveTo(flap.x - 15, flap.y - 9);
    g.lineTo(flap.x, flap.y + 1);
    g.lineTo(flap.x + 15, flap.y - 9);
    g.stroke();
    const t = (flap.x - flap.minX) / (flap.maxX - flap.minX);
    if (renderers.length) {
      const frame = drawing.sample({time: t});
      for (const renderer of renderers) renderer.render(frame);
    }
    return `${Math.round(100 * t)}% of the way to a flat map. Both renderers receive the same frame.`;
  }});
  stage.querySelector('.ek-study-picture').append(panels);
  try {
    renderers = [
      createSVGRenderer(panels.firstElementChild, {label: 'Globe and map rendered by SVG'}),
      createCanvasRenderer(panels.lastElementChild, {pixelRatio: Math.min(devicePixelRatio || 1, 3), label: 'Globe and map rendered by Canvas'}),
    ];
    const frame = drawing.sample({time: 0});
    for (const renderer of renderers) renderer.render(frame);
  } catch (error) { for (const renderer of renderers) renderer.dispose(); disposeStudy(); throw error; }
  return () => { disposeStudy(); for (const renderer of renderers) renderer.dispose(); renderers = []; };
}
