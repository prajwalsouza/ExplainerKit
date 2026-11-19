# Design explanations with a language model

Give `explainerkit/design` a topic, such as "colour science", and it researches the topic, chooses one story worth telling, tries several structures for it, writes a narration script, reviews the script three ways and revises it. The result is the narration itself, with the research claims each sentence relies on, and a visual design for it: a storyboard timed to the narration, its visual structure, colour script, motion and feeling, checked against the research on learning from words and pictures. You can also ask for a short science fable instead of a narrated explainer, or give a list of learning objectives and get one stitched piece or a series.

This is a production module. It runs while you make a piece, in Node or a build step, and never inside the finished page. It calls a language model you supply, so its scripts become material for a scene rather than code the page runs.

The module does this by running many small steps rather than one large prompt. Each step is an operation with a single job, such as finding stories about the topic or checking that every planted clue pays off later. Some operations ask a language model and must answer in a declared shape. Others are measures, which are ordinary functions that count or check something and give the same answer every time. A run calls the operations in order, checks every answer and records every step.

The interactive map below shows each process as stages. Choose any step to read its purpose and method, an example of what it returned in a real run, the shape its answer must fit and the exact prompt it sends.

```demo design-flow
```

The module is experimental, and the package is not yet published. Model answers vary from run to run, and the measures describe a script rather than grade it. Treat every script as a researched first draft for a person to check.

## Two ways to use it

In library mode, you import `explainerkit/design` in JavaScript and call a process such as `designExplainer`. The library runs every step in order, checks each answer against its shape, runs the measures, records the run and can resume it. The sections below describe library mode.

In skills mode, you give the same operations to an agent as Agent Skills, the folder format that Claude Code and Codex both read. Each model operation is one skill with a `SKILL.md` holding the same instructions the library sends, a `schema.json` for the shape of its answer, an example output from a real run where one exists, and Codex metadata in `agents/openai.yaml`. The skills `explainerkit-design-explainer`, `explainerkit-design-fable` and `explainerkit-design-series` walk through their processes stage by stage and name the step skill for each stage. The explainer skill also carries the fixed checks as a small script, `scripts/check-script.mjs`, which runs on any narration or outline file.

[Download the design skills](../downloads/explainerkit-design-skills.zip) as a zip, and copy the folders into `~/.claude/skills/` for Claude Code or `~/.codex/skills/` for Codex.

For a complete piece, start with the process for its form. When a brief calls for a custom workflow, adapt the stages that need to change and keep using the others wherever feasible. If you plan a series backward from its finale, you can still research each chapter and give the findings to the chapter writers. Record any stage you have to skip, the reason and what later steps lose as a result.

## What comes out

These are four briefs and what the explainer, fable and series processes wrote for them in October 2026, with GPT-6.1 Terra at medium effort. Each brief named only a topic or a list of objectives. The title, the story and the shape were the process's own choices.

| Brief | Title it chose | How it opens |
| --- | --- | --- |
| Explainer, topic "colour science" | How Can Two Colours Match in One Light but Not Another? | "Imagine we're in a shop choosing two yellow crayons. We make two marks side by side and agree: same yellow. Then we get home…" |
| Explainer, topic "signal processing" | How Can a Line in Soot Become a Voice? | "This line was made by a voice in 1860, on a machine that wasn't built to play it back, and more than a century later, people found a way to hear a song in it." |
| Fable, topic "the biology of ageing" | What Can an Unfinished Life Tell Us? | "On the morning the king threatened to close the infirmary, the archivist drew a line beside her mother's name." |
| Series, four objectives about sound, 20 minutes | The Journey of a Sound Pattern | "Listen to this note. Now this one. Do you hear a low pitch in both?" |

The card below holds the complete colour science script. The outline is the narration itself, split into lines so that each claim and source can sit beneath the sentence it supports. Choose Narration only to read it straight through as it would be spoken. Choose Checks to run the module's fixed, non-model checks on it, which flag what a person should look at before the script is used.

For more writing, [read two complete examples of each form](#read-complete-examples), including two fables with their afterwords.

```demo design-outline
```

## Run a process from the development repository

ExplainerKit's development repository includes a command that runs a process with the local Codex command-line tool. That repository and its command are not public yet, so with the npm package alone you run a process from your own code, as [the next section](#call-a-process-from-your-own-code) shows. This section describes the command and its output for readers who have the repository. It needs Codex installed and signed in, and it runs from the repository root.

```sh
node scripts/design-run.mjs --topic "colour science"
```

The command prints each step as it starts and finishes, with the time and tokens each model call used. When it finishes, it prints the folder it wrote to, which is `.local/design-runs/` followed by the form, topic, model and effort. That folder holds `outline.md` (the final script as an outline), `script.md` (the same script as plain sections), `result.json` (every intermediate result), `usage.json` (calls, tokens and time) and a `prompts/` folder with the full text of every prompt that was sent. Running the same command again with the same folder reuses every step whose input has not changed.

Open `script.html` in a browser to read the full script in the same outline
format as the card above. Use the outline filter to find narration, visual
directions, sources or insights. The Insight engineering view shows where
the modeled viewer finds a reveal, which earlier lines feed it and where the
viewer predicts the ending or gets lost. A series includes a reading across
its full narration, with neighboring scenes grouped when the script is long.
If that reading finds a weak cascade, the command tries up to two revisions.
It keeps a revision when a new reading finds an improvement, the earlier
connections hold up and the revised scenes pass a check for factual changes.

In the live monitor, choose **Script** to use this reader. Select a sentence
to see its recorded draft and the earlier work it draws on.

The same command runs the other processes. The `--form fable` option writes a short story instead of a narrated script. The `--form series` option takes learning objectives or topics separated by vertical bars.

```sh
node scripts/design-run.mjs --form fable --topic "how computers store numbers"
node scripts/design-run.mjs --form series --minutes 20 \
  --objectives "Explain what frequency and pitch are|Explain how a microphone works|Explain aliasing"
```

Add `--live` when you want to follow an authoring run as it happens. The command
starts a local server, opens a browser tab and prints its URL. The monitor shows
running operations and updates token counts as Codex reports them. Open a step
to inspect the received input, sent prompt and output. **Back to map** shows
where the running operations fit in the process. **Stop run** cancels active
Codex calls and leaves the completed steps available for review.

To run just one operation, pass its name and a JSON file containing the input
object. Use the **Inputs** view of a completed operation to copy its input into
that file, then change the fields you want to test.

```sh
node scripts/design-run.mjs --step plan-subtopics --input ./subtopics-input.json \
  --model gpt-6-luna --effort low --live
```

The live recording is saved in the output folder. Its local server stays open
for 30 minutes after the command exits so you can review the result. Use
`--no-open` with `--live` if you want to open the printed URL yourself.

Every explainer and series run also designs the visuals for a motion-graphics film. The `--medium` option chooses another medium, `--music` and `--effects` add sound to it, `--previews` generates reference frames with Codex's image tool, `--style` chooses the house style, and `--no-visuals` skips the visual design.

The command uses GPT-6.1 Terra at medium effort by default. Change them with `--model` and `--effort`. The `--seed` option changes the random words and lens families used for lateral thinking, which can lead the run to a different story from the same topic.

## Call a process from your own code

A process needs a run, and a run needs a model. The model is a function you write. It receives one request for each model operation and returns the parsed answer together with the tokens it used. In the example below, `complete` stands for your own function that sends a prompt to a model with a JSON Schema for structured output and returns the parsed object and its token counts.

```js
import {createDesignRun, designExplainer, renderOutline} from 'explainerkit/design';

async function model({prompt, schema, effort, search}) {
  const {json, inputTokens, outputTokens} = await complete({prompt, schema, effort, webSearch: search});
  return {output: json, usage: {input: inputTokens, output: outputTokens}};
}

const run = createDesignRun({model, effort: 'medium'});
const result = await designExplainer(run, {
  topic: 'colour science',
  audience: 'curious adults with no specialist knowledge',
  minutes: 10,
});

console.log(result.title.chosen);
console.log(renderOutline(result));
console.log(run.usage); // {input, output, ...} tokens across every model call
```

Each request has the operation's name, a label for this call, the full prompt text, the JSON Schema the answer must fit, the reasoning effort and whether the operation wants web search. Operations that search expect your model function to give the model a web search tool. Without one, they still answer from the model's own knowledge, and their sources may be less reliable.

The run checks every answer against the operation's shape. If an answer does not fit, the run asks once more and lists what was wrong in the new prompt. If the second answer also fails, the call throws an error with the code `DESIGN_OUTPUT_INVALID`, and its `problems` property lists every mismatch. Calling a model operation on a run without a model throws `DESIGN_MODEL_MISSING`. Each call in a run needs its own label, so calling the same operation twice without a new label throws `DESIGN_STEP_REPEATED`.

A run can also take a `recorder`, an object with a `save(entry)` method and an optional `load(label)` method. The run saves every step with its input, output, prompt, attempts, tokens and time. Before calling a step, it asks the recorder for an earlier entry with the same label, and it reuses that entry when its input and effort are unchanged. This is how the repository command resumes a run. The run's `trace` property lists every step, and its `usage` property adds up the tokens of the calls it actually made.

## Operations, prompts and answer shapes

An operation is a plain object made by `defineOperation`. A model operation has a role (who the model is asked to be), a purpose (its one job), a method (numbered steps), optional examples and rules, an output shape, and a flag that says whether it searches the web. A measure has a purpose and a `compute` function instead.

```js
import {createDesignRun, defineOperation, list, record, string} from 'explainerkit/design';

const findAnalogies = defineOperation({
  name: 'find-analogies',
  role: 'You are a teacher who explains with everyday objects.',
  purpose: 'Find everyday objects that behave like the mechanism in the input.',
  method: [
    'Restate the mechanism in one plain sentence.',
    'List objects from the kitchen, the street and the body that behave the same way.',
    'For each, say where the comparison breaks.',
  ],
  output: record({
    analogies: list(record({object: string({max: 120}), breaks: string({max: 300})}), {min: 3, max: 6}),
  }),
});

const run = createDesignRun({model});
const {analogies} = await run.call(findAnalogies, {mechanism: 'Three cone types respond to overlapping wavelengths.'});
```

`renderPrompt` builds the prompt the run sends. It writes the role, the task, the numbered method, the examples with a note that they come from other topics on purpose, a search instruction when the operation searches, the rules and then each field of the input under its own heading. The operations in this module share three rules. They ask for JSON that fits the shape exactly, ask the model to say when it is unsure rather than invent detail, and ask it to reuse the ids it defined.

Shapes are built from `string`, `number`, `boolean`, `oneOf`, `list` and `record`. A shape becomes a strict JSON Schema, in which every field is required and no other fields are allowed, and it also checks the answer when it comes back. Limits that a schema cannot carry reliably, such as the length of a text or the number of entries in a list, are written into each field's description so the model can see them, and are checked by the shape. A text limit is given to the model in words, at about six characters per word. Text may run half as long again as its stated limit before it is refused, because models count characters poorly and a slightly long answer is still useful.

## The explainer, stage by stage

`designExplainer` runs twenty-three stages, three of which run alongside the stage after them. The map at the top of this page shows every step, and `EXPLAINER_STAGES` holds the same map in code.

### Explore and reframe

The first stage describes who will watch, as the next section explains, while the others begin. Then the stages look for material from several directions at once. One searching step finds surprising results, human stories and unusual sources, and another lists places where the audience has already met the topic. In parallel, six lateral-thinking operations force the topic out of its obvious framing. They look at it through eight lenses, such as inverting it or asking what nobody can check from the outside. They make deliberately unreasonable statements and move from them to sound ideas, and they connect the topic to random words and distant fields chosen by code from the run's seed. They also name the paradox at its centre, and run two unconstrained "wander" passes that collect playful questions and odd true stories without trying to solve anything.

Alongside that exploration, a reframing loop reads the topic again and again in different frames, because depth rarely comes from one look. Each round takes two lens families the loop has not used yet, chosen by code from the run's seed. The families ask, for example, what the subject is like from the inside, how we could know, what it really is, what matters, or where explanation stops. The round reframes the current question through those lenses and drops frames that repeat an earlier round. It then searches the literature on the rest (philosophers, essays, papers and classic thought experiments) and chooses the deepest question that still connects to the mechanism. That question becomes the next round's focus, so each round starts somewhere new.

### Choose the story

The next stage proposes six story seeds. A seed is one specific thing to tell, such as an experiment or an event, rather than a topic. Each seed must combine at least two pieces of the material, including a story, an unusual source or a lateral idea, and a seed may be carried by a question from the reframing loop. A measure ranks the seeds by surprise, wonder, closeness, depth and reach (how far a seed can lead toward a deep question that still connects to the science), and lowers seeds that would be the first example in a textbook. An editor operation then chooses one of the best three.

### Research and plan

The research stages find the people who carry the story, investigate the mechanism with sources and numbers, and find parallel stories from other subjects that share the same deep question. A second reframing loop runs alongside them on the chosen story itself, and the philosophy module described below decides whether the piece should leap anywhere deeper. The process then plans backward from the insight to what the audience already knows, asks what the insight means beyond itself, and chooses one central image to carry the piece.

### Tell, engineer and draft

The process writes four tellings of the same story. A mystery plants clues for a reveal, a chain steps sideways through parallel stories, a descent builds the explanation down to its formal statement and back up, and an experience starts with something the audience can try. Every beat in a telling records its register (such as surprise, play, build, formal or reflect) and its depth. A measure checks each telling. It checks that ideas arrive before they are needed, that every recalled clue was planted earlier and every opened question is closed, and that the telling reaches at least the mechanism and uses people and parallel stories. An editor chooses one telling, weighing how many earlier beats its reveal recalls. The insight engineering module then reworks the chosen telling backward from its reveal. The attention module plans the opening hook and a refill for every later beat, as described below, and the draft is written from the telling and that plan.

### Review, polish and audit

The draft is measured, reviewed for science, learning and story in parallel, and revised. If the revised narration still has too many hedges, flat sentence rhythm, choppy runs of short sentences, instructions to the viewer, an absent narrator, stock phrases, placeholders or spoken philosophical jargon, one more operation polishes its voice. The insight audit then reads the finished script as a first-time viewer, and a revision pass runs when the audit finds problems. The attention audit reads the result once more for where a viewer would lose patience, and its line edits are kept only when they help. The visual design process then plans the pictures, as described below, and may make small narration edits of its own through the same gate. The title is chosen last, after the script exists.

## Depth without jargon

The philosophy module (`consultPhilosophy`) asks what the chosen story means beyond itself, and whether the piece should say so. Behind the scenes, its first operation searches for the established debates the story genuinely touches, with their positions, the thought experiments that make them vivid and readings to follow. That research is for the writer, never for the audience. For each debate, the module also writes the everyday version, a question a child might ask about something ordinary that holds the same puzzle.

A second operation weighs how strongly the piece is invited to leap there. The verdict is `none` when the story is better without philosophy, `light` for one earned moment of wonder, or `central` when the deep question can be the story itself. When the verdict invites a leap, it is written as the audience will hear it, as a plain question raised by something ordinary in the story and carried by a real-world analogy. The colour science runs, for example, arrived at "So where is the colour: in the fabric alone, or in the meeting of fabric, light and eyes?"

Later steps follow the verdict instead of a fixed rule, and the narration never names a debate, a school of thought or a technical term. A thought experiment can be told as a small story in plain words, with the thinker credited in the notes. The measure `philosophyJargon` lists such terms if any are spoken, and the voice gate asks for a polish when it finds one. The story reviewer also marks a leap that is missing where it was invited, one tacked on at the end, and one that the ending shrinks back to a practical tip.

## Know who is watching

A eureka moment happens in a particular viewer's head, not in the script. The same reveal can astonish a newcomer, bore someone who works in the field and pass a child by. `buildAudience` therefore describes the viewers before anything is written. It returns two to four personas, one for each level of mastery in `AUDIENCE_LEVELS`: a newcomer meeting the topic for the first time, someone familiar with it from school or a hobby, and an expert. Each persona lists what that viewer already knows in everyday words, the gaps that matter for this topic, what they believe that is wrong or incomplete, and what they would find too obvious to be a reveal. One persona is marked as the target, the viewer the brief describes.

The personas are used in two places. While designing, `engineerCascade` builds the reveal for the target viewer, on something they wrongly believe or have not yet connected, and says for every other persona whether the reveal will land and why. Where it would be obvious to an expert, the operation is asked to add a deeper turn to the same reveal. After writing, `auditForAudience` runs the insight audit once for each persona, as the next section describes, and `audienceInsight` compares the results. Its `landsFor`, `missesFor` and `leaksFor` lists name the viewers for whom the main eureka lands, the viewers for whom it never arrives and the viewers who could state it before it came. `audienceProblems` turns those lists into sentences, and the explainer adds every one except the target's own to the insight gate.

Personas are a model's description of kinds of viewer, not real people. They make the audit's assumptions explicit and let you compare readers, but they do not replace watching real viewers.

## Keep the words plain

A script can avoid every textbook term and still be jargon. Told to avoid jargon, a model tends to coin a label for an idea, such as "a grid-related trace" for the hum that power lines leave in a recording, and then use that label as if it were an ordinary word. A newcomer heard it explained once, several minutes earlier, and has nothing to picture when it returns.

The writing steps follow `PLAIN_RULES`, which ask for the picture before the word. A thing is named by what the viewer can imagine, such as "the faint hum from the power lines, whose pitch wobbles a little from minute to minute", rather than by a label. A technical word appears only after that picture, and the picture comes back with the word when it returns after a gap. The eureka and the ending use only everyday words, because the moment of understanding must not depend on remembering a term. The learning reviewer also looks for terms and coined labels that a newcomer could not picture where they appear.

After writing, `checkTerms` checks the result. The model step `findTerms` reads the script as the target viewer and lists every technical term and coined label, with the line that first lets that viewer picture it and a plain way to say it. The measure `termMeasures` then finds every place each term is said. It reports a term that is never pictured, a term used before its picture, a term that returns more than three sections after it was last said, and a term that the eureka line depends on. Its problems join the insight gate described below, so a script with unexplained words is rewritten in plainer ones.

## Engineer and audit the insight

The insight engineering module follows the Insight Engineering method. The ending comes first, the pieces it needs are planted earlier as memorable cues in disguise, no beat gives the ending away, and the reveal recalls many of them at once so that earlier moments fire together. This simultaneous recall is called the cascade.

Before drafting, `engineerCascade` reworks the chosen telling backward from its reveal. It picks the cues the reveal will return to, written as the exact short phrase the narration will say, such as a number, an object or a person. It plants each cue in a different earlier beat, disguises it in a different setting or form, and checks that no earlier beat gives the ending away. The measure `checkCascade` reports which cues fire at the reveal, how far each is planted from it and how many settings they come from. A cue that returns after the reveal counts as a callback rather than part of the cascade. The process keeps the engineered telling when it breaks no more of the structure than the original and its reveal recalls at least as much.

After writing, `auditInsight` reads the finished script section by section as one viewer, the persona it is given. Before each section it writes what it expects next. After the section it scores the surprise and quotes the line where the surprise landed, because surprise happens at a moment rather than across a whole section. It also notes which earlier sections it remembered and whether it could already state the final insight. It marks every line where that viewer got lost, because they could not picture what was meant or had forgotten a label, and quotes the words that lost them.

The audit then maps every eureka, small or main. A eureka is the line where something clicks, and the audit quotes that line. It also cites where the eureka comes from, in the way a paper cites its sources. Each citation names an earlier section, quotes the line in it that feeds the eureka and says in one sentence what that line contributes. A source can itself be an earlier eureka, so small eurekas build into larger ones and the citations form a graph. The audit is told to be honest. A script may give a viewer no eureka at all, and in that case the audit lists none and explains why the main insight did not land.

Several measures check the audit against the text. `insightMeasures` counts the cues whose exact words appear both before the aha and in it, finds where the ending first became guessable, and counts strong surprises and the longest stretch without one. `locateQuote` finds each quoted line in the narration, and `surpriseMoments` places every surprise at its line and scores it against the script's own range, from its flattest moment to its strongest. `eurekaGraph` reads the citations, reporting how many earlier sections feed the main eureka, how long the longest chain of eurekas citing eurekas is, and any citation that points forward or to nothing.

The map below lays these audits over two real scripts. The surprise trace across the top rises at each quoted line, with its height relative to the rest of that script. Diamonds on the section strip mark each eureka at its line, the star marks the main one, and the arcs under the strip run into each eureka from the lines it cites. Coloured arcs above join each cue where it is planted to where it is said again. The narration underneath carries the same marks as coloured text, with the lines where the viewer got lost highlighted and italicized. Above the timeline, the words a viewer has to hold are listed, and any the script never pictured are coloured. Choose a eureka to read its cascade in script order, with each source line quoted, what it adds and the line where it clicks, and open a source that is itself a eureka to see how that one formed. Switch between the newcomer, familiar and expert viewers to see each one's own audit.

```demo design-insight
```

The two scripts show what the checks fix and what they still find. In the colour science script, the first draft said "illuminant metamerism" aloud and never let a newcomer picture the cells in the eye that respond to colour. The plain-words pass replaced those lines, and the problems the gate found fell from ten to six. In both scripts the main eureka lands for the newcomer and the familiar viewer and never for the expert, who knew the central idea already. Some problems remain and are reported rather than hidden. In the signal processing script the eureka arrives in section 4 of 11, so most of the piece explains what the newcomer already understands. The same newcomer still cannot picture how a gravitational-wave detector works when one appears as an example. In both scripts a restructuring pass made matters worse and was rejected.

`insightProblems` turns those measures into problems against `INSIGHT_GATE`. It reports a missing aha, a viewer who got lost at the eureka or more than once anywhere, a leak before the aha, an aha in the first half of the piece, a stretch of more than four sections without a strong surprise, fewer than two strong surprises, fewer than half the cues said in the same words, or a main eureka that draws on fewer than two earlier sections. The explainer adds every problem from the terms check and every viewer the eureka misses. Wording problems are fixed first, because restructuring a whole script to fix one unclear line tends to break other lines. `rewritePlain` proposes an exact replacement for each line where a viewer got lost and each line with an unexplained term, and `applyEdits` applies those replacements in code, changing nothing else. When problems remain, `reviseForInsight` restructures the script using the audit's own advice. After each pass the script is audited and checked again. A pass is kept only if it leaves fewer problems, and the process makes at most two restructuring passes. The audit is a model's prediction about viewers, not a measurement of them, and only real viewers can confirm an aha.

## Earn and keep attention

An insight only lands for a viewer who is still watching when it arrives. The attention module checks whether a script keeps them there. It treats the viewer's patience as a balance that the script spends and earns. A caveat, a recap of something already seen, a new term, notation or a derivation each asks the viewer to hold something, so each one spends patience. A question the viewer now wants answered, a surprise, a payoff of something they were waiting for, a person with something at stake or a vivid image earns it back. A good opening is therefore a deposit rather than a fix, and a long piece has to keep earning before the balance runs out. Insight engineering designs the moment understanding arrives, while this module checks the time leading up to it.

Five model operations and one measure do the work. `researchHooks` searches the web for what creators, research and platforms say about opening hooks and keeping viewers. It also looks for frameworks that already plan or audit them and for how other explanations of the same topic open. It labels each principle by where it comes from and how strong its evidence is, because much retention advice is opinion. `engineerHooks` plans a telling's attention before drafting. It writes an opening hook within the first twenty spoken seconds with the promise it makes, a refill at the start of every later section, a reason before every new idea and a deposit before every heavy stretch. A refill is an opening that earns patience with a new question, image or stake. A recap of earlier material is not a refill, although a short callback can sit inside one.

The hook operations learn from real openings. `HOOK_REFERENCES` lists twelve videos by Vsauce, 3Blue1Brown, Veritasium, fern and Steve Mould, each with its link, its hook flavour and the move its opening makes, described in our own words from its first ninety seconds of captions. One example opens on a sloppy handwritten digit that anyone reads instantly, then asks the viewer to write a program that does the same. `HOOK_PATTERNS` states what the openings share, such as a concrete thing in the first sentences, a question or anomaly within about twenty seconds, a sharp contrast and stakes. `engineerHooks`, the audit and the revision receive the references as examples and the patterns as rules, so a hook is judged against strong openings rather than merely found. `researchHooks` is told to find further openings of this kind, on the brief's topic where possible, instead of repeating these.

To audit a finished script, call `auditScriptAttention(run, { brief, sections, persona, research })`. Here `run` is a design run created with `createDesignRun`, and `sections` is the script as a list of `{ beat, narration }` objects. `persona` and `research` are optional. A script longer than 4000 words (`ATTENTION_PART_WORDS`) is read part by part. There is one call for each chapter when sections carry a `chapter` field, or for each section otherwise, and each part carries the questions still open and the patience left from the one before. This keeps the reading dense on a long film. A shorter script is read in one call. The model step `auditAttention` reads the script in order as a first-time viewer. It quotes the hook line, names its flavour from `HOOK_FLAVOURS` and states the promise it heard. It then quotes each sentence that earned or spent patience with its kind and a strength from 0 to 1, and marks where the viewer would leave and which new ideas arrived without a reason. It also lists each question the viewer carried, with the line that opened it and the line that answered it.

The measure `attentionMeasures` then keeps the ledger in code. It places every sentence at its spoken time, at 150 words a minute by default. It counts spending the text shows directly, which means caveat phrases, recap phrases, sentences that introduce a term and sentences dense with numbers or symbols. Earning comes only from the audit's quotes that are found in the text, so a quote the model invented earns nothing and is counted in `unfoundQuotes`. Patience starts at 50 on a 0 to 100 scale, drains a little each spoken minute and moves with each sentence's largest cost and largest deposit. The costs and deposits are in `ATTENTION_LEDGER`.

The result describes where the balance runs low. `curve` samples the balance every 30 seconds, `lows` lists stretches below the threshold together with the lines that spent most there, and `droughts` lists stretches with no strong earning moment. `opening` reports when the hook arrives, how many words come before the first question, any caveats in the first minute and whether the promise is paid. `openings` classifies the first 45 seconds of every later section as a refill, a recap or flat. `promiseShare` says how far through the piece the opening promise is paid. A promise paid in the first quarter is reported, because the hook's question should be the piece's own question rather than a small one that is answered and dropped. `auditDensity` counts the audit's moments per spoken minute. The ledger can only earn from moments the audit records, so an audit with fewer than one moment every two minutes is reported as a problem, and its lows may reflect a sparse reading rather than the script. `attentionProblems` turns these measures into sentences against `ATTENTION_GATE`. The model step `reviseForAttention` proposes exact line edits for those problems, and `applyEdits` from the terms check applies them.

The processes use the module in two places. Before drafting, `planAttention` runs `researchHooks` and `engineerHooks`, and the draft follows the plan's hook, refills and promises. In `designSeries`, the plan gives the first chapter its hook and every later chapter its refill. After the script is finished, `keepAttention` audits it and, when the gate finds problems, runs one pass of `reviseForAttention`. It drops any edit that would change a protected line, which in `designExplainer` means the main eureka line and the planted cues. It audits the revision again and keeps it only when fewer attention problems remain. The explainer returns all of this as `attention`, and so does the written piece of a series. You can also call `keepAttention` yourself on a finished script.

The values in `ATTENTION_LEDGER` and `ATTENTION_GATE` are editorial choices, not measured constants. The curve shows where a model reader predicts viewers would lose patience, and it does not show where real viewers left. Only real viewers or a platform's audience-retention data can establish that.

## Design the visuals

A finished script says what the viewer hears, and the narration's visual notes only suggest what they might see. The visual design process turns the script into a plan an animator can build. It decides what each idea must show, storyboards it against the narration, plans the visual structure, the colour, the feeling, the motion and the sound, and checks the result against the research on how people learn from words and pictures. `designExplainer` and `designSeries` run it after the attention pass. You can also call `designVisuals(run, { brief, sections })` on any finished script, where `sections` is the narration as a list of `{ beat, narration }` objects.

### Choose the medium

The medium says what may appear on screen. In `'motion-graphics'`, the default, the library draws everything, using shapes, strokes, text, plots, particles, simple characters and camera moves. `'motion-graphics-with-images'` adds still images, and `'generated-video'` adds video clips. Pass the medium as a name, or as an object such as `{ kind: 'motion-graphics', sound: { music: true }, images: { previews: true } }`. `resolveMedium` fills in the rest. Sound defaults to narration only, so music and effects are planned only when the medium says they are available.

The process is built around motion graphics. `VISUAL_VOCABULARY` lists what the library can draw, each entry with an id such as `strokes`, `morph` or `particles` and the import it comes from. Every planned shot names the capabilities it uses, and the timing check reports a shot that uses an image or a video in a medium that does not allow one.

### Decide what each idea must show

`depictIdeas` reads the script for the ideas the viewer must understand or feel, usually one every twenty to sixty spoken seconds rather than one per sentence. For each idea it quotes the words where the narration says it, states what must be seen, and states what must not be seen yet, so that a picture does not give a later reveal away. It then writes three depictions at different levels. The plain depiction uses the fewest elements that communicate the idea. The artful depiction adds one artistic move, such as a colour shift, a metaphor or a satisfying transformation, that adds feeling without adding anything to read. The rich depiction is the fullest version the medium allows. The step chooses the artful depiction when it is as easy to read as the plain one, and chooses the plain one when the idea is hard. Each depiction also records its rung on the ladder of abstraction, which runs from a concrete case through a schematic to a symbol.

`researchVisuals` runs before this step and searches the web for how other explanations have shown the same subject, what each picture gets right and which common diagrams mislead.

### The shot plan

`planShots` turns the chosen depictions into shots, and the shot plan is the contract that every later step reads and writes. A shot names its section and its cue, which is the exact first words of the narration where it starts. It also names the idea it carries and lists its elements. Each element has a role, which is subject, context, label, highlight, guide or decoration, together with the idea it carries. A shot also records its on-screen text, framing, camera move, transition, motion and capabilities, whether it uses a drawn, image or video source, and whether it ends on a hold where the viewer can pause.

`timeShots(sections, shots, { medium })` finds every cue in the narration and places the shot in spoken seconds at 150 words a minute. A shot ends where the next one starts. The result lists each shot's start, end and duration. Its errors include a cue that is not in the narration, shots out of order, a section with no shot and a source the medium does not allow. `shotSpans` returns the narration each shot covers.

Later steps change shots only through patches. A patch names a shot, a field and a new value, and `applyShotPatches` applies it only when the field is one of `PATCHABLE` and the value fits the shot's shape. The cue, the section and the idea cannot be patched. Changing them would be a different shot.

### The craft modules

Each craft module follows the same pattern. Its principles are the literature translated into rules, each with its source and how strong the evidence is. A model step designs the module's layer, and a measure checks that layer in code. The measures report problems as sentences.

| Module | What it decides | Grounded in | What its measure reports |
| --- | --- | --- | --- |
| Multimedia (`checkMultimedia`) | What to cut, what to point at, where labels sit and when things appear | Mayer's multimedia principles and the research on seductive details | On-screen text that repeats the narration or runs long, labels the narration does not say in that shot, more than three elements to track, decoration in the first minute, a protected line with nothing pointing at it, long stretches without a hold, and terms first said without being shown |
| Cinematography (`planStructure`) | Sequences, their visual intensity, contrast or affinity for each visual component, framing, cutting and screen direction | Block's *The Visual Story*, Mascelli, Murch and McCloud | Cut rate, runs of one framing, shots in no sequence, intensity that barely changes, calm sequences where attention runs low, and a central image missing from the first or last shot |
| Look (`planLook`) | The palette with roles, a colour key for each sequence, fixed colour meanings and style frames | Pixar colour scripts, Bellantoni, signalling and WCAG contrast | Invalid HSLA colours, a palette that is too large, text contrast below 4.5 to 1, an accent that dominates, and peaks with little value contrast |
| Emotion (`planEmotion`) | The feeling of each shot, elements given intent, visual metaphors, play and the emotional arc | The emotional-design meta-analyses, Heider and Simmel, Forceville, Norman and the research on humour | Emotional moves that carry no idea, decoration in the opening, metaphors that do not say where they break, too little or too much play, and an arc without a reflective close |
| Motion (`planMotion`) | The change each shot shows, the animation principles it uses, how many things move and screen direction | Tversky and colleagues on congruence, Thomas and Johnston and Michotte | More than two things moving at once, long still shots, motion that does not mirror its idea, and a subject whose direction flips |
| Sound (`planSound`) | Music, effects, ambience and silence by shot | Coherence, synchresis, mixing practice and Sanderson on music | Music too loud under dense shots, sound that does not duck under the narration, effects not tied to a motion, no space before the reveal, and cues the medium cannot play |

The most important rule runs through the emotion and multimedia modules. Emotional design helps learning when it carries the idea, and interesting but irrelevant detail harms it, most of all when the detail is visual and early. Every emotional move must therefore name the idea it carries, and the measure reports any move that carries none. A shape given intent through motion alone is the strongest emotional tool available in pure motion graphics, because viewers readily read moving shapes as characters.

`REFERENCES` holds the practitioner and research sources the modules learn from, described in our own words with a link. `referencesFor(module)` returns one module's entries, which its model step receives as examples. Each module's principles are exported, for example `MULTIMEDIA_PRINCIPLES`, so you can read exactly what a step was told and where each rule came from.

### The loop

The visual work can change the script. A picture may make a sentence unnecessary, or let the narrator react to what is on screen in a few words. The emotion and multimedia steps therefore propose small narration edits, and each edit must name the idea it serves. `designVisuals` drops any edit that touches a protected line, which in `designExplainer` means the main eureka line and the planted cues. It then applies the remaining edits only when you give it a gate. The gate is a `recheck` function that audits the edited narration and returns its problems, together with a `baseline` count. The edits are kept only when the problems do not rise above the baseline. `designExplainer` and `designSeries` use the attention audit as the gate. Without a gate, the edits are returned as suggestions in `rounds`, and the narration stays as it was.

When an edit is kept, the process runs another round. It re-times the shots, replans only the shots whose cue was lost with `replanShots`, and runs the multimedia check again. `rounds` limits the loop and defaults to two. Each entry in the result's `rounds` records the edits proposed, how many touched protected lines, the gate's counts and whether the edits were kept.

### The house style

Every film has a visual style that its colour script, style frames and generated images follow. The default, `'soft-minimal-2.5d'`, is a soft, clean 2.5D minimalism. Every shape is slightly raised, like smooth matte paper or a soft clay cut-out resting just above the background, and casts a soft shadow beneath it. Lines become soft rounded ribbons, light comes from the top left, the palette is small with one warm accent, and there is generous empty space. It aims to be beautiful and still simple, and the library can approach it with layered shapes, soft gradients, blurred shadows and a little parallax. `'flat-vector'` is a plainer alternative. Pass `style` to `designVisuals`, or put it on the brief, as a style name or as an object with at least a `look` sentence.

`VISUAL_STYLES` holds the styles. The look step receives the style, so the palette and style frames belong to it. For images, `withStyle` puts the style's look at the start of every prompt's style line and adds its avoid list, which keeps a model writing the prompts from dropping or contradicting it. The default style also sets the image use case to stylized concept art, because a diagram use case pulls a generator back toward flat output. In the first trial, the same three prompts produced flat diagrams with the earlier wording and visibly raised, softly shadowed shapes with the stronger one.

### What comes out

`designVisuals` returns the medium, the research, the depictions, the final shots and their timing. It also returns each module's layer as `structure`, `look`, `emotion`, `motion` and `sound`, together with every measure and all their problems in one list. It also returns the narration, including any kept edits. Its `production` field holds the deliverables a studio would make:
- `storyboard` lists the shots;
- `animatic` is a timing table with each shot's start, end and the words it covers;
- `colourScript` is the colour key of each sequence;
- `styleFrames` describes three to six finished-looking stills;
- `prompts` and `images` hold image prompts and generated images when they are allowed.

### Generating images

Generated images are references, not the film. A reference frame shows the people storyboarding and building a shot what it should communicate and feel like, so they have something to aim for. The shot that is finally built may look quite different. This holds even in a medium that allows images in the film, where a generated image is a starting point that is checked and changed like any other material.

The design module never generates images itself. Image generation needs two things. The medium must allow it, either with `images: { generate: true }` in a medium that allows images, or with `images: { previews: true }` for reference frames that never appear in the film. You must also pass an `imager`, a function that takes `{ id, kind, prompt }` and returns `{ file }`. `writeImagePrompts` writes each prompt in labelled parts (use case, request, scene, subject, style, composition, mood, palette, exact text, constraints and what to avoid), and `imagePromptSpec` formats those parts as the prompt text the imager receives.

A generated image often misses the one thing its frame is for. In the first trial, a frame meant to show a soft face against a sharp fence drew the face sharp, and two waves meant to be shifted copies came out with different wavelengths. An optional `reviewer`, a function that takes `{ file, spec, previewsOnly }` and returns `{ fits, problems }`, checks each image against its prompt. A reference frame is judged as something to aim for, so the reviewer reports what is unclear or misleading and does not fault detail a builder would simplify. Each problem in an image that does not fit joins the result's problems, prefixed with `Frames:`. `codexFrameReviewer` in the same adapter file asks Codex to look at the image.

The development repository's adapter, `scripts/design/codex-image.mjs`, generates images with Codex's built-in image tool. Only Codex has that tool, and a run driven by Claude cannot generate images without an adapter of this kind. Other generators can be connected by writing a function of the same shape. In the repository, `node scripts/design-run.mjs --topic "colour science" --previews` adds reference frames to a run, `--style` chooses the house style, `--images` generates images for a medium that allows them, and `--medium`, `--music` and `--effects` set the medium. `node scripts/design/visual-check.mjs` runs the visual process alone on chapters of an existing narration.

The plans are a model's design decisions, and the measures check their structure rather than their quality. A storyboard that passes every measure can still be dull, and only the rendered film shows whether the pictures work.

## Read the result

`renderOutline` turns a result into an outline. Every line begins with a tag in square brackets, and everything that belongs to a line is indented beneath it. A section holds its narration, its visual note and its production notes, then the research claims it cites, and each claim holds its sources. The citations come from the research by claim id, so the outline shows exactly which source supports which part of the script. The card under "What comes out" shows a complete outline.

| Tag | What the line holds |
| --- | --- |
| `[title]` | The chosen title, with the form, topic, audience, seed and shape as children. |
| `[checks]` | Whether every section cites its claims. An `[uncited]` child lists sections that cite nothing, and `[unknown-claims]` lists ids that are not in the research. |
| `[philosophy]` | The leap verdict and its debate, with the thought experiment and the leap as it will be heard as children. |
| `[insight]` | Where the aha falls and how many earlier sections fire there, with the aha itself, the verified cues, the surprise counts, any leak and how the aha could be stronger as children. |
| `[lost]` | A line where the target viewer got lost, with the words that lost them and why. |
| `[clarity]` | How many technical terms and coined labels the script uses, and how many it never pictures. Each `[term]` child names one with a problem and where it is said. |
| `[eureka]` | One eureka from the target viewer's audit, with its section and insight. Its `[because]` children name each section it cites and what that section contributes. |
| `[section]` | A section's id, followed by its register and depth from the chosen telling. The word `optional` marks a section that can be removed later without breaking the through-line. |
| `[narration]` | One paragraph of what is spoken. |
| `[visual]` | What the audience sees during the section. |
| `[note]` | Caveats and production details for the makers, which are never read aloud. |
| `[claim]` | A research claim the section relies on, with its confidence. |
| `[source]` | A source for the claim above it, as a title and a URL. |

A fable's outline has `[scene]` and `[text]` lines instead of sections and narration, and ends with an `[afterword]` that explains the allegory. A series outline begins with the verdict, the through-line, each objective and each keep or cut decision, then lists the chapters with their hand-offs before the script itself.

## Measures and the voice gate

The measures are ordinary functions, so you can use them on any narration. `scriptStats` counts words and estimated spoken minutes, sentence lengths and how much they vary, questions, address to the viewer, the narrator's own voice, numbers, hedges, sentences that open as instructions, stock phrases and placeholders that leave a result to be filled in later. `shortRuns` finds runs of three or more short sentences, which make narration sound choppy, and `philosophyJargon` finds philosophical terms spoken aloud. `voiceProblems` compares the counts with the thresholds in `VOICE_GATE` and returns the problems as sentences. Edit the narration below to see how they respond.

```demo design-measures
```

The thresholds in `VOICE_GATE` came from reading reference transcripts, and they are editorial choices rather than research findings. A script can pass every measure and still be dull, and a strong script can fail one. The structural measure `checkTelling` works the same way. It reports a telling that uses an idea before it is introduced, but a telling with no structural errors is not necessarily good.

## Write a science fable

`designFable` writes a short story whose plot runs on the science, in the tradition of Nick Bostrom's "The Fable of the Dragon-Tyrant". It looks for a truth that people misjudge or cannot feel, such as a risk too slow to notice. It then designs three allegories for that truth in parallel (a society living with the problem, a magic whose rules are exactly the science, and a short fable with a few characters). Each allegory maps every step of the mechanism to something in the story and lists the field's own vocabulary, which must not appear on the page. A measure checks how much of the mechanism each allegory covers. After an editor chooses one, the process plots the story with its stakes, darkest moment and punchline, writes it, and reviews it for the science and for the craft. It then revises the story and adds an afterword that names the real science. Each scene lists the research claims it carries, and the outline nests their sources under the scene.

## Several subtopics or learning objectives

`designSeries` takes a list of topics or of learning objectives. When it receives objectives, it first groups them into subtopics that could each stand alone as a video, and a measure confirms that every objective is covered. Each subtopic is then researched as a full video of its own, so none of them gets thin, borrowed research.

A filtering operation reads what every subtopic found and chooses one through-line. It marks every story and person keep or cut, and decides whether the material makes one piece, a series or nothing coherent. A measure reports when fewer than a quarter of the stories are kept, because a piece made only of mechanisms reads as a lecture. A stitching operation orders the kept material into chapters, gives each chapter its objectives, its minutes and the question it hands to the next, and plants callbacks between chapters. A measure checks that every objective is still covered and that cut material is not used again.

For one piece, every chapter is written separately with its own telling, draft, reviews and voice gate, and a bridging operation writes the joins between chapters and the closing. After writing, a measure searches the narration for the names of cut people and stories and reports any that came back. The time budget is a guide rather than a limit, and the outline marks optional sections that can be trimmed later. For a series, each episode is written as a full explainer that knows the series' through-line.

## Read complete examples

Start with the writing. Each link opens a complete recorded story or narration in a reading page, with its sources at the end. The examples preserve the model's prose. Their claims have not been independently rechecked for these pages.

### Fables

In [What Can an Unfinished Life Tell Us?](design-reading-fable-ledger.md), an archivist must answer a king who wants to close an infirmary. It begins with an unfinished entry in a book.

“On the morning the king threatened to close the infirmary, the archivist drew a line beside her mother’s name.

She drew it as far as the day’s date and stopped. Beyond the nib lay a clean stretch of paper. She put a brass weight on the page to keep it from curling, then went to see her mother.”

In [Where Did the Missing Numbers Go?](design-reading-fable-numbers.md), Mara keeps a market's prosperity reading while tiny discarded fractions accumulate. Both fables end with an afterword that explains the connection to the science.

### Explainers

- [Why Matching Colours Can Look Different in Another Light](design-reading-explainer-colour.md) follows a colour match that breaks when the lighting changes.
- [What Are You Filtering Out?](design-reading-explainer-signal.md) asks when an unwanted hum becomes useful evidence.

These are complete narration scripts. References to pictures and sound describe the planned demonstrations.

### Series

- [What Happens to a Sound Along the Way?](design-reading-series-sound.md) connects pitch, microphones, sampling and noise cancellation through four chapters.
- [How Can One Fan Sound Quieter to One Person?](design-reading-series-fan.md) follows the same objectives through a fan and a pair of headphones.

These are two treatments of the same sound unit. In both recorded runs, the series process chose to combine the objectives into a single piece.

## Follow a run by scrolling

Choose a fable, explainer or series, then scroll from its brief to its finished writing. The pinned picture changes as you scroll, while each stage explains the output it produced. The numbered beats take you to that point in the same story. You can stop to read or scroll backward to revisit an earlier decision. The fable starts with the archivist's story above.

```demo design-story
```

The walkthrough uses recorded outputs. The explainer's audience and final audit come from later runs of the same brief, because those steps were added after the original recording. Those stages identify the difference beside their explanations.

The walkthrough uses `attachStory` from `explainerkit/story` to connect scrolling to the presentation's existing beat timeline. The module pins the stage, smooths progress between frames and holds completed outputs while you read. Its `onAct` callback selects the accompanying text, and beat links use the same story's `seekTime` method. The complete text and stage outputs remain available when JavaScript is unavailable.

## Play the timed walkthrough

The same stages are available as a timed presentation. Pause at any beat and choose “Read this stage in the scroll story” to return to its explanation. The presentation uses `beats` from `explainerkit/motion` and the projection player to make seeking and replaying return to the same frame.

```demo design-film
```
