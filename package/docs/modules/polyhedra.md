# Turn and split a 3D shape

Use `polyhedron` to draw a cube or an icosahedron as ordinary scene paths, so you can turn the shape or open a cut through it without adding a separate 3D renderer. A polyhedron is a solid enclosed by flat faces. The supported solids are convex, which means they have no inward dents and a straight line between any two interior points stays inside the solid.

A cube has six square faces, while an icosahedron has twenty triangular faces. Each face is drawn as a flat polygon whose color depends on its direction relative to the light. This makes the form readable as it turns, while keeping it part of the same scene as your text, diagrams and other artwork.

## Create and turn the shape

The example below creates an icosahedron that starts turning immediately and begins opening along a cut after one second. Add `<div id="stage"></div>` to your page before running the JavaScript. If you have not set up a project yet, follow [Getting started](../getting-started.md) for npm or plain HTML imports.

```js
import {scene} from 'explainerkit/core';
import {polyhedron, split} from 'explainerkit/geometry';

const drawing = scene({width: 600, height: 400});
const solid = polyhedron(drawing, {
  kind: 'icosahedron',
  width: 180,
  yaw: 0,
  light: [-.4, -.6, 1],
  ramp: ['#16374a', '#8fd7bc'],
});
solid.handle.set({x: 300, y: 200});
solid.inputs.yaw.to(0, 1.2, {duration: 2});

const cut = split(solid, {
  plane: {normal: [1, .3, .2], offset: 0},
  interior: '#ed7147',
});
cut.pieces[0].offset.to(1, .2, {duration: 1});
cut.pieces[1].offset.to(1, .2, {duration: 1});

const player = await drawing.mount(document.querySelector('#stage'));
player.play();
// Call player.dispose() when you remove this example from the page.
```

The returned `solid.handle` is the scene object that controls the whole shape. Setting its position places the shape at the center of this example. The separate `solid.inputs.yaw` parameter controls its turn, so animating that value does not require replacing any faces. Try changing `kind` to `'cube'` to compare how the two shapes turn under the same light and timing.

`width` sets the shape's horizontal span before it is rotated. That scale stays fixed throughout the animation, even though the visible outline can become wider or narrower as different faces turn toward you. For example, a cube seen diagonally can occupy more horizontal space than the same cube seen straight on, even though its width parameter has not changed.

## Understand the view and rotation

The shape is drawn with an orthographic projection, which means that moving a point farther from the viewer does not make it appear smaller. This differs from a perspective view, where distant objects look smaller. Orthographic drawing is useful when you want the shape's geometry to remain easy to compare, but this API does not offer perspective as another view setting.

Coordinates follow the screen along the horizontal and vertical axes, with positive y pointing downward. The viewer looks toward the shape from the positive z direction. The z coordinate records depth even though each face is ultimately drawn as a two-dimensional path.

All three rotation angles use radians. A full turn is `2 * Math.PI` radians. The library first applies `yaw` around the y axis, then `pitch` around x, and finally `roll` around z. Their order matters because turning an already rotated shape can give a different result from applying those turns in another order.

When you supply a number for width or an angle, the library creates a scene parameter and exposes it through `solid.inputs`. You can instead supply an existing numeric parameter or derived value from that same scene, which lets the shape follow a slider or another calculation. Inputs from a different scene are rejected because their values belong to another scene and cannot be sampled together here.

## Choose how the faces are lit

The `light` array describes the direction toward the light in the viewer's coordinate system. The library normalizes that vector, meaning it keeps the direction but gives the vector a length of one. It remains fixed as the shape turns, so each face changes brightness according to which way it points.

The `ramp` is a sequence of two to thirty-two opaque colors used to turn brightness into a face color. A face pointing toward the light receives a brighter position along that sequence, while one pointing away retains a base brightness. The exact calculation is `0.2 + 0.8 * max(0, normal·light)`, where `normal` is the outward-pointing direction perpendicular to the face and the dot product measures how closely it points toward the light.

Each face receives one color across its entire surface. This is flat shading rather than a simulation of light spreading across a material. The API does not support translucent faces, textures or arbitrary imported meshes, so use [the optional Three.js renderer](spatial-three.md) when your scene requires those other rendering capabilities.

## Open a cut through the solid

`split` takes a plane that crosses the solid and creates two pieces with new faces covering the cut. A plane is a flat surface extending through space, and its `normal` vector specifies the direction perpendicular to that surface. The example uses `[1, .3, .2]` to make a slanted cut through the center. The library normalizes this direction before using it.

The plane's `offset` moves the cutting surface away from the center along its normal. This is a signed distance measured relative to the solid's width before rotation. An offset of `0` passes through the center, while `.1` moves the plane by one tenth of the width in the positive normal direction. The plane must still pass through the interior, so a value that places it entirely outside the solid is rejected. The new faces exposed by the cut use the supplied `interior` color rather than the lighting ramp.

Each piece has a `side` value and its own `offset` parameter. The `side` identifies the negative or positive side of the cut, while the piece's offset controls how far it moves outward along that side's direction. This separation also uses the solid's width as its unit, so `.2` moves a piece by one fifth of that width. The value cannot be negative because it moves a piece away from the cut rather than through the other piece.

The two offset animations in the example begin at one second and reach `.2` at two seconds. Both pieces continue to use the solid's rotation and scale, which makes the opening follow the turning shape. They cannot be translated or rotated independently through this API because the renderer relies on their shared separating plane to keep their overlap correct.

## Keep placement and drawing order together

Splitting inserts the new drawing inside the original shape's group and hides the original face paths. This preserves positioning and animation already applied to `solid.handle`. Use `cut.handle` when you need to control the new shared drawing group. The two logical pieces are controlled through their offset parameters and face records rather than separate scene groups.

The renderer draws farther faces before nearer ones so the nearer faces cover them. For a split shape, it first determines which half lies farther away using the rotated cutting plane, then orders the faces within each half. Sorting the halves only by their center points would give incorrect overlap for some views, as would drawing every newly exposed interior face last.

Scene path IDs identify positions in that drawing order rather than permanently identifying particular geometric faces. A path may therefore draw a different face after the shape turns. If your application needs to track a specific face, use the face IDs returned by `facesAt` instead of relying on a scene path ID.

## Inspect a chosen moment

Call `solid.facesAt({time, width, height})` to inspect the shape at a scene time and viewport size, or call `cut.facesAt(...)` to inspect its split drawing. Each call returns records that cannot be edited in place. The records include a stable geometric face ID, projected x/y/z points, the face's outward direction, visibility, depth, fill, piece number and whether it covers the cut interior. An uncut face has no piece number. Calling a piece's own `facesAt` returns only that piece's records.

Sampling calculates the requested moment from the scene inputs rather than advancing a hidden simulation. You can inspect a later time and return to an earlier one without changing that earlier result. This is the same behavior used when seeking a scene player backward.

## Know the limits and the checks

The supported meshes produce at most forty-two faces after a split, so the number of faces does not grow with animation time. Width must remain between `1e-6` and `1e6`. Angles must remain between `-1e6` and `1e6` radians, and each piece's separation must remain between zero and `1e6` width units. Colors in the ramp must be opaque, and invalid geometry, colors, cutting planes or foreign-scene inputs are rejected.

Native tests compare cube visibility against independently calculated face directions across one hundred seeded orientations. They also check that the cut faces point outward across one hundred rotations. The synthetic browser fixture compares pixels with a separate calculation that follows viewing rays to the nearest surface, using one hundred Canvas orientations and twelve SVG orientations. It excludes antialiased edges from those interior-pixel comparisons because edge pixels blend neighboring surfaces.

These checks cover the supported shapes and recorded fixture conditions. They do not establish support for every browser, arbitrary meshes or a different projection model. Continue with [spatial rendering](spatial-three.md) for other 3D approaches or [shape operations](shape-operations.md) for cutting two-dimensional outlines.
