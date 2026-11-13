# Deterministic film export

Use the exporter to capture an authored page as numbered frames through a separate headless Chrome process. It supplies each sample time explicitly instead of waiting for playback, which lets a repeatable scene produce repeatable frames.

The package installs the exporter as the `explainerkit-export-film` command. Serve your film page over HTTP with any local static server, then run the command from your project with that page's address. It needs Chrome or Chromium installed on the machine, and ffmpeg as well when you want a video file.

```sh
npx explainerkit-export-film \
  --url http://localhost:8080/your-film/ \
  --out ./renders/my-new-film \
  --width 1920 --height 1080 --fps 30 --from 0 --duration 1
```

For 4K UHD, use `--width 3840 --height 2160`. Output must be a **new directory**, including when an existing directory is empty. Its parent must already exist. The script writes numbered PNGs, a `manifest.json` with exact sample times and SHA-256 hashes, and `film.mp4` when ffmpeg is available. `--video` requires encoding; `--no-video` writes PNGs only. `--chrome PATH` / `CHROME_PATH` and `--ffmpeg PATH` select local executables.

Each sample time is `from + index / fps`, computed directly rather than accumulated. The export interval excludes its end. The frame count is `ceil(duration * fps)` after a small floating-point roundoff correction; a partial final interval therefore produces a full output video frame. Default duration is the remaining authored duration. Export never advances playback with elapsed wall time.

## Page contract

```js
window.explainerkitExport = {
  duration: drawing.duration,
  element: renderer.element,
  ready: assetsReady,                         // optional Promise
  resize({ width, height }) {                 // optional; may return Promise
    outputWidth = width;
    outputHeight = height;
  },
  seek(time) {                               // may return Promise
    renderer.render(drawing.sampleView({
      time, width: outputWidth, height: outputHeight,
    }).frame);
  },
};
```

The exporter waits for the hook, its `ready` promise, and `document.fonts.ready`, then calls `resize`. Each `seek` must finish rendering before returning or resolving. Keep the authored composition in the hook's `element`; it must be connected, visible, and measure exactly the requested CSS pixel dimensions. A Canvas must also have matching intrinsic raster dimensions. The hook may replace its `element` after resizing.

Authors control image/media readiness and must stop independent playback or wall-clock animations. The exporter supplies exact times; arbitrary pages with timers, live network data or unsynchronized media cannot be assumed deterministic. Use the returned `sampleView().frame` directly so its motion-blur samples reach the Canvas renderer. SVG's explicit motion-blur refusal remains in force.

Chrome uses a fresh temporary profile, never the user's personal browser profile. Capture uses device scale factor 1. Output dimensions are checked against each PNG's IHDR, preventing an accidental preview-size raster from passing as 4K.

## Errors and encoding

Any capture, hook, readiness, page exception or encoding failure exits nonzero and records a failed manifest. Captured PNGs remain available. Encoding uses ffmpeg's image sequence input at the requested frame rate and a silent H.264 MP4 (`libx264`, CRF 18, medium preset, yuv420p, faststart). It does not install ffmpeg. A missing encoder in default mode records `unavailable`; a present but failing encoder always reports failure. MP4 requires even pixel dimensions; use PNG-only export for odd dimensions.

Executable paths and arguments go directly to `spawn`, without a shell. ffmpeg uses `-n`, and frame writes use exclusive creation. Limits of 8,294,400 pixels, 100,000 frames, 240 fps and a default 30-second per-command/readiness timeout are explicit engineering conventions. They bound individual capture work, not a promise that every scene fits the renderer's existing effect and scratch-memory budgets. CRF/preset are quality/encoding conventions, not research-derived constants.

## Verification

The exporter's tests verify real 1080p/4K dimensions, exact indexed sampling, half-open endpoints, resource bounds, input validation, PNG dimensions, and refusal to overwrite an existing output directory. The original fixture at `tests/fixtures/export-film.html` uses the production Canvas renderer with four-sample motion blur, and scales its authored geometry while rendering at the actual requested raster size.

Recorded export measurements include local 1080p and 4K checks using Chrome and ffmpeg 8.1. The table summarizes output dimensions and frame counts.

| Capture | Actual PNG raster | Frames / fps | Repeat-run PNG hashes | ffprobe result |
| --- | --- | --- | --- | --- |
| 1080p | 1920 × 1080 | 3 / 30 | All three identical | H.264, 1920 × 1080, 30/1 fps, 3 frames, 0.100000 s |
| 4K UHD | 3840 × 2160 | 3 / 30 | All three identical | H.264, 3840 × 2160, 30/1 fps, 3 frames, 0.100000 s |

The recorded checks compare repeated PNG hashes, confirm that motion blur changes the captured frames, and verify that an encoding failure retains completed PNGs and writes a failed manifest. These short local checks do not measure long-film throughput or establish identical pixels across machines.

The capture interface follows [Chrome DevTools Page.captureScreenshot](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot) and [Chrome DevTools device metrics](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setDeviceMetricsOverride). Encoding uses the documented [ffmpeg image sequence guidance](https://www.ffmpeg.org/faq.html#How-do-I-encode-single-pictures-into-movies_003f) and [frame-rate options](https://www.ffmpeg.org/ffmpeg.html#Video-Options). No external code or artwork was copied.