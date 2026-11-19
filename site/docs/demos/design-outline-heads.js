import {scene} from '../../runtime/src/core/index.js';
import {character, stick} from '../../runtime/src/characters/index.js';
import {disc, label, paintColor} from './design-stage.js';
import {characterStudy} from './design-character-study.js';

const HEIGHT = 251;

export default async function outlineHeads(stage, ctx) {
  const drawing = scene({width: 520, height: HEIGHT});
  const inkColor = paintColor(217, 30, 44);
  character(drawing, stick({style: 'heavy', ink: inkColor}), {x: 158, y: 188, height: 139, idle: false});
  character(drawing, stick({style: 'heavy', ink: inkColor, paper: paintColor(40, 45, 94)}), {
    x: 357, y: 188, height: 139, idle: false,
  });
  const stripe = {name: 'the paint stripe', x: 150, y: 225, axis: 'x', minX: 56, maxX: 466};
  return characterStudy(stage, ctx, drawing, {
    height: HEIGHT,
    handles: [stripe],
    draw(g, {dark, ink}, paint) {
      const magenta = paintColor(316, 64, dark ? 72 : 63);
      g.fillStyle = magenta;
      g.fillRect(stripe.x - 24, 35, 48, stripe.y - 35);
      g.fillStyle = paintColor(ctx.hue, 14, dark ? 40 : 73);
      g.fillRect(75, 189, 366, 2);
      paint(g, 0);
      label(g, 'Outline only', 158, 23, ink, 17);
      label(g, 'Painted interior', 357, 23, ink, 17);
      disc(g, stripe.x, stripe.y, 12, magenta);
      disc(g, stripe.x, stripe.y, 3.5, ink);
      return 'The stripe shows through the outlined head. The painted head keeps its fill.';
    },
  });
}
