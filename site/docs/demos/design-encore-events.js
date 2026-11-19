import {createTimeline} from '../../runtime/src/motion/index.js';
import {createTimelinePlayer} from '../../runtime/src/player/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

export default function encoreEvents(stage, ctx) {
  const clock = {name: 'the curtain clock', x: 72, y: 242, axis: 'x', minX: 72, maxX: 448};
  const timeline = createTimeline().add({curtain: {from: 0, to: 1, duration: 1.35, ease: 'easeInOut'}}, .25)
    .event({name: 'curtain-call'}, 1.1);
  let opening = 0;
  let announcement = 'Move across the star to cross the event.';
  const player = createTimelinePlayer(timeline, {
    project({values}) { opening = values.curtain ?? 0; },
    onEvent(_, context) { announcement = `Curtain call crossed ${context.backwards ? 'backward' : 'forward'}.`; },
  });
  const stop = dragStudy(stage, ctx, {height: 266, handles: [clock], draw(g, {dark, ink}) {
    const time = player.duration * (clock.x - clock.minX) / (clock.maxX - clock.minX);
    if (time !== player.time) player.seek(time);
    g.fillStyle = paintColor(247, 22, dark ? 25 : 34);
    g.fillRect(104, 27, 312, 162);
    label(g, 'ENCORE', 260, 101, paintColor(49, 83, 87), 21);
    const hue = dark ? 329 : 344;
    const width = 156 - 114 * opening;
    for (const x of [104, 416 - width]) {
      g.fillStyle = paintColor(hue, 59, dark ? 56 : 47);
      g.fillRect(x, 27, width, 162);
      g.fillStyle = paintColor(hue, 48, dark ? 32 : 29, .47);
      for (let stripe = 13; stripe < width; stripe += 24) g.fillRect(x + stripe, 27, 6, 162);
    }
    g.fillStyle = paintColor(hue, 34, dark ? 66 : 47, .42);
    g.fillRect(clock.minX, clock.y - 1, clock.maxX - clock.minX, 3);
    label(g, '✦', clock.minX + 1.1 / player.duration * (clock.maxX - clock.minX), 218, ink, 17);
    disc(g, clock.x, clock.y, 12, ink);
    return `${time.toFixed(2)} s. ${announcement}`;
  }});
  return () => { stop(); player.dispose(); };
}
