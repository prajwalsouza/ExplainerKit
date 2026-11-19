# Reversible Three.js material palettes

Use a material palette to restyle a Three.js projection while keeping the scene's authored colors available for restoration. Create an adapter with your imported Three.js instance, project a frame, then install a palette callback. Passing `null` restores the authored base colors.

```js
import {createThreeAdapter, darkClay} from 'explainerkit/renderers/three';
const adapter = createThreeAdapter({THREE}); // caller imports Three.js
adapter.update(drawing.sample({time: 0}));
adapter.setPalette(darkClay);
adapter.setPalette(null); // restore authored albedos exactly
```

Both the adapter and the DOM renderer created by `createThreeRenderer` provide `setPalette(map | null)`. The method changes the base colors, also called albedos, of fill and stroke materials owned by the adapter. Authored scene paints remain available for sampling and restoration. Lights, emissive channels, opacity, external assets, texture maps, and your Three.js instance keep their existing values.

The palette callback receives an opaque sRGB hex color and frozen `{id, role, hasMap}` context. The `id` identifies the authored scene node, and `role` is either `'fill'` or `'stroke'`. Return an opaque solid color accepted by the shared color module, using hex, a supported name, numeric HSLA, or an HSLA record. Returned alpha must equal one because opacity belongs on the scene. The adapter currently supplies `hasMap:false` for its solid paints and does not own texture-bearing materials in imported assets. The next example applies `darkClay` to every color except those belonging to selected accent nodes.

```js
adapter.setPalette((colour, {id}) =>
  accentIds.has(id) ? colour : darkClay(colour));
```

Every mapping starts from the sampled authored paint, so applying the palette repeatedly does not compound its color changes. Passing `null` removes the mapping. Installing a palette before the first frame applies it to that frame and to later geometry. Objects already committed to the adapter change immediately. With a GPU renderer, call `render` to repaint the surface, as you would after changing a light. Installing a palette does not start a clock or draw a frame for you.

Before committing a palette change, the adapter prepares a new projection and validates every mapped color. If the callback throws or returns an invalid color, the previous projection and map remain in place. Node and mesh identities and unchanged geometry are retained. Materials may be replaced and disposed just as they are when authored paints change. Identical mapped results share materials, while results that differ by node ID use separate materials.

The adapter maps at most 20,000 distinct node paints per frame and reuses results for repeated stroke contours. Keep callback work bounded because its execution time remains your responsibility. A callback cannot call mutating adapter methods or dispose the adapter while mapping is in progress.

Observers of resource disposal run after a valid projection and its palette map have been published. If an observer throws, the adapter releases every retired resource before propagating the exception. The committed map remains in place. If an observer requests adapter disposal, that request waits for the commit to complete and then clears the new projection too.

## The built-in darkClay policy

```demo design-kiln-palette
Give a pot a kiln makeover. Slide the switch right to apply the standalone `darkClay` helper, or left to return to the authored swatches. The red ornament is treated as an accent.
```

Use the optional pure helper `darkClay(colour, context?)` for a palette that deepens pale and neutral colors while keeping saturated colors as accents. It uses the shared HSLA module to inspect encoded sRGB colors. It preserves hue and lightness order, keeps greys neutral, and leaves saturated colors with middle lightness unchanged. It contains no brand colors or example-specific material IDs. This artistic mapping does not guarantee perceptual contrast or compliance with the Web Content Accessibility Guidelines (WCAG).

Pass `role:'accent'` to preserve a supplied color. The standalone helper also accepts `hasMap:true`, which returns a neutral sRGB color suitable for multiplication with a texture. You must apply that result to any textured materials you own. This helper option does not add texture support to the adapter. Supply your own palette callback when your theme needs different rules.

See [Three rendering](spatial-three.md), [colour utilities](color.md), and
[plain HTML dependency coordination](../getting-started.md#add-threejs-for-3d).
