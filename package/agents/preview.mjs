// Headless preview for agents: run an ES module that uses ExplainerKit in Chromium
// and return screenshots, console output and errors. Shared by the MCP server,
// the command-line tool and the recipe tests.
//
// The code runs in a page with `<div id="stage">` and an import map that
// resolves `explainerkit` and `explainerkit/<entry>` to this package's source. A
// module that exports `player` (the object `scene.mount()` returns) or a
// `seek(seconds)` function is captured at exact scene times; otherwise each
// capture waits for real time to pass.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const SERVED = ['src', 'assets'];
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.glb': 'model/gltf-binary', '.wav': 'audio/wav' };
const MAX_CODE = 200_000,
  MAX_CAPTURES = 6,
  MAX_SIZE = 2000;

export async function importMap() {
  const pkg = JSON.parse(await readFile(resolve(PACKAGE_ROOT, 'package.json'), 'utf8')),
    imports = {};
  for (const [key, value] of Object.entries(pkg.exports)) {
    const target = typeof value === 'string' ? value : (value.import ?? value.default);
    // Stylesheet entries are mapped too, so import.meta.resolve('explainerkit/film.css') works.
    if (!target.endsWith('.js') && !target.endsWith('.css')) continue;
    imports[key === '.' ? 'explainerkit' : `explainerkit${key.slice(1)}`] = target.slice(1);
  }
  return { imports };
}

function page(map, width, height, background) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ExplainerKit preview</title>
<script type="importmap">${JSON.stringify(map)}</script>
<style>html,body{margin:0;background:${background};font-family:system-ui,sans-serif}#stage{width:${width}px;min-height:${height}px}</style></head>
<body><div id="stage"></div>
<script type="module">
window.__preview = {ready: false, error: null, module: null};
try { window.__preview.module = await import('/__preview/code.js'); }
catch (error) { window.__preview.error = String(error && error.stack || error); }
window.__preview.ready = true;
</script></body></html>`;
}

function serve(code, html) {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://local').pathname);
    if (path === '/' || path === '/index.html') return response.writeHead(200, { 'content-type': 'text/html' }).end(html);
    if (path === '/favicon.ico') return response.writeHead(204).end();
    if (path === '/__preview/code.js') return response.writeHead(200, { 'content-type': 'text/javascript' }).end(code);
    const file = resolve(PACKAGE_ROOT, `.${path}`);
    const top = file.slice(PACKAGE_ROOT.length).split(sep)[0];
    if (!file.startsWith(PACKAGE_ROOT) || !SERVED.includes(top)) return response.writeHead(404).end();
    try {
      if (!(await stat(file)).isFile()) throw Error('not a file');
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

async function chromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    throw Error('Preview needs Playwright with Chromium. Install it with `npm install -D playwright` and `npx playwright install chromium`.');
  }
}

// Chromium to use: EXPLAINERKIT_CHROMIUM when set, then Playwright's own
// download, then common system installs. Playwright's download is often
// missing or belongs to another Playwright version, and MCP clients start the
// server without the shell's environment, so the fallbacks matter.
const SYSTEM_BROWSERS = [
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
async function launch() {
  const engine = await chromium(),
    candidates = [process.env.EXPLAINERKIT_CHROMIUM || null, undefined, ...SYSTEM_BROWSERS],
    tried = [];
  for (const executablePath of candidates) {
    if (executablePath === null) continue;
    if (executablePath && !(await stat(executablePath).catch(() => null))) continue;
    try {
      return await engine.launch(executablePath ? { executablePath } : {});
    } catch (error) {
      tried.push(`${executablePath ?? "Playwright's Chromium"}: ${error.message.split('\n')[0]}`);
    }
  }
  throw Error(`Chromium did not start. Tried ${tried.join('; ')}. Run \`npx playwright install chromium\`, or set EXPLAINERKIT_CHROMIUM to a Chromium executable.`);
}

/**
 * Run `code` and capture it. `times` are scene seconds when the module exports
 * a player or seek function, otherwise seconds of real time after loading.
 * Returns base64 PNG captures, console lines, page errors and a blank check.
 */
export async function preview(code, options = {}) {
  if (typeof code !== 'string' || code.length === 0 || code.length > MAX_CODE) throw Error(`Code must be a string of 1–${MAX_CODE} characters.`);
  const width = Math.round(Math.min(MAX_SIZE, Math.max(64, options.width ?? 800))),
    height = Math.round(Math.min(MAX_SIZE, Math.max(64, options.height ?? 450))),
    times = (options.times ?? [0]).slice(0, MAX_CAPTURES).map((t) => Math.max(0, Math.min(3600, Number(t) || 0))),
    background = /^#[0-9a-f]{3,8}$/i.test(options.background ?? '') ? options.background : '#ffffff',
    html = page(await importMap(), width, height, background),
    server = await serve(code, html),
    browser = await launch(),
    logs = [],
    errors = [];
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 }),
      tab = await context.newPage();
    tab.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`.slice(0, 2000)));
    tab.on('pageerror', (e) => errors.push(String(e.stack || e.message).slice(0, 4000)));
    tab.on('requestfailed', (r) => errors.push(`Request failed: ${new URL(r.url()).pathname}`));
    tab.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} for ${new URL(r.url()).pathname} (only explainerkit imports, src/ and assets/ are served)`));
    await tab.goto(`http://127.0.0.1:${server.address().port}/`);
    await tab.waitForFunction(() => window.__preview?.ready, null, { timeout: options.timeout ?? 20000 });
    const loadError = await tab.evaluate(() => window.__preview.error);
    if (loadError) errors.push(loadError);
    const control = await tab.evaluate(() => {
      const m = window.__preview.module;
      return m && typeof m.seek === 'function' ? 'seek' : m?.player && typeof m.player.seek === 'function' ? 'player' : 'clock';
    });
    const captures = [];
    let elapsed = 0;
    for (const time of times) {
      if (control === 'clock') {
        if (time > elapsed) await tab.waitForTimeout((time - elapsed) * 1000);
        elapsed = Math.max(elapsed, time);
      } else
        try {
          await tab.evaluate(async ([t, how]) => {
            const m = window.__preview.module;
            if (how === 'seek') await m.seek(t);
            else {
              m.player.pause?.();
              // Clamp to the player's duration; a scene without motion has duration 0.
              m.player.seek(Math.min(t, m.player.duration ?? t));
            }
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          }, [time, control]);
        } catch (error) {
          // A scroll story owns its player's clock and refuses manual seeks by design.
          if (/Detach scroll|DRIVER_OWNED/.test(error.message)) {
            logs.push(`info: the player is driven by scroll, so capture ${time} s shows the current scroll position. Export seek(t) that scrolls the page for exact captures.`);
          } else errors.push(`Seeking to ${time} s failed: ${error.message.split('\n')[0]}`);
        }
      if (control === 'clock' && time === 0) await tab.waitForTimeout(150);
      const png = await tab.screenshot({ type: 'png' });
      const blank = await tab.evaluate(() => {
        const stage = document.querySelector('#stage');
        return !stage || stage.getBoundingClientRect().height < 2 || (!stage.querySelector('svg *, canvas') && !stage.textContent.trim());
      });
      captures.push({ time, png: png.toString('base64'), blank });
    }
    return { control, captures, logs, errors, ok: errors.length === 0 && captures.some((c) => !c.blank) };
  } finally {
    await browser.close();
    await new Promise((done) => server.close(done));
  }
}
