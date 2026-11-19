import {createSafeMorph} from '../../runtime/src/morph/index.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const square = [['M', -65, -65], ['L', 65, -65], ['L', 65, 65], ['L', -65, 65], ['Z']];
const opposite = square.map(command => command.length === 3 ? [command[0], -command[1], -command[2]] : command);
const morph = createSafeMorph(square, opposite, {align: 'none', reverse: false, samples: 16});

export default function collapsingCracker(stage, ctx) {
  const clock = {name: 'the cracker morph clock', x: 80, y: 246, axis: 'x', minX: 80, maxX: 440};
  let last = morph.sample(0);
  return dragStudy(stage, ctx, {height: 271, handles: [clock], draw(g, {dark, ink}) {
    const progress = Math.round(20 * (clock.x - clock.minX) / (clock.maxX - clock.minX)) / 20;
    let refused = false;
    try { last = morph.sample(progress); } catch (error) {
      if (error.code !== 'MORPH_UNSAFE_SAMPLE') throw error;
      refused = true;
    }
    polygon(g, last.filter(command => command.length === 3).map(([, x, y]) => ({x: x + 260, y: y + 116})), paintColor(35, 67, dark ? 69 : 60));
    if (refused) {
      disc(g, 260, 116, 4, paintColor(5, 67, dark ? 74 : 42));
      label(g, 'Sample refused', 260, 195, ink, 19);
    }
    g.fillStyle = paintColor(35, 28, dark ? 64 : 42, .4);
    g.fillRect(clock.minX, clock.y - 2, clock.maxX - clock.minX, 4);
    disc(g, 260, clock.y, 4, paintColor(4, 65, dark ? 68 : 42));
    disc(g, clock.x, clock.y, 11, ink);
    return refused ? 'The cracker would collapse to a point. The last valid outline stays on screen.' : `Sample ${Math.round(progress * 100)}%. The sampler accepted this outline.`;
  }});
}
