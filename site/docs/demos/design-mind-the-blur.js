import {fromRGBA8, tiltShift, toRGBA8} from '../../runtime/src/vfx/post/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const W = 240;
const H = 125;

function paintRailway(g, dark) {
  g.fillStyle = paintColor(132, 25, dark ? 31 : 74);
  g.fillRect(0, 0, W, H);
  for (const [index, track] of [32, 66, 97].entries()) {
    for (let y = track - 3; y <= track + 3; y += 6) {
      g.fillStyle = paintColor(206, 21, dark ? 67 : 33);
      g.fillRect(0, y, W, 1);
    }
    for (let x = 4; x < W; x += 8) {
      g.fillStyle = paintColor(27, 28, dark ? 62 : 43, .7);
      g.fillRect(x, track - 5, 1, 12);
    }
    for (let car = 0; car < 3; car++) {
      const x = 29 + index * 38 + car * 27;
      g.fillStyle = paintColor(17 + 67 * index, 71, dark ? 68 : 47);
      g.fillRect(x, track - 9, 22, 12);
      g.fillStyle = paintColor(45, 50, 94);
      for (let i = 0; i < 3; i++) g.fillRect(x + 3 + 6 * i, track - 7, 4, 4);
      for (const dx of [5, 18]) disc(g, x + dx, track + 3, 2, paintColor(22, 14, dark ? 35 : 20));
    }
  }
  for (let x = 14; x < W; x += 16) {
    disc(g, x, 12 + Math.sin(x) * 3, 6, paintColor(140, 40, dark ? 48 : 53));
    disc(g, x, 114 + Math.sin(x) * 2, 4, paintColor(141, 33, dark ? 39 : 57));
  }
}

export default function mindTheBlur(stage, ctx) {
  const buffer = document.createElement('canvas');
  buffer.width = W;
  buffer.height = H;
  const pixels = buffer.getContext('2d', {willReadFrequently: true});
  const lens = {name: 'the focus band', x: 483, y: 133, axis: 'y', minY: 30, maxY: 235};
  let source, previousTheme;
  return dragStudy(stage, ctx, {height: 275, handles: [lens], draw(g, {dark, ink}) {
    if (!source || dark !== previousTheme) {
      paintRailway(pixels, dark);
      source = fromRGBA8(W, H, pixels.getImageData(0, 0, W, H).data);
      previousTheme = dark;
    }
    const center = lens.y / 265;
    const focused = tiltShift(source, {center, halfWidth: .065, falloff: .35, maxBlur: .085});
    pixels.putImageData(new ImageData(toRGBA8(focused.image), W, H), 0, 0);
    g.drawImage(buffer, 13, 0, 458, 265);
    g.strokeStyle = ink;
    g.setLineDash([4, 4]);
    g.strokeRect(13, lens.y - 17, 458, 34);
    g.setLineDash([]);
    disc(g, lens.x, lens.y, 13, ink);
    label(g, '↕', lens.x, lens.y, paintColor(36, 25, dark ? 12 : 96), 15);
    return `The sharp band is centered ${Math.round(center * 100)}% of the way down the frame.`;
  }});
}
