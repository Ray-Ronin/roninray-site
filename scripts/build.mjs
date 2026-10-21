// Builds the build log from the game repo (Ray-Ronin/hogg-squash):
//   public/build/data.json   commits with their plain-English summaries, playable versions, the plan's next steps
//   public/versions/<id>/    the game exactly as it was at each commit listed in content/versions.json
// Cloudflare runs this before every deploy (Workers Builds build command: npm run build). Needs git and Node 18+.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMessage, parsePlan } from '../public/assets/buildlog.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'Ray-Ronin/hogg-squash';
const BRANCH = 'main';
const GAME_DIR = 'public/hogg-squash/';
const MIRROR = path.join(ROOT, '.cache', 'hogg-squash.git');
const OUT_DATA = path.join(ROOT, 'public', 'build', 'data.json');
const OUT_VERSIONS = path.join(ROOT, 'public', 'versions');

/** @param {string[]} args */
const git = (...args) => execFileSync('git', ['--git-dir', MIRROR, ...args], { maxBuffer: 256 * 1024 * 1024 });
/** @param {string[]} args */
const gitText = (...args) => git(...args).toString('utf8');
/** @param {string} file */
const readJson = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

// 1. A local copy of the game repo: cloned the first time, refreshed after that.
if (fs.existsSync(MIRROR)) git('fetch', '--prune', '--quiet', 'origin');
else execFileSync('git', ['clone', '--mirror', '--quiet', `https://github.com/${REPO}.git`, MIRROR]);

// 2. Every commit, oldest first. A `Build-log:` line in the message wins; older commits use content/summaries.json.
/** @type {Record<string, string>} */
const backfill = readJson('content/summaries.json');
const SEP = '\x1f', END = '\x1e';
const commits = gitText('log', BRANCH, '--reverse', `--format=%H${SEP}%aI${SEP}%B${END}`)
  .split(END).map(rec => rec.trim()).filter(Boolean)
  .map(rec => {
    const [hash, date, message] = rec.split(SEP);
    const m = parseMessage(message);
    const old = Object.entries(backfill).find(([short]) => hash.startsWith(short))?.[1];
    return { hash, short: hash.slice(0, 7), date, subject: m.subject, summary: m.summary || old || '', details: m.details };
  });

// 3. The next few unticked steps in the game's plan.
const plan = parsePlan(gitText('show', `${BRANCH}:docs/plan.md`));

// 4. Playable old versions. The game has no build step, so its files at a commit are the whole game.
/** @type {{ id: string, commit: string, tag: string, title: string, about: string, note?: string, modes?: { label: string, query: string }[], hash?: string, date?: string }[]} */
const versions = readJson('content/versions.json');
fs.rmSync(OUT_VERSIONS, { recursive: true, force: true });
for (const v of versions) {
  if (!/^[a-z0-9-]+$/.test(v.id)) throw new Error(`versions.json: id "${v.id}" may only use a-z, 0-9 and -`);
  const hash = gitText('rev-parse', '--verify', `${v.commit}^{commit}`).trim();
  const date = gitText('log', '-1', '--format=%aI', hash).trim();
  const files = gitText('ls-tree', '-r', '--name-only', hash, '--', GAME_DIR).split('\n').filter(Boolean);
  if (!files.length) throw new Error(`versions.json: commit ${v.commit} has no ${GAME_DIR}`);
  for (const file of files) {
    const dest = path.join(OUT_VERSIONS, v.id, file.slice(GAME_DIR.length));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    let bytes = git('show', `${hash}:${file}`);
    if (file === `${GAME_DIR}index.html`) bytes = Buffer.from(addBadge(bytes.toString('utf8'), v.id, v.tag, date));
    fs.writeFileSync(dest, bytes);
  }
  Object.assign(v, { hash, date });
}

// 5. Everything the build page needs, in one file.
fs.mkdirSync(path.dirname(OUT_DATA), { recursive: true });
fs.writeFileSync(OUT_DATA, JSON.stringify({
  generatedAt: new Date().toISOString(),
  repo: REPO,
  head: commits.at(-1)?.hash ?? null,
  commits,
  versions,
  next: plan.next,
}, null, 1));

const missing = commits.filter(c => !c.summary).map(c => c.short);
console.log(`Build log: ${commits.length} commits, ${versions.length} playable version(s), ${plan.next.length} next steps.`);
if (missing.length) console.log(`No plain-English summary yet for: ${missing.join(', ')}`);

/**
 * Marks an old version as old: a small link back to the build log, and the step and date in the tab title.
 * @param {string} html @param {string} id @param {string} tag @param {string} date
 */
function addBadge(html, id, tag, date) {
  const day = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
  const badge = `<a href="/build/#v-${id}" style="position:fixed;left:8px;top:8px;z-index:9;padding:6px 9px;background:rgba(200,16,46,.92);color:#fff;font:12px/1.2 Consolas,monospace;text-decoration:none">&#9664; Build log &middot; ${tag}, ${day}</a>`;
  return html
    .replace(/<title>([^<]*)<\/title>/, `<title>$1 (${tag}, ${day})</title>`)
    .replace(/<\/body>/i, `  ${badge}\n</body>`);
}
