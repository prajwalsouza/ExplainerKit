import { createMusicScore, editMusicNotes, repeatMusicPhrase } from '../../runtime/src/music/index.js';

export const TITLE = 'Beneath the Surface';
const PPQ = 480;
export const BAR = PPQ * 4;
export const PARTS = Object.freeze([
  { id: 'theme', name: 'Piano melody', instrument: 'felt', sample: 'piano', gain: 0.85, pan: -0.1, release: 0.83 },
  { id: 'bed', name: 'Bowed cello', instrument: 'pad', sample: 'arco', gain: 0.48, pan: 0.16, release: 0.58 },
  { id: 'answer', name: 'Plucked cello', instrument: 'pluck', sample: 'pizz', gain: 0.44, pan: 0.23, release: 0.38 },
  { id: 'bass', name: 'Piano left hand', instrument: 'bass', sample: 'piano', gain: 0.62, pan: -0.1, release: 0.92 },
]);
export const SECTIONS = Object.freeze([
  { name: 'Theme', first: 0, last: 4, bpm: 88 },
  { name: 'Opening out', first: 4, last: 8, bpm: 94 },
  { name: 'Return', first: 8, last: 12, bpm: 84 },
]);

const melody = [
  [
    [0, 62, 0.83, 75],
    [1.5, 69, 0.72, 58],
    [2.53, 76, 0.6, 63],
    [3.32, 77, 0.62, 69],
  ],
  [
    [0, 74, 1.42, 70],
    [2.34, 69, 0.84, 57],
    [3.4, 65, 0.53, 49],
  ],
  [
    [0, 67, 0.87, 67],
    [1.24, 69, 0.72, 59],
    [2.18, 72, 1.0, 68],
    [3.53, 74, 0.32, 58],
  ],
  [
    [0, 76, 1.11, 69],
    [1.7, 72, 0.48, 53],
    [2.67, 67, 1.12, 59],
  ],
];

const harmony = [
  [50, 57, 64, 65],
  [46, 53, 57, 62],
  [45, 53, 60, 65],
  [48, 55, 62, 64],
  [50, 57, 64, 65],
  [46, 53, 60, 62],
  [43, 50, 58, 62],
  [45, 52, 55, 61],
  [50, 57, 64, 65],
  [46, 53, 57, 62],
  [48, 55, 62, 64],
  [50, 57, 62, 66],
];

function note(id, bar, beat, pitch, duration, velocity, channel) {
  return {
    id,
    tick: bar * BAR + Math.round(beat * PPQ),
    pitch,
    duration: Math.round(duration * PPQ),
    velocity,
    channel,
  };
}

export function makeCue() {
  const theme = melody.flatMap((events, bar) =>
    events.map(([beat, pitch, duration, velocity], i) =>
      note(`theme-${bar}-${i}`, bar, beat, pitch, duration, velocity, 0),
    ),
  );
  const bow = [
    [],
    [[1.22, 50, 2.6, 53]],
    [[0.06, 53, 3.7, 57]],
    [
      [0.19, 55, 2.27, 55],
      [2.7, 52, 1.17, 49],
    ],
    [
      [0.05, 50, 2.35, 61],
      [2.58, 57, 1.27, 65],
    ],
    [[0.14, 58, 3.65, 63]],
    [
      [0.12, 55, 2.06, 67],
      [2.36, 58, 1.54, 63],
    ],
    [
      [0.08, 57, 2.17, 64],
      [2.48, 49, 1.34, 58],
    ],
    [[0.13, 50, 3.61, 53]],
    [[0.24, 46, 2.9, 47]],
    [[1.22, 55, 2.39, 49]],
    [[0.14, 50, 3.47, 48]],
  ];
  const bed = bow.flatMap((events, bar) =>
    events.map(([beat, pitch, duration, velocity], i) =>
      note(`bed-${bar}-${i}`, bar, beat, pitch, duration, velocity, 1),
    ),
  );
  const answer = harmony.flatMap((chord, bar) => {
    if (bar < 4 || bar > 9) return [];
    const steps = bar < 5 || bar > 7 ? [2.64] : [1.36, 2.73, 3.45];
    return steps.map((beat, i) =>
      note(`answer-${bar}-${i}`, bar, beat, chord[i + 1] - (chord[i + 1] > 60 ? 12 : 0), 0.36, 49 + (i % 2) * 9, 2),
    );
  });
  const bass = harmony.flatMap(([root, fifth], bar) => [
    note(`bass-${bar}-0`, bar, bar % 3 === 0 ? 0.04 : 0.13, root, bar === 11 ? 3.46 : 2.21, bar < 4 ? 53 : 56, 3),
    ...(bar % 4 === 0 || bar === 6 || bar === 11
      ? [note(`bass-${bar}-1`, bar, 0.32, fifth, 1.7, bar === 11 ? 42 : 48, 3)]
      : []),
  ]);
  const base = createMusicScore({
    title: TITLE,
    ppq: PPQ,
    endTick: 12 * BAR,
    tempos: SECTIONS.map(({ first, bpm }) => ({ tick: first * BAR, microsecondsPerQuarter: Math.round(60e6 / bpm) })),
    meters: [{ tick: 0, numerator: 4, denominator: 4 }],
    tracks: PARTS.map(({ id, name }, channel) => ({
      id,
      name,
      notes: [theme, bed, answer, bass][channel],
      messages: [{ tick: 0, status: 0xc0 + channel, data1: [0, 42, 45, 0][channel] }],
    })),
  });
  const repeat = repeatMusicPhrase(base, {
    id: 'lift',
    start: 0,
    end: 4 * BAR,
    at: 4 * BAR,
    tracks: ['theme'],
    velocityScale: 1.08,
  });
  const copied = repeatMusicPhrase(repeat, {
    id: 'return',
    start: 0,
    end: 4 * BAR,
    at: 8 * BAR,
    tracks: ['theme'],
    velocityScale: 0.92,
  });
  const adjustments = [
    [5, 3.4, { pitch: 77 }],
    [6, 2.18, { pitch: 78, velocity: 73 }],
    [6, 3.53, { pitch: 77 }],
    [7, 0, { pitch: 76 }],
    [7, 1.7, { pitch: 73, duration: 380 }],
    [7, 2.67, { pitch: 69 }],
    [10, 0, { pitch: 64 }],
    [10, 2.18, { pitch: 67 }],
    [10, 3.53, { pitch: 69 }],
    [11, 0, { pitch: 66 }],
    [11, 1.7, { pitch: 64 }],
    [11, 2.67, { pitch: 62, duration: 600, velocity: 61 }],
  ];
  const byTick = new Map(copied.tracks[0].notes.map((event) => [event.tick, event.id]));
  const edits = adjustments.map(([bar, beat, change]) => ({ id: byTick.get(bar * BAR + Math.round(beat * PPQ)), ...change }));
  return { copied, score: editMusicNotes(copied, edits), edits };
}

export function cueRenderOptions(banks) {
  return {
    stems: true,
    tail: 1.1,
    space: banks ? 0.27 : 0.54,
    gain: banks ? 0.96 : 0.84,
    tracks: PARTS.map(({ id, instrument, sample, gain, pan, release }) => ({
      id,
      ...(banks ? { sample: { bank: banks[sample], release } } : { instrument }),
      gain,
      pan,
    })),
  };
}

export function makeGuidePhrase() {
  const first = createMusicScore({
    ppq: 480,
    endTick: 1920,
    tempos: [{ tick: 0, microsecondsPerQuarter: 680000 }],
    tracks: [
      {
        id: 'keys',
        name: 'Piano',
        notes: [
          { id: 'opening', tick: 0, duration: 720, pitch: 62, velocity: 76 },
          { id: 'ending', tick: 960, duration: 720, pitch: 69, velocity: 65 },
        ],
      },
    ],
  });
  const copied = repeatMusicPhrase(first, { id: 'return', start: 0, end: 1920, at: 1920 });
  const ending = copied.tracks[0].notes.find((event) => event.tick === 2880);
  return { copied, score: editMusicNotes(copied, [{ id: ending.id, pitch: 65, velocity: 71 }]), changedId: ending.id };
}
