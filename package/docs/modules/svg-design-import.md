# Design SVG import

Use `importSVG(source, options)` from `explainerkit/import/svg` when you want to animate individual parts of an SVG illustration. It returns a component blueprint, which is a frozen description of scene geometry that cannot execute code. Import the artwork before creating its component so a failed import leaves your scene unchanged. The example creates an instance and changes the opacity of the part named `Planet`.

```js
const asset = importSVG(svgText);
const component = drawing.component(asset.blueprint);
const instance = drawing.instance(component);
const planet = asset.parts.find(part => part.id === 'Planet');
instance.part(planet.path).set({ opacity: .7 });
```

Find editable artwork through `parts` rather than guessing component paths. Each entry provides `id`, `sourceId`, `type`, and a generated component `path`. Labels include the source `id`, `data-name`, and a decoded alias for Illustrator `_x5F_` escapes. Aliases for the same element share a path, while resource definitions are excluded from the artwork list. Duplicate source IDs cause import to fail. Artist labels may repeat, so use `sourceId` to distinguish elements with the same label.

The importer preserves group and shape opacity separately, including overlap isolation. It maps `mix-blend-mode` normal, multiply and screen to `blend`. Other modes refuse with `SVG_UNSUPPORTED`.

## Supported resources

| Source | Imported representation | Boundary |
| --- | --- | --- |
| Linear gradients | The importer creates a local linear paint. | It supports `objectBoundingBox` and `userSpaceOnUse` coordinates, percentages, affine `gradientTransform`, pad spread, sRGB interpolation, internal `href` and `xlink:href` templates, and 1–64 stops. |
| Radial gradients | The importer creates a local radial paint. | It supports the same units and templates when the effective transform remains circular, the focal point equals the center, and `fr` is zero. |
| `clip-path` | The importer creates a local or bounds-relative path clip. | It accepts one basic shape or compound path and captures resource and child transforms. Shape clips in `objectBoundingBox` coordinates keep their normalized units and clip rule. |
| Alpha mask | The importer creates a gradient alpha mask. | It requires explicit `mask-type="alpha"` and one untransformed gradient rectangle with square corners in user coordinates. The rectangular mask region is intersected with that rectangle's bounds. |
| `feGaussianBlur` | The importer creates a `blur` effect. | It accepts one isotropic `SourceGraphic` primitive with explicit sRGB filter interpolation, uniform nonsingular world scale, and sigma within runtime budgets. Isotropic means the blur has the same spread in both directions. |
| `feDropShadow` | The importer creates a `glow` effect. | It applies the blur restrictions and requires explicit `dx="0" dy="0"`, while preserving the supplied color and opacity. |

Linear gradients use the inverse transpose of their affine transform to preserve the color field under shear and nonuniform scale. Transforming just the two endpoints would produce the wrong gradient. Geometry bounding boxes use quadratic and cubic extrema, excluding strokes, as required for SVG object-bounding-box resources.

A shape clip can use `clipPath({units:'bounds', ...})` to express its coordinates relative to the shape's bounding box. The imported clip keeps that coordinate system when rendered as SVG. Group clips instead keep the local geometry captured during import. The public bounds-relative clip API does not calculate group bounds or browser-text bounds. Check the [clipping contracts](graphics.md) before choosing geometry that depends on those bounds.

Imported filters run before clipping, masking, and compositing. Component groups preserve the source's finite filter region, including the default box that starts at −10% and spans 120% of the artwork bounds. Paths remain ordinary core geometry. Imported filters support rotation and uniform scaling. Import fails if viewport scaling differs between axes or an ancestor applies shear, since those transforms would change the filter's meaning.

Keep referenced definitions in the same SVG document because the importer never fetches URLs. Each reference must identify a compatible definition. A template cycle produces `SVG_INVALID`. A reference depth over 24 or reference work over 10,000 produces `RESOURCE_LIMIT`. Source bytes, source and output nodes, normalized commands, and hierarchy depth also remain bounded. A failed import returns no component and inserts no DOM nodes.

## Explicit limits

The importer refuses off-center or elliptical radial gradients, repeat/reflect spreads, non-sRGB gradient interpolation, arbitrary mask artwork, luminance masks, object-bounding-box mask content, clip unions from multiple children, offset shadows, filter chains, unrecognized filter primitives, stylesheets, text that has not been outlined, images, `use`, nested viewports, external references and executable content. It never flattens these into an inaccurate approximation or silently removes a visible effect. The existing core paint color vocabulary applies (hex and supported named colors).

Use these limits to decide whether your artwork fits the supported import subset. They do not establish compatibility with every Illustrator or Figma export. The fixtures `tests/fixtures/design-figma-structure.svg` and `design-illustrator-structure.svg` are small original files written by hand to represent common exported structures. **They were not exported from those applications.** Acceptance of actual application exports remains unverified until originals can be produced with those tools.

See [the geometry import guide](svg-import.md).
