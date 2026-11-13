// Several subtopics or learning objectives in, one stitched piece (or a series) out. Each subtopic is researched as
// if it were a full video of its own, so none gets thin, borrowed research. Then a filtering agent decides what
// belongs together and what to cut, and a stitching agent orders what is left into chapters with real hand-offs.
// Code checks the plan at each step: every objective covered, nothing cut sneaking back, the time budget kept.
//
//   brief (topics or objectives) → plan subtopics (objectives only) → cover check (measure)
//         → discover each subtopic as a full explainer (in parallel, each in its own scope)
//         → cohesion map (measure: shared ideas and words between subtopics)
//         → assess cohesion (filtering agent: through-line, keep or cut, one piece / series / not feasible)
//         → stitch (structuring agent: chapters, hand-offs, callbacks, cuts) → check stitch (measure)
//         → write: one piece from the merged material, or each episode of a series
import { assert } from '../core/validate.js';
import { findParallels, findPeople } from './explore.js';
import { defineOperation } from './run.js';
import { boolean, list, number, oneOf, record, string } from './schema.js';
import {
  DEFAULT_AUDIENCE,
  SHAPES,
  VOICE_GATE,
  checkTellings,
  developTelling,
  discoverExplainer,
  draftScript,
  revise,
  scriptMeasures,
  voiceProblems,
  writeExplainer,
} from './explainer.js';
import { nameIt, polishVoice, reviewScience, reviewStory } from './craft.js';
import { shortRuns, termHits } from './measures.js';
import { auditScriptAttention, keepAttention, planAttention } from './attention.js';
import { VISUAL_STAGES, designVisuals } from './production.js';

const ids = list(string({ max: 60 }), { max: 20 });
const maxSeriesTopics = 12;
const maxSeriesCandidates =
  maxSeriesTopics * (1 + findPeople.output.fields.people.max + findParallels.output.fields.parallels.max);

export const planSubtopics = defineOperation({
  name: 'plan-subtopics',
  role: 'You are a curriculum designer who also makes videos. You know a learning objective is not yet a story.',
  purpose: 'Group the learning objectives into subtopics, each strong enough to be a full video of its own.',
  method: [
    'Read every objective. Group objectives that need the same explanation; split an objective that hides two different ideas.',
    'Give each subtopic a topic phrase a researcher could start from, the objective ids it covers, and why it can stand on its own.',
    'Every objective must belong to at least one subtopic. Do not invent objectives.',
  ],
  output: record({
    subtopics: list(
      record({
        id: string({ max: 60 }),
        topic: string({ max: 200 }),
        objectives: ids,
        standsAlone: string({ max: 300 }),
      }),
      { min: 1, max: 8 },
    ),
  }),
});

export const coverObjectives = defineOperation({
  name: 'cover-objectives',
  kind: 'measure',
  purpose: 'Check that every learning objective is covered by at least one subtopic or chapter.',
  compute({ objectives, groups }) {
    const covered = new Set(groups.flatMap((g) => g.objectives ?? []));
    return {
      missing: objectives.filter((o) => !covered.has(o.id)).map((o) => o.id),
      covered: [...covered].filter((id) => objectives.some((o) => o.id === id)).length,
      of: objectives.length,
    };
  },
});

const words = (text) =>
  new Set(
    String(text)
      .toLowerCase()
      .match(/[a-z]{5,}/g) ?? [],
  );

/** Compact what discovery found for one subtopic, so later steps read summaries, not whole dossiers. */
export function summariseDiscovery(found) {
  return {
    topic: found.brief.topic,
    objectives: found.brief.objectives ?? [],
    seed: found.seed.seed,
    insight: found.seed.insight,
    deepQuestion: found.parallels.deepQuestion,
    mechanism: found.research.mechanism,
    ideas: found.plan.ideas.map((i) => ({ id: i.id, idea: i.idea })),
    people: found.people.map((p) => ({ id: p.id, who: p.who, shows: p.shows })),
    parallels: found.parallels.parallels.map((p) => ({ id: p.id, story: p.story.slice(0, 240), distance: p.distance })),
    image: found.image.chosen,
    meaning: found.meaning.bigger,
  };
}

export const cohesionMap = defineOperation({
  name: 'cohesion-map',
  kind: 'measure',
  purpose:
    'Measure how much the subtopics share: idea ids and content words in common, and which subtopics share nothing with the rest.',
  compute({ summaries }) {
    const bags = summaries.map((s) =>
      words([s.insight, s.deepQuestion, ...s.mechanism, ...s.ideas.map((i) => i.idea)].join(' ')),
    );
    const idSets = summaries.map((s) => new Set(s.ideas.map((i) => i.id)));
    const pairs = [];
    for (let a = 0; a < summaries.length; a++)
      for (let b = a + 1; b < summaries.length; b++) {
        const sharedWords = [...bags[a]].filter((w) => bags[b].has(w));
        const sharedIdeas = [...idSets[a]].filter((w) => idSets[b].has(w));
        pairs.push({
          a: summaries[a].topic,
          b: summaries[b].topic,
          sharedIdeas,
          sharedWords: sharedWords.slice(0, 15),
          overlap: Math.round((sharedWords.length / Math.max(1, Math.min(bags[a].size, bags[b].size))) * 100) / 100,
        });
      }
    const isolated = summaries
      .map((s) => s.topic)
      .filter((topic) =>
        pairs
          .filter((p) => p.a === topic || p.b === topic)
          .every((p) => p.overlap < 0.08 && p.sharedIdeas.length === 0),
      );
    return { pairs, isolated };
  },
});

export const assessCohesion = defineOperation({
  name: 'assess-cohesion',
  role: 'You are an executive producer with good taste in both directions: you cut what breaks the through-line, and you fight to keep the stories that make people care. You say plainly when a brief cannot become one piece.',
  purpose:
    'Decide what belongs together: find the through-line, mark every piece of material keep or cut, and judge whether this can be one piece, a series, or not feasible.',
  method: [
    'Read every subtopic summary and the cohesion map. Write two or three candidate through-lines: one question or tension that every kept part serves.',
    'Choose the through-line that keeps the most objectives with the least forcing.',
    'For every person, parallel and seed in every subtopic, mark keep or cut, with a one-line reason. Cut what breaks the through-line or repeats another item; keep what carries the mechanism through a person, a place or an image. Colour is not a detour when it carries the idea.',
    'Return a separate decision for every candidate. Copy its exact ID into item, even when several candidates have the same decision and reason.',
    'Keep at least one person or story for every subtopic, and about a third of the material overall. A piece made only of mechanisms is a lecture.',
    'Judge feasibility. One piece: the parts form a single arc within the time budget. Series: each part needs its own arc but they share a thread. Not feasible: the parts share no real thread; say what is missing and what would fix it.',
    'Name the risk most likely to make the result feel stitched together.',
  ],
  output: record({
    throughLines: list(record({ line: string({ max: 300 }), serves: string({ max: 300 }) }), { min: 2, max: 3 }),
    throughLine: string({ max: 300 }),
    decisions: list(
      record({
        subtopic: string({ max: 200 }),
        item: string({ max: 60 }),
        kind: oneOf(['seed', 'person', 'parallel']),
        keep: boolean(),
        reason: string({ max: 200 }),
      }),
      { min: 1, max: maxSeriesCandidates },
    ),
    verdict: oneOf(['one-piece', 'series', 'not-feasible']),
    why: string({ max: 600 }),
    missing: string({ max: 400 }),
    risk: string({ max: 300 }),
  }),
});

export const stitch = defineOperation({
  name: 'stitch',
  role: 'You are a story editor who structures long explainers so they feel like one journey, not a playlist.',
  purpose:
    'Order the kept material into chapters along the through-line, with hand-offs and callbacks, and list everything you cut.',
  method: [
    'Use only kept material. Each chapter covers one or more subtopics, says which objectives it serves, its purpose, and which kept people, parallels and images it uses (by id).',
    'In subtopics, copy the exact topic names from material. In uses, copy the exact IDs of the kept candidates this chapter uses.',
    'Order chapters so each one creates the need for the next. Write the hand-off: the question the end of one chapter leaves for the start of the next.',
    'Plant callbacks: an image, number or person from an early chapter that returns later with new meaning.',
    'Choose one central image for the whole piece, and the opening and closing it returns to.',
    'Give each chapter its minutes and a shape. The time budget is a guide, not a limit: a chapter can run long, and segments can be trimmed later. List anything else you cut and why.',
    'Finally, say honestly whether it holds together, and what would make a viewer feel the seams.',
  ],
  output: record({
    title: string({ max: 120 }),
    image: string({ max: 300 }),
    opening: string({ max: 400 }),
    closing: string({ max: 400 }),
    chapters: list(
      record({
        id: string({ max: 60 }),
        purpose: string({ max: 300 }),
        subtopics: list(string({ max: 200 }), { min: 1, max: 4 }),
        objectives: ids,
        uses: list(string({ max: 60 }), { max: maxSeriesCandidates }),
        handOff: string({ max: 300 }),
        minutes: number({ min: 0.5, max: 30 }),
        shape: oneOf(Object.keys(SHAPES)),
      }),
      { min: 2, max: 10 },
    ),
    callbacks: list(
      record({ planted: string({ max: 60 }), returns: string({ max: 60 }), what: string({ max: 300 }) }),
      { max: 6 },
    ),
    cuts: list(string({ max: 300 }), { max: maxSeriesCandidates }),
    holds: boolean(),
    seams: string({ max: 400 }),
  }),
});

/** Share of the material the filtering agent kept; below `min`, the piece is likely to read as a lecture. */
export function keepRatio(decisions, { min = 0.25 } = {}) {
  const kept = decisions.filter((d) => d.keep).length;
  const ratio = decisions.length ? Math.round((kept / decisions.length) * 100) / 100 : 1;
  return { kept, of: decisions.length, ratio, tooFew: ratio < min };
}

export const checkStitch = defineOperation({
  name: 'check-stitch',
  kind: 'measure',
  purpose:
    'Check the stitched plan: objectives covered, cut material not used, every chapter handed off, time within budget.',
  compute({ outline, objectives, cutIds, minutes, decisions = [] }) {
    const errors = [];
    const keeping = keepRatio(decisions);
    if (keeping.tooFew)
      errors.push(
        `Only ${keeping.kept} of ${keeping.of} stories and people were kept; the piece may read as a lecture.`,
      );
    const covered = new Set(outline.chapters.flatMap((c) => c.objectives));
    const missing = objectives.filter((o) => !covered.has(o.id)).map((o) => o.id);
    if (missing.length) errors.push(`Objectives not covered by any chapter: ${missing.join(', ')}.`);
    const reused = outline.chapters.flatMap((c) => c.uses).filter((id) => cutIds.includes(id));
    if (reused.length) errors.push(`Cut material is used again: ${[...new Set(reused)].join(', ')}.`);
    outline.chapters.slice(0, -1).forEach((c) => {
      if (!c.handOff.trim()) errors.push(`${c.id} has no hand-off to the next chapter.`);
    });
    const total = Math.round(outline.chapters.reduce((n, c) => n + c.minutes, 0) * 10) / 10;
    const notes = [];
    if (total > minutes * 1.15)
      notes.push(
        `The chapters add up to ${total} minutes against a ${minutes}-minute guide; trim optional sections later if needed.`,
      );
    return {
      errors,
      notes,
      totalMinutes: total,
      chapters: outline.chapters.length,
      callbacks: outline.callbacks.length,
      cuts: outline.cuts.length,
      keeping,
    };
  },
});

/**
 * Did cut material come back in the written script? Looks for the names of cut people and the proper nouns of cut
 * stories in the narration.
 */
export const checkCuts = defineOperation({
  name: 'check-cuts',
  kind: 'measure',
  purpose: 'Find cut people and stories that reappear in the written narration.',
  compute({ sections, cut }) {
    const text = sections.map((s) => s.narration).join('\n');
    const back = [];
    for (const item of cut) {
      const hits = termHits(
        text,
        (item.names ?? []).filter((n) => n.length > 3),
      );
      if (Object.keys(hits).length) back.push({ id: item.id, found: Object.keys(hits) });
    }
    return { back, clean: back.length === 0 };
  },
});

/** Capitalised names that do not merely start a sentence ("Haskins Laboratories", not "Imagine"). */
function properNouns(text) {
  const out = [];
  for (const m of text.matchAll(/\b[A-Z][\p{L}]+(?:[ -][A-Z][\p{L}]+)*/gu)) {
    const before = text.slice(0, m.index).trimEnd();
    const startsSentence = before === '' || /[.!?:"“]$/.test(before);
    if (m[0].length > 5 && (!startsSentence || m[0].includes(' '))) out.push(m[0]);
  }
  return [...new Set(out)].slice(0, 4);
}

/** Names and proper nouns for each cut item, for checkCuts. */
export function cutNames(found, cutIds) {
  const out = [];
  for (const f of found) {
    for (const p of f.people)
      if (cutIds.includes(p.id)) {
        const name = p.who.split(',')[0].trim();
        out.push({ id: p.id, names: [name, name.split(' ').at(-1)] });
      }
    for (const p of f.parallels.parallels)
      if (cutIds.includes(p.id)) out.push({ id: p.id, names: properNouns(p.story) });
  }
  return out;
}

export const bridgeChapters = defineOperation({
  name: 'bridge-chapters',
  role: 'You are the story editor who makes a long piece feel like one journey. You write the joins nobody notices.',
  purpose:
    'Write the bridges between chapters and plant the callbacks, so separately written chapters read as one piece.',
  method: [
    'Read how each chapter opens and closes, the hand-offs in the outline, and the callbacks.',
    'For every boundary, write a short bridge section (two to five sentences) that turns the end of one chapter into the question that opens the next. It should sound like the same host, not an announcer.',
    'For each callback, write one sentence to add at the end of a named section, where an image, number or person from earlier returns with new meaning.',
    'Write the closing lines: return to the opening image of the whole piece, now seen differently.',
  ],
  output: record({
    bridges: list(
      record({ after: string({ max: 60 }), narration: string({ max: 1200 }), visual: string({ max: 300 }) }),
      { max: 10 },
    ),
    callbacks: list(record({ chapter: string({ max: 60 }), beat: string({ max: 60 }), line: string({ max: 400 }) }), {
      max: 8,
    }),
    closing: string({ max: 900 }),
  }),
});

const firstLast = (script) => ({
  opens: script.sections[0]?.narration.slice(0, 500) ?? '',
  closes: script.sections.at(-1)?.narration.slice(-500) ?? '',
});

/** Write one chapter of a long piece: telling, draft, two reviews, revision and the voice gate. */
async function writeChapter(run, context, chapter, { moves }) {
  const brief = { ...context.brief, minutes: chapter.minutes, chapter: chapter.purpose };
  const input = { ...context, brief, chapter, ...(moves ? { movesFromCreators: moves } : {}) };
  const telling = await run.call(developTelling, { ...input, shape: `${chapter.shape}: ${SHAPES[chapter.shape]}` });
  const { checks } = await run.call(checkTellings, {
    tellings: [telling],
    known: context.plan.ideas.filter((i) => i.known).map((i) => i.id),
  });
  const draft = await run.call(draftScript, { ...input, telling });
  const draftMeasures = await run.call(scriptMeasures, draft, { label: 'draft-measures' });
  const [science, storyNotes] = await run.all([
    run.call(reviewScience, { brief, script: draft.sections, research: context.research, measures: draftMeasures }),
    run.call(reviewStory, {
      brief,
      script: draft.sections,
      measures: draftMeasures,
      telling,
      meaning: context.meaning,
    }),
  ]);
  let script = await run.call(revise, {
    brief,
    script: draft.sections,
    research: context.research,
    reviews: { science, story: storyNotes },
  });
  let measures = await run.call(scriptMeasures, script, { label: 'revised-measures' });
  const choppy = shortRuns(script.sections.map((x) => x.narration).join('\n\n'));
  const problems = voiceProblems(measures, VOICE_GATE, choppy);
  if (problems.length) {
    script = {
      ...script,
      ...(await run.call(polishVoice, {
        brief,
        sections: script.sections,
        measures,
        problems,
        choppyPassages: choppy.map((r) => r.join(' ')),
      })),
    };
    measures = await run.call(scriptMeasures, script, { label: 'final-measures' });
  }
  return {
    chapter,
    telling,
    check: checks[0],
    draft,
    reviews: { science, story: storyNotes },
    voiceGate: problems,
    script,
    measures,
  };
}

/**
 * Write a long piece chapter by chapter, in parallel, then bridge the chapters and plant the callbacks. A weak model
 * writes a good chapter far more reliably than a good long script in one go.
 */
export async function writeChapters(
  run,
  whole,
  outline,
  {
    moves = null,
    medium = 'motion-graphics',
    style = undefined,
    imager = null,
    reviewer = null,
    visuals: withVisuals = true,
  } = {},
) {
  // Plan attention for the whole piece: the opening hook for the first chapter and a refill to open each later one.
  const attention = await planAttention(run, {
    brief: whole.brief,
    sections: outline.chapters.map((c) => ({ beat: c.id, narration: c.purpose })),
  });
  const refillOf = (i) => attention.plan.refills.find((r) => r.section === i + 1)?.line ?? '';
  const chapters = outline.chapters.map((c, i, all) => ({
    ...c,
    ...(i === 0
      ? { hook: attention.plan.opening.line, promise: attention.plan.opening.promise }
      : { refill: refillOf(i) }),
    position: i === 0 ? 'first' : i === all.length - 1 ? 'last' : 'middle',
    handOffIn: i ? all[i - 1].handOff : outline.opening,
    handOffOut: i < all.length - 1 ? c.handOff : outline.closing,
  }));
  const pick = (wanted, items) => items.filter((x) => wanted.includes(x.id));
  const written = await run.all(
    chapters.map((c, i) =>
      writeChapter(
        run.scope(`chapter-${i + 1}`),
        {
          ...whole,
          people: pick(c.uses, whole.people),
          parallels: { ...whole.parallels, parallels: pick(c.uses, whole.parallels.parallels) },
          outline: {
            title: outline.title,
            image: outline.image,
            chapters: outline.chapters.map((x) => ({ id: x.id, purpose: x.purpose })),
          },
        },
        c,
        { moves },
      ),
    ),
  );
  const joins = await run.call(bridgeChapters, {
    outline: {
      title: outline.title,
      image: outline.image,
      opening: outline.opening,
      closing: outline.closing,
      callbacks: outline.callbacks,
    },
    chapters: written.map((w) => ({
      id: w.chapter.id,
      purpose: w.chapter.purpose,
      handOff: w.chapter.handOff,
      beats: w.script.sections.map((s) => s.beat),
      ...firstLast(w.script),
    })),
  });
  const sections = [];
  for (const w of written) {
    for (const s of w.script.sections) {
      const back = joins.callbacks.filter((c) => c.chapter === w.chapter.id && c.beat === s.beat).map((c) => c.line);
      sections.push({
        ...s,
        beat: `${w.chapter.id}-${s.beat}`,
        narration: [s.narration, ...back].join(' '),
        chapter: w.chapter.id,
      });
    }
    const bridge = joins.bridges.find((b) => b.after === w.chapter.id);
    if (bridge && w !== written.at(-1))
      sections.push({
        beat: `${w.chapter.id}-bridge`,
        narration: bridge.narration,
        visual: bridge.visual,
        notes: '',
        optional: false,
        cites: [],
        chapter: w.chapter.id,
      });
  }
  if (joins.closing.trim())
    sections.push({
      beat: 'closing',
      narration: joins.closing,
      visual: outline.closing,
      notes: '',
      optional: false,
      cites: [],
      chapter: written.at(-1).chapter.id,
    });
  // Keep attention across the stitched piece, audited chapter by chapter; edits are kept only if they help.
  const held = await keepAttention(run, { brief: whole.brief, sections, research: attention.research });
  if (held.pass?.kept) sections.splice(0, sections.length, ...held.sections);
  // Design the visuals for the whole piece; narration edits are kept only if the attention audit agrees.
  const visuals = withVisuals
    ? await designVisuals(run, {
        brief: whole.brief,
        sections,
        medium,
        attention: held.measures,
        recheck: async (r, secs) =>
          (await auditScriptAttention(r, { brief: whole.brief, sections: secs, research: attention.research }))
            .problems,
        baseline: held.problems.length,
        imager,
        reviewer,
        style,
      })
    : null;
  if (visuals && visuals.sections !== sections) sections.splice(0, sections.length, ...visuals.sections);
  const measures = await run.call(scriptMeasures, { sections }, { label: 'piece-measures' });
  const title = await run.call(nameIt, {
    brief: whole.brief,
    story: whole.story,
    script: sections.map((s) => ({ beat: s.beat, narration: s.narration.slice(0, 400) })),
  });
  return {
    chapters: written,
    joins,
    visuals,
    attention: {
      research: attention.research,
      plan: attention.plan,
      audit: held.audit,
      measures: held.measures,
      problems: held.problems,
      pass: held.pass,
    },
    script: { sections },
    measures,
    title,
  };
}

function merge(found, keepIds, outline, brief) {
  const keep = (id) => keepIds.has(id);
  const parallels = found.flatMap((f) => f.parallels.parallels.filter((p) => keep(p.id)));
  return {
    brief: { ...brief, topic: outline.title, minutes: brief.minutes },
    story: {
      seed: { seed: outline.opening, insight: found.map((f) => f.seed.insight).join(' / ') },
      editor: { why: 'Stitched from several subtopics along one through-line.', protect: outline.seams },
    },
    research: {
      mechanism: found.flatMap((f) => f.research.mechanism),
      claims: found.flatMap((f) => f.research.claims),
      numbers: found.flatMap((f) => f.research.numbers),
      demonstrations: found.flatMap((f) => f.research.demonstrations),
      boundaries: found.flatMap((f) => f.research.boundaries),
      misconceptions: found.flatMap((f) => f.research.misconceptions),
      openQuestions: found.flatMap((f) => f.research.openQuestions),
    },
    people: found.flatMap((f) => f.people.filter((p) => keep(p.id))),
    parallels: { deepQuestion: outline.opening, parallels },
    plan: { ending: outline.closing, ideas: found.flatMap((f) => f.plan.ideas) },
    meaning: {
      bigger: found.map((f) => f.meaning.bigger).join(' '),
      ending: outline.closing,
      lastLine: '',
      levels: [],
      tomorrow: '',
    },
    image: { chosen: outline.image, returnAtEnd: outline.closing },
    outline,
    cut: outline.cuts,
  };
}

/**
 * Run the series process. `brief` has `topics` (a list of subtopic phrases) or `objectives` (learning objectives),
 * plus `audience`, `goals` and `minutes` for the whole. Returns the discovery for each subtopic, the cohesion
 * assessment, the stitched outline and its checks, and the written piece or episodes (unless not feasible).
 */
export async function designSeries(
  run,
  brief,
  { seed = 1, moves = null, imager = null, reviewer = null, visuals = true } = {},
) {
  assert(
    brief && (Array.isArray(brief.topics) || Array.isArray(brief.objectives)),
    'INVALID_DATA',
    'Give a list of topics or of learning objectives.',
  );
  const audience = brief.audience ?? DEFAULT_AUDIENCE;
  const minutes = brief.minutes ?? 20;
  const objectives = (brief.objectives ?? brief.topics).map((text, i) => ({ id: `o${i + 1}`, text }));
  assert(
    objectives.length >= 2 && objectives.length <= maxSeriesTopics,
    'INVALID_DATA',
    'Give between 2 and 12 topics or objectives.',
  );

  let subtopics;
  if (brief.objectives) {
    ({ subtopics } = await run.call(planSubtopics, { audience, objectives }));
    const cover = await run.call(coverObjectives, { objectives, groups: subtopics });
    assert(
      cover.missing.length === 0,
      'DESIGN_PLAN_INCOMPLETE',
      `The subtopics leave objectives uncovered: ${cover.missing.join(', ')}.`,
    );
  } else subtopics = objectives.map((o) => ({ id: o.id, topic: o.text, objectives: [o.id] }));

  const found = await run.all(
    subtopics.map((s, i) =>
      discoverExplainer(
        run.scope(`topic-${i + 1}`),
        {
          topic: s.topic,
          audience,
          goals: brief.goals,
          minutes: Math.max(4, Math.round(minutes / subtopics.length)),
          objectives: s.objectives.map((id) => objectives.find((o) => o.id === id)?.text ?? id),
        },
        { seed: seed + i },
      ),
    ),
  );
  const summaries = found.map(summariseDiscovery);
  const map = await run.call(cohesionMap, { summaries });
  const assessment = await run.call(assessCohesion, { audience, minutes, objectives, summaries, cohesionMap: map });
  const result = { form: 'series', objectives, subtopics, discoveries: found, cohesionMap: map, assessment };
  if (assessment.verdict === 'not-feasible') return result;

  const cutIds = assessment.decisions.filter((d) => !d.keep).map((d) => d.item);
  const kept = summaries.map((s) => ({
    ...s,
    people: s.people.filter((p) => !cutIds.includes(p.id)),
    parallels: s.parallels.filter((p) => !cutIds.includes(p.id)),
  }));
  const outline = await run.call(stitch, {
    audience,
    minutes,
    objectives,
    throughLine: assessment.throughLine,
    verdict: assessment.verdict,
    material: kept,
    cuts: assessment.decisions.filter((d) => !d.keep),
  });
  const checks = await run.call(checkStitch, { outline, objectives, cutIds, minutes, decisions: assessment.decisions });
  Object.assign(result, { outline, checks });

  const keepIds = new Set(assessment.decisions.filter((d) => d.keep).map((d) => d.item));
  if (assessment.verdict === 'one-piece') {
    const whole = merge(found, keepIds, outline, {
      audience,
      goals: brief.goals ?? 'curiosity and real understanding',
      minutes,
    });
    result.piece = await writeChapters(run.scope('whole'), whole, outline, {
      moves,
      medium: brief.medium ?? 'motion-graphics',
      style: brief.style,
      imager,
      reviewer,
      visuals,
    });
    result.cutCheck = await run.call(checkCuts, {
      sections: result.piece.script.sections,
      cut: cutNames(found, cutIds),
    });
  } else {
    result.episodes = await run.all(
      found.map((f, i) =>
        writeExplainer(
          run.scope(`episode-${i + 1}`),
          {
            ...f,
            outline: {
              series: outline.title,
              throughLine: assessment.throughLine,
              chapters: outline.chapters.filter((c) => c.subtopics.includes(f.brief.topic)),
              callbacks: outline.callbacks,
            },
          },
          { moves, medium: brief.medium ?? 'motion-graphics', style: brief.style, imager, reviewer, visuals },
        ),
      ),
    );
  }
  return result;
}

/**
 * The series process as stages, for diagrams and documentation; see EXPLAINER_STAGES for the fields. `each` says a
 * stage runs once per subtopic or chapter, all of them at the same time.
 */
export const SERIES_STAGES = Object.freeze([
  {
    id: 'plan',
    phase: 'discover',
    title: 'Turn objectives into subtopics',
    parallel: false,
    ops: ['plan-subtopics', 'cover-objectives'],
    when: { 'plan-subtopics': 'only for learning objectives', 'cover-objectives': 'only for learning objectives' },
  },
  {
    id: 'discover',
    phase: 'research',
    title: 'Research every subtopic as a full video',
    parallel: false,
    each: 'subtopic',
    ops: ['explore-wide', 'wander', 'propose-seeds', 'choose-seed', 'investigate', 'find-parallels', 'find-meaning'],
  },
  {
    id: 'filter',
    phase: 'shape',
    title: 'Keep what fits, cut the rest',
    parallel: false,
    ops: ['cohesion-map', 'assess-cohesion'],
  },
  { id: 'stitch', phase: 'shape', title: 'Order the chapters', parallel: false, ops: ['stitch', 'check-stitch'] },
  {
    id: 'hooks',
    phase: 'write',
    title: 'Plan the hook and the chapter refills',
    parallel: false,
    ops: ['research-hooks', 'engineer-hooks'],
  },
  {
    id: 'chapters',
    phase: 'write',
    title: 'Write every chapter',
    parallel: false,
    each: 'chapter',
    ops: ['develop-telling', 'draft-script', 'review-science', 'review-story', 'revise', 'polish-voice'],
    when: { 'polish-voice': 'only when the voice gate finds problems' },
  },
  {
    id: 'join',
    phase: 'refine',
    title: 'Bridge, measure and name it',
    parallel: false,
    ops: ['bridge-chapters', 'script-measures', 'name-it', 'check-cuts'],
  },
  {
    id: 'attention',
    phase: 'refine',
    title: 'Keep the viewer watching, chapter by chapter',
    parallel: false,
    ops: ['audit-attention-part', 'attention-measures', 'revise-for-attention'],
    when: { 'revise-for-attention': 'only when the attention gate finds problems; kept only if it leaves fewer' },
  },
  ...VISUAL_STAGES,
]);
