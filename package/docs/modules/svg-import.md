# Bring an SVG into the scene

Use the optional SVG importer to bring a bounded local illustration into an ExplainerKit scene as editable groups and paths. Its output is a component blueprint, which describes scene geometry rather than embedding an SVG image. The importer does not insert source markup into the page, adopt source DOM nodes, or fetch external resources. Once import succeeds, create an instance and use the part list to animate a named element as shown below.

```js
import {importSVG, importSVGFile} from 'explainerkit/import/svg';

const asset = importSVG(svgText);
const illustration = drawing.instance(drawing.component(asset.blueprint));
const hand = asset.parts.find(part => part.id === 'hand');
if (hand) illustration.part(hand.path).to(0, {rotation: .3}, {duration: 1});

// Inside an explicitly chosen file/drop handler:
const uploaded = await importSVGFile(file);
```

The package exposes these functions through `explainerkit/import/svg`. The
[design-resource guide](svg-design-import.md) extends this geometry guide with
supported gradients, clipping resources, alpha masks and bounded filters.

## One small front door

Pass SVG text to `importSVG(source, options)`. Its frozen result contains the blueprint you instantiate, the imported dimensions, and records that help you find editable parts and inspect the work performed.

| Field | Meaning |
| --- | --- |
| `blueprint` | This core component definition contains groups and path nodes. |
| `width`, `height` | These values give the imported viewport dimensions in authored units. |
| `viewBox` | This value captures the source `[x,y,width,height]` rectangle, or is null when none was supplied. |
| `parts` | These `{id,type,path}` records map source IDs to editable component part paths. |
| `diagnostics` | This record reports source and component node counts, normalized command count, arc-path count, the approximation used, and `externalResources:false`. |

Use source IDs to locate artwork through `parts`. They remain labels and correspondence hints rather than executable attributes or global DOM IDs. Duplicate or empty IDs cause import to fail. The importer generates internal part names to satisfy component naming rules, so retrieve the generated path from `parts` instead of constructing one yourself. Each instance gets independent scene node identities and local overrides. The root can also appear as an editable entry when it has a source ID.

The options object accepts `{DOMParser,maxBytes,maxNodes,maxCommands,maxDepth,width,height}`. Set `width` and `height` to choose the imported viewport. The source `viewBox` fitting rule determines how the artwork fits inside it, and the returned top-level group clips content to that viewport. Changing the viewport scales or positions the illustration through that fitting rule. It does not rearrange its internal parts as a responsive layout would.

Use `importSVGFile(file, options)` in a file-selection or drop handler. It accepts a local File or Blob-like object with a finite nonnegative `size` and an asynchronous `text()` method. The function checks the byte budget before reading, then validates the resulting text through the same import pipeline. It has no URL or network-fetch overload. Selecting a file does not save, upload, or persist it.

In a browser, the importer uses the native `DOMParser` only to read inert XML structure. In Node, a first-party inert XML reader supplies the same pipeline when no native parser is available, without requiring another dependency. It accepts namespace-qualified XML, quoted attributes, comments, descriptive CDATA, predefined and numeric entities, and an initial XML 1.0 declaration. It rejects document type definitions (DTDs), custom entities, invalid characters, processing instructions, duplicate attributes, mismatched tags, and undeclared prefixes. The root must declare the SVG namespace.

The XML reader caps input at 10,000 elements and 24 levels as well as applying the configured source and output budgets. You may supply a trusted `DOMParser` constructor explicitly. A supplied value that is not a constructor produces `SVG_ENVIRONMENT`. The separate path and transform helpers can also run without a browser.

## Supported artwork

| SVG feature | Imported behavior |
| --- | --- |
| Root `svg`, `g` | These elements become an editable group hierarchy with group opacity. |
| `path` | The importer accepts relative and absolute commands in the M/L/H/V/C/S/Q/T/A/Z family. |
| `rect` | Rectangles become path outlines, with separate elliptical `rx` and `ry` corners supported. |
| `circle`, `ellipse` | These shapes become closed cubic paths. |
| `line`, `polyline`, `polygon` | These shapes become paths using M/L/Z commands. |
| Solid `fill`, `stroke` | Supported hex and simple named colors are inherited through groups. |
| `fill-rule` | Nonzero and evenodd rules are preserved, with compound-path holes kept in one path. |
| `fill-opacity`, `stroke-opacity` | These values become paint alpha, including inherited values. |
| `color`, `currentColor` | The inherited color resolves at the painted shape. |
| `stroke-width`, caps, joins, miter limit | These values become core stroke properties, including those needed for common round and square line icons. |
| Inline `style` | The supported presentation properties override presentation attributes. |
| `display:none`, `visibility` | Hidden rendering is preserved, and a descendant can override inherited visibility. |
| `title`, `desc`, text-only `metadata` | The importer inspects this descriptive content and omits it from visible artwork. |
| `defs` | Supported inert paint, clip, mask, and filter definitions are imported as described in the [resource guide](svg-design-import.md). |

Default SVG paint is black fill and no stroke. It is not replaced by the library's own default shape color. Group opacity remains a compositing operation rather than being multiplied into every child's paint, preserving overlap behavior. Named colors are restricted to the core's explicit supported set. `rgb()`/`hsl()`/CSS variables and arbitrary CSS color syntax are not interpreted.

All artwork becomes paths, so it can participate in normal component overrides, renderer-independent sampling, transforms, clipping, skinning and compatible morph workflows. Importing a path does not automatically infer semantic anatomy, skin weights, rig topology or shape correspondence. Compound paths still require explicit contour correspondence for morphing holes.

## Paths and arc approximation

`parseSVGPath(d, {maxCommands=10000})` is separately exported. It returns deeply frozen absolute M/L/C/Q/Z command arrays. It handles repeated argument groups, relative coordinates, implicit line segments after moveto, horizontal/vertical segments, reflected smooth controls, scientific notation and adjacent arc flags.

The importer converts an SVG arc from its endpoint form into a center-based representation and corrects radii according to the SVG rules. Negative radii become positive, a zero radius produces a line, and coincident endpoints add no segment. It then approximates each elliptical arc with cubic segments that meet its tangents and span at most 90 degrees. The endpoints are exact, but the curve between them is an approximation. A standard quarter-circle cubic has a small radial error at unit scale, which becomes more visible with larger radii or greater zoom. Browser tests compare arc lengths and sample positions against native SVG results using explicit tolerances.

A shape's original compound-contour order, closures and fill rule are retained. Smooth control reflection resets after incompatible commands. Malformed/incomplete commands, invalid flags and exceeded normalized-command budgets reject before returning an asset. The importer does not silently repair malformed designer exports.

## Coordinates and transforms

Use `parseSVGTransform(text)` to parse a transform list without creating a scene. The pure helper returns a frozen affine `[a,b,c,d,e,f]` matrix, which represents a two-dimensional linear transform and translation. It accepts SVG `matrix`, `translate`, `scale`, `rotate`, `skewX`, and `skewY`, including rotation about a supplied center. SVG attribute angles are degrees, while imported core rotations are radians. Transform lists compose in SVG order.

The core displays translate/rotate/scale transforms. Orthogonal SVG matrices map directly to those properties. A shear or general affine matrix is decomposed into nested rotation/scale groups, including reflections and nonuniform scaling. This preserves stroke geometry and editable hierarchy rather than baking a transformed outline while incorrectly treating its stroke as unchanged. Extra decomposition groups consume the same node/depth budget as authored groups. Floating-point reconstruction is verified against independent/native matrix calculations.

The root `viewBox` supports default `xMidYMid meet`, min/mid/max alignment with `meet` or `slice`, and `none` for independent x/y scaling. Root transforms compose outside viewBox fitting. Imported viewport clipping is explicit. Nested `svg` viewports are currently unsupported, because they introduce additional clipping and percentage-coordinate contexts.

Lengths accept unitless values and the units px, in, cm, mm, q, pt, and pc, using the CSS relation of 96 pixels per inch. Percentages, em/rem, and other dimensions that require an external context are rejected. Positive `viewBox` dimensions provide defaults when root dimensions are omitted. Without either source of dimensions, the viewport defaults to 300×150. Imported width and height must each be in [1,8192].

## Safety and unsupported cases

The importer converts supported artwork into scene data. It accepts a stricter subset than the SVG format, so keep the original source if you need to revise artwork with unsupported effects. The following boundaries apply before an imported blueprint can be instantiated.

- Document type definitions (DTDs), entity declarations, and processing instructions are rejected before DOM parsing. A standard XML declaration is allowed.
- Scripts, event handlers, foreign namespaces, `foreignObject`, images, links, `use` references, and external href references are forbidden.
- Paint and resource references must resolve to compatible definitions in the same document. External assets are not resolved.
- Stylesheets, imports, selectors, CSS animations, Synchronized Multimedia Integration Language (SMIL) animation, and markers are rejected. Gradients, clips, alpha masks, and filters accept only the bounded forms in the [resource guide](svg-design-import.md).
- Text must be converted to outlines before import. Fonts are not fetched, and a text label is not silently dropped.
- Unknown meaningful elements, attributes, and styles are rejected. Safe ID, class, role, data, and ARIA labels and namespace declarations may be ignored as metadata. They never become active markup.
- Nonvisual `title`, `desc`, and `metadata` elements cannot conceal nested artwork or executable nodes.

These boundaries prevent silently presenting an asset with important artwork/effects removed. They also mean some ordinary exports require an explicit “plain outlined SVG” export step. Retain the original source file separately if the author needs to revisit unsupported effects.

## Bounded work and diagnostics

| Limit | Default | Hard maximum |
| --- | --- | --- |
| UTF-8 source bytes | 1,000,000 | 4,000,000 |
| Source/component nodes | 2,048 | 10,000 |
| Normalized commands across the asset | 100,000 | 100,000 |
| Normalized commands in one path | 10,000 | 10,000 |
| Output hierarchy depth | 24 | 24 |
| Transform-list operations per element | 64 | 64 |

Coordinates and composed transform values must be finite and within ±10,000,000. Shape radii and dimensions also obey core geometry limits. Node budgets apply independently to the source and final component, including wrappers added for viewport fitting or matrix decomposition. A short source path can exceed its command budget when arcs expand into cubic segments. The source-byte cap bounds XML parsing before structural and output inspection applies stricter limits.

Use diagnostic codes to distinguish malformed geometry or XML (`SVG_INVALID`), forbidden declarations or references (`SVG_UNSAFE`), unsupported format behavior (`SVG_UNSUPPORTED`), an unavailable parser (`SVG_ENVIRONMENT`), duplicate IDs (`DUPLICATE_ID`), and exceeded work budgets (`RESOURCE_LIMIT`). Core property validation can also return its stable codes for invalid paint or stroke values. Import allocates no scene nodes. Only your explicit instantiation of a completed blueprint changes the scene, so a failed import leaves existing artwork unchanged.

The native tests cover path grammar, analytical arc controls, transforms, limits, declaration rejection and bounded file reads. A real-browser fixture in the test suite checks DOM parsing, malicious/unsupported input, native/normalized arc geometry, matrix decomposition, viewBox fitting, actual SVG/Canvas pixels, common glyph and line-icon assets, snapshots, editable IDs and local File import. This is a supported subset tested in local Chrome, not exhaustive SVG conformance or a security certification.

The implementation follows the primary [SVG 2 path](https://www.w3.org/TR/SVG2/paths.html), [coordinate/transform](https://www.w3.org/TR/SVG2/coords.html), and [basic-shape](https://www.w3.org/TR/SVG2/shapes.html) specifications. The algorithms are first-party JavaScript. Browser `DOMParser` and drawing APIs provide platform facilities without adding imported libraries.