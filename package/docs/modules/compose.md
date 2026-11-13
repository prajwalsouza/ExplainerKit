# Compose: decide where things go

The [composition audit](composition-audit.md) reports layout problems. These helpers in `explainerkit/layout` use the same measurements to place labels, wrap text and choose contrasting ink. Inspect the resulting scene with the audit as you work.

```js
import { place, attach, inkFor, paragraph, wrapText, panel, pathPoint } from 'explainerkit/layout';
```

## Put words in clear space: `place`

```js
const spot = place(scene, { text: 'other guests for an even chance', fontSize: 26, near: bo, from: 20, to: 30, prefer: 'above' });
scene.text({ text: '…', x: spot.x, y: spot.y, align: 'middle', baseline: 'middle' });
if (!spot.clear) console.warn('no clear space: overlap', spot.overlap);
```

`place` samples the scene during `[from,to]` before camera projection, then searches outward from `near`. When `near` is a node, the search starts just beyond its edge so the proposed label does not cover its subject. The `prefer` direction is tried first.

Every mark acts as an obstacle except ignored tags, which default to `decor` and `background`, and ground shapes covering more than half the stage. Obstacles are expanded by `margin`, which defaults to 12. Text receives more avoidance weight than strokes, followed by fills. The search remains inside `region`, which defaults to the title-safe area.

The result is `{x,y,box,clear,overlap}`, with x and y at the label’s center. When `clear` is false, the result is the least obstructed position found. You still need to move another object, shorten the text or choose a panel rather than treating that result as a collision-free placement.

## Keep a label beside what it names: `attach`

```js
attach(scene.text({ text: 'someone shares your birthday' }), curve, { side: 'end', gap: 16, dy: -20 });
attach(scene.text({ text: 'giant' }), jumper, { side: 'right', gap: 16, from: 72, until: 90 });
```

`attach` binds a label’s x and y to the target’s current bounds. Choose `right`, `left`, `above`, `below` or `center`, or choose `end` to follow the visible end of a trimmed path. The helper also sets text alignment for the chosen side.

The `from` and `until` options limit when the target is measured. Outside that interval the label holds its boundary position without another measurement. The helper uses `scene.locate` to account for the target’s geometry and transform.

## Where is a node? `scene.locate`

```js
const { x, y, box, matrix, opacity, visible } = scene.locate(handle, { time: 12 });
```

`scene.locate` returns an object’s origin, combined bounds including descendants, transform and effective opacity in scene coordinates before the camera. It can be called from another object’s binding when the located object does not depend on that binding. Pass the binding’s context as `time` so measurements are shared within the same sample. Several labels following one figure then measure it once.

## Ink that reads: `inkFor`

```js
fill: inkFor('#fbfaf7', palette.accent, { size: 18 })   // '#db2f00': same hue, 4.5:1 for small text
fill: inkFor(night.sky, '#3b6fd4', { size: 40, weight: 700 })
```

`inkFor` keeps hue and saturation while changing lightness until the foreground and background meet the WCAG 2.2 contrast threshold. That threshold is 4.5 to 1 for ordinary text, or 3 to 1 for text at least 24 px tall or at least 18.66 px when bold. The function first tries moving lightness farther from the background, then the opposite direction if needed. An input that already passes is returned unchanged. For a fixed background, the film palette’s `…Ink` values have already been calculated.

## More than one line: `wrapText`, `paragraph`

A text node draws one line. `wrapText(text,{width,fontSize})` divides a string into lines by fitting as many words as possible at each step, using the audit’s width estimate or your `measure` callback. `paragraph(scene,{text,x,y,width,fontSize,lineHeight,align,fill})` creates one node for each line and returns `{group,lines,width,height}`. In both functions, `\n` explicitly starts a new line.

## A card sized from its words: `panel`

```js
panel(scene, { x: 1140, y: 230, lines: [{ text: 'shared: 50.7%', fontSize: 40, fontWeight: 700, fill: palette.accentInk }, { text: 'all different: 49.3%', fontSize: 28 }] });
```

`panel` sizes its background from the supplied text and defaults to padding of 0.9 em based on the largest line. Equal padding on opposite sides avoids `cardPadding`, `cardBalance` and `cardOverflow` findings for that constructed panel. Use a panel when the background is part of the intended design. If it is only hiding a collision, try `place` first and inspect the audit’s `coverUp` finding.

## Along a path: `pathPoint`

`pathPoint(commands, u)` returns `{x, y, tx, ty}` at arc-length fraction `u`, for leader lines, arrowheads and labels that ride a curve.

## Limits

Outside the browser, text widths are estimates with about ±10% error. `place` treats each mark as a box, so a thin line can reserve more empty space than its visible stroke. For several labels, call it in order and exclude earlier placements with `exclude` because it searches one box at a time. Limit `attach` with `from` and `until` when a large target would otherwise be measured on every frame. Tests in `tests/modules/compose.test.js` include a placed label that leaves the audit with nothing to report.