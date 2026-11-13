# Label callouts, dashed strokes and elliptical arcs

Use a label callout when a ring and leader should identify an object without covering the scene with a panel. The first example assumes `s` is a scene, `subject` is its target handle, `callout` is imported from `explainerkit/layout`, and `loadedFace` is a parsed font. Later sections show how dash patterns and elliptical paths can use the same scene methods.

```js
const words = callout(s, {
  target:subject, anchor:[-30,20], ring:16,
  style:'label', route:'shoulder', at:2,
  label:{text:'A label',font:loadedFace,size:32,at:[120,180]},
  timing:{ring:.2,line:.45,word:.3},
});
```

Choose `style:'label'` to connect a ring to a word and underline without a background panel. The result contains `{ring,line,label,word}` handles. Supply a font returned by `parseFont` or `loadFont` so glyphs can be drawn as self-contained outlines while retaining their text meaning. Choose `style:'hud'` for a panel callout instead.

`anchor` is target-local. `label.at:[x,y]` places the underline's left end at absolute scene coordinates when the callout begins. `label.offset:[dx,dy]` instead places it relative to the sampled anchor. Choose one. Both modes subsequently follow the anchor's motion, including its transformed local position; the label remains upright in world coordinates. Labels may be placed anywhere, so authors remain responsible for viewport clearance and overlap with other content.

The shoulder route starts on the actual ring edge, reaches the nearer underline end, then draws the underline to its far end. Underline width uses the greater of measured advance and ink width. The default sequence is ring .2s, line .45s, word .3s; timing values may be zero for cuts. The word rises through a fixed local clip whose bottom is the underline's upper stroke edge. Actual outline bounds determine the starting and final baselines, including descenders. `label.gap` controls clearance (at least half the stroke width), and `label.fill` overrides the text paint. `stroke` and `strokeWidth` control the ring and leader. No wall-clock state is used.

## Dashes

Every drawable accepts `strokeDasharray:[8,4]` and `strokeDashoffset:0`. Arrays are captured/frozen, contain at most 128 nonnegative lengths and have a total cycle length at most one million local units. Empty and all-zero patterns are solid. Odd-length patterns use the native repeated-cycle convention in both renderers.

```js
const wire = s.line({x1:30,y1:60,x2:330,y2:60,
  stroke:'#315d62',strokeWidth:4,strokeDasharray:[10,5]});
wire.animate('strokeDashoffset',{from:0,to:30,duration:2,ease:'linear'});
wire.animate('strokeDasharray',{from:[10,5],to:[6,9],duration:2,ease:'linear'});
```

Dash arrays support `animate`, `to`, `keys`, `replaceKeys` and bindings. Interpolated patterns must retain the same nonempty array length; provide an explicit `from` when the authored pattern is empty. Easing must keep lengths nonnegative. Offset uses the ordinary numeric channel rules.

A Canvas platform without `setLineDash` rejects a visible nonzero pattern with `RENDER_UNSUPPORTED` and capability `stroke.dashes` before replacing the previous output. Nonzero dashes cannot be combined with active path trimming in either native renderer because they would require two independent stroke patterns. That combination reports `stroke.dashTrim`. The optional Three adapter rejects authored dashes with `THREE_UNSUPPORTED` and capability `stroke.dashes`.

## Ellipses and arcs

```js
const orbit = s.ellipse({x:240,y:160,rx:100,ry:45,
  startAngle:.2,endAngle:5.4,fill:'none',stroke:'#315d62',
  strokeWidth:3,strokeDasharray:[12,7]});
```

`scene.ellipse` and `group.ellipse` create path geometry around the local origin. Position, rotation and scale use normal path properties. Radii must be nonnegative and the angle span cannot exceed one turn in either direction. A full ellipse closes by default. A partial arc stays open unless `closed:true` adds a straight chord between its endpoints. Use `fill:'none'` to draw only the arc’s stroke.

The helper generates adaptive cubic segments, with a conservative .01 local-unit approximation bound. SVG and Canvas draw the same commands. It does not add SVG `A` syntax or a separate ellipse node type; radii/angles are construction arguments. Animate scale/rotation or bind path commands when geometry must change.

Misspelled names such as `lineCap`, `lineJoin`, `lineWidth`, `dashArray` and `strokeLineCap` produce `UNKNOWN_PROPERTY` text suggesting the corresponding supported stroke name. Getter-valued options are refused without running them.

## Verification

`tests/core/labels-strokes.test.js` checks moving anchor geometry, both label placement modes, exact rewind, atomic failures, captured dash animation, numerical ellipse error and stroke-name hints. `tests/browser/labels-strokes-checks.html` measures SVG/Canvas pixels, detects any word ink before reveal or below the clip, checks leader endpoints within .01 units, probes known dash gaps after offset animation, and verifies unsupported compound strokes preserve prior raster/DOM output.

These fixtures use original synthetic geometry and font bytes. They check supported callout and stroke behavior without establishing similarity to a reference video.

A scoped three-engine report records leader endpoint error, premature word pixels, rewind differences and SVG/Canvas pixel comparisons. Its selected-suite status is `partial`. Its screenshot check uses a minimal original font whose A glyph is a triangle, so it is a geometry check rather than a typography specimen.