# Play native scenes through an existing renderer

Use `createProjectionPlayer` from `explainerkit/player` when you already have a renderer and want ExplainerKit to sample and play a native scene. Supply a projection callback that applies the validated frame to your renderer. The player evaluates scene tracks, parameters, derived values and camera projection using the same clock implementation as mounted SVG and Canvas players. It does not replace your renderer or create another animation engine.

```js
import {scene} from 'explainerkit/core';
import {createProjectionPlayer} from 'explainerkit/player';
import {springTiming} from 'explainerkit/motion';

const drawing = scene({width: 400, height: 400, duration: 6});
drawing.circle({x: 50, y: 200, r: 12})
  .animate('x', {from: 50, to: 350, ...springTiming({stiffness: 120, damping: 6})});
const player = createProjectionPlayer(drawing, {
  project(frame, {time}) {
    // Draw validated frame children using your existing DOM, Canvas or 3D stage.
    renderExistingStage(frame, time);
  },
});
player.play();
// Later: player.pause(); player.seek(1); player.dispose();
```

Construction renders time zero through your callback and starts paused. Use `play`, `pause`, `seek`, `refresh` and `on` to control or observe the player. Times use seconds and geometry rotations use radians. A scene change schedules one refresh rather than creating a second loop. The optional `host` provides browser frame scheduling and defaults to the current global environment. An unsupported host is rejected explicitly.

```demo design-elevator-projection
Lift and let lift. Drag the brass floor selector, or focus it and use the arrow keys. The projection callback reads the height from the sampled scene and moves the existing HTML cabin.
```

This player has one playback timeline, so ambient inputs read the same elapsed seconds as authored tracks. Pausing freezes both and seeking changes both. To keep a scroll-controlled shape moving through elapsed time, bind scroll to a separate parameter and leave this player playing. Mounted SVG and Canvas players instead support independent ambient time. Choose the player whose timing behavior fits the explanation, because neither scene nor renderer schedules browser frames.

Seeking preserves live parameter overrides by default. Pass `{reset:true}` to restore authored values before sampling. If sampling or projection fails, player time and frame remain at the last committed values. A failed reset also restores its parameter checkpoint. Your projection callback must apply renderer changes together or restore them on failure, because the player cannot undo arbitrary writes inside that callback.

Inspect `cost` for the last successful `{sampleMS,projectMS,totalMS}`, or call `profile()` for the scene's structural profile at the current time. These measurements help identify work in your application. They are local diagnostics rather than claims about every browser or device.

The reduced-motion preference blocks automatic playback but still permits manual seeking. Supply an explicit boolean `reducedMotion` only when your application owns that policy. Disposal prevents further use, cancels frame requests, removes media-query and scene listeners, releases model and projection references, and emits the dispose event. Your application must separately dispose its renderer because the player does not own it.

The About page uses this player for six native feature scenes. Its remaining hero choreography is page-local adapter code, so that example does not establish that the whole homepage uses native scene playback.