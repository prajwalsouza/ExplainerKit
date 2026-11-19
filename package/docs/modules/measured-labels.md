# Measured label placement

When points crowd together on a chart, a name that fits on the right of one point may cover the next name. Use `placeLabels` to assign a measured box to each label. The planner tries positions around each anchor, which is the point the label names. It also checks rectangular obstacles, such as the space reserved for the Moon in this star chart.

```demo measured-labels-drag
Give the stars some space. Drag Deneb toward the right edge and watch its name switch sides. Then try to photobomb a star with the Moon. Press Tab to select a star or the Moon and use the arrow keys to move it.
```

The Moon's dashed square shows the rectangle passed to the planner, including the corners beyond the visible disc. Each label box must fit inside the declared bounds and leave the requested gap from earlier labels and all obstacles. When a move fails, the chart marks the attempted position and keeps the last accepted positions for both the objects and their labels.

Add a canvas to your page, then run the JavaScript below in a browser module where `explainerkit/layout/labels` resolves. See [Getting started](../getting-started.md) for ways to load the library.

```html
<canvas id="stars" width="320" height="160" aria-label="Chart of Vega and Deneb"></canvas>
```

Wait for fonts before measuring so the canvas uses the same font for measuring and drawing. The example puts Vega and Deneb close enough that their names would overlap if both went to the right. After planning, it draws both dots and places the names at the returned coordinates.

```js
import {canvasTextMeasurer, placeLabels} from 'explainerkit/layout/labels';

const canvas = document.querySelector('#stars');
const context = canvas.getContext('2d');
const font = '18px sans-serif';
await document.fonts.ready;
const measure = canvasTextMeasurer(context, {font, lineHeight: 24});
const stars = [
  {id: 'vega', text: 'Vega', anchor: {x: 120, y: 80}},
  {id: 'deneb', text: 'Deneb', anchor: {x: 146, y: 98}},
];
const boxes = placeLabels(stars, {
  bounds: {x: 0, y: 0, width: canvas.width, height: canvas.height},
  measure,
  gap: 6,
});

context.font = font;
context.textBaseline = 'middle';
for (const {anchor: {x, y}} of stars) {
  context.beginPath();
  context.arc(x, y, 3, 0, 2 * Math.PI);
  context.fill();
}
for (const box of boxes) {
  context.fillText(box.text, box.x, box.y + box.height / 2);
}
```

Move Deneb's anchor to `x: 240` and run the example again. The greater distance lets the planner put both names to the right of their stars.

The planner visits labels in input order. For each anchor, it tries the right, left, above and below positions, followed by the four corners. It keeps the first position that fits and moves on to the next label. This is a greedy search, so the same measured input produces the same result, and an early label can take space that a later one needs. Put labels whose placement matters most early in the list.

The measured dimensions stay fixed. If all eight positions fail for any label, the planner throws `LABEL_LAYOUT_OVERFLOW`. It returns boxes only when the whole plan fits. Apply them after planning succeeds so a rejected attempt keeps the previous layout. The planner accepts up to 256 labels and 256 rectangular obstacles. Applications handle priorities, leader line crossings, label reveal and adaptive layout separately.

`canvasTextMeasurer` measures one unwrapped line and restores the context's previous font even if measurement fails. Supply a line height large enough to contain the glyphs you draw. For multiline text, shaped text with different metrics, or rotated labels, supply a synchronous function that returns a box aligned with the horizontal and vertical axes. Include shadows, strokes and hit regions in that measurement when they need space. Check the result with the fonts and devices your application uses.

## Label a circle

A radial chart names marks that sit around a rim, and its labels follow different rules from labels beside points. Use `placeRadialLabels` for those names. Give each label the `angle` of its mark in radians, measured clockwise from the right on screen, and the `span` its mark covers. The placer then decides how to set each name, moves crowded names apart and hides the ones that still do not fit.

A name whose mark is wide stands upright just outside the rim. Its alignment points away from the centre, so names on the right start at the rim and names on the left end at it. A mark counts as wide when its span is at least `wideArc` radians (0.16 by default) or when the name fits along its arc. A narrower mark gets its name along the radius instead, like a spoke, so that names of neighbouring thin slices stack side by side rather than on top of each other.

Neighbouring names that would still collide slide apart around the rim, each by at most `maxShift` radians (0.12 by default). Spokes keep at least `spokeGap` radians apart (0.045 by default). When sliding is not enough, the name with the lower `priority` is hidden, and the name whose ID you pass as `keep` is never hidden. A chart can pass the hovered or selected row as `keep` so that its name always shows.

A label can also sit inside its own mark, as the names of a sunburst's inner ring do. Give it a `band` with the mark's inner and outer radii in `r0` and `r1`. The name then runs along the radius through the middle of the band, in a box 86% as long as the band. The returned `box.lines` is 2 when the arc is wide enough for two lines and 1 otherwise. A label whose arc cannot hold one line is hidden. Pass the mark's `fill` colour and the label returns `ink`, which is `'light'` or `'dark'` depending on which of the `light` and `dark` text colours has the higher contrast against that fill.

The following module assumes a page with `<canvas id="ring" width="320" height="320">`. It places three names 128 units from the centre at (160, 160). Rachel's arc is wide, so her name stands upright. Gunther and Janice share a narrow sliver and cannot both fit, so Gunther, who has the lower priority, is hidden.

```js
import {canvasTextMeasurer, placeRadialLabels} from 'explainerkit/layout/labels';

const context = document.querySelector('#ring').getContext('2d');
const measure = canvasTextMeasurer(context, {font: '13px sans-serif', lineHeight: 16});
const placed = placeRadialLabels([
  {id: 'rachel', text: 'Rachel', angle: 0, span: 0.8, priority: 5},
  {id: 'gunther', text: 'Gunther', angle: 2, span: 0.02, priority: 1},
  {id: 'janice', text: 'Janice', angle: 2.01, span: 0.02, priority: 2},
], {cx: 160, cy: 160, r: 128, measure});

context.font = '13px sans-serif';
context.textBaseline = 'middle';
for (const label of placed) {
  if (!label.visible) continue;
  context.save();
  context.translate(label.x, label.y);
  context.rotate(label.rotation);
  context.textAlign = label.align === 'middle' ? 'center' : label.align === 'start' ? 'left' : 'right';
  context.fillText(label.text, 0, 0);
  context.restore();
}
```

Each result keeps its `id` and `text` and gives the point `x`, `y` where the text is anchored, the final `angle`, the `rotation` to draw it at, its `align`, its `orientation` (`'upright'`, `'ray'` or `'inside'`) and whether it is `visible`. Rotated names are already turned so that they never read upside down. The placer accepts up to 256 labels. It runs at most 40 passes to move names apart and then hides at most one name per pass.
