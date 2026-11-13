# Mix recorded audio and combine it with video

Import `createAudioMix` and `encodeWav` from `explainerkit/sound/mix`. Supply decoded mono or stereo pulse-code modulation (PCM) samples, not compressed bytes.

```js
const mix = createAudioMix([
  {id: 'voice', role: 'narration', channels: [voicePCM], sampleRate: 48000, start: 1},
  {id: 'music', role: 'music', channels: [musicPCM], sampleRate: 44100, gain: .3},
], {duckGain: .25, attack: .05, release: .2, threshold: .01});
const rendered = mix.render({sampleRate: 48000, from: 0, duration: 30});
const wav = encodeWav(rendered);
```

The mixer copies its source samples so callers cannot change a prepared mix by editing the input buffers. Each track supplies an ID, sample rate, start offset, gain and role of `narration`, `music` or `effect`. Mono tracks are duplicated into stereo, and linear interpolation converts between sample rates. `sample(seconds)` returns an immutable left/right pair at any requested time.

Use `render` when you need writable output channels and a count of clipped samples in `clippedSamples`. Source buffers are not exposed. `encodeWav` converts the result to signed 16-bit PCM and clips values that exceed that format’s range. The mixer does not normalize loudness, limit peaks, provide band-limited resampling or decode compressed audio.

To reduce music under narration, the mixer checks peak amplitudes in fixed 10 ms blocks and merges neighboring active blocks into intervals. Music gain falls smoothly before an interval and recovers smoothly afterward using the attack and release settings. These defaults are animation and audio-design choices rather than measured perceptual laws. A binary search finds the interval at a requested time, so the result does not depend on playback history. This is not a streaming sidechain compressor or speech recognizer.

Your application decodes audio, stores WAV or Blob data, obtains permissions and starts playback. Once the mixed recording is in an audio element, `attachMedia(player,audioElement)` can make that recording drive the picture’s clock. The mix is prepared offline rather than synchronizing several independently playing HTML audio elements.

```sh
npx explainerkit-export-film --url http://localhost:8080/your-film/ \
  --out /absolute/path/new-export --video --audio /absolute/path/mix.wav
```

Pass `--audio` to include a local RIFF/WAVE file in an ffmpeg video export. The exporter trims audio from the picture’s `--from` time, encodes it as AAC and adds silence when needed to match the encoded frame duration. A header check rejects playlists, and ffmpeg is restricted to local-file audio input. This option requires ffmpeg and video output.

If encoding fails, captured PNGs and a failure manifest remain available. Duration rounding follows the frame schedule, which includes its start and excludes its end. Different codecs or platforms are not guaranteed to produce identical encoded bytes.

A mix accepts 1–32 tracks with whole-number sample rates from 8–192 kHz, up to 32 million copied samples and a timeline no longer than one day. Each render is limited to 16 million track/sample operations and 32 million output channel samples. Render longer mixes in adjacent segments. Local files supplied for combining audio and video must be nonempty and no larger than 512 MB. The API provides fixed-gain mixing rather than a multitrack editor or effect graph.

Run `node benchmarks/audio-export.mjs` to test local Chrome, ffmpeg and ffprobe together. Both ffmpeg and ffprobe must already be installed. The check creates six frames of original audio and H.264 video, then independently checks the codecs, frame count and audio duration. It removes temporary media and retains the measured report.