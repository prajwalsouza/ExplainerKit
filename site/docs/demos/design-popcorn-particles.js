import {emitter} from '../../runtime/src/particles/index.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const popcorn = emitter({seed: 17, rate: 28, life: 1.25, end: 2.6,
  origin: {x: 260, y: 157}, velocity: {y: -195}, spread: {x: 87, y: 45}, acceleration: {y: 310}});

export default function popcornParticles(stage, ctx) {
  const clock = {name: 'the popcorn timer', x: 224, y: 252, axis: 'x', minX: 76, maxX: 444};
  return dragStudy(stage, ctx, {height: 276, handles: [clock], draw(g, {dark, ink}) {
    const time = 3.8 * (clock.x - clock.minX) / (clock.maxX - clock.minX);
    const puffs = popcorn.sample(time);
    for (const {x, y, progress, id} of puffs) {
      const fill = paintColor(39 + id % 12, 76, dark ? 78 : 69, 1 - .65 * progress);
      disc(g, x, y, 5, fill);
      disc(g, x + 3, y - 4, 4, fill);
      disc(g, x - 4, y - 2, 4, fill);
    }
    polygon(g, [{x: 208, y: 155}, {x: 312, y: 155}, {x: 296, y: 219}, {x: 224, y: 219}], paintColor(6, 67, dark ? 62 : 49));
    label(g, 'POP', 260, 183, paintColor(49, 82, 96), 23);
    g.fillStyle = paintColor(32, 22, dark ? 65 : 43, .4);
    g.fillRect(clock.minX, clock.y - 2, clock.maxX - clock.minX, 4);
    disc(g, clock.x, clock.y, 11, ink);
    return `${time.toFixed(2)} s. ${puffs.length} popcorn particles are alive.`;
  }});
}
