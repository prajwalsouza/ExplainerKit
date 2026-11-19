# Emphasis

An explanation often needs the reader to look at one word, term or part while the rest stays visible. Emphasis does that by treating the target and its context differently. The target takes an accent colour and can grow or lift slightly. The context recedes by fading and losing some colour, but it never disappears. `explainerkit/emphasis` describes that as a track of moments over time, so the same emphasis appears when a film is scrubbed, reversed or exported.

## Emphasise one word in a title

```demo design-cat-emphasis
Choose a word to shift the blame. The highlighted word changes while the rest of the sentence stays readable.
```

This example accents the word "frame" in a title and lets the other words step back. It assumes the title has already been split into one element per word, for example with `kineticText` from `explainerkit/typography`, and that `tokens` holds those elements.

```js
import {emphasis, topics, tagTokens, emphasizeDOM} from 'explainerkit/emphasis';

const palette = topics({frame: 'hsl(10 76% 56%)', time: 'hsl(200 50% 45%)'});
const track = emphasis({palette, recede: {opacity: 0.55, desaturate: 0.3}})
  .on('frame', {topic: 'frame', at: 1.2, duration: 0.5})
  .off({at: 4});

const targets = tagTokens(tokens, {frame: 'frame'});
const binding = emphasizeDOM(track, {targets, context: tokens, ink: '#222222', player});
```

`topics` gives each idea one colour, so "frame" in a title and in a code chip can share an accent across a page. `emphasis` creates the track, `on` adds a moment of emphasis and `off` lets the context return. `tagTokens` finds words and phrases among split tokens, which keeps the emphasis attached to the right word after the text is split for animation.

`emphasizeDOM` writes the styles. With a `player`, each frame event updates the elements, and the player's dispose event restores every element's original `style` attribute. Without a player, call `binding.update(time)` yourself and `binding.dispose()` when you are done. The `ink` colour is the target's normal text colour, which it mixes from toward the topic colour.

## Hand emphasis from one target to the next

Calling `on` again moves the emphasis. The outgoing target fades while the incoming one rises, and the context stays receded throughout, so the page never flashes back to neutral between them. A target named in two consecutive moments stays lit without dipping.

```js
track
  .on('frame', {topic: 'frame', at: 1})
  .on(['bar3', 'label3'], {topic: 'time', at: 3})
  .on('frame', {topic: 'frame', at: 5})
  .off({at: 7});
```

Each change needs its own time. Two changes at the same moment are rejected with `EMPHASIS_OVERLAP`, because the result would depend on their order. When a change begins before the previous ramp has finished, the values continue from where that ramp had reached, so nothing jumps.

## Emphasise parts of a scene

`emphasizeScene` drives scene handles through ordinary bindings, so the scene's own sampling, seeking and export see the emphasis. Give each target its base `fill`, because the handle's own fill is what the accent mixes from.

```js
import {emphasizeScene} from 'explainerkit/emphasis';
const link = emphasizeScene(track, {
  targets: {bar3: {handle: bar3, fill: '#777777'}},
  context: [{handle: bar1}, {handle: bar2, fill: '#777777'}],
});
// Later, to give the properties back:
link.release();
```

A target binds `fill`, `scaleX` and `scaleY`, and a context entry binds `opacity`, plus `fill` when you give one so that it can lose colour too. Those properties belong to the binding until `release()`, so `set()` on them is rejected in the meantime. If any handle is invalid, every binding made so far is undone before the error is thrown.

## Read the values directly

For a renderer of your own, read the state at a time. `track.state(time)` returns each target's emphasis from 0 to 1, its topic, and how far the context has receded. `track.targetStyle(name, time, {color})` returns the mixed colour, scale and lift for one target. `track.contextStyle(time, {color})` returns the opacity multiplier, the desaturation, the blur and, when you pass a colour, the desaturated colour.

| Option | Default | Meaning |
| --- | --- | --- |
| `recede.opacity` | `0.55` | The context's opacity at full recession, from 0.15 to 1. |
| `recede.desaturate` | `0.35` | How much colour the context loses, from 0 to 1. |
| `recede.blur` | `0` | A blur in pixels for DOM context, from 0 to 8. |
| `duration` | `0.45` | Seconds for each change to ramp. |
| `ease` | `easeInOut` | A named easing from `explainerkit/motion`. |
| `scale`, `lift` | `1`, `0` | How much a target grows and rises at full emphasis. |

## Keep receded text readable

A context that recedes too far becomes hard to read. Pass the text and background colours and a contrast floor, then call `audit()`.

```js
const track = emphasis({recede: {opacity: 0.5}, contrast: {text: '#111111', background: '#ffffff', floor: 4.5}});
const report = track.audit();
```

The audit composites the context text at each recede level used by the track over the background and compares the result with the floor, using the WCAG contrast ratio. A level below the floor is reported as `RECEDE_TOO_FAINT` with the ratio it reached. The audit reports problems and does not change the track.
