import {scene} from '../../runtime/src/core/index.js';
import {character, stick} from '../../runtime/src/characters/index.js';
import {disc, label, paintColor} from './design-stage.js';
import {characterStudy, rail} from './design-character-study.js';

const HEIGHT = 253;

export default async function mimeWindow(stage, ctx) {
  const drawing = scene({width: 520, height: HEIGHT, duration: 1});
  const mime = character(drawing, stick({ink: paintColor(202, 31, 44), line: 4.4}), {x: 215, y: 187, idle: false});
  mime.keys([{at: 0, pose: {effectors: {handF: {target: [25, -120], mix: 1}}}}]);
  mime.keys([
    {at: .2, duration: 0, pose: {}},
    {at: 1, duration: .8, ease: 'linear', pose: {lean: .25}},
  ], {channels: ['body.r']});
  const palm = mime.socket('handF', 0);
  const marker = {name: 'the mime’s gesture clock', x: 150, y: 215, axis: 'x', minX: 75, maxX: 445};
  return characterStudy(stage, ctx, drawing, {
    height: HEIGHT,
    handles: [marker],
    draw(g, {dark, ink}, paint) {
      const time = (marker.x - marker.minX) / (marker.maxX - marker.minX);
      const blue = paintColor(190, 56, dark ? 66 : 42);
      const glass = paintColor(191, 58, dark ? 63 : 66, .2);
      const shadow = paintColor(ctx.hue, 15, dark ? 41 : 75);
      g.fillStyle = glass;
      g.fillRect(palm.x, 31, 102, 129);
      g.strokeStyle = blue;
      g.lineWidth = 2;
      g.strokeRect(palm.x, 31, 102, 129);
      g.fillStyle = shadow;
      g.fillRect(151, 188, 222, 2);
      paint(g, time);
      disc(g, palm.x, palm.y, 5, blue);
      rail(g, marker, blue, ink, 'Stand', 'Lean');
      label(g, '◷', marker.x, marker.y, paintColor(44, 45, 94), 18);
      const angle = mime.inspect(time).pose['body.r'];
      return `Body angle ${Math.round(angle * 180 / Math.PI)} degrees. The hand keeps its earlier glass contact.`;
    },
  });
}
