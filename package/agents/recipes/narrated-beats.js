// @recipe narrated-beats
// @title Time shapes to narration lines
// @task Turn narration sentences into beat times, then make shapes enter, move, dim and explain themselves at those beats.
// @uses explainerkit/core
// @keywords narration, beats, captions, script, enter, pop, dim, explain, voice over, storytelling
// @guide docs/runtime-api.md
// @times 1, 6, 12
import {scene, beats} from 'explainerkit/core';

const b = beats([
  'Four buses run this morning.',
  'Twelve riders, four buses. Three per bus.',
  'But ask the riders, and the answer changes.',
]);
const s = scene({width: 960, height: 540, label: 'Average riders per bus'});
s.text({text: '3', x: 480, y: 280, fontSize: 150, align: 'middle', fill: '#262d2b'})
  .enter(b.at(1), {style: 'pop'})
  .to(b.at(1.5), {x: 300})
  .dim([[b.at(2), 0.3]])
  .explain('Counting buses', 'Each bus is one vote: 12 ÷ 4 = 3.');
s.text({text: '7', x: 660, y: 280, fontSize: 150, align: 'middle', fill: '#a74a2d'}).enter(b.at(2), {style: 'pop'});

export const player = await s.mount(document.querySelector('#stage'));
player.play();
