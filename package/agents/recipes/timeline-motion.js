// @recipe timeline-motion
// @title Choreograph several moves with a timeline, labels and keyframes
// @task Build a pure motion timeline with labels, relative positions and keyframes, then drive scene properties from it.
// @uses explainerkit/core, explainerkit/motion
// @keywords timeline, sequence, keyframes, labels, stagger, choreography, easing, bounce
// @guide docs/modules/timelines.md
import {scene} from 'explainerkit/core';
import {createTimeline} from 'explainerkit/motion';

const motion = createTimeline({defaults: {duration: 1, ease: 'easeInOut'}})
  .label('travel', 0.3)
  .add({'dot.x': {from: 80, to: 560}}, 'travel')
  .add({'dot.y': {keyframes: [{from: 180, to: 100, duration: 0.4}, {to: 180, duration: 0.6}]}}, 'travel')
  .add({'bar.width': {from: 0, to: 480}}, 'travel');

const drawing = scene({width: 640, height: 300, duration: 2, label: 'A dot hops along while a bar fills'});
const t = drawing.parameter(0, {min: 0, max: 2});
t.animate({from: 0, to: 2, duration: 2, ease: 'linear'});
const values = drawing.derive([t], (s) => motion.sample(s).values);
drawing.rect({x: 80, y: 240, height: 12, fill: '#d9a441'}).bind('width', {inputs: [values], map: (v) => v['bar.width'] ?? 0});
drawing.circle({r: 22, fill: '#34766b'}).bind(['x', 'y'], {inputs: [values], map: (v) => ({x: v['dot.x'] ?? 80, y: v['dot.y'] ?? 180})});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
