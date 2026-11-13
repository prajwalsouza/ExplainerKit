// The agent tools, independent of how they are called. The MCP server and the
// command-line tool both use these functions. Every tool returns
// {text, images?} where images are base64 PNG strings.

import { readFile, readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, relative, resolve, sep } from 'node:path';
import { PACKAGE_ROOT, preview as runPreview } from './preview.mjs';

let catalogCache = null;
export async function catalog() {
  catalogCache ??= JSON.parse(await readFile(resolve(PACKAGE_ROOT, 'agents/catalog.json'), 'utf8'));
  return catalogCache;
}

// ---------------------------------------------------------------- search
const STOP = new Set('a an and are as at be by can do for from how i in into is it its make me my of on or so that the this to use using want with without you your'.split(' '));
const words = (text) =>
  String(text)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => w.replace(/(ies)$/, 'y').replace(/(?<=[a-z]{3}[^s])s$/, ''));

function documents(data) {
  const docs = [];
  for (const m of data.modules.filter((x) => !x.compatibility))
    docs.push({
      kind: 'module',
      id: m.import,
      fields: [
        [m.import.replace(/explainerkit\/?/, ''), 3],
        [m.responsibility, 3],
        [(m.keywords ?? []).join(' '), 3],
        [m.guides.map((g) => g.title).join(' '), 2],
        [m.guides.map((g) => g.headings.join(' ')).join(' '), 1.5],
        [m.guides.map((g) => g.summary).join(' '), 1],
        [m.exports.join(' '), 1],
      ],
      item: m,
    });
  for (const r of data.recipes)
    docs.push({ kind: 'recipe', id: r.id, fields: [[r.title, 3], [r.keywords.join(' '), 3], [r.task, 2], [r.uses.join(' '), 1]], item: r });
  return docs.map((d) => {
    const counts = new Map();
    for (const [text, weight] of d.fields) for (const w of words(text)) counts.set(w, (counts.get(w) ?? 0) + weight);
    return { ...d, counts, length: [...counts.values()].reduce((n, v) => n + v, 0) };
  });
}

/** Rank modules and recipes for a task described in plain words (BM25 over weighted fields). */
export async function findCapability({ task, limit = 6 }) {
  if (typeof task !== 'string' || !task.trim()) throw Error('Describe the task in words, for example "make a dot pulse on the beat of a song".');
  const data = await catalog(),
    docs = documents(data),
    query = [...new Set(words(task))],
    average = docs.reduce((n, d) => n + d.length, 0) / docs.length,
    df = new Map(query.map((q) => [q, docs.filter((d) => [...d.counts.keys()].some((k) => k === q || (q.length > 4 && k.startsWith(q)))).length]));
  const scored = docs
    .map((d) => {
      let score = 0;
      const matched = [];
      for (const q of query) {
        let tf = d.counts.get(q) ?? 0;
        if (!tf && q.length > 4) for (const [k, v] of d.counts) if (k.startsWith(q)) tf = Math.max(tf, v * 0.7);
        if (!tf) continue;
        matched.push(q);
        const idf = Math.log(1 + (docs.length - df.get(q) + 0.5) / (df.get(q) + 0.5));
        score += (idf * tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (d.length / average)));
      }
      return { d, score, matched };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(15, limit)));
  if (!scored.length) return { text: `Nothing matched "${task}". Call list_modules to browse every import, or rephrase with the visual result you want.` };
  const lines = scored.map(({ d, matched }, i) => {
    if (d.kind === 'recipe') {
      const r = d.item;
      return `${i + 1}. Recipe \`${r.id}\`: ${r.title}. ${r.task}\n   Uses ${r.uses.map((u) => `\`${u}\``).join(', ')}. Get the code with get_recipe("${r.id}")${r.guide ? ` and read ${r.guide}` : ''}. Matched: ${matched.join(', ')}.`;
    }
    const m = d.item;
    return `${i + 1}. Module \`${m.import}\`: ${m.responsibility}.\n   Guides: ${m.guides.map((g) => g.path).join(', ') || 'none'}. Exports include ${m.exports.slice(0, 12).join(', ')}${m.exports.length > 12 ? ', …' : ''}. Matched: ${matched.join(', ')}.`;
  });
  return { text: `Best matches for "${task}":\n\n${lines.join('\n')}\n\nNext, read the guide or recipe before writing code, then check the result with preview.` };
}

export async function listModules() {
  const data = await catalog(),
    areas = [...new Set(data.modules.map((m) => m.area))];
  return {
    text: areas
      .map((a) => `## ${a}\n${data.modules.filter((m) => m.area === a).map((m) => `- ${m.import}: ${m.responsibility}${m.guides.length ? ` (${m.guides.map((g) => g.path).join(', ')})` : ''}`).join('\n')}`)
      .join('\n\n') + `\n\n## Recipes\n${data.recipes.map((r) => `- ${r.id}: ${r.title}`).join('\n')}`,
  };
}

// ---------------------------------------------------------------- reading
function inside(path, allowed) {
  const full = resolve(PACKAGE_ROOT, path),
    rel = relative(PACKAGE_ROOT, full);
  if (rel.startsWith('..') || !allowed.some((a) => rel === a || rel.startsWith(a + sep) || rel.startsWith(a + '/'))) throw Error(`Only files under ${allowed.join(', ')} can be read.`);
  return full;
}

/** Read a guide, optionally only the section under one heading. Accepts a path or an import name. */
export async function readGuide({ path, heading, maxChars = 12000 }) {
  const data = await catalog();
  if (typeof path !== 'string' || !path) throw Error('Give a guide path such as docs/modules/music.md, or an import such as explainerkit/music.');
  if (path.startsWith('explainerkit')) {
    const m = data.modules.find((x) => x.import === path);
    if (!m?.guides.length) throw Error(`No guide is linked for ${path}. Call list_modules.`);
    path = m.guides[0].path;
    // A module can have several guides. With a heading, read the first guide that has it.
    if (heading) {
      const wanted = String(heading).toLowerCase();
      for (const guide of m.guides) {
        const candidate = await readFile(resolve(PACKAGE_ROOT, guide.path), 'utf8').catch(() => '');
        if (candidate.split('\n').some((l) => /^#+ /.test(l) && l.replace(/^#+ /, '').toLowerCase().includes(wanted))) {
          path = guide.path;
          break;
        }
      }
    }
  }
  const full = inside(path, ['docs', 'README.md', 'llms.txt']);
  if (!['.md', '.txt'].includes(extname(full))) throw Error('Guides are Markdown files.');
  let text = await readFile(full, 'utf8').catch(() => null);
  if (text === null) {
    // Installed packages ship the module guides and main guides, but not every document.
    const pkg = JSON.parse(await readFile(resolve(PACKAGE_ROOT, 'package.json'), 'utf8')),
      home = String(pkg.repository?.url ?? '').replace(/^git\+/, '').replace(/\.git$/, '');
    throw Error(`${path} is not included in this installation. Read it in the repository${home ? ` at ${home}/blob/main/${relative(PACKAGE_ROOT, full)}` : ''}, or start from get_recipe and lookup_export, which work from the installed package.`);
  }
  if (heading) {
    const lines = text.split('\n'),
      start = lines.findIndex((l) => /^#+ /.test(l) && l.replace(/^#+ /, '').toLowerCase().includes(String(heading).toLowerCase()));
    if (start < 0) throw Error(`No heading containing "${heading}". Headings: ${lines.filter((l) => /^##+ /.test(l)).map((l) => l.replace(/^#+ /, '')).join('; ')}`);
    const level = lines[start].match(/^#+/)[0].length,
      end = lines.findIndex((l, i) => i > start && /^#+ /.test(l) && l.match(/^#+/)[0].length <= level);
    text = lines.slice(start, end < 0 ? undefined : end).join('\n');
  }
  const limit = Math.max(1000, Math.min(60000, maxChars));
  return { text: text.length > limit ? `${text.slice(0, limit)}\n\n[Truncated at ${limit} characters. Ask for a heading or a larger maxChars.]` : text };
}

export async function getRecipe({ id }) {
  const data = await catalog(),
    r = data.recipes.find((x) => x.id === id);
  if (!r) throw Error(`Unknown recipe "${id}". Recipes: ${data.recipes.map((x) => x.id).join(', ')}.`);
  const code = await readFile(resolve(PACKAGE_ROOT, r.path), 'utf8');
  return { text: `${r.title}\n${r.task}\nGuide: ${r.guide ?? 'none'}. Capture times: ${r.times.join(', ')} s.\n\n\`\`\`js\n${code}\`\`\`` };
}

async function declarationFiles(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) await declarationFiles(p, out);
    else if (e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
/** Which imports export a name, and its TypeScript declaration. */
export async function lookupExport({ name }) {
  const data = await catalog();
  if (typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name)) throw Error('Give one exported name, such as musicGrid.');
  const owners = data.modules.filter((m) => m.exports.includes(name));
  if (!owners.length) {
    const near = suggestions(name, data.modules.flatMap((m) => m.exports));
    return { text: `No public import exports \`${name}\`.${near.length ? ` Did you mean ${near.map((n) => `\`${n}\``).join(', ')}?` : ''}` };
  }
  const declarations = [];
  for (const file of await declarationFiles(resolve(PACKAGE_ROOT, 'src'))) {
    const text = await readFile(file, 'utf8'),
      lines = text.split('\n');
    lines.forEach((line, i) => {
      if (new RegExp(`\\b(function|const|class|interface|type)\\s+${name}\\b`).test(line) && !/^export\s*\{/.test(line))
        declarations.push(`${relative(PACKAGE_ROOT, file)}:${i + 1}\n${lines.slice(i, i + 6).join('\n').slice(0, 1600)}`);
    });
    if (declarations.length >= 3) break;
  }
  const canonical = owners.filter((m) => !m.compatibility);
  return {
    text: `\`${name}\` is exported by ${(canonical.length ? canonical : owners).map((m) => `\`${m.import}\``).join(', ')}.${owners.length > canonical.length && canonical.length ? ` It is also reachable through compatibility imports ${owners.filter((m) => m.compatibility).map((m) => m.import).join(', ')}.` : ''}\nGuides: ${[...new Set(canonical.flatMap((m) => m.guides.map((g) => g.path)))].join(', ') || 'see the module map'}.\n\n${declarations.join('\n\n') || 'No declaration found.'}`,
  };
}

export async function describeShape({ type }) {
  const { vocabularies: v } = await catalog();
  if (!v.shapeTypes.includes(type)) throw Error(`Shape types are ${v.shapeTypes.join(', ')}. Create one with scene.${v.shapeTypes[1]}({...}) and so on.`);
  return {
    text: `\`scene.${type}(props)\` accepts these properties. Unknown properties are rejected.\n\nOwn properties: ${v.shapeProperties[type].join(', ') || 'none beyond the shared ones'}.\nShared properties: ${v.sharedShapeProperties.join(', ')}.\n\nAnimate any numeric or colour property with handle.to(at, {prop: value}, {duration, ease}), bind it with handle.bind(prop, {inputs, map}), or make the handle enter with handle.enter(at, {style}).\nNamed easings: ${v.easings.join(', ')}.\nEntrance styles: ${v.enterStyles.join(', ')}.\nThe runtime reference is docs/runtime-api.md.`,
  };
}

// ---------------------------------------------------------------- checking code
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1));
  return d[a.length][b.length];
}
function suggestions(name, pool) {
  return [...new Set(pool)]
    .map((p) => ({ p, d: distance(name, p) }))
    .filter(({ p, d }) => d <= Math.max(2, Math.floor(name.length / 3)) || p.toLowerCase().includes(name.toLowerCase()))
    .sort((a, b) => a.d - b.d)
    .slice(0, 4)
    .map(({ p }) => p);
}

// Names agents bring from SVG, CSS, canvas or other libraries, and ExplainerKit's equivalent.
const SYNONYMS = { radius: 'r', textAnchor: 'align', textAlign: 'align', anchor: 'align', color: 'fill', fontColor: 'fill', textColor: 'fill', backgroundColor: 'fill', fillColor: 'fill', strokeColor: 'stroke', lineWidth: 'strokeWidth', w: 'width', h: 'height', size: 'fontSize', font: 'fontFamily', content: 'text', label: 'text', value: 'text', alpha: 'opacity', angle: 'rotation', rotate: 'rotation', scale: 'scaleX', cx: 'x', cy: 'y', d: 'commands', points: 'points' };

/** Static checks: imports that do not exist, unknown shape properties and known mistakes. */
export async function checkCode({ code }) {
  if (typeof code !== 'string' || !code.length || code.length > 200_000) throw Error('Give the module source as a string.');
  const data = await catalog(),
    byImport = new Map(data.modules.map((m) => [m.import, m])),
    problems = [],
    notes = [];
  for (const m of code.matchAll(/import\s+([\s\S]*?)\s+from\s+['"](explainerkit[^'"]*)['"]/g)) {
    const [, clause, source] = m,
      entry = byImport.get(source);
    if (!entry) {
      const tail = source.split('/').pop(),
        near = [...new Set([...[...byImport.keys()].filter((k) => k !== source && k.split('/').pop() === tail), ...suggestions(source, [...byImport.keys()])])].slice(0, 4);
      problems.push(`\`${source}\` is not a public import.${near.length ? ` Did you mean ${near.join(', ')}?` : ''}`);
      continue;
    }
    if (entry.compatibility) notes.push(`\`${source}\` is a compatibility import. New code should use the canonical import from the module map.`);
    const named = clause.match(/\{([\s\S]*)\}/)?.[1] ?? '';
    for (const part of named.split(',').map((s) => s.trim()).filter(Boolean)) {
      const name = part.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (part.startsWith('type ')) continue;
      if (!entry.exports.includes(name)) {
        const elsewhere = data.modules.filter((x) => !x.compatibility && x.exports.includes(name)).map((x) => x.import);
        problems.push(`\`${name}\` is not exported by \`${source}\`.${elsewhere.length ? ` It is exported by ${elsewhere.join(', ')}.` : suggestions(name, entry.exports).length ? ` Did you mean ${suggestions(name, entry.exports).join(', ')}?` : ''}`);
      }
    }
    if (/^\s*[A-Za-z_$]/.test(clause) && !clause.trim().startsWith('{') && !clause.includes('* as')) problems.push(`\`${source}\` has no default export. Use named imports such as \`import {${entry.exports[0]}} from '${source}'\`.`);
  }
  const { vocabularies: v } = data;
  for (const m of code.matchAll(/\.(circle|rect|line|path|text|group|cloud)\(\s*\{([^{}]*)\}/g)) {
    const allowed = new Set([...v.sharedShapeProperties, ...v.shapeProperties[m[1]]]);
    for (const key of m[2].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g))
      if (!allowed.has(key[1])) {
        const synonym = SYNONYMS[key[1]] && allowed.has(SYNONYMS[key[1]]) ? [SYNONYMS[key[1]]] : [],
          near = [...new Set([...synonym, ...suggestions(key[1], [...allowed])])];
        problems.push(`\`${m[1]}\` has no property \`${key[1]}\`.${near.length ? ` Did you mean ${near.join(', ')}?` : ''} Call describe_shape("${m[1]}") for the full list.`);
      }
  }
  for (const m of code.matchAll(/ease\s*:\s*['"]([^'"]+)['"]/g))
    if (!v.easings.includes(m[1])) problems.push(`Easing \`${m[1]}\` does not exist. Use one of ${v.easings.join(', ')}.`);
  for (const m of code.matchAll(/\.enter\([^)]*?style\s*:\s*['"]([^'"]+)['"]/g))
    if (!v.enterStyles.includes(m[1])) problems.push(`Entrance style \`${m[1]}\` does not exist. Use one of ${v.enterStyles.join(', ')}.`);
  for (const m of code.matchAll(/commonEffect\(\s*['"]([^'"]+)['"]/g)) if (!v.commonEffects.includes(m[1])) problems.push(`Effect \`${m[1]}\` does not exist. Use one of ${v.commonEffects.join(', ')}.`);
  for (const p of data.pitfalls) if (new RegExp(p.pattern).test(code)) notes.push(p.message);
  if (!/from\s+['"]explainerkit/.test(code)) notes.push('The code does not import ExplainerKit. Call find_capability to see whether the library already does what you are writing by hand.');
  if (/\.mount\(/.test(code) && !/export\s+(const|let)\s+player|export\s+(async\s+)?function\s+seek/.test(code)) notes.push('Export the player (`export const player = await drawing.mount(...)`) so preview can capture exact scene times.');
  const unique = (list) => [...new Set(list)];
  return {
    text: problems.length || notes.length
      ? `${problems.length ? `Problems (these will fail or are wrong):\n${unique(problems).map((p) => `- ${p}`).join('\n')}` : 'No definite problems found.'}${notes.length ? `\n\nNotes:\n${unique(notes).map((n) => `- ${n}`).join('\n')}` : ''}\n\nStatic checks cannot see every option. Run preview to confirm.`
      : 'No problems found in imports, shape properties, easings or effects. Static checks cannot see every option, so run preview to confirm.',
  };
}

// ---------------------------------------------------------------- running code
export async function preview({ code, path, width, height, times, background }) {
  if (path && !code) code = await readFile(resolve(process.cwd(), path), 'utf8');
  const result = await runPreview(code, { width, height, times, background });
  const lines = [
    `${result.ok ? 'Rendered' : 'Problems found'}. Time control: ${result.control === 'clock' ? 'real time after loading (export `player` or `seek(t)` to capture exact scene times)' : `scene time through the exported ${result.control}`}.`,
    ...result.captures.map((c, i) => `Capture ${i + 1} at ${c.time} s${c.blank ? ': the stage looks empty' : ''}.`),
    ...(result.errors.length ? ['', 'Errors:', ...result.errors.map((e) => `- ${e}`)] : []),
    ...(result.logs.length ? ['', 'Console:', ...result.logs.slice(0, 30).map((l) => `- ${l}`)] : []),
  ];
  return { text: lines.join('\n'), images: result.captures.map((c) => c.png), result };
}

// ---------------------------------------------------------------- music
function parseWav(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return null;
  let offset = 12,
    format = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4),
      size = view.getUint32(offset + 4, true),
      body = offset + 8;
    if (id === 'fmt ') format = { code: view.getUint16(body, true), channels: view.getUint16(body + 2, true), rate: view.getUint32(body + 4, true), bits: view.getUint16(body + 14, true) };
    if (id === 'data' && format) {
      const frames = Math.floor(size / (format.channels * (format.bits / 8))),
        channels = Array.from({ length: Math.min(2, format.channels) }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i++)
        for (let c = 0; c < channels.length; c++) {
          const at = body + (i * format.channels + c) * (format.bits / 8);
          channels[c][i] = format.code === 3 && format.bits === 32 ? view.getFloat32(at, true) : format.bits === 16 ? view.getInt16(at, true) / 32768 : format.bits === 24 ? ((view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getInt8(at + 2) << 16)) / 8388608) : NaN;
        }
      if (channels.some((c) => Number.isNaN(c[0]))) return null;
      return { channels, sampleRate: format.rate };
    }
    offset = body + size + (size % 2);
  }
  return null;
}
function ffmpegDecode(file) {
  return new Promise((done, fail) => {
    const child = spawn('ffmpeg', ['-v', 'error', '-i', file, '-t', '900', '-f', 'f32le', '-ac', '2', '-ar', '44100', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }),
      chunks = [];
    let size = 0,
      error = '';
    child.on('error', () => fail(Error('Decoding this format needs ffmpeg on the PATH. WAV files are read without it.')));
    child.stdout.on('data', (c) => {
      size += c.length;
      if (size > 900 * 44100 * 8 + 8) child.kill();
      else chunks.push(c);
    });
    child.stderr.on('data', (c) => (error += c));
    child.on('close', (status) => {
      if (status !== 0 && !chunks.length) return fail(Error(`ffmpeg could not decode the file: ${error.trim().slice(0, 300)}`));
      const all = Buffer.concat(chunks),
        frames = Math.floor(all.length / 8),
        left = new Float32Array(frames),
        right = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        left[i] = all.readFloatLE(i * 8);
        right[i] = all.readFloatLE(i * 8 + 4);
      }
      done({ channels: [left, right], sampleRate: 44100 });
    });
  });
}

/** Analyse a local audio file with explainerkit/music and summarise what to stage. */
export async function analyzeMusicFile({ path, detail = 'summary' }) {
  if (typeof path !== 'string' || !path) throw Error('Give the path of a local audio file.');
  const file = resolve(process.cwd(), path);
  if (!(await stat(file).catch(() => null))?.isFile()) throw Error(`No file at ${file}.`);
  const { analyzeMusic } = await import('../src/music/index.js');
  const pcm = (extname(file).toLowerCase() === '.wav' ? parseWav(await readFile(file)) : null) ?? (await ffmpegDecode(file)),
    a = analyzeMusic(pcm);
  if (detail === 'full') return { text: JSON.stringify(a) };
  const events = a.events.filter((e) => e.type !== 'hit');
  return {
    text: [
      `Duration ${a.duration} s, audible ${a.start}–${a.end} s. Tempo ${a.tempo.bpm} BPM (confidence ${a.tempo.confidence}), ${a.meter.beatsPerBar} beats per bar, key ${a.key?.name ?? 'unclear'}, loudness ${a.loudness.integrated} LUFS.`,
      `${a.beats.length} beats, ${a.downbeats.length} bars, ${a.onsets.length} onsets, ${a.chords.length} chord segments.`,
      '',
      'Sections:',
      ...a.sections.map((s) => `- ${s.label} ${s.start}–${s.end} s, bar ${s.startBar}, ${s.bars} bars, ${s.role}, energy ${s.energy}${s.progression?.chords ? `, loop ${s.progression.chords.join(' ')}` : ''}`),
      '',
      'Events:',
      ...events.map((e) => `- ${e.type} at ${e.time} s${e.end !== undefined ? ` to ${e.end} s` : ''}${e.bar !== null ? `, bar ${e.bar}` : ''}${e.label ? `, section ${e.label}` : ''}${e.measure ? ` (${e.measure})` : ''}`),
      `- plus ${a.events.length - events.length} strong hits`,
      '',
      'First chords: ' + a.chords.slice(0, 16).map((c) => c.name).join(' '),
      '',
      'Pin actions with musicGrid(analysis).pin([...]) from explainerkit/music. Ask with detail "full" for the complete analysis JSON, which musicGrid accepts.',
    ].join('\n'),
  };
}

export const TOOLS = {
  find_capability: {
    run: findCapability,
    description: 'Find which ExplainerKit modules and tested recipes do a task. Call this first, before writing code: the library covers characters, gears, particles, cameras, 3D line art, scroll stories, narrated films, sound, music timing, charts, labels and audits, not only shapes.',
    input: { task: { type: 'string', description: 'The visual result or behaviour you want, in plain words.' }, limit: { type: 'integer', description: 'How many results, 1–15. Default 6.' } },
    required: ['task'],
  },
  list_modules: { run: listModules, description: 'List every public ExplainerKit import with its responsibility and guides, grouped by area, plus the recipe ids.', input: {}, required: [] },
  read_guide: {
    run: readGuide,
    description: 'Read an ExplainerKit guide, or one section of it. Accepts a path under docs/ or an import name such as explainerkit/music.',
    input: { path: { type: 'string', description: 'A guide path such as docs/modules/music.md, or an import name.' }, heading: { type: 'string', description: 'Return only the section whose heading contains this text.' }, maxChars: { type: 'integer', description: 'Truncate after this many characters. Default 12000.' } },
    required: ['path'],
  },
  get_recipe: { run: getRecipe, description: 'Get the full code of a tested recipe. Recipes run as written in a page with <div id="stage">.', input: { id: { type: 'string', description: 'The recipe id from find_capability or list_modules.' } }, required: ['id'] },
  lookup_export: { run: lookupExport, description: 'Find which import exports a name and show its TypeScript declaration. Use it before calling a function you have not seen in a guide.', input: { name: { type: 'string', description: 'An exported name, such as musicGrid or createSoundtrack.' } }, required: ['name'] },
  describe_shape: { run: describeShape, description: 'List the properties a scene shape accepts, with the named easings and entrance styles. Unknown properties are rejected at run time.', input: { type: { type: 'string', description: 'group, circle, rect, line, path, cloud or text.' } }, required: ['type'] },
  check_code: { run: checkCode, description: 'Statically check ExplainerKit code: imports and names that do not exist, unknown shape properties, easing and effect names, and known mistakes. Fast; run preview afterwards to be sure.', input: { code: { type: 'string', description: 'The ES module source.' } }, required: ['code'] },
  preview: {
    run: preview,
    description: 'Run an ES module that uses ExplainerKit in headless Chromium and return screenshots, console output and errors. The page has <div id="stage"> and resolves explainerkit/* imports. Export `player` (from scene.mount) or `seek(t)` to capture exact scene times.',
    input: {
      code: { type: 'string', description: 'The module source. Give this or path.' },
      path: { type: 'string', description: 'Path of a module file to run instead of code.' },
      times: { type: 'array', items: { type: 'number' }, description: 'Up to six times in seconds to capture. Default [0].' },
      width: { type: 'integer', description: 'Viewport width in CSS pixels. Default 800.' },
      height: { type: 'integer', description: 'Viewport height in CSS pixels. Default 450.' },
      background: { type: 'string', description: 'Page background as a hex colour. Default #ffffff.' },
    },
    required: [],
  },
  analyze_music: {
    run: analyzeMusicFile,
    description: 'Analyse a local song file with explainerkit/music: tempo, beats, bars, key, chords, sections and events such as drops and build-ups, for timing visuals to it. WAV is read directly; other formats need ffmpeg.',
    input: { path: { type: 'string', description: 'Path of the audio file.' }, detail: { type: 'string', enum: ['summary', 'full'], description: 'summary (default) or full analysis JSON.' } },
    required: ['path'],
  },
};
