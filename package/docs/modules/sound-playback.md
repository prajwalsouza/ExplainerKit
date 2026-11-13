# Audition an original soundtrack

Use `attachSoundtrack` from `explainerkit/sound` to play an already rendered soundtrack alongside a scene player. Prepare the decoded audio and the player first, then start playback from a user action.

```js
import {attachSoundtrack} from 'explainerkit/sound';
const audition = attachSoundtrack(player, renderedPCM, {volume: .6});
playButton.addEventListener('click', () => {
  audition.play().catch(showPlaybackError);
});
// audition.pause(); audition.seek(2); audition.speed = 1.25;
// audition.muted = true; audition.volume = .2; audition.dispose();
```

Supply decoded mono or stereo audio as `{sampleRate,channels}`, with optional duration and metadata. These numeric channel samples are pulse-code-modulated audio, or PCM. The adapter copies them, encodes an owned 16-bit PCM WAV, creates an audio element and Blob URL, then delegates timing to [`attachMedia`](media-clock.md). It does not create Web Audio voices, a separate interval scheduler or another picture clock. Cues already occupy sample positions in the rendered mix, so seeking backward cannot stack old one-shot voices over new ones. Live effects and MIDI playback are outside this adapter.

Construction leaves audio paused. Call `play()` from a click or key action that the browser recognizes as user activation. A refused request throws `MEDIA_PLAY_REJECTED`, reports it through `onError` and exposes it as `error`. The reporter defaults to the player's reporter, and a later user action can retry playback. This does not bypass autoplay rules or guarantee that a device is audible. Read the adapter's `playing` for native audio state, since `player.playing` may remain false when reduced motion keeps the picture still.

Set `volume` in 0–1, `muted` as a boolean, a nonnegative source `offset` in seconds, and `onError` as needed. Volume defaults to 1 and muted defaults to false. The `reducedMotion` choice is `'audio-only'` or `'respect'`. Audio-only is the default for soundtracks and lets explicitly requested sound continue while the picture holds its current sample. Manual pause or seeking still stops audio. Choose respect to pause both, matching `attachMedia`'s default. Use the sound adapter's play control for audio-only playback because the ordinary player continues enforcing its own motion restriction.

The adapter shares `speed` in 0.1–16 with media and player. Its controls reuse one audio element, and volume and mute affect only that element. You may use the exposed `media` for accessible controls or loading status, but replacing its source or taking over its events is outside the supported interface. The adapter reserves the player's media driver and rejects an existing scroll or media owner rather than competing for the same clock.

Disposal detaches the driver, pauses, unloads and removes only the owned audio element, and revokes only the owned URL. It is safe to repeat and also runs when the player is disposed or its media driver is released. Cleanup continues if the platform refuses one operation, with causes retained under `SOUND_CLEANUP`. Application-owned audio contexts, media elements, URLs and other voices are left alone. Supply `document` for an explicit browser host, or let the adapter use the document of the player's element.

Captured audio is limited to 16 million channel samples at whole-number sample rates from 8000 to 192000 Hz. WAV encoding clamps samples outside [-1,1], so inspect the mix or processing diagnostics for clipping before auditioning it. The adapter is an in-memory preview within those limits rather than a streaming player or general compressed-file decoder.

Native tests check capture, ownership, paused construction, seeking, rate changes, retry, reduced-motion separation and cleanup. The browser fixture in `tests/browser/sound-playback-checks.html` checks native WAV timing and controls. Automated mode is muted, while `?gesture=1` waits for a browser-recognized click and plays unmuted. These checks establish control behavior rather than subjective quality or loudness on physical devices.

A development check, `scripts/sound-gesture-checks.mjs`, verifies activation in the installed engines without autoplay bypass flags. It clicks the fixture button through Playwright and verifies the recognized, unmuted path and native controls. Its gesture report records the source hash and results. If source changes during a run, that report is marked partial rather than claiming one verified snapshot.

A platform may refuse a rate even when it lies within the numeric API range. The media adapter then restores the previous picture rate, pauses playback and reports `MEDIA_RATE_REJECTED`. Setting soundtrack `speed` also throws that coded error, and a failed restoration is retained as `rollbackError`.