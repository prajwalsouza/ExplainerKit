import {scene} from '../../runtime/src/core/index.js';
import {character, contactTiming, stick} from '../../runtime/src/characters/index.js';
import {disc, paintColor} from './design-stage.js';
import {characterStudy} from './design-character-study.js';

const HEIGHT = 230;
const RANGE_END = .7;
const RADIUS = 16;

export default async function biscuitTiming(stage, ctx) {
  const drawing = scene({width: 520, height: HEIGHT, duration: 1});
  const figure = character(drawing, stick({ink: paintColor(214, 30, 38), line: 4.5}), {
    x: 145, y: 206, idle: false, secondaryMotion: false,
  });
  figure.keys([
    {at: 0, pose: {handF: [12, -76]}},
    {at: .5, duration: .5, ease: 'smooth', pose: {handF: [45, -120]}},
    {at: .8, pose: {handF: [45, -120]}},
  ]);
  const end = figure.socket('handF', RANGE_END);
  const trail = Array.from({length: 22}, (_, index) => figure.socket('handF', RANGE_END * index / 21));
  const biscuit = {name: 'the biscuit', x: end.x, y: end.y, axis: 'x', minX: end.x - 4, maxX: 359};
  return characterStudy(stage, ctx, drawing, {
    height: HEIGHT,
    handles: [biscuit],
    draw(g, {dark, ink}, paint) {
      const contact = contactTiming(figure, {
        from: 0, to: RANGE_END, target: [biscuit.x, biscuit.y], radius: RADIUS,
      });
      const known = contact.at !== null;
      const point = contact.at ?? RANGE_END;
      const hand = figure.socket('handF', point);
      const path = paintColor(ctx.hue, 60, dark ? 71 : 42, .68);
      const wafer = paintColor(39, 73, dark ? 72 : 51);
      const snap = known ? paintColor(166, 65, dark ? 71 : 39) : paintColor(9, 59, dark ? 69 : 45);
      const floor = paintColor(ctx.hue, 22, dark ? 36 : 78);
      g.fillStyle = floor;
      g.fillRect(71, 206, 342, 2);
      for (const {x,y} of trail) disc(g, x, y, 1.6, path);
      paint(g, point);

      g.strokeStyle = snap;
      g.lineWidth = 1.5;
      g.setLineDash([3, 3]);
      g.beginPath();
      g.moveTo(hand.x, hand.y);
      g.lineTo(biscuit.x, biscuit.y);
      g.stroke();
      g.setLineDash([]);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(biscuit.x, biscuit.y, RADIUS, 0, 2 * Math.PI);
      g.stroke();
      g.fillStyle = wafer;
      g.beginPath();
      g.roundRect(biscuit.x - 11, biscuit.y - 9, 22, 18, 3);
      g.fill();
      for (const dx of [-5, 0, 5]) {
        disc(g, biscuit.x + dx, biscuit.y - 3, 1, ink);
        disc(g, biscuit.x + dx, biscuit.y + 3, 1, ink);
      }
      return known
        ? `Contact at ${contact.at.toFixed(2)} s. The hand slowed down inside the biscuit’s target radius.`
        : 'No contact time. The hand slowed down outside the biscuit’s target radius.';
    },
  });
}
