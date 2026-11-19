import {wrapText} from '../../runtime/src/layout/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

export default function burritoWrap(stage, ctx) {
  const right = {name: 'the menu’s right edge', x: 415, y: 152, axis: 'x', minX: 226, maxX: 461};
  return dragStudy(stage, ctx, {height: 289, handles: [right], draw(g, {dark, ink}) {
    const left = 55;
    const padding = 22;
    const width = right.x - left;
    const paper = paintColor(43, 57, dark ? 25 : 91);
    g.fillStyle = paper;
    g.beginPath(); g.roundRect(left, 27, width, 235, 15); g.fill();
    label(g, 'THE BIG WRAP', left + width / 2, 65, ink, 18);
    g.font = '500 19px system-ui, sans-serif';
    const words = 'Black beans, rice, roasted corn, verde salsa and a surprise crunch.';
    const lines = wrapText(words, {width: width - 2 * padding, fontSize: 19, fontWeight: 500,
      measure: text => g.measureText(text).width});
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = ink;
    lines.forEach((line, i) => g.fillText(line, left + padding, 102 + 25 * i));
    disc(g, right.x, right.y, 13, ink);
    label(g, '↔', right.x, right.y, paper, 17);
    return `${Math.round(width - 2 * padding)} units wide. The description wraps onto ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}.`;
  }});
}
