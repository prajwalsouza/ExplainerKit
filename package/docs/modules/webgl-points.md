# Draw a large set of points and connections

Use the WebGL2 renderer for a dense field of observations, a network or a particle drawing whose positions are already supplied by your model. It draws point and line buffers using the graphics processor (GPU). A buffer is a typed array containing many values in a fixed order, which lets the renderer submit those values together rather than create one scene object per point.

Keep explanatory labels, controls and sparse vector artwork in SVG or Canvas when those are more useful for the task. Both drawings can use the same coordinates and sampled time, so they show one model through different rendering layers. This renderer is provided by ExplainerKit and does not require Three.js.

The example supplies two points and connects them with one line. Positions are stored as x/y/z triples, colors as red/green/blue/alpha values, and indices identify which points each line connects. `screenProjection` makes the positions use ordinary scene coordinates, with x moving right and y moving down.

```js
import {createWebGLRenderer, screenProjection} from 'explainerkit/renderers/webgl';

const renderer = createWebGLRenderer(container, {
  label: 'Observed trajectories and their connections',
  pixelRatio: 1,
});
renderer.render({
  width: 640, height: 360,
  positions: new Float32Array([100, 120, 0, 300, 220, 0]),
  colors: new Float32Array([.15, .55, .53, 1, .86, .4, .27, 1]),
  indices: new Uint32Array([0, 1]),
  matrix: screenProjection(640, 360),
  pointSize: 10,
});
renderer.dispose();
```

## One explicit GPU frame

`createWebGLRenderer(container, options)` creates and owns one canvas and its WebGL2 context. The default limits are 100,000 points and 200,000 lines, configured through `maxPoints` and `maxLines`. You can lower those limits but cannot raise them above the supported maximums. If WebGL2 is unavailable, construction throws `RENDER_UNSUPPORTED` rather than choosing another renderer silently.

The frame describes points and lines rather than an arbitrary scene tree. Use the SVG or Canvas renderer for ordinary paths, text, clips and gradients. The following fields describe the point-and-line input.

| Frame field | What it means |
| --- | --- |
| `width`, `height` | These required logical viewport dimensions must each stay between 1 and 8192. |
| `positions` | Supply a native `Float32Array` of x/y/z triples containing at most 100,000 points. |
| `colors` | An optional native `Float32Array` supplies four red/green/blue/alpha components per point, each between zero and one. |
| `color` | Without per-point colors, this shared color defaults to `[1,1,1,1]`. |
| `indices` | A native `Uint16Array` or `Uint32Array` can supply endpoint pairs for at most 200,000 lines. Every index must identify an existing point. |
| `matrix` | A native `Float32Array` supplies sixteen values ordered one column at a time to transform model coordinates into the browser's clipping coordinates. It defaults to the identity matrix. |
| `pointSize` | The default is four CSS pixels. Values must stay between 1 and 2048 and fit the hardware size range after device-pixel-ratio scaling. |
| `pointShape` | The default is `circle`, with `square` and `glow` also available. |
| `blend` | The default is `alpha`, with `additive` also available. |
| `drawPoints` | The default is true. Set it to false to draw only indexed lines. |
| `clearColor` | The background defaults to transparent `[0,0,0,0]` in red/green/blue/alpha order. |

Typed arrays must come from the same JavaScript window or execution context as the renderer. Arbitrary array-like objects and typed-array subclasses are not accepted. The renderer copies buffers before checking and using them, so changing your original arrays cannot silently change a committed frame.

Position and matrix entries must be finite and stay within ±10,000,000. Invalid colors, mismatched lengths, out-of-range indices and unsupported modes are rejected before drawing. Empty point buffers are allowed. WebGL uses an internal viewing region to decide which drawing stays visible. With an identity matrix, x, y and z values between minus one and one describe that region directly rather than CSS pixels or metres. Use `screenProjection` when you want ordinary drawing coordinates instead.

Lines are drawn before points without testing their depth against one another. A line blends the colors at its two endpoints and is one drawing-buffer pixel wide. Wide strokes, joins, caps and ribbons require geometry that this renderer does not provide. Point size stays constant on screen rather than shrinking with distance.

The `glow` shape fades opacity radially inside a point using `(1-r²)²`. It is a drawing effect rather than a physical light source or bloom calculation. Floating-point colors are used directly without converting color spaces or providing a high dynamic range (HDR) color pipeline.

Before blending, the shader multiplies red, green and blue by opacity. This is premultiplied color, and both alpha and additive blending use it consistently. The canvas requests the same presentation format, so raw `readPixels` results differ from an unweighted authored color when opacity is below one. Clear colors are multiplied in the same way before clearing. Browser behavior is described in the [WebGL2 specification](https://registry.khronos.org/webgl/specs/latest/2.0/) and the [WebGL context and compositing foundations](https://registry.khronos.org/webgl/specs/latest/1.0/).

## Share the projection

`screenProjection(width, height, options)` returns the matrix that maps a scene's downward-positive y coordinates into WebGL clipping coordinates. Its optional `transform` is the same six-value `[a,b,c,d,e,f]` transform used by the 2D camera, with `[1,0,0,1,0,0]` as the default. Passing the displayed camera matrix aligns GPU points with the corresponding SVG or Canvas view without creating another camera or moving model geometry.

The following example assumes an existing `player`, a point frame named `pointFrame` and the renderer created above.

```js
const matrix = screenProjection(player.frame.width, player.frame.height, {
  transform: player.view?.matrix ?? [1,0,0,1,0,0],
});
renderer.render({...pointFrame, matrix});
```

An application using a perspective 3D camera can supply its complete model-to-clipping matrix instead. `projectGPUPoint({x,y,z=0}, matrix, {width,height})` applies that same matrix on the main processor (CPU) and divides by the resulting fourth coordinate, w, as the graphics pipeline does. That fourth coordinate controls perspective scaling when the transformed point becomes a screen position. It returns `{x,y,depth,visible,w}`, with screen x/y measured from the viewport's top-left corner.

A point is marked visible only when w is positive and its transformed position lies inside the viewing region. Zero w produces null projected coordinates because division is undefined. This calculation concerns the center of one point, so it does not decide whether a whole sprite or line was hit or hidden behind another object. Shader precision and pixel drawing can differ from CPU calculations near exact boundaries.

Call `render` from the same player frame event or another clock owned by your application. The renderer starts no animation loop and calculates no particle forces or history. The controlling player or application also chooses how to respect reduced motion. DOM labels can consume the same sampled model state through their adapter.

## Preserve a valid frame

The renderer checks inputs, hardware limits and pixel limits before allocating a replacement drawing. It prepares new geometry buffers and a temporary RGBA8 framebuffer, which is a graphics-memory image with eight bits for each red, green, blue and alpha channel. It draws and checks that image before presenting it to the canvas.

Invalid input, failed allocation or a failed candidate draw leaves the previous canvas dimensions, pixels and CPU snapshot intact. If presentation itself fails, the renderer attempts to restore the previous image. A lost graphics context can make the visible pixels unavailable, so that failure is reported separately rather than described as successful recovery.

`render` returns read-only metadata containing width, height, point and line counts, blending, point size and point shape. The `.frame` property exposes the same metadata. Use `.snapshot()` for fresh copies of the last committed arrays and settings. Editing those copies cannot change the renderer's saved recovery data.

For CPU-only preparation, `capturePointFrame(frame, {maxPoints,maxLines})` is separately exported. Its wrapper is read-only, but the copied typed-array contents remain mutable for their recipient. That distinction lets callers work with their own copy without changing retained renderer state.

Logical size and device pixel ratio must fit the hardware's texture limits and an 8,000,000-pixel drawing-buffer cap. During replacement, the previous and candidate images can coexist alongside the browser's canvas buffer. At the maximum size, those three RGBA8 images can require roughly 96 MB before geometry, CPU copies and driver overhead are counted.

The pixel cap limits requested dimensions rather than promising that a device can allocate them. Point and line counts are also input limits rather than frame-rate guarantees. Each `render` currently allocates and uploads candidate buffers and textures, so this API does not provide persistent-buffer streaming or worker-based rendering.

## Loss, restoration and disposal

Inspect `.capabilities`, `.lost`, `.disposed` and `.error`, or subscribe through `.on(name, fn)`. Supported events are `contextlost`, `contextrestored`, `error` and `dispose`. The renderer owns the WebGL state used to draw its frames, so other code should not change its program, buffers or framebuffer behind it.

When the browser reports `webglcontextlost`, the renderer permits restoration, stops GPU work and retains its last valid CPU frame. Calls to `render` then reject with `WEBGL_CONTEXT_LOST`. If the browser restores the context, the renderer rebuilds its resources, redraws the saved frame and emits `contextrestored`. A failed setup or restore remains visible through `.error` and the error event. The browser may never restore a lost context.

Call `dispose()` to remove context listeners, delete the owned graphics resources, release CPU copies, clear the canvas dimensions and remove its DOM node. Repeated disposal is safe, but the disposed renderer cannot be reused. Disposing during context loss also prevents a later restoration callback from recreating those resources. Further render and snapshot calls reject with `DISPOSED`.

## Evidence and remaining work

Native tests check copied arrays, input counts, invalid values, coordinate transforms, clipping and zero-w projection. Isolated Chrome fixtures check actual point and line pixels, alpha and additive blending, preservation after invalid updates, caller-copy safety and context loss, restoration and cleanup. The large fixture supplies 100,000 points and 200,000 lines, including an index beyond 65,535.

Those checks apply to their recorded environments rather than establishing 60 fps, sustained mobile performance, every browser or complete accessibility. This renderer remains a projection of supplied points and lines. It does not add a material system, texture or asset loading, depth-sorted transparency, GPU picking, arbitrary clipping or masks, renderer export or a particle simulation. Choose another renderer or application-owned processing when those are required.

## Inside a scene

Use a `drawing.cloud` node when the points need to share a scene's timeline, clips and drawing order. Canvas can rasterize that node through WebGL2 and composite it in place. The [film kit](film-kit.md#draw-a-hundred-thousand-points) explains that scene-based approach, while this module supplies the standalone buffer renderer.
