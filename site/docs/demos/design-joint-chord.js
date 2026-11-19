import {scene} from '../../runtime/src/core/index.js';
import {character, stick} from '../../runtime/src/characters/index.js';
import {disc, label, paintColor} from './design-stage.js';
import {characterStudy, rail} from './design-character-study.js';

const HEIGHT = 241;

export default async function jointChord(stage, ctx) {
  const drawing = scene({width: 520, height: HEIGHT, duration: 1});
  const performers = ['joints', 'targets'].map((space, index) => {
    const actor = character(drawing, stick({ink: paintColor(216, 30, 45), line: 4.4}), {
      x: 132 + 239 * index, y: 173, idle: false, size: .75,
    });
    actor.keys([
      {at: 0, pose: {handF: [18, -152]}},
      {at: 1, duration: 1, ease: 'linear', space, arc: 0, pose: {handF: [53, -112]}},
    ]);
    return actor;
  });
  const paths = performers.map(actor => Array.from({length: 21}, (_, i) => actor.socket('handF', i / 20)));
  const marker = {name: 'the gesture clock', x: 239, y: 198, axis: 'x', minX: 72, maxX: 448};
  return characterStudy(stage, ctx, drawing, {
    height: HEIGHT,
    handles: [marker],
    draw(g, {dark, ink}, paint) {
      const time = (marker.x - marker.minX) / (marker.maxX - marker.minX);
      const colors = [
        paintColor(283, 54, dark ? 76 : 45),
        paintColor(173, 58, dark ? 66 : 37),
      ];
      paths.forEach((path,index) => {
        for (const point of path) disc(g, point.x, point.y, 1.6, colors[index]);
      });
      paint(g, time);
      performers.forEach((actor,index) => {
        const hand = actor.socket('handF', time);
        disc(g, hand.x, hand.y, 4.5, colors[index]);
      });
      label(g, 'Joint angles', 138, 20, ink, 17);
      label(g, 'Hand targets', 375, 20, ink, 17);
      rail(g, marker, colors[0], ink, 'Start', 'Arrive');
      label(g, '◷', marker.x, marker.y, paintColor(42, 58, 97), 18);
      return `${time.toFixed(2)} s. The joint-angle hand follows an arc. The target-space hand follows a straight chord.`;
    },
  });
}
