import {idle, motionStyle, scene} from '../../runtime/src/core/index.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const DURATION = 4;
const FROM = 1;
const TO = 3;

export default async function statueHold(stage, ctx) {
  const drawing = scene({width: 520, height: 272, duration: DURATION});
  const columns = [154, 368];
  const movements = columns.map((x, index) => idle(drawing.group({x, y: 135}), {
    motionStyle: motionStyle({preset: 'classic', holdStill: index === 0}),
    sway: {amplitude: 24, period: 1.35},
    turn: {amplitude: .24, period: 1.8},
    breathe: {amplitude: .15, period: 1.55},
    holds: [[FROM, TO]],
  }));
  const marker = {name: 'the statue timer', x: 255, y: 232, axis: 'x', minX: 78, maxX: 442};
  const stop = dragStudy(stage, ctx, {
    height: 268,
    handles: [marker],
    draw(g, {dark, ink}) {
      const time = DURATION * (marker.x - marker.minX) / (marker.maxX - marker.minX);
      const statues = drawing.sample({time}).children;
      const stone = paintColor(208, 25, dark ? 65 : 50);
      const shade = paintColor(211, 27, dark ? 42 : 34);
      const accent = paintColor(ctx.hue, 64, dark ? 68 : 44);
      const light = paintColor(45, 42, dark ? 78 : 93);
      columns.forEach((x, i) => {
        label(g, i ? 'Idle stays on' : 'Idle pauses', x, 34, ink, 18);
        g.fillStyle = stone;
        g.fillRect(x - 42, 183, 84, 13);
        const pose = statues[i].props;
        g.save();
        g.translate(pose.x, pose.y);
        g.rotate(pose.rotation);
        g.scale(pose.scaleX, pose.scaleY);
        g.strokeStyle = stone;
        g.lineWidth = 9;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-6, 11);
        g.lineTo(-12, 44);
        g.moveTo(6, 11);
        g.lineTo(12, 44);
        g.moveTo(-8, -12);
        g.lineTo(-29, 0);
        g.lineTo(-31, -24);
        g.moveTo(7, -11);
        g.lineTo(24, 6);
        g.stroke();
        polygon(g, [{x:-11,y:-16},{x:12,y:-15},{x:9,y:16},{x:-9,y:16}], stone);
        disc(g, 0, -29, 12, stone);
        g.fillStyle = shade;
        g.fillRect(-11, -35, 22, 5);
        g.fillRect(-7, -43, 14, 9);
        disc(g, -4, -28, 1.6, light);
        disc(g, 4, -28, 1.6, light);
        g.restore();
      });
      const range = marker.maxX - marker.minX;
      g.fillStyle = stone;
      g.globalAlpha = .4;
      g.fillRect(marker.minX, marker.y - 2, range, 4);
      g.globalAlpha = 1;
      g.fillStyle = accent;
      g.fillRect(marker.minX + range * FROM / DURATION, marker.y - 2, range * (TO - FROM) / DURATION, 4);
      disc(g, marker.x, marker.y, 12, accent);
      label(g, '◷', marker.x, marker.y, light, 18);
      label(g, 'Hold', 260, 253, ink, 15);
      return `${time.toFixed(2)} s. ${time >= FROM && time <= TO ? 'The left statue’s idle motion is paused.' : 'Both statues can fidget.'}`;
    },
  });
  return () => {
    stop();
    movements.forEach(movement => movement.dispose());
  };
}
