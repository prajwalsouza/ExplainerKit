// @recipe characters
// @title Add a character who walks, waves and speaks
// @task Place a ready-made character in a scene and direct it to walk, wave, talk and show emotion on a timeline.
// @uses explainerkit/core, explainerkit/characters
// @keywords character, person, walk, wave, speech bubble, say, emote, acting, mascot
// @guide docs/modules/characters.md
import {scene} from 'explainerkit/core';
import {character, starter} from 'explainerkit/characters';

const drawing = scene({width: 960, height: 540, duration: 8, label: 'A scientist walks in, waves and speaks'});
const ada = character(drawing, starter('bean-scientist'), {x: 160, y: 460, seed: 4});
ada.act('walk', {at: 0.5, duration: 3})
  .act('wave', {at: 4})
  .say('Every invention starts as one point.', {at: 5})
  .emote('happy', {at: 5, duration: 3});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
