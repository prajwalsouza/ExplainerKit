# Finish film frames

A rendered frame often needs finishing before it looks filmed. A real lens blurs what is out of focus and spreads light from bright areas, and the result is usually graded and given grain. `explainerkit/vfx/post` applies those steps to a frame's pixels. It is meant for the film path, where each frame is rendered and exported one at a time, so it runs on the CPU and favours exact, repeatable results over speed.

An image here is `{width, height, data}`, where `data` is a `Float32Array` holding red, green, blue and alpha for every pixel, each from 0 to 1. Every function returns a new image and leaves its input untouched, so exporting the same frame twice gives the same pixels.

## Give a frame the miniature look

This example takes 8-bit pixels from a canvas, applies the tilt-shift lens, bloom and grade from the cinematic-look pack, and writes the result back. It assumes `ctx` is a 2D canvas context, and that `lens` and `look` hold the parsed `miniature.json` lens and `warm-miniature.json` grade.

```js
import {fromRGBA8, toRGBA8, finishFrame} from 'explainerkit/vfx/post';

const source = ctx.getImageData(0, 0, width, height);
const frame = fromRGBA8(width, height, source.data);
const finished = finishFrame(frame, {lens, look, frame: frameNumber});
ctx.putImageData(new ImageData(toRGBA8(finished), width, height), 0, 0);
```

`finishFrame` applies the steps in the pack's order. First comes the lens blur, then bloom, then the grade and vignette, then chromatic aberration only where the image is sharp, and finally grain. Pass the frame number so the grain changes from frame to frame while staying the same for the same frame.

## Blur what is out of focus

`tiltShift` keeps one horizontal band sharp and blurs more and more above and below it. That is what makes a real landscape look like a small model. Its options are fractions of the frame height, as in the lens pack. `center` places the band, `halfWidth` sets how wide it is, `falloff` sets how quickly the blur grows, and `maxBlur` sets the largest blur radius.

```demo design-mind-the-blur
Please mind the blur. Drag the round focus marker at the right toward a train to bring its row into focus. The pixels above and below the band stay softer.
```

`depthOfField(image, depth, {focus, range, maxBlur})` blurs by distance instead, using a depth buffer with one value per pixel. Pixels at the `focus` distance stay sharp, and the blur reaches `maxBlur` at `range` units away.

Both return `{image, blur}`, where `blur` gives each pixel's blur from 0 (sharp) to 1 (fully blurred). Pass that to `chromaticAberration` so its colour fringing appears only where the image is sharp. Mixing sharp red and blue channels into a blurred green one would tint the blurred areas green.

## Spread light from bright areas

| Function | What it does |
| --- | --- |
| `bloom(image, {threshold, strength, radius, mask})` | Pixels brighter than `threshold` glow into their surroundings at three sizes. Pass a `mask` with one value per pixel for selective bloom, so that only rivers, screens or lit labels glow. |
| `halation(image, {threshold, strength, radius, color})` | A warm glow around strong highlights, as film emulsion produces. |
| `lightRays(image, {origin, samples, density, decay, weight})` | Bright areas smeared toward a light at `origin` in pixels, giving shafts of light. This is the radial blur described in GPU Gems 3, chapter 13. |

## Add camera and lens character

| Function | What it does |
| --- | --- |
| `motionBlur(image, velocity, {samples, shutter})` | Each pixel is averaged along its own screen motion. `velocity` holds two values per pixel, the motion in pixels over one frame, and `shutter` is the fraction of the frame the shutter stays open. |
| `lensDistortion(image, {k1, k2, zoom})` | Barrel distortion for a positive `k1` and pincushion distortion for a negative one, centred on the frame. |
| `chromaticAberration(image, {amount, blur})` | Red and blue pulled apart toward the frame edges by `amount`, a fraction of the frame diagonal. |
| `vignette(image, {amount, softness, roundness})` | Darkening toward the corners. A `roundness` of 1 gives a circle, and lower values follow the frame's shape. |
| `grade(image, {splitTone, saturation, contrast, exposure})` | The grade from the look pack. A split tone mixes one colour into the shadows and another into the highlights. |
| `grain(image, {amount, size, seed, frame})` | Seeded grain, strongest in the midtones. The same seed and frame always give the same grain. |
| `blur(image, radius)` | A blur that approximates a Gaussian, built from three box-blur passes. |

## Limits

An image holds at most 3840 × 2160 pixels, and a blur radius is at most 256 pixels. Each operation's cost grows with the number of pixels, and the blur cost does not depend on the radius. Expect several seconds per effect for a 4K frame, which suits frame-by-frame export but not live playback. The effects are approximations chosen to match the look-development frames. They are not physically based lens simulations, and the bokeh shape and cat's-eye settings in the lens pack are not used.
