import {kineticText} from '../../runtime/src/typography/index.js';
import {css} from './_kit.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const CSS = `
.ek-loitering-sign { position: absolute; inset: 18% 13% auto; min-height: 43%; display: grid; place-items: center; padding: 3%; text-align: center; pointer-events: none; }
.ek-loitering-sign p { margin: 0; color: var(--ink); font: 750 clamp(16px,5cqw,34px)/1.13 system-ui, sans-serif; }
`;

export default function loiteringWords(stage, ctx) {
  css('design-loitering-words', CSS);
  const cord = {name: 'word sign pull cord', x: ctx.still ? 441 : 191, y: 181, axis: 'x', minX: 79, maxX: 441};
  const sign = document.createElement('div');
  sign.className = 'ek-loitering-sign';
  sign.innerHTML = '<p><strong>No</strong> loitering in this sentence.</p>';
  const title = kineticText(sign.querySelector('p'), {split: 'words'});
  const options = {duration: .55, stagger: .16, from: {y: 19, opacity: 0}};
  const end = title.sample(0, options).end;
  const disposeStudy = dragStudy(stage, ctx, {height: 226, handles: [cord], draw(g, {dark, ink}) {
    const board = paintColor(42, 52, dark ? 24 : 90);
    const edge = paintColor(43, 48, dark ? 70 : 44, .70);
    g.fillStyle = board;
    g.strokeStyle = edge;
    g.lineWidth = 1.25;
    g.beginPath();
    g.roundRect(46, 22, 428, 131, 11);
    g.fill();
    g.stroke();
    for (const x of [64, 456]) {
      for (const y of [38, 137]) disc(g, x, y, 2.75, edge);
    }
    g.beginPath();
    g.moveTo(cord.minX, cord.y);
    g.lineTo(cord.maxX, cord.y);
    g.stroke();
    disc(g, cord.x, cord.y, 10, paintColor(34, 68, dark ? 66 : 45));
    disc(g, cord.x, cord.y, 4, board);
    label(g, 'First word', cord.minX + 1, 207, ink, 14);
    label(g, 'Full phrase', cord.maxX - 1, 207, ink, 14);
    const time = end * (cord.x - cord.minX) / (cord.maxX - cord.minX);
    const {progress} = title.sample(time, options);
    const entered = progress.filter(value => value === 1).length;
    return `${entered} of ${progress.length} text parts have reached their final pose. The words enter one after another.`;
  }});
  stage.querySelector('.ek-study-picture').append(sign);
  return () => { title.dispose(); disposeStudy(); };
}
