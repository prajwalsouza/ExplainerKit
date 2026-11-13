#!/usr/bin/env node
// ExplainerKit MCP server: the agent tools over the Model Context Protocol, using
// JSON-RPC 2.0 messages, one per line, on standard input and output. It has no
// dependencies beyond Node; the preview tool also needs Playwright's Chromium.
// Register it with a client as: node /path/to/explainerkit/agents/mcp/server.mjs
import { createInterface } from 'node:readline';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TOOLS } from '../tools.mjs';
import { PACKAGE_ROOT } from '../preview.mjs';

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const pkg = JSON.parse(await readFile(resolve(PACKAGE_ROOT, 'package.json'), 'utf8'));
const INSTRUCTIONS = `ExplainerKit is a JavaScript library for interactive visual explanations. Its API is JavaScript, so you use it by writing ES modules that import explainerkit/<module>. Work in this order: call find_capability with the visual result you want, read the guide or get_recipe it points to, write the module, call check_code, then call preview and look at the screenshots before reporting success. Option names are validated at run time, so do not guess them: use describe_shape and lookup_export. Draw into a scene and mount it rather than drawing on a canvas yourself, so seeking, export and audits work.`;
const RESOURCES = [
  { uri: 'explainerkit://llms.txt', name: 'llms.txt', description: 'Compact index of every ExplainerKit import, recipe and vocabulary.', mimeType: 'text/plain', path: 'llms.txt' },
  { uri: 'explainerkit://catalog.json', name: 'catalog.json', description: 'Machine-readable capability catalog.', mimeType: 'application/json', path: 'agents/catalog.json' },
  { uri: 'explainerkit://docs/agents.md', name: 'Agent tools guide', description: 'How these tools, skills and the evaluation fit together.', mimeType: 'text/markdown', path: 'docs/agents.md' },
];

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function call(name, args) {
  const tool = TOOLS[name];
  if (!tool) return { content: [{ type: 'text', text: `Unknown tool ${name}.` }], isError: true };
  try {
    const out = await tool.run(args ?? {});
    return { content: [{ type: 'text', text: out.text }, ...(out.images ?? []).map((data) => ({ type: 'image', data, mimeType: 'image/png' }))], isError: false };
  } catch (error) {
    return { content: [{ type: 'text', text: error.message }], isError: true };
  }
}

async function handle(message) {
  const { id, method, params } = message;
  const isRequest = id !== undefined && id !== null;
  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: VERSIONS.includes(params?.protocolVersion) ? params.protocolVersion : VERSIONS[0],
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: { name: 'explainerkit', version: pkg.version },
        instructions: INSTRUCTIONS,
      });
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, {
        tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: { type: 'object', properties: t.input, required: t.required, additionalProperties: false } })),
      });
    case 'tools/call':
      return reply(id, await call(params?.name, params?.arguments));
    case 'resources/list':
      return reply(id, { resources: RESOURCES.map(({ path, ...r }) => r) });
    case 'resources/read': {
      const r = RESOURCES.find((x) => x.uri === params?.uri);
      if (!r) return fail(id, -32602, `Unknown resource ${params?.uri}.`);
      return reply(id, { contents: [{ uri: r.uri, mimeType: r.mimeType, text: await readFile(resolve(PACKAGE_ROOT, r.path), 'utf8') }] });
    }
    default:
      if (method?.startsWith('notifications/')) return;
      if (isRequest) fail(id, -32601, `Method not found: ${method}`);
  }
}

const lines = createInterface({ input: process.stdin });
let pending = Promise.resolve();
lines.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  // Answer in order; a long preview does not reorder later replies.
  pending = pending.then(() => handle(message)).catch((error) => message.id !== undefined && fail(message.id, -32603, error.message));
});
lines.on('close', () => pending.then(() => process.exit(0)));
