# Measured label placement

Use `placeLabels` when names need to fit around points without covering one another. Import it together with `canvasTextMeasurer` from `explainerkit/layout/labels`. The planner needs a measurement function so it can reserve the actual width and height of each label. In a browser, wait for fonts to load before creating that function.

```js
await document.fonts.ready;
const measure = canvasTextMeasurer(canvas.getContext('2d'), {
  font: '18px sans-serif', lineHeight: 24,
});
const boxes = placeLabels([
  {id: 'speed', text: 'Speed', anchor: {x: 100, y: 80}},
], {bounds: {x: 0, y: 0, width: 400, height: 240}, measure, gap: 6});
```

The returned boxes keep each label inside the declared bounds and at least the requested gap away from earlier labels and supplied obstacles. The planner keeps the measured dimensions rather than shrinking text to fit. If none of its supported positions works, it throws `LABEL_LAYOUT_OVERFLOW` without changing the displayed scene. Apply all returned positions only after planning succeeds so a failed attempt leaves the previous layout intact.

The planner tries eight positions around each anchor in input order and uses the first position that fits. This is a greedy search, so the same inputs produce the same result, but it can reject a layout that a more general solver could arrange. It accepts up to 256 labels and 256 rectangular obstacles. It does not reduce crossings between leader lines, decide which comparisons must remain visible, reveal labels over time, or replace the adaptive layout system.

`canvasTextMeasurer` measures one unwrapped line and restores the caller's font even if measurement fails. Your application loads the font and supplies a line height large enough to contain its glyphs. For multiline text, scripts that need shaping, or rotated labels, supply a custom function that returns an accurate enclosing box aligned with the horizontal and vertical axes. The planner keeps those declared boxes apart, but it cannot account for a glyph, shadow, stroke or hit region that was not included in the measurement. Check the result with the fonts and devices your application uses.