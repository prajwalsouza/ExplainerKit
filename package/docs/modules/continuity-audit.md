# Continuity and contrast audits

Use `explainerkit/audit` to measure jumps when switching representations and text contrast over rendered pixels. These checks complement the composition audit, which works from scene geometry.

```js
import {auditHandover, auditHandoverWindow, fitSimilarity, auditTextOverPixels} from 'explainerkit/audit';
```

## Handover continuity

When a 2D drawing changes into a 3D model or one camera replaces another, matching a few recognizable features helps the view remain continuous. A crossfade alone does not align those features. Give the audit the same named anchors in screen pixels on both sides so it can measure their position, size, angle and color differences.

```js
const report = auditHandover({
  at: time,
  viewport: {width: innerWidth, height: innerHeight},
  from: [{id: 'head', x: 812, y: 388, size: 54, color: hsla(34, 12, 62)}],      // the 2D drawing
  to: [{id: 'head', x: q.x, y: q.y, size: projectedRadius, color: hsla(34, 12, 64)}], // the 3D model
});
report.status;      // 'pass' | 'fail' | 'unknown'
report.message;     // "head jumps in position, size (212 px); move the incoming view by …"
report.correction;  // {scale, rotation, x, y, residual}: carries the incoming anchors onto the outgoing
```

- **Position** is measured as a fraction of the viewport diagonal (default 0.006), **size** as a
  ratio (8 %), **angle** in radians (0.12) and **colour** as OKLab distance (0.05, where about 0.02
  is just noticeable). Override any of them with `tolerance`. The defaults are exported as
  `CONTINUITY`.
- Anchors one side lacks, or marks `visible: false`, are listed in `missing` and never pass
  silently. With no shared anchors the status is `unknown`.
- `correction` is a least-squares similarity fit (`fitSimilarity`). With one anchor it uses the
  anchors' sizes for the scale. Apply it to the incoming camera or layout, or feed it back each frame
  while the two overlap, as the landing page does for its dandelion, until the audit passes.
- `auditHandoverWindow({from: t => anchors, to: t => anchors, start, end, samples})` checks the whole
  overlap and reports the worst moment.

A handover accepts at most 256 anchors on each side and 240 samples in a window. Sampler callbacks must return synchronously and have no side effects. They run as trusted application code.

## Text contrast over pixels

The composition audit compares text with objects in its own scene. To check contrast against a photograph, video, WebGL image or another renderer, supply the actual background pixels. Render the backdrop without the text, then pass its RGBA image data and the label rectangles to `auditTextOverPixels`.

```js
const report = auditTextOverPixels({
  image: ctx.getImageData(0, 0, width, height),
  texts: [{id: 'caption', x, y, width, height, color: '#5f564d', fontSize: 16}],
});
```

Each box is checked against WCAG 2.2 SC 1.4.3 (4.5:1, or 3:1 for text of at least 24 px, or
18.66 px bold). It uses a low percentile of per-pixel contrast (default the worst 10 %), not the
average, so one bright patch behind a word still fails, and it reports the backdrop colour that
limits it. Semi-transparent text is composited over each backdrop pixel before measuring. At most
256 boxes; sampling is strided to stay within 400,000 pixels.

These are heuristics with declared thresholds, not perceptual truth. A pass shows the declared
anchors and boxes are within tolerance, not that every viewer on every display will agree.
