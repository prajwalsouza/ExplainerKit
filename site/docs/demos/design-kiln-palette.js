import {darkClay} from '../../runtime/src/renderers/three.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const swatches = [paintColor(38, 42, 79), paintColor(38, 39, 89), paintColor(36, 37, 66)];
const accent = paintColor(17, 80, 52);
const base = [[-55, 7], [-45, 70], [28, 70], [50, 10]];

function pot(g, x, y, tiles, ornament) {
  const at = points => points.map(([dx, dy]) => ({x: x + dx, y: y + dy}));
  polygon(g, at(base), tiles[2]);
  polygon(g, at([[-55, 7], [-40, 71], [-4, 70], [-2, 9]]), tiles[0]);
  polygon(g, at([[-55, 7], [-27, -14], [70, -14], [50, 10]]), tiles[1]);
  disc(g, x, y + 39, 9, ornament);
}

export default function kilnPalette(stage, ctx) {
  const dial = {name: 'the clay palette switch', x: 138, y: 225, axis: 'x', minX: 138, maxX: 382};
  return dragStudy(stage, ctx, {height: 254, handles: [dial], draw(g, {dark, ink}) {
    const installed = dial.x >= 260;
    pot(g, 151, 78, swatches, accent);
    pot(g, 361, 78, installed ? swatches.map(color => darkClay(color)) : swatches,
      installed ? darkClay(accent, {role: 'accent'}) : accent);
    label(g, 'Authored', 151, 176, ink, 16);
    label(g, installed ? 'Dark clay' : 'Restored', 361, 176, ink, 16);
    g.fillStyle = paintColor(40, 39, dark ? 63 : 39, .4);
    g.fillRect(dial.minX, dial.y - 2, dial.maxX - dial.minX, 4);
    disc(g, dial.x, dial.y, 12, ink);
    return installed ? 'The darkClay helper deepens the pale colors. The red accent keeps its own color.' : 'Both pots use the authored colors.';
  }});
}
