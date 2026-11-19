import {loadFont, textOutline} from '../../runtime/src/import/font.js';
import {counterFontBytes} from './design-counter-font.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

function curvePath(commands) {
  const output = new Path2D();
  for (const [type, ...values] of commands) {
    if (type === 'M') output.moveTo(...values);
    else if (type === 'L') output.lineTo(...values);
    else if (type === 'Q') output.quadraticCurveTo(...values);
    else output.closePath();
  }
  return output;
}

export default async function counterService(stage, ctx) {
  const font = await loadFont(counterFontBytes());
  const outline = textOutline(font, 'O', {size: 252, x: 173, y: 223});
  const letter = curvePath(outline.commands);
  const sprinkle = {name: 'pink sprinkle', x: 261, y: 137, minX: 95, maxX: 425, minY: 27, maxY: 236};
  return dragStudy(stage, ctx, {height: 270, handles: [sprinkle], draw(g, {dark, ink}) {
    const icing = g.createLinearGradient(180, 55, 344, 204);
    icing.addColorStop(0, paintColor(21, 65, dark ? 64 : 71));
    icing.addColorStop(1, paintColor(34, 61, dark ? 46 : 63));
    g.fillStyle = icing;
    g.fill(letter, 'nonzero');
    g.lineWidth = 1.2;
    g.strokeStyle = paintColor(24, 38, dark ? 73 : 44, .82);
    g.stroke(letter);
    for (const [type, ...values] of outline.commands) {
      if (type !== 'Z') disc(g, ...values.slice(-2), 3, ink);
    }
    const point = g.getTransform().transformPoint(sprinkle);
    const drawsInk = g.isPointInPath(letter, point.x, point.y, 'nonzero');
    g.save();
    g.translate(sprinkle.x, sprinkle.y);
    g.rotate(-.7);
    g.fillStyle = paintColor(324, 62, dark ? 78 : 44);
    g.beginPath();
    g.roundRect(-12, -4, 24, 8, 4);
    g.fill();
    g.restore();
    label(g, 'O has an outer contour and an inner counter', 260, 251, ink, 17);
    return drawsInk ? 'The sprinkle landed on the glyph’s ink.' : 'The sprinkle found unfilled paper.';
  }});
}
