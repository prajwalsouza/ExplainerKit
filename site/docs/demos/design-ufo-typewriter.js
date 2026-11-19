import {commonEffect} from '../../runtime/src/motion/common-effects.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const TEXT = 'Take me to your typesetter.';
const effect = commonEffect('typewriter', {text: TEXT, duration: 2.4});

export default async function ufoTypewriter(stage, ctx) {
  const paper = {name: 'the paper strip', x: 260, y: 203, axis: 'y', minY: 181, maxY: 278};
  return dragStudy(stage, ctx, {
    height: 310,
    handles: [paper],
    draw(g, {dark, ink}) {
      const shell = paintColor(ctx.hue, 52, dark ? 53 : 44);
      const dome = paintColor(184, 67, dark ? 76 : 77);
      const lamp = paintColor(48, 90, dark ? 72 : 62);
      const parchment = paintColor(45, 65, dark ? 83 : 95);
      const spot = paintColor(ctx.hue, 64, dark ? 61 : 47, .3);
      const print = paintColor(203, 24, 19);
      for (const [x, y, r] of [[51, 43, 2], [112, 76, 3], [153, 30, 2], [385, 44, 2], [466, 82, 3], [427, 102, 2]]) {
        disc(g, x, y, r, spot);
      }
      g.fillStyle = dome;
      g.beginPath();
      g.ellipse(260, 91, 46, 47, 0, 0, 2 * Math.PI);
      g.fill();
      disc(g, 244, 68, 6, lamp);
      g.fillStyle = shell;
      g.beginPath();
      g.ellipse(260, 103, 102, 27, 0, 0, 2 * Math.PI);
      g.fill();
      for (const x of [205, 232, 260, 288, 315]) disc(g, x, 105, 3, lamp);
      polygon(g, [{x: 192, y: 117}, {x: 328, y: 117}, {x: 412, y: paper.y}, {x: 108, y: paper.y}], spot);
      g.fillStyle = ink;
      g.fillRect(110, 148, 300, 5);
      g.fillStyle = parchment;
      g.fillRect(120, 153, 280, paper.y - 153);
      const time = effect.end * (paper.y - paper.minY) / (paper.maxY - paper.minY);
      const {text} = effect.sample(time);
      label(g, text, 260, 174, print, 18);
      g.fillStyle = shell;
      g.beginPath();
      g.roundRect(236, paper.y - 9, 48, 18, 9);
      g.fill();
      for (const y of [paper.y - 2, paper.y + 2]) {
        g.fillStyle = dome;
        g.fillRect(254, y, 12, 1);
      }
      return text ? `Transmission so far. “${text}”` : 'Pull the strip to read the transmission.';
    },
  });
}
