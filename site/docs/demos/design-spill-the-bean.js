import {fall} from '../../runtime/src/physics/index.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, WIDTH} from './design-stage.js';

const HEIGHT = 295;
const START = 75;
const END = WIDTH - 75;
const drop = fall({from: 57, to: 202, terminal: 130, ramp: .35, at: 0});

export default function spillTheBean(stage, ctx) {
  const film = {name: 'the film tab', x: START, y: 247, minX: START, maxX: END, axis: 'x'};
  return dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [film],
    draw(g, {width, height, ink}) {
      const time = (drop.end + .2) * (film.x - START) / (END - START);
      const y = drop.sample(time);
      const speed = drop.velocity(time);
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.fillStyle = colour(ctx, 26 - ctx.hue, 23, 66);
      g.fillRect(70, 212, 380, 11);
      g.fillStyle = colour(ctx, 25 - ctx.hue, 55, 35);
      g.beginPath();
      g.ellipse(width / 2, y, 19, 10, -.32, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = colour(ctx, 34 - ctx.hue, 30, 62);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(width / 2 - 13, y + 3);
      g.bezierCurveTo(width / 2 - 4, y - 8, width / 2 + 4, y + 6, width / 2 + 13, y - 4);
      g.stroke();
      g.fillStyle = ink;
      g.fillRect(START, film.y, END - START, 1);
      disc(g, film.x, film.y, 10, colour(ctx, 52, 46, 45));
      label(g, 'Release', START, 276, ink, 13);
      label(g, 'Landing', END, 276, ink, 13);
      return `${time.toFixed(2)} s. Speed ${speed.toFixed(0)} px/s.${time >= drop.end ? ' The bean has landed.' : ''}`;
    },
  });
}
