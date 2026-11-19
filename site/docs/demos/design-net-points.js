import {hsla, toRGBA} from '../../runtime/src/color/index.js';
import {createWebGLRenderer, screenProjection} from '../../runtime/src/renderers/webgl.js';
import {disc, dragStudy, paintColor, WIDTH} from './design-stage.js';

const HEIGHT = 267;
const COUNT = 1250;
const angle = index => index * Math.PI * (3 - Math.sqrt(5));

export default function netPoints(stage, ctx) {
  const layer = document.createElement('div');
  Object.assign(layer.style, {position: 'absolute', inset: '0', pointerEvents: 'none'});
  let renderer;
  try {
    renderer = createWebGLRenderer(layer, {label: 'The point school and its indexed connections', maxPoints: COUNT, maxLines: 64, pixelRatio: Math.min(devicePixelRatio || 1, 2)});
  } catch (error) {
    if (error.code !== 'RENDER_UNSUPPORTED') throw error;
    stage.innerHTML = '<p role="status">This point school needs WebGL2, which is unavailable in this browser.</p>';
    return () => {};
  }
  const frame = {width: WIDTH, height: HEIGHT, positions: new Float32Array(3 * COUNT), colors: new Float32Array(4 * COUNT), indices: new Uint16Array(64 * 2), matrix: screenProjection(WIDTH, HEIGHT), pointSize: 4};
  const net = {name: 'landing net', x: 356, y: 126, minX: 46, maxX: 472, minY: 39, maxY: 223};
  for (let point = 0; point < COUNT; point++) {
    const r = Math.sqrt(point / COUNT);
    const x = 234 + 157 * Math.cos(angle(point)) * r;
    const y = 132 + 71 * Math.sin(angle(point)) * r + 15 * Math.sin(x * .014);
    frame.positions[3 * point] = x;
    frame.positions[3 * point + 1] = y;
  }
  for (let line = 0; line < 64; line++) {
    frame.indices[2 * line] = 9 * line + 40;
    frame.indices[2 * line + 1] = 9 * line + 43;
  }

  const disposeStudy = dragStudy(stage, ctx, {height: HEIGHT, handles: [net], draw(g, {dark}) {
    const water = g.createLinearGradient(0, 0, WIDTH, HEIGHT);
    water.addColorStop(0, paintColor(184, 49, dark ? 18 : 92));
    water.addColorStop(1, paintColor(218, 58, dark ? 10 : 81));
    g.fillStyle = water;
    g.fillRect(0, 0, WIDTH, HEIGHT);
    const edge = paintColor(32, 61, dark ? 67 : 40);
    g.strokeStyle = edge;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(net.x, net.y, 42, 0, Math.PI * 2);
    g.moveTo(net.x + 29, net.y + 30);
    g.lineTo(net.x + 55, net.y + 57);
    g.stroke();
    disc(g, net.x, net.y, 5, edge);
    if (renderer.lost) return 'The graphics context was lost. The demo is waiting for the browser to restore it.';
    const fish = toRGBA(hsla(195, 58, dark ? 72 : 39, .66));
    const caught = toRGBA(hsla(39, 90, dark ? 70 : 44, .92));
    let count = 0;
    for (let point = 0; point < COUNT; point++) {
      const x = frame.positions[point * 3];
      const y = frame.positions[point * 3 + 1];
      const inside = (x - net.x) ** 2 + (y - net.y) ** 2 <= 42 ** 2;
      count += Number(inside);
      frame.colors.set(inside ? caught : fish, point * 4);
    }
    renderer.render(frame);
    return `${count} of ${COUNT.toLocaleString('en-US')} points in the net. The renderer draws the points and 64 indexed lines from typed buffers.`;
  }});
  stage.querySelector('.ek-study-picture').append(layer);
  return () => { disposeStudy(); renderer.dispose(); };
}
