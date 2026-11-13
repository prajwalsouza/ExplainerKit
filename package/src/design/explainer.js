// The narrated explainer: a broad topic in, a reviewed script out. The process is an ordinary async function over
// a design run, so it reads as the flowchart it implements:
//
//   brief → explore wide (one search: surprises · stories · unusual sources) · everyday  ┐ all in parallel
//         → lateral pass (reframe · provoke · random entry · distant links · frames · wander ×2)  ┘
//         → propose seeds → rank (measure) → choose seed
//         → people · investigate · parallel stories (in parallel) → work backward → meaning · central image
//         → develop tellings (mystery · chain · descent · experience, in parallel; each beat has a register and depth)
//         → check structure and flow (measure) → choose telling
//         → draft → measure → review (science · learning · story, in parallel) → revise → measure
//         → [voice gate: too many hedges, flat rhythm or instructions → polish voice → measure]
//         → name it
//
// The title is chosen last, after the script exists.
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { list, oneOf, record, string } from './schema.js';
import { checkTelling, philosophyJargon, scriptStats, shortRuns } from './measures.js';
import { CAVEAT_RULES, VOICE_EXAMPLES, VOICE_RULES, section, tellingBeat } from './shared.js';
import { exploreEveryday, exploreWide, findParallels, findPeople, investigate } from './explore.js';
import { DEPTHS, REGISTERS, flowStats } from './flow.js';
import { findImage, lateralPass, reframeLoop } from './lateral.js';
import { consultPhilosophy } from './philosophy.js';
import { auditScriptInsight, engineerInsight, insightProblems, reviseForInsight } from './insight.js';
import { auditForAudience, audienceProblems, buildAudience, targetPersona } from './audience.js';
import { applyEdits, checkTerms, rewritePlain } from './terms.js';
import { auditScriptAttention, keepAttention, planAttention } from './attention.js';
import { VISUAL_STAGES, designVisuals } from './production.js';
import {
  chooseSeed,
  findMeaning,
  nameIt,
  polishVoice,
  proposeSeeds,
  rankSeeds,
  reviewLearning,
  reviewScience,
  reviewStory,
  workBackward,
} from './craft.js';

export const SHAPES = Object.freeze({
  mystery:
    'A mystery with a reveal. Open with a question the audience cannot answer yet. Plant the pieces of the answer earlier, each as its own interesting moment, disguised so they do not give the ending away. At the reveal, several earlier moments should click into place together.',
  chain:
    'A chain of parallel stories. Open on something everyone agrees about, then pull the rug with the deep question. Step sideways through the parallels (near, then middle, then far), each one answering a little and handing on a bigger question, with a dose of play between them. Return to the opening at the end with a question larger and more human than the first.',
  descent:
    'A descent and return. Pose one concrete question with real numbers. Build the explanation piece by piece, each piece a small surprise or a playful aside, down to the formal level (a formula, a rule, a precise statement), then decode that formal statement so every symbol means something seen earlier. Climb back up: where else the idea appears, and what it says about how we know things.',
  experience:
    'An experience first. Begin with something the audience can see, try or feel right now. Change one condition at a time and let them notice the difference before you explain it. Then use the explanation on a new case they did not expect.',
});

export const developTelling = defineOperation({
  name: 'develop-telling',
  role: 'You are a writer who structures science videos the way a good novelist structures a plot.',
  purpose: 'Design one telling of the chosen story, in the shape given in the input, as an ordered list of beats.',
  method: [
    'Read the shape. Commit to it fully; another writer is trying the other shapes.',
    'Open with a hook the viewer feels personally within the first two beats.',
    "Lay out 7 to 12 beats. Each beat has one purpose, its content, and the world it lives in. Change worlds often: a story from history, then the viewer's own kitchen, then a lab.",
    'Build at least two beats around people from the research, by their id, and at least two around parallel stories, by their id. Use the central image as the backbone, and return to it.',
    `Give every beat a register (${REGISTERS.join(', ')}) and a depth (${DEPTHS.join(', ')}). Change register often: never more than three beats in a row in the same one (a hard construction may need three). Go down to at least the mechanism level. Put one reflect beat before the midpoint, where the story first widens to a human question, and end on reflect.`,
    'Study the moves from other creators in the input, if any, and use the ones that suit this shape. Learn the move, never the content.',
    'Follow the philosophy verdict in the input. If it is central, the philosophical question can be the hook and the spine of the telling, with the science as the way in. If it is light, plan one earned leap beat that climbs the depth ladder to the chosen debate, carried by its thought experiment or a named thinker and connected back to the mechanism. If it is none, do not force a leap; end on what the insight changes about the world.',
    'Use the idea ids from the backward plan in gives and needs. A beat may only need an idea that an earlier beat gives or that the audience already knows.',
    'Plant memorable cues (a number, an image, a phrase) that the reveal recalls. Open a question early and close it late.',
    'Name the reveal beat. After it, widen to the meaning and end on the planned ending.',
  ],
  rules: [
    'gives, needs, plants, recalls, opens and closes contain ids only; every recall must match a plant from an earlier beat, and every opened question must be closed.',
  ],
  output: record({
    shape: oneOf(Object.keys(SHAPES)),
    logline: string({ max: 300 }),
    beats: list(tellingBeat, { min: 5, max: 14 }),
    reveal: string({ max: 60 }),
  }),
});

export const checkTellings = defineOperation({
  name: 'check-tellings',
  kind: 'measure',
  purpose:
    "Check each telling's structure: needs met in order, cues planted before recalled, loops closed, people present, and the size of the reveal.",
  compute({ tellings, known, invites = 'light' }) {
    return {
      checks: tellings.map((t) => {
        const result = checkTelling(t, { known });
        const people = t.beats.filter((b) => b.person).length;
        const flow = flowStats.compute({ beats: t.beats.map((b) => ({ ...b, distance: b.parallel ? 2 : 0 })) });
        if (people === 0) result.errors.push('No beat is built around a person.');
        if (flow.longestRun > 3) result.errors.push(`${flow.longestRun} beats in a row share one register.`);
        if (DEPTHS.indexOf(flow.deepest) < DEPTHS.indexOf('mechanism'))
          result.errors.push(`The telling never goes deeper than ${flow.deepest}.`);
        if (!flow.endsOn.includes('reflect')) result.errors.push('The telling does not end on reflection.');
        if (flow.parallels < 2)
          result.errors.push(`Only ${flow.parallels} beat tells a parallel story; use at least two.`);
        // How much reflection a telling needs follows the philosophy verdict: a central question shows up early.
        const half = Math.ceil(t.beats.length / 2);
        if (invites === 'central' && !t.beats.slice(0, half).some((b) => b.register === 'reflect'))
          result.errors.push('The philosophy verdict is central, but no reflect beat comes before the midpoint.');
        if (invites === 'light' && !t.beats.slice(1, -1).some((b) => b.register === 'reflect'))
          result.errors.push('The philosophy verdict invites a leap, but no reflect beat comes before the ending.');
        return { shape: t.shape, ...result, measures: { ...result.measures, peopleBeats: people, ...flow } };
      }),
    };
  },
});

export const chooseTelling = defineOperation({
  name: 'choose-telling',
  role: 'You are the editor choosing which structure to produce.',
  purpose:
    'Compare the tellings with their structural checks and choose one to write, borrowing from the others where they are stronger.',
  method: [
    'Read each telling as a viewer. Where would you get bored? Where would you lean in? Where would you tell a friend?',
    'Read the structural checks. A telling with errors is not ruled out, but its errors must be fixable.',
    'Weigh the cascade in the checks: how many earlier beats the reveal recalls. Prefer the telling where more of the piece clicks into place at once, unless it gives the ending away early.',
    'Choose one. You may name beats to borrow from another telling.',
    'List the changes the writer must make before drafting.',
  ],
  output: record({
    chosen: oneOf(Object.keys(SHAPES)),
    borrow: list(string({ max: 300 }), { max: 4 }),
    changes: list(string({ max: 300 }), { max: 8 }),
    why: string({ max: 800 }),
  }),
});

const HOST =
  'You are the host and writer of a science channel, and you are a character in it: curious, a little stubborn, quick to admit when something surprised you or when you were wrong. You talk to one friend, not an audience. You are warm, precise and playful, and genuinely amazed by the right things. You never sound like a textbook, a lab manual or an advert.';

export const draftScript = defineOperation({
  name: 'draft-script',
  role: HOST,
  purpose: 'Write the narration for the chosen telling, beat by beat, as it will be spoken.',
  method: [
    "Follow the telling and the editor's changes. Each beat becomes one section.",
    'Write for the ear. Ask the viewer real questions and give them a moment before answering.',
    'Make the people real: what they wanted, what went wrong, one remembered detail each.',
    'Show the mechanism through the central image; do not just assert it. Use real numbers from the research.',
    'Tell the parallel stories as stories, each with its person or image, and make each hand its question to the next. Follow the register and depth of each beat: when a beat is play, be playful; when it is formal, be precise and then decode it; when it is reflect, slow down and wonder aloud.',
    'Plant cues so they are memorable without announcing that they matter. At the reveal, return to them by name.',
    'After the reveal, widen to the meaning, then end on the planned last image or line.',
    'If the telling has a leap beat, make it land the way you would for a child: an everyday question and a real-world analogy, told slowly, with a sense of wonder. Never say the name of a debate, a school of thought or a technical term (no "qualia", "epistemology", "relationalism"). A thought experiment can be told as a little story in plain words; credit the thinker in the notes. Let the deepest question stay open if science cannot close it.',
    'If the telling has cues, plant each one in its beat, in its disguise and with its exact wording, and return to it by name at the reveal.',
    'Each section gets a short visual note (what we see) and notes (caveats and details for the makers, never read aloud).',
    'If an attention plan is given, open with its hook inside the first twenty spoken seconds and keep caveats out of the first minute. Start each later section with its refill (a new question, image, person or stake, not a recap), give each new idea its reason before its name, and pay each promise where the plan says. If the chapter has a hook or a refill, open the chapter with it, and if it has a promise, make that the question the piece carries.',
    'Treat the length in the brief as a minimum, not a limit (about 150 spoken words a minute). Give every beat the room it needs; it is easier to cut later than to add. Mark sections that could be removed without breaking the through-line as optional.',
  ],
  examples: VOICE_EXAMPLES,
  rules: [...VOICE_RULES, ...CAVEAT_RULES, 'Do not end with a summary list.'],
  output: record({ sections: list(section, { min: 5, max: 16 }) }),
});

export const scriptMeasures = defineOperation({
  name: 'script-measures',
  kind: 'measure',
  purpose: 'Count words, rhythm, questions, address, numbers, hedges, instructions and stock phrases in the narration.',
  compute({ sections }) {
    const text = sections.map((s) => s.narration).join('\n\n');
    return { ...scriptStats(text), jargon: philosophyJargon(text) };
  },
});

export const revise = defineOperation({
  name: 'revise',
  role: `${HOST} You are now revising with notes from three reviewers.`,
  purpose: "Revise the script using the reviewers' findings, keeping what works.",
  method: [
    'Fix every must-fix finding. Fix should-fix findings unless they fight the story; say which you declined and why.',
    'Put each fix where the reviewer placed it: narration fixes in the narration, notes fixes in the notes. Do not read production caveats aloud.',
    'Keep the strengths the reviewers named.',
    'Length is not a constraint: keep everything that works, and mark sections that could be removed later as optional rather than cutting them.',
  ],
  rules: [...VOICE_RULES, ...CAVEAT_RULES],
  output: record({ sections: list(section, { min: 5, max: 16 }), declined: list(string({ max: 300 }), { max: 8 }) }),
});

/** The voice gate: which measures say the script needs a voice pass. Editorial thresholds, from the reference scripts. */
export const VOICE_GATE = Object.freeze({
  maxHedgesPer100Words: 2.2,
  minSentenceSpread: 7,
  maxInstructionShare: 0.08,
  minNarratorPer100Words: 1,
  maxShortRuns: 2,
});
/** What the measures say is wrong with the voice. `runs` are the choppy passages found by shortRuns. */
export function voiceProblems(measures, gate = VOICE_GATE, runs = []) {
  const problems = [];
  if (measures.hedgesPer100Words > gate.maxHedgesPer100Words)
    problems.push(
      `Spoken hedges are ${measures.hedgesPer100Words} per 100 words; aim for at most ${gate.maxHedgesPer100Words}.`,
    );
  if (measures.sentenceSpread < gate.minSentenceSpread)
    problems.push(
      `Sentence lengths barely vary (spread ${measures.sentenceSpread}); aim for at least ${gate.minSentenceSpread}. Some sentences should run past 25 words.`,
    );
  if (measures.sentences && measures.instructionSentences / measures.sentences > gate.maxInstructionShare)
    problems.push(`${measures.instructionSentences} sentences open as instructions to the viewer.`);
  if (measures.narratorPer100Words < gate.minNarratorPer100Words)
    problems.push(
      `The narrator is almost absent (${measures.narratorPer100Words} uses of I or we per 100 words); the host should react, confess and have opinions.`,
    );
  if (runs.length > gate.maxShortRuns)
    problems.push(`${runs.length} passages are runs of short sentences; they are listed in choppyPassages.`);
  if (measures.stockPhrases?.length) problems.push(`Stock phrases: ${measures.stockPhrases.join(', ')}.`);
  if (Object.keys(measures.jargon ?? {}).length)
    problems.push(
      `Philosophical jargon is spoken aloud: ${Object.keys(measures.jargon).join(', ')}. Say it as an everyday question or analogy instead, and credit thinkers in the notes.`,
    );
  if (measures.placeholders?.length)
    problems.push(
      `The narration leaves placeholders instead of results: ${measures.placeholders.join(' | ')}. State the published result instead.`,
    );
  return problems;
}

export const DEFAULT_AUDIENCE = 'curious adults with no specialist knowledge';

function briefOf(brief) {
  assert(brief && typeof brief.topic === 'string' && brief.topic.trim(), 'INVALID_DATA', 'The brief needs a topic.');
  return {
    topic: brief.topic,
    audience: brief.audience ?? DEFAULT_AUDIENCE,
    goals: brief.goals ?? 'curiosity and real understanding',
    minutes: brief.minutes ?? 10,
    ...(brief.objectives ? { objectives: brief.objectives } : {}),
  };
}

/**
 * The discovery stage: explore, think laterally, choose a story, and research it (people, mechanism, parallels,
 * backward plan, meaning, central image). Everything a writer needs, before any structure is chosen.
 */
export async function discoverExplainer(run, brief, { seed = 1, depthRounds = 2 } = {}) {
  const b = briefOf(brief);
  const about = { brief: b };
  const [audience, wide, everyday, lateral, topicDepth] = await run.all([
    run.call(buildAudience, about),
    run.call(exploreWide, about),
    run.call(exploreEveryday, about),
    lateralPass(run, b, { seed }),
    reframeLoop(run.scope('depth'), { brief: b, focus: b.topic }, { rounds: depthRounds, seed }),
  ]);
  const exploration = { ...wide, everyday: everyday.items, ...lateral, depth: topicDepth.ladder };

  const { seeds } = await run.call(proposeSeeds, { brief: b, exploration });
  const { shortlist } = await run.call(rankSeeds, { seeds });
  const choice = await run.call(chooseSeed, { brief: b, shortlist });
  const chosen = shortlist.find((s) => s.id === choice.chosen) ?? shortlist[0];
  const used = new Set(chosen.uses ?? []);
  const material = Object.fromEntries(
    Object.entries(exploration)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, items]) => [k, items.filter((i) => used.has(i.id))]),
  );
  const story = { seed: chosen, editor: { why: choice.why, protect: choice.protect } };

  const [people, research, parallels, storyDepth] = await run.all([
    run.call(findPeople, { brief: b, story, material }),
    run.call(investigate, { brief: b, story, material }),
    run.call(findParallels, { brief: b, story, wanderings: exploration.wanderings }),
    reframeLoop(
      run.scope('deepen'),
      { brief: b, focus: `${chosen.seed} ${chosen.insight}` },
      { rounds: depthRounds, seed: seed + 1 },
    ),
  ]);
  const [plan, philosophy] = await run.all([
    run.call(workBackward, { brief: b, story, research }),
    consultPhilosophy(run, { brief: b, story, depth: storyDepth.ladder }),
  ]);
  const [meaning, image] = await run.all([
    run.call(findMeaning, { brief: b, story, plan, depth: storyDepth.ladder, philosophy: philosophy.verdict }),
    run.call(findImage, { brief: b, story, mechanism: research.mechanism }),
  ]);
  return {
    brief: b,
    audience: audience.personas,
    exploration,
    seeds,
    seed: chosen,
    depth: { topic: topicDepth, story: storyDepth },
    story,
    people: people.people,
    parallels,
    research,
    plan,
    philosophy,
    meaning,
    image,
  };
}

/**
 * The writing stage: tellings in every shape, structure and flow checks, the draft, three reviews, revision and
 * the voice gate, then the title. `found` is what discovery returned (or what a series stitched together).
 */
export async function writeExplainer(
  run,
  found,
  {
    moves = null,
    insightPasses = 2,
    medium = 'motion-graphics',
    imager = null,
    reviewer = null,
    style = undefined,
    visuals: withVisuals = true,
  } = {},
) {
  const { brief: b, story, research, people, parallels, plan, meaning, image } = found;
  const known = plan.ideas.filter((i) => i.known).map((i) => i.id);
  const context = {
    brief: b,
    story,
    research,
    people,
    plan,
    meaning,
    image: { chosen: image.chosen, returnAtEnd: image.returnAtEnd },
    parallels,
    ...(found.depth ? { depth: found.depth.story.ladder } : {}),
    ...(found.philosophy ? { philosophy: { ...found.philosophy.verdict, debate: found.philosophy.debate } } : {}),
    ...(found.outline ? { outline: found.outline } : {}),
    ...(found.cut ? { cutDoNotUse: found.cut } : {}),
    ...(moves ? { movesFromCreators: moves } : {}),
  };
  const tellings = await run.all(
    Object.entries(SHAPES).map(([shape, description]) =>
      run.call(developTelling, { ...context, shape: `${shape}: ${description}` }, { label: `telling-${shape}` }),
    ),
  );
  const invites = found.philosophy?.verdict.invites ?? 'light';
  const { checks } = await run.call(checkTellings, { tellings, known, invites });
  const picked = await run.call(chooseTelling, { brief: b, story, tellings, checks });
  const chosenTelling = tellings.find((t) => t.shape === picked.chosen) ?? tellings[0];

  // Insight engineering: rework the chosen telling backward from its reveal. Keep the original when the engineered
  // version breaks more of the structure than it fixes.
  const personas = found.audience ?? null;
  const engineered = await engineerInsight(
    run,
    { brief: b, story, research, plan, meaning, editorChanges: picked, ...(personas ? { audience: personas } : {}) },
    chosenTelling,
    { known },
  );
  // Keep the engineered telling when it breaks no more of the structure and its reveal recalls at least as much.
  const original = checks.find((c) => c.shape === chosenTelling.shape);
  const better =
    engineered.check.errors.length <= (original?.errors.length ?? 0) &&
    engineered.check.cascade >= (original?.measures.cascade ?? 0);
  const telling = better ? { ...engineered.telling, shape: chosenTelling.shape } : chosenTelling;

  // Plan attention before drafting: research hooks (with web search), then the opening hook and its promise, a refill
  // for every later beat, a reason before every new idea and a deposit before every heavy stretch.
  const target = personas ? targetPersona(personas) : null;
  const attention = await planAttention(run, {
    brief: b,
    persona: target,
    sections: telling.beats.map((x) => ({ beat: x.id, narration: `${x.purpose} ${x.content}` })),
  });
  const draft = await run.call(draftScript, {
    ...context,
    telling,
    editorChanges: picked,
    attentionPlan: attention.plan,
  });
  const draftMeasures = await run.call(scriptMeasures, draft, { label: 'draft-measures' });

  const review = { brief: b, script: draft.sections, measures: draftMeasures };
  const [science, learning, storyNotes] = await run.all([
    run.call(reviewScience, { ...review, research }),
    run.call(reviewLearning, review),
    run.call(reviewStory, { ...review, telling, meaning, philosophy: context.philosophy ?? null }),
  ]);

  let script = await run.call(revise, {
    brief: b,
    script: draft.sections,
    research,
    reviews: { science, learning, story: storyNotes },
  });
  let measures = await run.call(scriptMeasures, script, { label: 'revised-measures' });
  const choppy = shortRuns(script.sections.map((x) => x.narration).join('\n\n'));
  const problems = voiceProblems(measures, VOICE_GATE, choppy);
  if (problems.length) {
    script = {
      ...script,
      ...(await run.call(polishVoice, {
        brief: b,
        sections: script.sections,
        measures,
        problems,
        choppyPassages: choppy.map((r) => r.join(' ')),
      })),
    };
    measures = await run.call(scriptMeasures, script, { label: 'final-measures' });
  }
  // Audit clarity and insight. The insight audit runs once per persona when there is an audience, each reading
  // honestly as that viewer and marking where they got lost; the terms check lists every technical word and coined
  // label and finds the ones never pictured, returning bare or carrying the eureka. The gate reads the target's audit,
  // every persona the eureka misses and every term problem. When it fails, the script is restructured and rewritten
  // in plainer words, up to `passes` times, and each revision is kept only if it leaves fewer problems.
  const cues = telling.cues ?? [];
  const assess = async (r, sections) => {
    let insight,
      audience = null;
    if (!personas) insight = await auditScriptInsight(r, { brief: b, sections, cues });
    else {
      audience = await auditForAudience(r, { brief: b, sections, cues, personas });
      const reading = audience.readings.find((x) => x.persona.id === target.id) ?? audience.readings[0];
      insight = { audit: reading.audit, measures: reading.measures, persona: target.id };
    }
    const main = (insight.audit.eurekas ?? []).find((e) => e.kind === 'main');
    const terms = await checkTerms(r, {
      brief: b,
      sections,
      persona: target,
      eureka: main ? { section: main.section, line: main.line } : null,
    });
    return { insight, audience, terms };
  };
  const problemsOf = ({ insight: i, audience: a, terms: t }) => [
    ...insightProblems(i.measures, cues),
    ...(a ? audienceProblems(a.summary).filter((p) => !p.includes(', the target')) : []),
    ...t.measures.problems,
  ];
  let assessed = await assess(run, script.sections);
  const passes = [];
  // First the cheap, targeted fix: rewrite only the lines a viewer got lost in and the lines with unexplained terms,
  // as exact replacements applied in code. Restructuring comes after, and only for what remains.
  const unclear = ({ insight: i, terms: t }) => [
    ...(i.measures.lost ?? []).map((l) => `Section ${l.section}: the viewer got lost at "${l.quote}" (${l.why}).`),
    ...t.measures.problems,
  ];
  if (unclear(assessed).length) {
    const pass = run.scope('plain-pass');
    const issues = problemsOf(assessed);
    const { edits } = await pass.call(rewritePlain, {
      brief: b,
      script: script.sections.map((s, i) => ({ section: i + 1, narration: s.narration })),
      problems: unclear(assessed),
    });
    const { sections, applied, skipped } = applyEdits(script.sections, edits);
    const after = await assess(pass, sections);
    const remaining = problemsOf(after);
    const kept = remaining.length < issues.length;
    passes.push({
      kind: 'plain',
      problems: issues,
      changes: applied.map((e) => `Section ${e.section}: ${e.why}`),
      skipped,
      remaining,
      kept,
    });
    if (kept) {
      script = { ...script, sections };
      assessed = after;
      measures = await pass.call(scriptMeasures, script, { label: 'measures' });
    }
  }
  for (let round = 1; round <= insightPasses; round++) {
    const issues = problemsOf(assessed);
    if (!issues.length) break;
    const pass = run.scope(round === 1 ? 'insight-pass' : `insight-pass-${round}`);
    const revised = await pass.call(reviseForInsight, {
      brief: b,
      sections: script.sections,
      audit: assessed.insight.audit,
      measures: assessed.insight.measures,
      terms: assessed.terms.measures.terms.filter((x) => x.problems.length),
      problems: issues,
      cues,
    });
    const after = await assess(pass, revised.sections);
    const remaining = problemsOf(after);
    const kept = remaining.length < issues.length;
    passes.push({ kind: 'restructure', problems: issues, changes: revised.changes, remaining, kept });
    if (!kept) break;
    script = { ...script, sections: revised.sections };
    assessed = after;
    measures = await pass.call(scriptMeasures, script, { label: 'measures' });
  }
  // Keep attention: audit the finished script as a first-time viewer and keep the patience ledger. When the gate finds
  // problems, one pass of exact line edits runs, never touching the main eureka line or a planted cue, and is kept only
  // when it leaves fewer attention problems.
  const eureka = (assessed.insight.audit.eurekas ?? []).find((e) => e.kind === 'main');
  const held = await keepAttention(run, {
    brief: b,
    sections: script.sections,
    persona: target,
    research: attention.research,
    protect: [eureka?.line, ...cues.map((c) => c.cue)],
  });
  if (held.pass?.kept) {
    script = { ...script, sections: held.sections };
    measures = await run.call(scriptMeasures, script, { label: 'attention-script-measures' });
  }
  // Design the visuals: how others showed the subject, what each idea must show, the storyboard, the visual
  // structure, the look, the feeling, the motion, the sound when the medium has it and the multimedia checks. The
  // narration edits the visual work proposes are kept only when the attention audit finds no more problems than it
  // did before; the protected lines are never touched.
  const visuals = withVisuals
    ? await designVisuals(run, {
        brief: b,
        sections: script.sections,
        medium,
        persona: target,
        protect: [eureka?.line, ...cues.map((c) => c.cue)].filter(Boolean),
        terms: assessed.terms.measures.terms.map((x) => x.term),
        attention: held.measures,
        recheck: async (r, sections) =>
          (await auditScriptAttention(r, { brief: b, sections, persona: target, research: attention.research }))
            .problems,
        baseline: held.problems.length,
        imager,
        reviewer,
        style,
      })
    : null;
  if (visuals && visuals.sections !== script.sections) {
    script = { ...script, sections: visuals.sections };
    measures = await run.call(scriptMeasures, script, { label: 'visual-script-measures' });
  }
  const title = await run.call(nameIt, { brief: b, story, script: script.sections });
  return {
    visuals,
    attention: {
      research: attention.research,
      plan: attention.plan,
      audit: held.audit,
      measures: held.measures,
      problems: held.problems,
      pass: held.pass,
    },
    tellings,
    checks,
    cascade: engineered,
    telling,
    insight: assessed.insight,
    viewers: assessed.audience,
    terms: assessed.terms,
    insightPass: passes.find((p) => p.kind === 'restructure') ?? null,
    insightPasses: passes,
    draft,
    draftMeasures,
    reviews: { science, learning, story: storyNotes },
    voiceGate: problems,
    script,
    measures,
    title,
  };
}

/**
 * Run the explainer process: discovery, then writing. `brief` is {topic, audience, goals, minutes}; `seed` fixes
 * the lateral stimuli; `moves` are optional writing techniques passed to the telling and drafting steps as examples.
 */
export async function designExplainer(
  run,
  brief,
  { seed = 1, moves = null, imager = null, reviewer = null, visuals = true } = {},
) {
  const found = await discoverExplainer(run, brief, { seed });
  const written = await writeExplainer(run, found, {
    moves,
    medium: brief.medium ?? 'motion-graphics',
    style: brief.style,
    imager,
    reviewer,
    visuals,
  });
  return { form: 'explainer', ...found, ...written };
}

/**
 * The explainer process as stages, in order, for diagrams and documentation; the process itself is designExplainer.
 * A stage runs `first` in order, then `ops` (in parallel when `parallel` is true), then `then` in order. `variants`
 * names the parallel copies of one operation; `when` marks a conditional step. `phase` groups stages for display:
 * discover, research, shape, write or refine.
 */
export const EXPLAINER_STAGES = Object.freeze([
  {
    id: 'audience',
    phase: 'discover',
    title: 'Describe the audience at each level of mastery',
    parallel: false,
    ops: ['build-audience'],
  },
  {
    id: 'depth',
    phase: 'discover',
    title: 'Reframe the topic in a loop, alongside exploring',
    parallel: false,
    loop: 2,
    ops: ['pick-lenses', 'deepen-frame', 'fresh-frames', 'read-around', 'choose-depth'],
  },
  {
    id: 'explore',
    phase: 'discover',
    title: 'Explore and think laterally',
    first: ['pick-stimuli'],
    parallel: true,
    ops: [
      'explore-wide',
      'explore-everyday',
      'reframe',
      'provoke',
      'random-entry',
      'connect-distant',
      'create-frames',
      'wander',
    ],
    variants: { wander: ['a', 'b'] },
    then: ['keep-wanderings'],
  },
  {
    id: 'choose',
    phase: 'discover',
    title: 'Choose the story',
    parallel: false,
    ops: ['propose-seeds', 'rank-seeds', 'choose-seed'],
  },
  {
    id: 'research',
    phase: 'research',
    title: 'Research it',
    parallel: true,
    ops: ['find-people', 'investigate', 'find-parallels'],
  },
  {
    id: 'deepen',
    phase: 'research',
    title: 'Deepen the story in a loop, alongside research',
    parallel: false,
    loop: 2,
    ops: ['pick-lenses', 'deepen-frame', 'fresh-frames', 'read-around', 'choose-depth'],
  },
  {
    id: 'philosophy',
    phase: 'research',
    title: 'Ask what philosophy it touches',
    parallel: false,
    ops: ['map-debates', 'weigh-leap', 'check-philosophy'],
  },
  {
    id: 'plan',
    phase: 'research',
    title: 'Plan backward from the insight',
    first: ['work-backward'],
    parallel: true,
    ops: ['find-meaning', 'find-image'],
  },
  {
    id: 'tell',
    phase: 'write',
    title: 'Try four tellings',
    parallel: true,
    ops: ['develop-telling'],
    variants: { 'develop-telling': Object.keys(SHAPES) },
    then: ['check-tellings', 'choose-telling'],
  },
  {
    id: 'cascade',
    phase: 'write',
    title: 'Engineer the insight cascade',
    parallel: false,
    ops: ['engineer-cascade', 'check-cascade'],
  },
  {
    id: 'hooks',
    phase: 'write',
    title: 'Plan the hook and the refills',
    parallel: false,
    ops: ['research-hooks', 'engineer-hooks'],
  },
  {
    id: 'draft',
    phase: 'write',
    title: 'Draft and measure',
    parallel: false,
    ops: ['draft-script', 'script-measures'],
  },
  {
    id: 'review',
    phase: 'refine',
    title: 'Review three ways',
    parallel: true,
    ops: ['review-science', 'review-learning', 'review-story'],
  },
  {
    id: 'revise',
    phase: 'refine',
    title: 'Revise and check the voice',
    parallel: false,
    ops: ['revise', 'script-measures', 'polish-voice'],
    when: { 'polish-voice': 'only when the voice gate finds problems' },
  },
  {
    id: 'insight',
    phase: 'refine',
    title: 'Audit clarity and insight as each viewer',
    parallel: false,
    ops: [
      'audit-insight',
      'insight-measures',
      'audience-insight',
      'find-terms',
      'term-measures',
      'rewrite-plain',
      'revise-for-insight',
    ],
    loop: 2,
    when: {
      'rewrite-plain': 'only when a viewer got lost or a term is unexplained; replaces just those lines',
      'revise-for-insight': 'only when the gate still finds problems; the script is then audited again, up to twice',
    },
  },
  {
    id: 'attention',
    phase: 'refine',
    title: 'Keep the viewer watching',
    parallel: false,
    ops: ['audit-attention', 'audit-attention-part', 'attention-measures', 'revise-for-attention'],
    when: {
      'audit-attention-part':
        'instead of audit-attention when the script is longer than 4000 words; one part per chapter',
      'revise-for-attention':
        'only when the attention gate finds problems; edits never touch the eureka or a cue, and the script is audited again',
    },
  },
  ...VISUAL_STAGES,
  { id: 'name', phase: 'refine', title: 'Name it', parallel: false, ops: ['name-it'] },
]);
