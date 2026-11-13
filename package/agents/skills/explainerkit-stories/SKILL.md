---
name: explainerkit-stories
description: "Use when building a scroll-driven story, a narrated film with chapters and captions, syncing to media, or controlling playback and export with the ExplainerKit JavaScript library. Covers explainerkit/story, explainerkit/scroll, explainerkit/film, explainerkit/player, explainerkit/media, explainerkit/project, with tested recipes and the exact option vocabularies."
---

# Scroll stories, films and playback

This skill is generated from the ExplainerKit package by `scripts/agents/build.mjs`. ExplainerKit's API is JavaScript, so you use it by writing ES modules. Option names are validated, and a guessed name fails at run time with a coded error, so start from a recipe below and read the linked guide before using an option you have not seen.

## Modules

- `explainerkit/story`: Scroll acts, holds, controls and reversible cue policies. Read `docs/modules/story-delivery.md`, `docs/modules/story-cues-hover-intent.md`.
  Exports: `ARRIVALS`, `DEFAULT_PACE_BOUNDS`, `SCROLL_PACES`, `arrivalPlan`, `arrivalTime`, `attachStory`, `holdControls`, `scrollPace`, `storyTimeline`.
- `explainerkit/scroll`: Scroll-to-time adapter. Read `docs/modules/story-delivery.md`.
  Exports: `ARRIVALS`, `DEFAULT_PACE_BOUNDS`, `SCROLL_PACES`, `arrivalPlan`, `arrivalTime`, `attachScroll`, `scrollPace`, `scrollProgress`, `scrollTime`.
- `explainerkit/film`: Narrated film composition and player. Read `docs/modules/film-kit.md`.
  Exports: `film`, `palette`.
- `explainerkit/player`: Browser mounting, clock, interaction lifecycle and disposal. Read `docs/runtime-api.md`, `docs/modules/timeline-player.md`, `docs/modules/projection-player.md`.
  Exports: `attachSceneLayer`, `createProjectionPlayer`, `createTimelinePlayer`, `mount`.
- `explainerkit/media`: Media-clock synchronization. Read `docs/modules/media-clock.md`.
  Exports: `attachMedia`.
- `explainerkit/project`: Bounded project recipes and history. Read `docs/modules/projects.md`.
  Exports: `buildProject`, `createProject`, `parseProject`, `serializeProject`.

## Recipes

Each recipe runs as written in a page with `<div id="stage">` and is tested in Chromium.

### Drive a scene by scrolling the page

Pin the scene in a sticky stage and map scroll position to scene time through acts with held moments.

```js
import {scene} from 'explainerkit/core';
import {attachStory} from 'explainerkit/story';

// Page structure: a tall story element containing a sticky stage.
const story = document.createElement('section');
story.className = 'story';
const stage = document.createElement('div');
stage.className = 'story-stage';
stage.style.cssText = 'position:sticky;top:0;height:100vh';
story.append(stage);
document.querySelector('#stage').append(story);

const drawing = scene({width: 640, height: 360, duration: 4, label: 'A bar grows as the reader scrolls'});
drawing.rect({x: 60, y: 160, width: 0, height: 40, fill: '#34766b'}).to(0, {width: 520}, {duration: 4, ease: 'linear'});

export const player = await drawing.mount(stage);
export const scroll = attachStory(player, {
  element: story,
  sticky: stage,
  acts: [
    {id: 'start', from: 0, to: 2, length: '150vh', holds: [{at: 1, length: '40vh'}]},
    {id: 'finish', from: 2, to: 4, length: '150vh'},
  ],
});

// The story owns the player's clock, so previews and tests move it by scrolling.
export async function seek(time) {
  const travel = story.getBoundingClientRect().height - innerHeight;
  window.scrollTo(0, travel * Math.min(1, time / 4));
  await new Promise((done) => setTimeout(done, 400));
}
```

### Time shapes to narration lines

Turn narration sentences into beat times, then make shapes enter, move, dim and explain themselves at those beats.

```js
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
```

## Vocabularies

- Named easings: linear, smooth, easeOut, easeInOut, launch, titleOpen, anticipateOut, linearStop, snapIn.
- Entrance styles: fade, rise, pop, cut, reveal.
- Text properties: text, fontSize, fontFamily, fontWeight, letterSpacing, align, baseline, wrap, lineHeight, minScreenSize, halo, textOutline, textAdvance.

The full lists, including every shape's properties, are in `agents/catalog.json` under `vocabularies`.

## Common mistakes

- For new VFX shots, prepare fitted camera poses with compileCameraTrack. Its standard level repairs isolated pose spikes by default. Choose strong for smaller spikes or none to inspect the original poses.
- Text alignment is the `align` property with the values start, middle and end. `textAnchor` is SVG vocabulary and is rejected.
- That easing name does not exist. Named easings are listed in vocabularies.easings, for example easeOut, easeInOut, smooth or linear, or pass a trusted progress function.
- Text `align` takes start, middle or end, not center, left or right.
- Path commands are absolute M, L, C, Q and Z only. Convert relative, smooth (S, T), arc (A) and horizontal or vertical (H, V) commands, or build paths with explainerkit/geometry.
- The `glow` property is an object, not a number. See docs/modules/graphics.md.
- A cloud takes `points: {positions: [x0, y0, x1, y1, …], radii?, colors?}`, not an array of {x, y} objects.
- A band scale exposes `bandwidth` and `step` as numbers, not methods. Write `x.bandwidth`.
- Create scenes with `scene({width, height})` from explainerkit/core. There is no global ExplainerKit object.
- You rarely need your own animation loop. Animate with `to`, parameters or timelines and let `scene.mount()` return a player that owns the clock, so seeking and export keep working.
- ExplainerKit has its own scales, timelines and effects. Check find_capability before adding another animation or charting library. Three.js is supplied to explainerkit/renderers/three, not imported by ExplainerKit.
- Drawing directly to SVG or Canvas bypasses the scene, so seeking, export and audits cannot see it. Add shapes to a scene and mount it, or use a renderer from explainerkit/renderers/svg or explainerkit/renderers/canvas.

## Check your work

Run the module and look at it before you report success. With the ExplainerKit MCP server, call `preview` with the code and the scene times to capture. Without it, run `node agents/cli.mjs preview path/to/module.js --times 0.5,2` from the ExplainerKit repository. Both return screenshots, console output and errors. Fix every error and check that the picture shows what the task asked for.
