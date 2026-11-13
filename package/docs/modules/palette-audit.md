# Palette measurements and comparison

Use `auditPalette` from `explainerkit/audit` to measure how much of a rendered image each color occupies. You can also supply named groups of authored fills to compare the colors chosen for different parts of a scene. Capture pixels yourself before calling the audit, then use `comparePalettes` to compare two reports. These helpers inspect supplied data without drawing, reading the DOM, loading images, starting clocks or changing the scene.

```js
import {auditPalette, comparePalettes} from 'explainerkit/audit';

const image = context.getImageData(0, 0, canvas.width, canvas.height);
const day = auditPalette({
  pixels: {width: image.width, height: image.height, data: image.data},
  background: '#ffffff',
  groups: {planes: ['#517e79', '#517e79', '#e9b78c']},
  maxColors: 8,
  policy: {balanceTarget: [.6, .3, .1]},
});

// Capture the next rendered frame in the same manner, then compare its report:
// const difference = comparePalettes(day, night, {threshold: .05});
// difference.groups identifies changed/added/removed groups by name.
```

## Inputs and ownership

Supply `pixels` as a plain record containing integer `width` and `height` and a `data` field holding a `Uint8Array` or `Uint8ClampedArray`. The bytes must contain encoded sRGB red, green, blue and alpha in that order. RGB values are stored independently of alpha, a representation called straight alpha. Wrap native `ImageData` as the example does instead of passing it directly, because its prototype accessors are not supported by the plain-record interface. Shared array buffers, numeric JavaScript arrays, sparse data and executable or accessor properties are rejected. The report does not retain the pixel bytes.

Choose the opaque solid `background` that should lie behind translucent pixels and fills. It defaults to white. Measurement composites over it in encoded sRGB and rounds to bytes. If your application uses another compositing or color-space workflow, supply pixels already rendered into that workflow's sRGB result. Fill entries must be sampled solid colors rather than gradients, CSS expressions or browser-parsed color strings.

Supply `groups` as a mapping from names to arrays of solid fills drawn from your scene tags or application state. Each fill counts as one element regardless of its size on screen. The audit does not discover groups or decide whether an element is hidden. A group's distribution therefore measures element counts, while an image distribution measures sampled pixel coverage. Empty named groups stay in the report so a comparison can distinguish an empty group from a missing one.

## Measurements

The returned report is frozen and identifies its format with `explainerkit.palette-audit/1`. Read its image measurements separately from group measurements because they count different things.

- `image` records dimensions, total pixel count, sample count and the compositing and sampling methods. Samples occur deterministically at equally spaced positions along flattened pixel rows.
- `clusters` contains up to `maxColors` dominant color groups sorted by coverage and then color. Each records a representative sampled color, a weighted mean in OKLab called its centroid, sample `count`, relative `coverage`, centroid `chroma`, representative HSL `hue` and WCAG sRGB contrast against the background. The representative is an observed color nearest the centroid rather than the centroid itself.
- `harmony` describes a hue-family heuristic and states its hue space and tolerance.
- `balance` records the largest cluster's share, the second-largest share and the remaining coverage. The remaining share is named `accentShare`, but it does not identify an accent's intended role.
- `groups` records names, element counts and separately clustered fills. These counts are not pixels or estimates of visible area.
- `score`, `reasons` and `policy` describe agreement with the configured coverage target and the settings used to calculate it.

Clustering groups nearby colors in OKLab, a color space intended to make numerical distances correspond more closely to perceived differences. It chooses initial colors farthest from the seeds already selected, then performs eight weighted assignment and averaging steps known as Lloyd updates. Selection is deterministic, and seeds closer than 0.025 OKLab units are not added, so a report may contain fewer than `maxColors` clusters. The limited number of updates makes each centroid an approximation. Sampling can also miss small or thin features, so increase `maxSamples` within its cap or audit a crop when one of those features matters.

Color distances follow [Ottosson's OKLab definition](https://bottosson.github.io/posts/oklab/), while contrast uses the sRGB relative-luminance ratio defined by [WCAG](https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio). A cluster's contrast describes its representative color and is not the worst-case contrast for text over the whole image. Use `auditTextOverPixels` when the backdrop varies under text.

## Policy is explicit

`policy.balanceTarget` defaults to `[.6, .3, .1]`, a selectable composition
convention. `score = 1 - 0.5 × sum(abs(measuredShare - targetShare))` measures
agreement with that target. It is **not an aesthetic-quality score**. Supply a
different three-share target summing to 1, or set `balanceTarget: null` to disable
the score (`score: null`). Harmony and contrast do not silently change this score.

Traditional color-wheel categories use HSL hues of representative colors, while
OKLab is used for clustering and comparison. HSL lightness is never used as
luminance. Hue families within half `hueTolerance` are merged by a weighted
circular mean. The declared classes are `achromatic`, `monochrome`, `analogous`,
`complementary`, `split-complementary`, `triadic` and `mixed`. Three-family templates
use 120° gaps for triadic and 60°/150°/150° gaps for split-complementary. Monochrome
uses a minimal hue arc within the tolerance. Analogous allows an arc up to 60° plus
the tolerance. These categories are descriptive conventions, not a judgment that a
mixed palette is wrong.

Other policy defaults are `hueTolerance: 20` degrees (1–30),
`chromaThreshold: .03` (0–.5 OKLab chroma), and `minimumShare: .02` (0–1) for hue
classification. Tiny or near-neutral clusters still retain their coverage and
contrast. They do not determine a hue-family label.

## Comparing chapters or themes

`comparePalettes(a, b, {threshold: .05})` accepts two reports, including reports saved as JSON and read back, and returns `explainerkit.palette-comparison/1`. Its `drift` measures the cost of matching color coverage between distributions. The calculation matches the closest OKLab clusters, transfers the coverage they can share, then continues with the remainder. It averages forward and reverse greedy assignments to make the result symmetric. This limited heuristic does not find optimal transport or preserve cluster identity across frames. Sorting captured clusters by numeric OKLab coordinates and coverage before resolving ties makes drift independent of the order of serialized cluster arrays.

The result includes overall `drift`, the selected threshold and changes to named groups. A group can be `stable`, `changed`, `added` or `removed`. Changing an empty group to a populated one yields `drift: null`, while two empty groups have zero drift. Element totals are reported separately because a count change alone does not prove a color change. Choose the threshold for your application rather than treating it as a universal perceptual boundary. Comparison validates required numeric distribution data, but a protocol string alone does not prove where a report came from. It retains the 4,096 aggregate group-element limit and rejects contradictory reports, such as an empty group with clusters or a populated group without a distribution.

## Bounds and compatibility

Input images contain at most 16,777,216 pixels (64 MiB), with each dimension at most
16,384. `maxSamples` defaults to and cannot exceed 65,536. `maxColors` defaults to
8 and cannot exceed 16. Up to 64 named groups and 4,096 aggregate fill entries are
accepted. Eight fixed clustering updates bound work by the sampled points times
the cluster limit. Reports contain at most 16 clusters per frame/group. Comparison
validates these limits, considers at most 128 names across two reports, and sorts
at most 256 transport edges per distribution in each direction.

Invalid requests report `INVALID_PALETTE_AUDIT`, `RESOURCE_LIMIT` or the shared number, color and options validation codes. The audit measures supplied colors without changing scene interpolation or authored motion. Its internal OKLab calculation uses the same numerical behavior as `colorDistance`.