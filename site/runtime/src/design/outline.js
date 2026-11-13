// The final script as an outline: every line tagged with what it is, and everything that belongs to a line nested
// beneath it. A section holds its narration, its visual and its notes; the claims it relies on sit under it, and
// each claim's sources sit under the claim. Citations are attached from the research by claim id, never copied
// from prose, so a reader can see exactly which source supports which part of the script.
//
//   - [section] the-swatches · story · anecdote
//     - [narration] Imagine a kitchen table covered in coloured swatches...
//     - [visual] Two sets of hands sort swatches under one lamp.
//     - [note] The grouping exercise is illustrative, not a diagnostic test.
//     - [claim] Dalton lacked the middle-wavelength cone pigment (established)
//       - [source] Hunt et al. 1995 — https://pubmed.ncbi.nlm.nih.gov/7863342/

const INDENT = '  ';
const clean = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
const paragraphs = (text) =>
  String(text ?? '')
    .split(/\n\s*\n/)
    .map(clean)
    .filter(Boolean);
const line = (depth, tag, text = '') => `${INDENT.repeat(depth)}- [${tag}]${text ? ` ${clean(text)}` : ''}`;

function claimLines(depth, cites, claims, report) {
  const out = [];
  for (const id of cites ?? []) {
    const claim = claims.get(String(id).trim());
    if (!claim) {
      report.unknown.add(id);
      out.push(line(depth, 'claim', `${id} — not in the research`));
      continue;
    }
    out.push(line(depth, 'claim', `${claim.claim} (${claim.confidence})`));
    for (const s of claim.sources ?? []) out.push(line(depth + 1, 'source', `${s.title} — ${s.url}`));
  }
  return out;
}

function sectionLines(sections, { research, telling, depth = 0, report }) {
  const claims = new Map((research?.claims ?? []).map((c) => [c.id, c]));
  const beats = new Map((telling?.beats ?? []).map((b) => [b.id, b]));
  const out = [];
  for (const s of sections) {
    const beat = beats.get(s.beat);
    out.push(
      line(
        depth,
        'section',
        [s.beat, beat?.register, beat?.depth, s.optional ? 'optional' : ''].filter(Boolean).join(' · '),
      ),
    );
    for (const p of paragraphs(s.narration)) out.push(line(depth + 1, 'narration', p));
    if (clean(s.visual)) out.push(line(depth + 1, 'visual', s.visual));
    if (clean(s.notes)) out.push(line(depth + 1, 'note', s.notes));
    if (!(s.cites ?? []).length) report.uncited.push(s.beat);
    out.push(...claimLines(depth + 1, s.cites, claims, report));
  }
  return out;
}

function checks(report) {
  const out = [line(0, 'checks', report.uncited.length || report.unknown.size ? '' : 'every section cites its claims')];
  if (report.uncited.length) out.push(line(1, 'uncited', report.uncited.join(', ')));
  if (report.unknown.size) out.push(line(1, 'unknown-claims', [...report.unknown].join(', ')));
  return out;
}

function header(result, title) {
  const b = result.brief ?? {};
  const out = [line(0, 'title', title), line(1, 'form', result.form)];
  if (b.topic) out.push(line(1, 'topic', b.topic));
  if (b.audience) out.push(line(1, 'audience', b.audience));
  if (result.seed?.seed) out.push(line(1, 'seed', result.seed.seed));
  if (result.truth?.seed) out.push(line(1, 'truth', result.truth.seed));
  if (result.telling?.shape) out.push(line(1, 'shape', result.telling.shape));
  if (result.allegory?.strategy) out.push(line(1, 'allegory', result.allegory.strategy));
  return out;
}

/** The insight and philosophy summary: the leap verdict, then the aha, its cascade, cues, surprise and leak. */
function insightLines(result) {
  const out = [];
  if (result.philosophy) {
    const v = result.philosophy.verdict,
      debate = result.philosophy.debate;
    out.push(line(0, 'philosophy', `${v.invites}${debate ? `: ${debate.debate}` : ''}`));
    if (debate?.thoughtExperiment?.name)
      out.push(line(1, 'thought-experiment', `${debate.thoughtExperiment.name} (${debate.thoughtExperiment.source})`));
    if (v.invites !== 'none' && v.line) out.push(line(1, 'leap', v.line));
  }
  if (result.insight) {
    const m = result.insight.measures,
      a = result.insight.audit;
    out.push(
      line(
        0,
        'insight',
        `aha at ${m.aha ?? `section ${a.aha.section}`} (${m.ahaPosition ?? '?'} of the way through), ${m.cascade} earlier sections fire`,
      ),
    );
    out.push(line(1, 'aha', a.aha.insight));
    for (const e of (a.eurekas ?? []).slice().sort((x, y) => x.section - y.section)) {
      out.push(line(1, 'eureka', `${e.id}, section ${e.section}${e.kind === 'main' ? ' (main)' : ''}: ${e.insight}`));
      for (const c of e.because)
        out.push(line(2, 'because', `section ${c.section}${c.eureka ? ` (${c.eureka})` : ''}: ${c.gives}`));
    }
    out.push(
      line(1, 'cues', `${m.verifiedCues.length} of ${m.cues} planted cues appear before the aha and again at it`),
    );
    out.push(
      line(
        1,
        'surprise',
        `${m.strongSurprises} strong surprises, mean ${m.meanSurprise}, longest flat stretch ${m.longestFlat} sections`,
      ),
    );
    out.push(
      line(
        1,
        'leak',
        m.leaksBeforeAha
          ? `a first-time viewer could state the insight ${m.leakPosition} of the way through, before the aha`
          : 'the insight is not guessable before the aha',
      ),
    );
    if (a.stronger) out.push(line(1, 'stronger', a.stronger));
    for (const l of m.lost ?? []) out.push(line(1, 'lost', `section ${l.section}: "${l.quote}" (${l.why})`));
  }
  if (result.terms) {
    const t = result.terms.measures;
    out.push(
      line(
        0,
        'clarity',
        `${t.terms.length} terms and labels, ${t.unpictured} never pictured, ${t.coined} coined labels reused`,
      ),
    );
    for (const row of t.terms.filter((x) => x.problems.length && x.uses.length))
      out.push(
        line(1, 'term', `"${row.term}" (${row.kind}), sections ${row.uses.join(', ')}: ${row.problems.join('; ')}`),
      );
  }
  return out;
}

/** An explainer result as an outline. */
export function outlineExplainer(result) {
  const report = { uncited: [], unknown: new Set() };
  const body = sectionLines(result.script.sections, { research: result.research, telling: result.telling, report });
  return [...header(result, result.title.chosen), ...checks(report), ...insightLines(result), ...body].join('\n');
}

/** A fable result as an outline: scenes with their text and the claims they carry, then the afterword. */
export function outlineFable(result) {
  const report = { uncited: [], unknown: new Set() };
  const claims = new Map((result.research?.claims ?? []).map((c) => [c.id, c]));
  const body = [];
  for (const part of result.fable.parts) {
    body.push(line(0, 'scene', part.scene));
    for (const p of paragraphs(part.text)) body.push(line(1, 'text', p));
    if (clean(part.notes)) body.push(line(1, 'note', part.notes));
    if (!(part.cites ?? []).length) report.uncited.push(part.scene);
    body.push(...claimLines(1, part.cites, claims, report));
  }
  body.push(line(0, 'afterword'));
  for (const p of paragraphs(result.fable.afterword)) body.push(line(1, 'text', p));
  return [...header(result, result.title.chosen), ...checks(report), ...body].join('\n');
}

/** A series result as an outline: the plan and its decisions, then the piece or each episode. */
export function outlineSeries(result) {
  const a = result.assessment;
  const out = [
    line(0, 'series', result.outline?.title ?? a.throughLine),
    line(1, 'verdict', `${a.verdict}: ${a.why}`),
    line(1, 'through-line', a.throughLine),
  ];
  out.push(line(1, 'objectives'));
  for (const o of result.objectives) out.push(line(2, 'objective', `${o.id}: ${o.text}`));
  out.push(line(1, 'decisions', 'cut items are leftovers that can be brought back later'));
  for (const d of a.decisions)
    out.push(line(2, d.keep ? 'keep' : 'cut', `${d.item} (${d.kind}, ${d.subtopic}): ${d.reason}`));
  if (a.verdict === 'not-feasible') {
    out.push(line(1, 'missing', a.missing));
    return out.join('\n');
  }
  out.push(line(1, 'chapters'));
  for (const c of result.outline.chapters) {
    out.push(line(2, 'chapter', `${c.id} · ${c.minutes} min · ${c.purpose}`));
    out.push(line(3, 'objectives', c.objectives.join(', ')));
    if (c.uses.length) out.push(line(3, 'uses', c.uses.join(', ')));
    if (clean(c.handOff)) out.push(line(3, 'hand-off', c.handOff));
  }
  out.push(line(1, 'checks', result.checks.errors.join(' ') || 'all passed'));
  if (result.cutCheck && !result.cutCheck.clean)
    for (const b of result.cutCheck.back) out.push(line(2, 'cut-came-back', `${b.id}: ${b.found.join(', ')}`));
  if (result.piece?.chapters) {
    const research = { claims: (result.discoveries ?? []).flatMap((d) => d.research.claims) };
    const telling = {
      beats: result.piece.chapters.flatMap((w) =>
        w.telling.beats.map((b) => ({ ...b, id: `${w.chapter.id}-${b.id}` })),
      ),
    };
    const report = { uncited: [], unknown: new Set() };
    const body = [];
    for (const w of result.piece.chapters) {
      body.push(line(1, 'chapter', `${w.chapter.id} · ${w.chapter.shape} · ${w.chapter.purpose}`));
      const own = result.piece.script.sections.filter((s) => s.chapter === w.chapter.id);
      body.push(...sectionLines(own, { research, telling, depth: 2, report }));
    }
    const m = result.piece.measures;
    out.push(
      line(0, 'piece', result.piece.title.chosen),
      line(1, 'length', `${m.words} words, about ${m.estimatedMinutes} minutes`),
    );
    out.push(...checks(report).map((l) => INDENT + l), ...body);
    return out.join('\n');
  }
  const pieces = result.piece ? [result.piece] : (result.episodes ?? []);
  const discoveries = result.discoveries ?? [];
  pieces.forEach((piece, i) => {
    const research = result.piece
      ? { claims: discoveries.flatMap((d) => d.research.claims) }
      : discoveries[i]?.research;
    const report = { uncited: [], unknown: new Set() };
    const body = sectionLines(piece.script.sections, { research, telling: piece.telling, depth: 1, report });
    out.push(
      line(0, result.piece ? 'piece' : 'episode', piece.title.chosen),
      ...checks(report).map((l) => INDENT + l),
      ...body,
    );
  });
  return out.join('\n');
}

/** Any design result as an outline. */
export function renderOutline(result) {
  if (result.form === 'fable') return outlineFable(result);
  if (result.form === 'series') return outlineSeries(result);
  return outlineExplainer(result);
}
