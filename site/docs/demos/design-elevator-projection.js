import {scene} from '../../runtime/src/core/index.js';
import {createProjectionPlayer} from '../../runtime/src/player/index.js';
import {css} from './_kit.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const CSS = `
.ek-lift-cabin { position: absolute; top: 0; left: 35%; width: 25%; height: 22%; border: .15em solid var(--rim); border-radius: .45em; display: grid; place-items: center; background: var(--metal); color: var(--rim); font: 700 clamp(10px,3cqw,20px)/1 system-ui,sans-serif; pointer-events: none; }
`;

export default function elevatorProjection(stage, ctx) {
  css('design-elevator-projection', CSS);
  const switcher = {name: 'brass floor selector', x: 413, y: 222, axis: 'y', minY: 40, maxY: 222};
  const floors = document.createElement('div');
  floors.className = 'ek-lift-cabin';
  floors.textContent = 'Service lift';
  const drawing = scene({width: 520, height: 272, duration: 3});
  drawing.rect({x: 0, y: 177, width: 1, height: 1}).to(0, {y: 19}, {duration: 3, ease: 'linear'});
  const player = createProjectionPlayer(drawing, {project(frame) {
    floors.style.top = `${100 * frame.children[0].props.y / frame.height}%`;
  }});
  const disposeStudy = dragStudy(stage, ctx, {height: 272, handles: [switcher], draw(g, {dark, ink}) {
    const wall = paintColor(40, 23, dark ? 24 : 92);
    const frame = paintColor(32, 25, dark ? 53 : 37);
    const brass = paintColor(43, 66, dark ? 70 : 46);
    g.fillStyle = wall;
    g.beginPath();
    g.roundRect(88, 17, 261, 238, 10);
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = frame;
    g.beginPath();
    g.moveTo(173, 18);
    g.lineTo(173, 254);
    g.moveTo(321, 18);
    g.lineTo(321, 254);
    g.stroke();
    for (const [index, y] of [211, 158, 105, 52].entries()) {
      label(g, String(index + 1), 131, y, ink, 20);
      g.strokeStyle = paintColor(38, 25, dark ? 53 : 44, .54);
      g.beginPath();
      g.moveTo(95, y + 23);
      g.lineTo(343, y + 23);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(switcher.x, switcher.minY);
    g.lineTo(switcher.x, switcher.maxY);
    g.stroke();
    disc(g, switcher.x, switcher.y, 13, brass);
    disc(g, switcher.x, switcher.y, 5, wall);
    const time = 3 * (switcher.maxY - switcher.y) / (switcher.maxY - switcher.minY);
    player.seek(time);
    floors.style.setProperty('--rim', paintColor(27, 28, dark ? 21 : 24));
    floors.style.setProperty('--metal', paintColor(47, 36, dark ? 67 : 81));
    return `Lift time ${time.toFixed(2)} seconds. The sampled scene moves the existing HTML cabin.`;
  }});
  stage.querySelector('.ek-study-picture').append(floors);
  return () => { disposeStudy(); player.dispose(); floors.remove(); };
}
