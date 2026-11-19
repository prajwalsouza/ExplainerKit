import {scene} from '../../runtime/src/core/index.js';
import {character, stick} from '../../runtime/src/characters/index.js';
import {label, paintColor} from './design-stage.js';
import {characterStudy, rail} from './design-character-study.js';

const HEIGHT = 270;
const END = 1.5;

export default async function balancedTrays(stage, ctx) {
  const drawing = scene({width: 520, height: HEIGHT, duration: 2});
  const handles = [];
  const rotatedTray = [155, 341].map((x, index) => {
    const align = index ? 'upright' : 'hand';
    const figure = character(drawing, stick({ink: paintColor(211, 28, 38), line: 4.5}), {
      x, y: 203, size: .81, idle: false, secondaryMotion: false,
    });
    figure.keys([
      {at: 0, pose: {handF: [46, -75]}},
      {at: END, duration: END, pose: {handF: [34, -147]}, ease: 'smooth'},
    ]);
    const tray = drawing.group({});
    tray.rect({x: -28, y: -2, width: 56, height: 5, fill: paintColor(27, 63, 48)});
    tray.rect({x: -10, y: -14, width: 13, height: 12, fill: paintColor(189, 64, 53)});
    tray.circle({x: 4, y: -10, r: 4, fill: 'none', stroke: paintColor(189, 64, 47), strokeWidth: 2});
    handles.push(figure.hold(tray, {hand: 'F', from: 0, to: 2, blend: 0, align}));
    return tray;
  })[0];
  const marker = {name: 'the serving clock', x: 214, y: 232, axis: 'x', minX: 80, maxX: 440};
  const dispose = characterStudy(stage, ctx, drawing, {
    height: HEIGHT,
    handles: [marker],
    draw(g, {dark, ink}, paint) {
      const time = END * (marker.x - marker.minX) / (marker.maxX - marker.minX);
      const accent = paintColor(ctx.hue, 59, dark ? 68 : 47);
      const floor = paintColor(ctx.hue, 17, dark ? 30 : 80);
      g.fillStyle = floor;
      g.fillRect(68, 204, 384, 2);
      label(g, 'Hand-aligned', 162, 22, ink, 18);
      label(g, 'Upright', 349, 22, ink, 18);
      paint(g, time);
      rail(g, marker, accent, ink, 'Lift', 'Serve');
      label(g, '◷', marker.x, marker.y, ink, 18);
      const matrix = drawing.locate(rotatedTray, {time}).matrix;
      const tilt = Math.abs(Math.atan2(matrix[1], matrix[0]) * 180 / Math.PI);
      return `Hand-aligned tray tilt ${Math.round(tilt)} degrees. The upright tray stays level.`;
    },
  });
  return () => {
    dispose();
    handles.forEach(handle => handle.dispose());
  };
}
