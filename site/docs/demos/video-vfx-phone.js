import { scene } from '../../runtime/src/core/index.js';
import { hsla, toHex } from '../../runtime/src/color/index.js';
import { createCanvasRenderer } from '../../runtime/src/renderers/canvas.js';
import { compositeMatte, projectSurface } from '../../runtime/src/vfx/index.js';

const frameWidth = 640;
const frameHeight = 360;
const crop = { x: 130, y: 44, width: 290, height: 254 };
const tint = (h, s, l, a = 1) => toHex(hsla(h, s, l, a));

function buffer() {
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  return canvas.getContext('2d', { willReadFrequently: true });
}

export function phoneCard(output) {
  const model = scene({ width: frameWidth, height: frameHeight, label: 'An insert on the phone glass' });
  const renderer = createCanvasRenderer(document.createElement('div'), { points: 'cpu' });
  const panel = model.path({
    commands: [['M', 0, 0], ['L', 1, 0], ['L', 0, 1], ['Z']],
    fill: tint(176, 42, 13, 0.96),
  });
  const text = model.text({ text: 'EAST EXIT', fontSize: 11, fontWeight: 800, fill: tint(46, 73, 90) });
  const graphic = buffer();
  const footage = buffer();
  const context = output.getContext('2d');
  const image = context.createImageData(crop.width, crop.height);
  const coverage = new Uint8Array(crop.width * crop.height);
  function clear() {
    context.clearRect(0, 0, frameWidth, frameHeight);
  }
  function draw(video, glass, opacity, holdout, words) {
    const corner = (u, v) => projectSurface(glass, u, v);
    const [a, b, c, d] = [corner(.03,.76), corner(.98,.76), corner(.98,.93), corner(.03,.93)];
    const origin = corner(.17,.88);
    panel.set({ commands: [['M', a.x, a.y], ['L', b.x, b.y], ['L', c.x, c.y], ['L', d.x, d.y], ['Z']], opacity });
    text.set({ ...origin, rotation: Math.atan2(b.y - a.y, b.x - a.x), opacity, text: words });
    renderer.render(model.sample({ time: 0 }));
    graphic.clearRect(0, 0, crop.width, crop.height);
    graphic.drawImage(renderer.element, -crop.x, -crop.y);
    footage.drawImage(video, -crop.x, -crop.y, frameWidth, frameHeight);
    const source = footage.getImageData(0, 0, crop.width, crop.height).data;
    const insert = graphic.getImageData(0, 0, crop.width, crop.height).data;
    coverage.fill(0);
    if (holdout) {
      for (let i = 0; i < coverage.length; i++) {
        const at = i * 4;
        if (!insert[at + 3]) continue;
        // The glass in this clip is cool and bright. Use only the red-green
        // separation here, so dark keyboard marks remain under the insert.
        const warmth = source[at] - source[at + 1];
        const amount = Math.min(1, Math.max(0, (warmth - 17) / 31));
        coverage[i] = Math.round(255 * amount * amount * (3 - 2 * amount));
      }
    }
    image.data.set(compositeMatte({
      width: crop.width, height: crop.height, footage: source, insert, foreground: coverage,
    }));
    clear();
    context.putImageData(image, crop.x, crop.y);
  }
  return { draw, dispose: () => renderer.dispose() };
}
