// @recipe produce-score
// @title Arrange parts and produce a mastered mix
// @task Write a pad, a harp figure and a drum in bars and beats, mix them through a shared hall to a loudness target and show the parts with the measured result.
// @uses explainerkit/core, explainerkit/color, explainerkit/music, explainerkit/sound/studio
// @keywords compose, arrange, chords, voice leading, arpeggio, synth, harp, drums, reverb, bus, master, loudness, LUFS, stems, soundtrack
// @guide docs/modules/music-production.md
// @times 0, 4, 9
import { scene } from 'explainerkit/core';
import { hsla, toHex } from 'explainerkit/color';
import { arpeggiate, arrangeMusic, chordPitches, musicScoreTime, produceMusic, voiceLead } from 'explainerkit/music';
import { percussionInstrument, pluckedInstrument, synthInstrument, SYNTH_PATCHES } from 'explainerkit/sound/studio';

const chords = ['Dm', 'Bb', 'F', 'C'];
const voicings = voiceLead(chords, { voices: 3, low: 'D3', high: 'D5' });
const score = arrangeMusic({
  tempo: 96,
  bars: 4,
  parts: [
    { id: 'pad', notes: voicings.map((pitch, bar) => ({ bar, pitch, beats: 4, velocity: 70 })) },
    {
      id: 'harp',
      notes: chords.flatMap((chord, bar) =>
        arpeggiate(chordPitches(chord, { octave: 4 }), { pattern: 'updown', steps: 8, step: 0.5, accent: 14 }).map((note) => ({ bar, ...note })),
      ),
    },
    { id: 'drums', percussion: true, notes: [0, 1, 2, 3].map((bar) => ({ bar, pitch: 36, velocity: 96 })) },
  ],
});

// Tracks feed a bus or the master. Sends copy them to one shared hall, and the master sets the delivery level.
const mix = produceMusic(score, {
  sampleRate: 32000,
  tracks: [
    { id: 'pad', instrument: synthInstrument(SYNTH_PATCHES.warmPad), gain: -8, output: 'synths', sends: { hall: -9 } },
    { id: 'harp', instrument: pluckedInstrument({ preset: 'harp' }), gain: -6, pan: 0.25, sends: { hall: -8 } },
    { id: 'drums', instrument: percussionInstrument(), gain: -6 },
  ],
  buses: [{ id: 'synths', effects: [{ type: 'compressor', key: 'drums', threshold: -28, ratio: 3 }] }],
  returns: [{ id: 'hall', effects: [{ type: 'reverb', preset: 'hall', decay: 2.4, mix: 1 }] }],
  master: { loudness: -16, ceiling: -1 },
});
export const audio = { sampleRate: mix.sampleRate, channels: mix.channels };

const time = musicScoreTime(score);
const drawing = scene({ width: 480, height: 270, duration: mix.duration, label: 'Three parts of a produced cue with its loudness and true peak' });
const ink = toHex(hsla(215, 30, 24));
const hues = { pad: 262, harp: 28, drums: 166 };
drawing.text({ x: 24, y: 32, text: 'Three parts, one mastered mix', fontSize: 20, fill: ink });
const left = 78,
  width = 378,
  scale = width / mix.duration;
score.tracks.forEach((track, lane) => {
  const top = 56 + lane * 58;
  drawing.text({ x: 24, y: top + 28, text: track.id, fontSize: 14, fill: ink });
  const pitches = track.notes.map((note) => note.pitch);
  const low = Math.min(...pitches),
    span = Math.max(1, Math.max(...pitches) - low);
  for (const note of track.notes) {
    const start = time.secondsAt(note.tick),
      end = time.secondsAt(note.tick + note.duration);
    drawing.rect({
      x: left + start * scale,
      y: top + 38 - ((note.pitch - low) / span) * 34,
      width: Math.max(3, (end - start) * scale - 1),
      height: 6,
      rx: 2,
      fill: toHex(hsla(hues[track.id], 55, 42)),
    });
  }
});
drawing.text({
  x: 24,
  y: 252,
  text: `${mix.loudness.toFixed(1)} LUFS · ${mix.truePeak.toFixed(1)} dBTP · ${mix.duration.toFixed(1)} s with its reverb tail`,
  fontSize: 14,
  fill: ink,
});
const cursor = drawing.rect({ x: left, y: 52, width: 2, height: 178, fill: ink, opacity: 0.5 });
cursor.to(0, { x: left + width }, { duration: mix.duration, ease: 'linear' });
export const player = await drawing.mount(document.querySelector('#stage'));
