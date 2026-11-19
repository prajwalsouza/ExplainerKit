import {animateWAAPI} from '../../runtime/src/adapters/waapi.js';
import {css} from './_kit.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const CSS = `
.ek-curtain-wall { position: absolute; inset: 7% 16% 25%; overflow: hidden; border-radius: 38% 38% 6px 6px / 19% 19% 6px 6px; pointer-events: none; }
.ek-curtain-panel { position: absolute; inset-block: 0; width: 50%; background: repeating-linear-gradient(90deg, var(--fold-dark) 0%, var(--fold) 9%, var(--fold-bright) 14%, var(--fold-dark) 25%); }
.ek-curtain-panel:first-child { left: 0; }
.ek-curtain-panel:last-child { right: 0; }
`;

export default function curtainPause(stage, ctx) {
  css('design-curtain-pause', CSS);
  const tassel = {name: 'curtain tassel', x: ctx.still ? 442 : 101, y: 258, axis: 'x', minX: 78, maxX: 442};
  const duration = 1.6;
  let effects = [];
  const disposeStudy = dragStudy(stage, ctx, {height: 296, handles: [tassel], draw(g, {dark, ink}) {
    g.fillStyle = paintColor(262, 22, dark ? 17 : 29);
    g.beginPath();
    g.roundRect(82, 19, 356, 205, [39, 39, 8, 8]);
    g.fill();
    const spot = g.createRadialGradient(260, 123, 14, 260, 123, 109);
    spot.addColorStop(0, paintColor(47, 74, 72, .56));
    spot.addColorStop(1, paintColor(48, 61, 36, 0));
    disc(g, 260, 123, 109, spot);

    const skin = paintColor(350, 62, 75);
    const snout = paintColor(348, 56, 65);
    const eye = paintColor(349, 34, 24);
    disc(g, 227, 101, 13, skin);
    disc(g, 293, 101, 13, skin);
    disc(g, 260, 133, 43, skin);
    disc(g, 247, 124, 3.2, eye);
    disc(g, 273, 124, 3.2, eye);
    g.fillStyle = snout;
    g.beginPath();
    g.ellipse(260, 147, 20, 14, 0, 0, 2 * Math.PI);
    g.fill();
    disc(g, 252, 147, 3, eye);
    disc(g, 268, 147, 3, eye);
    label(g, 'HAMLET', 260, 193, paintColor(47, 78, 85), 18);

    g.strokeStyle = paintColor(41, 35, dark ? 62 : 47, .65);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(tassel.minX, tassel.y);
    g.lineTo(tassel.maxX, tassel.y);
    g.stroke();
    disc(g, tassel.minX, tassel.y, 2.5, ink);
    disc(g, tassel.maxX, tassel.y, 2.5, ink);
    const gold = paintColor(40, 72, dark ? 69 : 43);
    disc(g, tassel.x, tassel.y - 3, 8, gold);
    g.fillStyle = gold;
    g.beginPath();
    g.moveTo(tassel.x - 3, tassel.y + 1);
    g.lineTo(tassel.x - 9, tassel.y + 15);
    g.lineTo(tassel.x + 9, tassel.y + 15);
    g.lineTo(tassel.x + 3, tassel.y + 1);
    g.fill();

    const fraction = (tassel.x - tassel.minX) / (tassel.maxX - tassel.minX);
    const time = fraction * duration;
    for (const effect of effects) effect.seek(time);
    return `Curtain paused at ${time.toFixed(2)} of ${duration} seconds. ${fraction >= .7 ? 'A ham takes the stage.' : 'Pull the tassel to reveal the performer.'}`;
  }});

  const wall = document.createElement('div');
  wall.className = 'ek-curtain-wall';
  wall.setAttribute('aria-hidden', 'true');
  wall.style.setProperty('--fold-dark', paintColor(349, 59, 25));
  wall.style.setProperty('--fold', paintColor(345, 62, 40));
  wall.style.setProperty('--fold-bright', paintColor(345, 61, 53));
  for (const direction of [-1, 1]) {
    const panel = document.createElement('div');
    panel.className = 'ek-curtain-panel';
    wall.append(panel);
  }
  stage.querySelector('.ek-study-picture').append(wall);

  try {
    for (const [index, panel] of [...wall.children].entries()) {
      const direction = index ? 1 : -1;
      // The drag samples a paused pose in either motion preference.
      const effect = animateWAAPI(panel, [
        {transform: 'translateX(0%)'},
        {transform: `translateX(${direction * 94}%)`},
      ], {duration, reducedMotion: 'allow'});
      effects.push(effect);
      effect.seek(duration * (tassel.x - tassel.minX) / (tassel.maxX - tassel.minX));
    }
  } catch (error) {
    for (const effect of effects) effect.dispose();
    disposeStudy();
    throw error;
  }
  return () => {
    for (const effect of effects) effect.dispose();
    effects = [];
    disposeStudy();
  };
}
