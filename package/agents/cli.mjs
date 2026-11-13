#!/usr/bin/env node
// The agent tools from a shell, for agents without MCP:
//   node agents/cli.mjs find "pulse a dot on the beat"
//   node agents/cli.mjs modules
//   node agents/cli.mjs guide docs/modules/music.md [heading]
//   node agents/cli.mjs recipe music-grid
//   node agents/cli.mjs export musicGrid
//   node agents/cli.mjs shape text
//   node agents/cli.mjs check my-scene.js
//   node agents/cli.mjs preview my-scene.js [--times 0.5,2] [--width 800] [--height 450] [--out dir]
//   node agents/cli.mjs music song.mp3 [--full]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { TOOLS } from './tools.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { times: { type: 'string' }, width: { type: 'string' }, height: { type: 'string' }, out: { type: 'string' }, full: { type: 'boolean' }, limit: { type: 'string' } },
});
const [command, ...rest] = positionals;
const usage = 'Commands: find <task>, modules, guide <path|import> [heading], recipe <id>, export <name>, shape <type>, check <file>, preview <file> [--times a,b] [--out dir], music <file> [--full].';
const arg = rest.join(' ');
const calls = {
  find: () => TOOLS.find_capability.run({ task: arg, limit: values.limit ? Number(values.limit) : undefined }),
  modules: () => TOOLS.list_modules.run({}),
  guide: () => TOOLS.read_guide.run({ path: rest[0], heading: rest.slice(1).join(' ') || undefined, maxChars: 60000 }),
  recipe: () => TOOLS.get_recipe.run({ id: rest[0] }),
  export: () => TOOLS.lookup_export.run({ name: rest[0] }),
  shape: () => TOOLS.describe_shape.run({ type: rest[0] }),
  check: async () => TOOLS.check_code.run({ code: await readFile(resolve(rest[0]), 'utf8') }),
  preview: () =>
    TOOLS.preview.run({
      path: rest[0],
      times: values.times ? values.times.split(',').map(Number) : undefined,
      width: values.width ? Number(values.width) : undefined,
      height: values.height ? Number(values.height) : undefined,
    }),
  music: () => TOOLS.analyze_music.run({ path: rest[0], detail: values.full ? 'full' : 'summary' }),
};
if (!calls[command]) {
  console.log(usage);
  process.exit(command ? 1 : 0);
}
try {
  const out = await calls[command]();
  console.log(out.text);
  if (out.images?.length) {
    const dir = resolve(values.out ?? 'preview-output');
    await mkdir(dir, { recursive: true });
    for (const [i, data] of out.images.entries()) await writeFile(resolve(dir, `capture-${i + 1}.png`), Buffer.from(data, 'base64'));
    console.log(`\nSaved ${out.images.length} screenshot(s) to ${dir}. Open them to look at the result.`);
  }
  if (command === 'preview' && !out.result.ok) process.exit(2);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
