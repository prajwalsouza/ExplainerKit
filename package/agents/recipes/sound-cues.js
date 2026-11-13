// @recipe sound-cues
// @title Give a move a sound that is timed to it
// @task Generate a whoosh and impact tied to an animation and attach the soundtrack to the scene player.
// @uses explainerkit/core, explainerkit/sound
// @keywords sound effect, whoosh, impact, audio, soundtrack, cue, sync sound to motion
// @guide docs/modules/sound.md
import {scene} from 'explainerkit/core';
import {createSoundtrack, cueForMotion, attachSoundtrack} from 'explainerkit/sound';

const move = {at: 0.5, duration: 0.8};
const drawing = scene({width: 640, height: 300, duration: 2.5, label: 'A dot lands with a thud'});
drawing.circle({x: 80, y: 150, r: 24, fill: '#34766b'}).to(move.at, {x: 560}, {duration: move.duration, ease: 'launch'});

const score = createSoundtrack([
  cueForMotion('whoosh', move, {options: {seed: 2}}),
  cueForMotion('impact', move, {options: {intensity: 0.5}}),
]);
export const player = await drawing.mount(document.querySelector('#stage'));
// Playback needs a user gesture in browsers: call `await sound.play()` from a click handler.
export const sound = attachSoundtrack(player, score.render({duration: 2.5}));
