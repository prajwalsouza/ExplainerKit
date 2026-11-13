// @recipe common-effects
// @title Use ready-made entrances: fly in, typewriter and wipe
// @task Apply seekable preset effects such as flyIn, typewriter, wipe and pulse to shapes and text.
// @uses explainerkit/core, explainerkit/motion/effects
// @keywords entrance, fly in, typewriter, typing, letter by letter, text appears, types itself, wipe, pulse, teeter, flash, preset effect, title animation
// @guide docs/modules/common-effects.md
import {scene} from 'explainerkit/core';
import {commonEffect, bindCommonEffect} from 'explainerkit/motion/effects';

const drawing = scene({width: 640, height: 360, duration: 4, label: 'A title types itself, a card wipes in, a dot flies in'});
const title = drawing.text({x: 60, y: 80, text: 'A small discovery', fontSize: 34, fill: '#262d2b'});
bindCommonEffect(title, commonEffect('typewriter', {text: 'A small discovery', duration: 1.5}));

const card = drawing.group({x: 60, y: 130});
card.rect({width: 260, height: 120, fill: '#3b8778'});
bindCommonEffect(card, commonEffect('wipe', {at: 1.2, duration: 1, width: 260, height: 120, direction: 'right'}));

const dot = drawing.circle({x: 480, y: 190, r: 34, fill: '#a74a2d'});
bindCommonEffect(dot, commonEffect('flyIn', {at: 2, duration: 1, direction: 'left', distance: 160, x: 480, y: 190}));

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
