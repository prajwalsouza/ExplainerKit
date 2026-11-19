import {scene} from '../../runtime/src/core/index.js';
import {polyhedron, split} from '../../runtime/src/geometry/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

export default function gemInsideJob(stage, ctx) {
  const spin = {name: 'the gem turntable', x: 243, y: 239, axis: 'x', minX: 62, maxX: 415};
  const cutSize = {name: 'the gem’s separation handle', x: 468, y: 155, axis: 'y', minY: 58, maxY: 155};
  const drawing = scene({width: 520, height: 230});
  const solid = polyhedron(drawing, {kind: 'icosahedron', width: 149, pitch: .36, light: [-.4, -.6, 1],
    ramp: [paintColor(221, 45, 26, 1).slice(0, 7), paintColor(176, 59, 74, 1).slice(0, 7)]});
  solid.handle.set({x: 257, y: 117});
  const cut = split(solid, {plane: {normal: [1, .25, .1], offset: 0}, interior: paintColor(20, 70, 62).slice(0, 7)});
  const renderer = createCanvasRenderer(document.createElement('div'), {points: 'cpu'});
  const stop = dragStudy(stage, ctx, {height: 267, handles: [spin, cutSize], draw(g, {dark, ink}) {
    const yaw = 2 * Math.PI * (spin.x - spin.minX) / (spin.maxX - spin.minX);
    const separate = .59 * (cutSize.maxY - cutSize.y) / (cutSize.maxY - cutSize.minY);
    solid.inputs.yaw.set(yaw);
    for (const piece of cut.pieces) piece.offset.set(separate);
    renderer.render(drawing.sample());
    g.drawImage(renderer.element, 0, 0, 520, 230);
    g.fillStyle = paintColor(188, 28, dark ? 70 : 42, .45);
    g.fillRect(cutSize.x - 2, cutSize.minY, 4, cutSize.maxY - cutSize.minY);
    g.fillRect(spin.minX, spin.y - 2, spin.maxX - spin.minX, 4);
    disc(g, spin.x, spin.y, 11, ink);
    disc(g, cutSize.x, cutSize.y, 11, ink);
    label(g, 'Open', cutSize.x, 36, ink, 14);
    return `Turn ${Math.round(yaw * 180 / Math.PI)}°. Each half moved ${Math.round(separate * 100)}% of the original width from the cut.`;
  }});
  return () => { stop(); renderer.dispose(); };
}
