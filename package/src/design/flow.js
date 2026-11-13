// The vocabulary for how an explanation moves, and a measure of it. Every beat of a telling has a register (what it
// does to the audience: a hook, a surprise, play, a story, a parallel, building, the formal statement, generalising,
// reflecting) and a depth (from anecdote to formal). flowStats summarises a sequence of beats, so a process can check
// that a telling changes register often enough, goes deep enough and ends on reflection.
import { defineOperation } from './run.js';

export const REGISTERS = Object.freeze([
  'hook', // an opening question or image that makes the viewer want something
  'surprise', // a result that contradicts an expectation
  'play', // a joke, a game, an aside, an absurd example
  'story', // a person or event
  'parallel', // a sideways step to a different subject sharing the same deep question
  'build', // constructing the explanation piece by piece
  'formal', // the precise statement: a formula, a definition, a proof step, decoded
  'generalise', // the same idea at work somewhere else
  'reflect', // what it means: philosophy, the limits of knowing, the human angle
]);

export const DEPTHS = Object.freeze(['anecdote', 'intuition', 'mechanism', 'formal']);

export const flowStats = defineOperation({
  name: 'flow-stats',
  kind: 'measure',
  purpose:
    'Summarise a sequence of beats: registers used, longest run in one register, deepest point, distance travelled, and how it ends.',
  compute({ beats }) {
    const registers = beats.map((b) => b.register);
    const counts = Object.fromEntries(REGISTERS.map((r) => [r, registers.filter((x) => x === r).length]));
    let longest = 0;
    for (let i = 0, run = 0; i < registers.length; i++) {
      run = i && registers[i] === registers[i - 1] ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    const depths = beats.map((b) => DEPTHS.indexOf(b.depth));
    const changes = registers.filter((r, i) => i && r !== registers[i - 1]).length;
    return {
      beats: beats.length,
      registers: counts,
      distinctRegisters: Object.values(counts).filter(Boolean).length,
      longestRun: longest,
      registerChanges: changes,
      deepest: DEPTHS[Math.max(...depths, 0)],
      farthest: Math.max(...beats.map((b) => b.distance ?? 0), 0),
      parallels: counts.parallel,
      endsOn: registers.slice(-2),
    };
  },
});
