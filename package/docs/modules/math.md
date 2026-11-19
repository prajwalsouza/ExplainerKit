# Animate equations

Turn LaTeX or MathML into scene paths so you can follow individual symbols from one step of an equation to the next. The same outlines can become parts of a character or another drawing.

```demo design-square-deal
A square deal. Drag the marker or use the arrow keys to add nine sixteenths to both sides, then factor the left side into a square. Watch the fractions and exponents move between their places while extra symbols grow or retract. The demo follows the opening steps of RhyformJS’s completing-the-square example.
```

## Typeset and place the equation

Load MathJax with SVG output and set `svg.fontCache` to `'none'` so each glyph comes with its own path. Wait for MathJax startup before calling `typesetEquation`. The example assumes `MathJax` is the initialized browser instance with TeX input. Load the MathML input component and set `format: 'mathml'` to typeset MathML. [MathJax conversion methods](https://docs.mathjax.org/en/v4.1/web/convert.html), [SVG output options](https://docs.mathjax.org/en/v4.0/options/output/svg.html).

```js
import {scene} from 'explainerkit/core';
import {addEquation, typesetEquation} from 'explainerkit/math';

const before = scene({width: 520, height: 240});
const after = scene({width: 520, height: 240});
const left = await typesetEquation('x+1=3', {mathjax: MathJax, height: 54});
const right = await typesetEquation('x=2', {mathjax: MathJax, height: 54});
const equation = addEquation(before, left, {x: (520 - left.width) / 2, y: 77});
const solution = addEquation(after, right, {x: (520 - right.width) / 2, y: 77});
```

`height` sizes the full equation view box in scene units and defaults to 72. `addEquation` places its top-left corner at `x, y`. Set `fill` for the equation or set paint on a glyph with its `handle`. Parts from the same MathML token share a `term` number. `role` gives the token type, such as `mi` for an identifier. `placement` records its position within the notation, such as `numerator/exponent` for an exponent inside a numerator.

Use `equationFromSVG(svg, {height})` when you have saved the typeset SVG. For a non-DOM MathJax setup, pass `serializeSVG(result)` to extract and serialize the inner SVG. Your application supplies and configures the typesetter. The importer reads outlines and fraction rules as geometry and bounds each input to 512,000 bytes, 128 parts and 20,000 path commands. SVG references, HTML and MathJax error expressions are rejected.

## Match symbols across equations

Use `createEquationMorph` when both ends are equations. It matches symbols across the whole expression using MathJax glyph identity, MathML type, placement and outline geometry. A compatible digit can reshape into another digit. A symbol without a compatible match shrinks toward or grows from a related symbol. The steps themselves come from the expressions you supply.

```js
import {createEquationMorph} from 'explainerkit/math';

const algebra = createEquationMorph(
  {frame: before.sample(), equation},
  {frame: after.sample(), equation: solution},
);

// Use the Canvas or SVG renderer that displays the scene.
renderer.render(algebra.sample(0.5));
```

Sample from 0 to 1 and use the same progress range when seeking backward. Both frames must use the same viewport and scene light. Inspect `diagnostics.matched`, `reshaped`, `entering` and `leaving` to see the chosen correspondence. Pass `pairs: [[sourcePartId, targetPartId]]` as an option to direct a compatible pair using the scene IDs of its glyph handles.

## Move the outlines into another drawing

Use `createObjectMorph` from the [morph module](morph-safety.md) when an endpoint is a shape, group or character. This example starts with `after` and `solution` from the placement example.

```js
import {character, starter} from 'explainerkit/characters';
import {createObjectMorph} from 'explainerkit/morph';

const cast = scene({width: 520, height: 240});
const bean = character(cast, starter('bean-scientist'), {
  x: 260, y: 204, height: 150, idle: false,
});
const reveal = createObjectMorph({frame: after.sample(), object: solution.handle}, {
  frame: cast.sample(),
  object: bean.handle,
});
```

```demo design-variable-character
An equation with character. Solve for x, then keep dragging until the glyphs turn into parts of the bean scientist.
```

Call `reveal.sample(progress)` with progress from 0 to 1. It returns a display frame for a [Canvas renderer](renderer-foundations.md) or an [SVG renderer](renderer-contracts.md). Keep persistent artwork in a separate layer when it should stay in front of the morph.

Both samplers match visible, filled 2D parts with the same fill rule and up to eight compatible closed contours. Each selection can contain up to 128 drawable parts. The object sampler pairs outlines by position and proportions, then fades the remaining artwork. When both object endpoints supply their equations’ `keys` maps, it pairs identical glyphs and fades unmatched symbols.

## Play the equation morph in Three.js

Use a frame plane when the equation needs to sit among 3D objects. `createThreeFramePlane` puts the Canvas render of each sampled frame on a Three.js object that you can position, rotate and scale. The plane keeps the frame’s proportions and its transparent areas.

This example uses `algebra` from the equation transition above. Supply the imported `THREE` namespace and the `threeScene` that your Three renderer already draws.

```js
import {createCanvasRenderer} from 'explainerkit/renderers/canvas';
import {createThreeFramePlane} from 'explainerkit/renderers/three';

const ink = createCanvasRenderer(document.createElement('div'));
const equationPlane = createThreeFramePlane({THREE, source: ink, width: 4});
equationPlane.object.position.set(0, 1.5, -2);
equationPlane.object.rotation.y = 0.35;
threeScene.add(equationPlane.object);

// Update the plane before drawing the Three scene at this progress.
equationPlane.render(algebra.sample(0.5));
```

Create the plane once and update it when the transition advances. Dispose the plane when you remove the equation, then dispose the Canvas renderer when you are done with it. For solid lettering, set `depth` on the glyph handles and send the world frame through the Three adapter. Extrusion requires simple contours that the adapter can triangulate. The frame plane also displays equations whose outlines overlap during the morph. [Three.js frame and geometry options](spatial-three.md).
