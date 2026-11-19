import {scene} from '../../runtime/src/core/index.js';
import {character, dragonfly, frog} from '../../runtime/src/characters/index.js';
import {disc, label, paintColor} from './design-stage.js';
import {characterStudy, rail} from './design-character-study.js';

const HEIGHT = 256;

export default async function familyPond(stage, ctx) {
  const drawing = scene({width: 520, height: HEIGHT, duration: 3});
  const insect = character(drawing, dragonfly({wings: {frequency: 2.2}}), {x: 150, y: 119, size: 1.05, idle: false});
  insect.act('flap', {at: 0, duration: 3, fadeIn: 0, fadeOut: 0});
  const hopper = character(drawing, frog(), {x: 281, y: 168, size: .8, idle: false});
  const end = hopper.walkTo(425, {action: 'leap', speed: 98});
  const lily = {name: 'the pond route marker', x: 136, y: 214, axis: 'x', minX: 82, maxX: 438};
  return characterStudy(stage, ctx, drawing, {
    height: HEIGHT,
    handles: [lily],
    draw(g, {dark, ink}, paint) {
      const time = end * (lily.x - lily.minX) / (lily.maxX - lily.minX);
      const leaf = paintColor(148, 51, dark ? 64 : 40);
      const water = paintColor(190, 59, dark ? 27 : 87);
      g.fillStyle = water;
      g.fillRect(46, 171, 428, 21);
      for (const x of [284, 351, 423]) {
        g.fillStyle = leaf;
        g.beginPath();
        g.ellipse(x, 170, 25, 4, 0, 0, 2 * Math.PI);
        g.fill();
      }
      paint(g, time);
      rail(g, lily, leaf, ink, 'Pond edge', 'Far side');
      disc(g, lily.x + 3, lily.y - 2, 4, paintColor(48, 77, 78));
      label(g, 'Flap', 150, 47, ink, 18);
      label(g, 'Leap', 359, 47, ink, 18);
      return `${time.toFixed(2)} s. The same character runtime samples a winged rig and a jumper rig.`;
    },
  });
}
