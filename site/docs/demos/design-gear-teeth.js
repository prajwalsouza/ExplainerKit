import {mechanism} from '../../runtime/src/mechanisms/index.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const engine = mechanism();
const driver = engine.gear({id: 'small', x: 197, teeth: 18, module: 6});
engine.gear({id: 'large', x: 332, teeth: 27, module: 6}).meshWith(driver);

function cog(g, x, y, radius, teeth, rotation, fill, ink) {
  const points = Array.from({length: teeth * 4}, (_, index) => {
    const angle = rotation + index * Math.PI * 2 / (teeth * 4);
    const r = radius + (index % 4 < 2 ? 3 : -3);
    return {x: x + r * Math.cos(angle), y: y + r * Math.sin(angle)};
  });
  polygon(g, points, fill);
  disc(g, x + .69 * radius * Math.cos(rotation), y + .69 * radius * Math.sin(rotation), 5, ink);
  disc(g, x, y, 13, ink);
}

export default function gearTeeth(stage, ctx) {
  const crank = {name: 'the gear crank', x: 190, y: 250, axis: 'x', minX: 109, maxX: 411};
  return dragStudy(stage, ctx, {height: 274, handles: [crank], draw(g, {dark, ink}) {
    const turns = (crank.x - crank.minX) / (crank.maxX - crank.minX);
    const state = engine.sample(turns * 2 * Math.PI);
    cog(g, 197, 132, 54, 18, state.small.rotation, paintColor(27, 79, dark ? 68 : 59), ink);
    cog(g, 332, 132, 81, 27, state.large.rotation, paintColor(170, 47, dark ? 55 : 43), ink);
    label(g, '18 teeth', 197, 46, ink, 17);
    label(g, '27 teeth', 332, 27, ink, 17);
    g.fillStyle = paintColor(34, 26, dark ? 67 : 43, .4);
    g.fillRect(crank.minX, crank.y - 2, crank.maxX - crank.minX, 4);
    disc(g, crank.x, crank.y, 13, ink);
    return `Driver ${turns.toFixed(2)} turns. Driven ${(state.large.rotation / (2 * Math.PI)).toFixed(2)} turns.`;
  }});
}
