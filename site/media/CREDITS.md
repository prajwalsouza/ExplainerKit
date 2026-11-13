# Media credits

The landing page plays two recorded clips. Both are re-encoded excerpts, used under their sources' free licences, and each is credited on the page while it plays. Each clip is published twice with the same frames, as WebM and as an H.264 MP4 for browsers that cannot play WebM.

| File | What it is | Source | Licence |
| --- | --- | --- | --- |
| `room.webm`, `room.mp4` | A camera move through a dining room, reversed, undistorted and scaled to 1920 × 1080. | [Modern Dining Room with Natural Lighting](https://www.pexels.com/video/modern-dining-room-with-natural-lighting-39576525/) by Alef Morais on Pexels | [Pexels license](https://www.pexels.com/license/) |
| `room.json` | The camera for each frame of `room.webm`, with the wall and table in metres. ExplainerKit derived it from the clip. | Derived from the clip above | As above |
| `river.webm`, `river.mp4` | A short stretch of a forest stream, 1280 × 720. | [Small river in the forest](https://mixkit.co/free-stock-video/small-river-in-the-forest-4374/) on Mixkit | [Mixkit free stock video license](https://mixkit.co/license/#videoFree) |
| `river.json` | The stream's surface motion, measured from the clip with `measureFlow` from `explainerkit/vfx`. | Derived from the clip above | As above |

The room's camera was recovered with COLMAP and fitted to the room with `scripts/landing/solve-room.py` and `scripts/landing/fit-room.py`.

Other material on the page:

- The Friends speaker data in `data/` comes from Emory NLP's Character Mining corpus. Its citation, licence and notice are in that folder.
- The country outlines in `geography.js` are simplified from Natural Earth, which is in the public domain.
- Three.js, which draws the 3D scenes, is MIT licensed. Its licence ships beside it in `vendor/three/`.
