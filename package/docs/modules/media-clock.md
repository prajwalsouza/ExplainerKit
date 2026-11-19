# Let the picture follow the voice

Attach an existing audio or video element to a player when the picture should follow its playback time. Import `attachMedia` from `explainerkit/media` after creating both objects.

```js
import {attachMedia} from 'explainerkit/media';
const narration = attachMedia(player, audioElement, {offset:0});
await narration.play(); // user activation may be required by the browser
// player.seek(20), player.pause(), player.play() and player.speed = 1.25 stay linked.
narration.dispose();
```

Use `attachMedia` when a scene should stay aligned with an existing audio or video element. Create the player and obtain the media element before attaching them. The element controls story time through `storyTime = clamp(media.currentTime-offset,0,player.duration)`, which the picture samples on animation frames and media events. There is no separate clock accumulating time and drifting away from the media. Changing either native playback rate or player speed updates the other. The nonnegative offset identifies the number of seconds into the media where the story starts. Your application still obtains and decodes the media and requests any access permission. Attaching it alone starts no capture or fetch.

```demo design-snail-tape
Snail Mail Express. Press Play to hear the original tape while the snail passes a postmark on each beep. Scrub the tape to inspect how the picture follows its time.
```

Only one scroll or media driver can control a player, and `attachMedia` reserves the media element against duplicate bindings. Moving the time slider pauses and seeks both picture and narration. Native play, pause, seek, end and rate events also synchronize the picture. Playback stops at whichever ends first, the story or the media. Under the default reduced-motion policy, automatic playback is blocked and a preference change pauses native media.

The returned adapter provides `play`, `pause`, `seek`, `refresh`, `dispose`, `media` and `disposed`. A rejected playback promise reports `MEDIA_PLAY_REJECTED`, while loading failures report `MEDIA_ERROR`. Errors go to `onError`, which defaults to the player's reporter. If sampling the picture fails, playback stops at the last committed timestamp. Disposal cancels frame requests and listeners, pauses media, restores its original rate and releases ownership. It does not unload or rewind the application-owned source. Disposing the player also detaches the adapter.

The shared player and film API exposes `syncTime(time,{source:'media',playing})` for the active driver and exposes `speed` and `reducedMotion` for inspection. Use the adapter for ordinary media synchronization rather than writing another driver. Its ownership rules keep media control separate from ordinary playback and scrolling.

The adapter follows the [HTML Standard media-element timeline and events](https://html.spec.whatwg.org/multipage/media.html#media-elements). Sampling occurs when the browser can present an update. Timestamp rounding for privacy, stalled devices and reduced update rates in background tabs can limit precision even when the clock relationships are correct.

A local Chrome test played an original two-minute silent PCM audio fixture at normal speed. It observed 120.15 s elapsed across 7205 observations and a maximum sampled drift of 4.493 ms against a 33.333 ms budget, equivalent to one frame at 30 fps. The test also checked seeking, pause and rate changes. These measurements describe that run rather than all devices or streaming sources. The fixture generates its own audio bytes without imported media. Native tests separately cover a full two-minute irregular trace, ownership, rejected playback, reduced motion and cleanup. Raw results are in `benchmarks/results/media-checks.json`.

Set `{reducedMotion:'audio-only'}` when a soundtrack should continue while the picture remains still. An explicit adapter `play()` can then play native audio without advancing the reduced-motion picture. A pause caused only by a motion-preference change does not mute sound, while explicit player or adapter pause and manual seeking still pause it. When unrestricted motion resumes, the picture follows current audio time. Use the adapter's play control for this mode because `player.play()` continues to enforce its own motion restriction. The default policy is `respect`. Volume and mute remain separate choices.

If the platform refuses a playback rate, the adapter restores the previous native rate, pauses picture and media, and reports `MEDIA_RATE_REJECTED` through `onError`. The browser's supported range may be narrower than the API's numeric range of 0.1–16.