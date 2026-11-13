// References: what practitioners and researchers say about each craft, organised by the design module that uses it.
// An entry describes one source in our own words (never a copied transcript or text), links to it, and says what
// move it teaches. Modules give their entries to the model as examples, and their research steps search for more.
// Principles are the literature translated into rules a module follows, each with the source it comes from and how
// strong the evidence is: measured (experiments or meta-analyses), observed (systematic study of practice) or
// practice (what practitioners say they do).
import { assert } from '../core/validate.js';

/** The design modules that own references and principles. */
export const REFERENCE_MODULES = Object.freeze([
  'attention',
  'shots',
  'multimedia',
  'cinematography',
  'look',
  'emotion',
  'motion',
  'sound',
  'production',
]);
export const REFERENCE_KINDS = Object.freeze(['opening', 'process', 'study', 'shot', 'palette', 'book']);
export const EVIDENCE = Object.freeze(['measured', 'observed', 'practice']);

/** Check and freeze one reference: module, kind, evidence, creator, title, an https url and the move it teaches. */
export function defineReference(entry) {
  assert(entry && typeof entry === 'object', 'INVALID_DATA', 'A reference needs a description object.');
  const { module, kind, evidence, creator, title, url, move } = entry;
  assert(REFERENCE_MODULES.includes(module), 'INVALID_DATA', `Unknown reference module ${module}.`);
  assert(REFERENCE_KINDS.includes(kind), 'INVALID_DATA', `Unknown reference kind ${kind}.`);
  assert(EVIDENCE.includes(evidence), 'INVALID_DATA', `Unknown evidence ${evidence}.`);
  for (const [name, value, max] of [
    ['creator', creator, 120],
    ['title', title, 200],
    ['move', move, 900],
  ])
    assert(
      typeof value === 'string' && value.length > 0 && value.length <= max,
      'INVALID_DATA',
      `A reference needs a ${name}.`,
    );
  assert(
    typeof url === 'string' && /^https:\/\/[^\s]+$/.test(url) && url.length <= 400,
    'INVALID_DATA',
    'A reference needs an https url.',
  );
  return Object.freeze({ ...entry });
}

/** Check and freeze one principle: an id, the rule, its source and how strong the evidence is. */
export function definePrinciple(entry) {
  assert(entry && typeof entry === 'object', 'INVALID_DATA', 'A principle needs a description object.');
  const { id, rule, source, evidence } = entry;
  assert(typeof id === 'string' && /^[a-z][a-z0-9-]{0,40}$/.test(id), 'INVALID_DATA', 'A principle needs a short id.');
  assert(
    typeof rule === 'string' && rule.length > 0 && rule.length <= 600,
    'INVALID_DATA',
    `${id}: a principle needs a rule.`,
  );
  assert(
    typeof source === 'string' && source.length > 0 && source.length <= 300,
    'INVALID_DATA',
    `${id}: a principle needs a source.`,
  );
  assert(EVIDENCE.includes(evidence), 'INVALID_DATA', `${id}: unknown evidence ${evidence}.`);
  return Object.freeze({ ...entry });
}

/** A frozen list of principles. */
export const principles = (list) => Object.freeze(list.map(definePrinciple));

/** The principles as prompt rules: each rule followed by its source and evidence. */
export const principleRules = (list) => list.map((p) => `${p.rule} (${p.source}; ${p.evidence})`);

const ENTRIES = [
  // Attention: openings of well-made videos, studied from their first ninety seconds of captions in October 2026.

  {
    module: 'attention',
    kind: 'opening',
    evidence: 'practice',
    creator: 'Vsauce',
    title: 'What Is The Speed of Dark?',
    url: 'https://www.youtube.com/watch?v=JTvcpdfGUtQ',
    flavour: 'puzzle',
    move: 'Answers the absurd title question almost at once (darkness leaves as fast as light arrives), then shows that answer is not the end: a shadow cast far enough can sweep across the Moon faster than light. The easy answer becomes the doorway to a stranger one within about twenty seconds.',
  },
  {
    module: 'attention',
    kind: 'opening',
    evidence: 'practice',
    creator: 'Vsauce',
    title: 'Is Your Red The Same as My Red?',
    url: 'https://www.youtube.com/watch?v=evQsOFQju08',
    flavour: 'broken-belief',
    move: 'Points at three colours everyone agrees on, then pulls the rug by saying colour exists only inside heads, and lands on a question viewers cannot settle even about themselves: how would anyone know your red is mine? Agreement first, then doubt, then a personal question.',
  },
  {
    module: 'attention',
    kind: 'opening',
    evidence: 'practice',
    creator: 'Vsauce',
    title: 'How Much Does a Shadow Weigh?',
    url: 'https://www.youtube.com/watch?v=Do1lm9IevYE',
    flavour: 'surprising-observation',
    move: 'Admits the question sounds silly, turns it into something measurable (light pushes on what it falls on), and delivers a concrete number within half a minute: a sunny city is measurably heavier. Concession, reframe, startling number.',
  },
  {
    module: 'attention',
    kind: 'opening',
    evidence: 'practice',
    creator: '3Blue1Brown',
    title: 'But what is a neural network?',
    url: 'https://www.youtube.com/watch?v=aircAruvnKk',
    flavour: 'tangible-problem',
    move: 'Shows one sloppy, tiny handwritten digit and points out that the viewer reads it instantly, then shows several more, then asks the viewer to write a program that does the same: the task goes from trivial to daunting in one sentence. It explicitly skips motivating with the importance of the field and lets the example do the work.',
  },
  {
    module: 'attention',
    kind: 'opening',
    evidence: 'practice',
    creator: '3Blue1Brown',
    title: 'The most unexpected answer to a counting puzzle',
    url: 'https://www.youtube.com/watch?v=HEfHFsfGXjs',
    flavour: 'puzzle',
    move: 'Promises in one line that the result feels too good to be true, sets up a simple game of two sliding blocks and a wall, counts the simplest case (three clacks), then plays the next case before explaining anything and promises the physics later. Even the idealising caveat is turned into a small joke that draws attention to the count.',
  },
  {
    module: 'attention',
    kind: 'opening',
    evidence: 'practice',
    creator: '3Blue1Brown',
    title: 'But what is the Fourier Transform? A visual introduction',
    url: 'https://www.youtube.com/watch?v=spUNpyF58BY',
    flavour: 'participation',
    move: 'Shows the finished animation the video will build to, then starts from a single musical note and asks the viewer to predict what two notes played together look like. Showing the destination first works here; its "let us dive in" is a stock phrase the gate would flag.',
  },
  {
    module: 'attention',
    kind: 'opening',
    evidence: 'practice',
    creator: 'Veritasium',
    title: 'The Riddle That Seems Impossible Even If You Know The Answer',
    url: 'https://www.youtube.com/watch?v=iSNsgj1OCLA',
    flavour: 'puzzle',
    move: 'Claims a riddle stays wrong-feeling even once solved, cuts to people visibly baffled by it, then sets up life-or-death stakes (all the prisoners go free or none do) and computes the obvious strategy, whose chance is vanishingly small. The viewer now wants the strategy that should not exist.',
  },
  {
    module: 'attention',
    kind: 'opening',
    evidence: 'practice',
    creator: 'Veritasium',
    title: 'This Skyscraper Was Days From Collapsing And No One Knew',
    url: 'https://www.youtube.com/watch?v=Q56PMJbCFXQ',
    flavour: 'person',
    move: 'Names one building, one year and one engineer who finds a fatal flaw, then gives the number (a moderate wind could topple it), the people at risk and a deadline (hurricane season weeks away). It poses his choice and two questions, then goes back to the start of the story, which the hook question now carries.',
  },
  {
    module: 'attention',
    kind: 'opening',
    evidence: 'practice',
    creator: 'fern',
    title: 'How Hackers Stole $1,000,000,000 From Banks',
    url: 'https://www.youtube.com/watch?v=WyQ7z8BMwwk',
    flavour: 'person',
    move: 'Opens on an exact date and street: two masked men at a bank machine that starts paying out cash while nobody touches it. Then it widens to the scale of the whole operation and foreshadows a mistake the gang will pay for. A small anomaly in an ordinary scene, then scale, then an open loop.',
  },
  {
    module: 'attention',
    kind: 'opening',
    evidence: 'practice',
    creator: 'fern',
    title: 'The Kid Who Hacked the Pentagon',
    url: 'https://www.youtube.com/watch?v=I1rzcZWTIjo',
    flavour: 'person',
    move: 'Describes a life-or-death system (the space station that keeps astronauts from overheating), says a hacker now controls its software, then reveals he is a fifteen-year-old in his bedroom. The contrast between the stakes and the person carries the jump back to his childhood.',
  },
  {
    module: 'attention',
    kind: 'opening',
    evidence: 'practice',
    creator: 'fern',
    title: 'The Taco Bell Art Heist',
    url: 'https://www.youtube.com/watch?v=jLJQ12OqjOo',
    flavour: 'surprising-observation',
    move: 'Starts from a headline that should not exist (art heists at a fast-food chain, with paintings resold for thousands), stacks three short questions, and frames the film as an investigation the viewer joins, with a warning that things are not as they seem.',
  },
  {
    module: 'attention',
    kind: 'opening',
    evidence: 'practice',
    creator: 'Steve Mould',
    title: 'A better description of entropy',
    url: 'https://www.youtube.com/watch?v=w2iTCm0xpDc',
    flavour: 'broken-belief',
    move: 'Opens with a playful gag about the set, names the definition the viewer probably holds (entropy as disorder) and says plainly that it is not a good one, promises a better one rooted in why the idea was invented, and brings out a physical engine that runs without fuel.',
  },
  // Production: how studios and creators describe their own process.
  {
    module: 'production',
    kind: 'process',
    evidence: 'practice',
    creator: 'Kurzgesagt',
    title: 'Our video process',
    url: 'https://kurzgesagt.org/youtube/',
    move: 'Research from books and primary sources with experts checking facts, then the script, then illustration and animation, then music and sound. Each video has a published source sheet. In a walkthrough of the same process they describe writing as the bottleneck, illustration drawn largely from scratch, and the team reviewing and revising every few days.',
  },
  {
    module: 'production',
    kind: 'process',
    evidence: 'practice',
    creator: 'Giant Ant',
    title: 'Interview on the studio process (Skwigly)',
    url: 'https://www.skwigly.co.uk/tako-faito-serving-success/',
    move: 'The team gathers reference pieces that share the mood they want before settling on a style, proposes camera moves in the storyboard and refines them during animation, and uses rough pre-visualisation before final production.',
  },
  {
    module: 'production',
    kind: 'process',
    evidence: 'practice',
    creator: '3Blue1Brown',
    title: 'Interview with Grant Sanderson (Smart Venture)',
    url: 'https://smartventure.substack.com/p/week-5-here-we-come',
    move: 'Scripting the narration, writing the animation code and editing happen together. The script is a loose guide that is adjusted after seeing the animation, so the picture is allowed to change the words.',
  },
  {
    module: 'production',
    kind: 'process',
    evidence: 'practice',
    creator: 'Vidico',
    title: 'Explainer video storyboard',
    url: 'https://vidico.com/explainer-video/explainer-video-storyboard/',
    move: 'A sixty to ninety second explainer usually maps to about ten to twenty storyboard frames, made after the script and before animation: far fewer pictures than sentences.',
  },
  {
    module: 'production',
    kind: 'book',
    evidence: 'practice',
    creator: 'Austin Shaw',
    title: 'Design for Motion (interview, Motionographer)',
    url: 'https://motionographer.com/?p=61754',
    move: 'Motion design work moves from style frames (a few finished-looking stills that fix the look) to design boards and storyboards (the sequence) to animation, so the look is agreed before anything moves.',
  },
  // Look: colour planned across a whole film.
  {
    module: 'look',
    kind: 'palette',
    evidence: 'practice',
    creator: 'Pixar (Ralph Eggleston)',
    title: 'Colour scripts, from Pixar: 20 Years of Animation',
    url: 'https://www.moma.org/audio/playlist/192/2581',
    move: 'A colour script is a strip of small paintings, one per scene, made after reading the whole script, that plans how colour and so emotion moves through the film before any scene is finished.',
  },
  {
    module: 'look',
    kind: 'book',
    evidence: 'practice',
    creator: 'Patti Bellantoni',
    title: "If It's Purple, Someone's Gonna Die",
    url: 'https://www.oreilly.com/library/view/if-its-purple/9780240806884/',
    move: 'Groups more than sixty films by the colour that dominates their key scenes and the feeling it carries, with cinematographers and production designers describing how colour communicates what is not said.',
  },
  // Cinematography: visual structure.
  {
    module: 'cinematography',
    kind: 'book',
    evidence: 'practice',
    creator: 'Bruce Block',
    title: 'The Visual Story',
    url: 'https://www.oreilly.com/library/view/the-visual-story/9781317745693/xhtml/Ch02.xhtml',
    move: 'Every shot is made of seven components (space, line, shape, tone, colour, movement, rhythm). Contrast in a component raises visual intensity and affinity lowers it, and the intensity is planned to rise and fall with the story.',
  },
  // Emotion: motion alone gives shapes minds.
  {
    module: 'emotion',
    kind: 'study',
    evidence: 'measured',
    creator: 'Heider and Simmel (1944), described by Scientific American',
    title: 'Animating anthropomorphism: giving minds to geometric shapes',
    url: 'https://www.scientificamerican.com/blog/thoughtful-animal/animating-anthropomorphism-giving-minds-to-geometric-shapes-video/',
    move: 'Thirty-three of thirty-four viewers described two triangles and a circle moving around a box as characters with intentions. Changes of speed and direction without a visible cause are enough for a shape to seem alive.',
  },
  {
    module: 'emotion',
    kind: 'study',
    evidence: 'measured',
    creator: 'Brom, Stárková and D’Mello (2018)',
    title: 'How effective is emotional design? A meta-analysis',
    url: 'https://artemis.ms.mff.cuni.cz/main/papers/emodesign_manuscript_1rev_180928_FINAL_norev.pdf',
    move: 'Across 33 samples, pleasant colours and faces on the objects of a lesson improved retention (d about 0.39) and comprehension (d about 0.32).',
  },
  {
    module: 'multimedia',
    kind: 'study',
    evidence: 'measured',
    creator: 'Seductive details research (Harp and Mayer 1998; Rey 2012)',
    title: 'Seductive details',
    url: 'https://en.wikipedia.org/wiki/Seductive_details',
    move: 'Interesting but irrelevant pictures and anecdotes lower recall and transfer, more when they are visual and more when they come early in a lesson.',
  },
];

/** Every reference, checked and frozen. */
export const REFERENCES = Object.freeze(ENTRIES.map(defineReference));

/** The references owned by `module`, optionally of one `kind`. */
export function referencesFor(module, kind = null) {
  assert(REFERENCE_MODULES.includes(module), 'INVALID_DATA', `Unknown reference module ${module}.`);
  return Object.freeze(REFERENCES.filter((r) => r.module === module && (!kind || r.kind === kind)));
}

/** References as prompt examples: who, what and the move, in one line each. */
export const referenceExamples = (list) =>
  list.map((r) => `${r.creator}, "${r.title}"${r.flavour ? ` (${r.flavour})` : ''}: ${r.move}`);
