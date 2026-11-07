// Checks the site's own pages before a deploy. Run by scripts/build.mjs (a failure stops the deploy) and by `npm run check`.
//   Fails on: text still marked class="draft" (Claude drafted it; Ronin must rewrite it in his own words first),
//             internal links or files that don't exist, links to #anchors that aren't on the page,
//             a site nav that differs from page to page, or one that doesn't mark its own page as current.
//   Lists:    sections marked class="todo" (not written yet; safe to publish, since they say so).
// Old game versions (public/versions/) and data.json are made later in the build, so links to them are not checked.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');

/** Paths served by something other than this repo's public/ folder at deploy time. */
const NOT_HERE = [/^\/hogg-squash(\/|$)/, /^\/versions\//, /^\/build\/data\.json$/];
/** Ids the build page makes in the browser (build-page.js), so they're not in its HTML. */
const DYNAMIC_IDS = { 'build/index.html': /^(latest|v-.+|step-.+)$/ };

/** @param {string} dir @returns {string[]} */
function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return full === path.join(PUB, 'versions') ? [] : htmlFiles(full);
    return e.name.endsWith('.html') ? [full] : [];
  });
}

/** @param {string} text @param {number} index */
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
/** @param {string} file */
const rel = file => path.relative(PUB, file).replaceAll('\\', '/');

/**
 * The file a link points to, or null when it can't be found. `/about/` → public/about/index.html.
 * @param {string} target the link without its #hash or ?query @param {string} fromFile
 */
function resolve(target, fromFile) {
  const base = target.startsWith('/') ? path.join(PUB, target) : path.join(path.dirname(fromFile), target);
  const tries = target.endsWith('/') || target === '' ? [path.join(base, 'index.html')] : [base, path.join(base, 'index.html')];
  return tries.find(f => fs.existsSync(f) && fs.statSync(f).isFile()) ?? null;
}

/** @returns {boolean} true when every check passes */
export function check() {
  const files = htmlFiles(PUB);
  /** @type {string[]} */ const errors = [];
  /** @type {string[]} */ const todos = [];
  /** @type {Map<string, string>} */ const htmlCache = new Map();
  const read = (/** @type {string} */ f) => htmlCache.get(f) ?? (htmlCache.set(f, fs.readFileSync(f, 'utf8')), htmlCache.get(f) ?? '');
  /** @type {{ file: string, nav: string } | null} */ let firstNav = null;

  for (const file of files) {
    const html = read(file);
    const name = rel(file);

    for (const m of html.matchAll(/class="[^"]*\bdraft\b[^"]*"/g))
      errors.push(`${name}:${lineOf(html, m.index)}: draft text still to be rewritten by Ronin`);
    const todoCount = [...html.matchAll(/class="[^"]*\btodo\b[^"]*"/g)].length;
    if (todoCount) todos.push(`${name} ${todoCount}`);

    for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
      const link = m[1].replaceAll('&amp;', '&');
      if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(link)) continue;                // https:, mailto:, data:, //cdn…
      const [beforeHash, hash = ''] = link.split('#');
      const target = beforeHash.split('?')[0];
      const at = `${name}:${lineOf(html, m.index)}`;
      if (NOT_HERE.some(re => re.test(target))) continue;
      const dest = target === '' ? file : resolve(target, file);
      if (!dest) { errors.push(`${at}: broken link ${link}`); continue; }
      if (hash && dest.endsWith('.html')) {
        const dynamic = DYNAMIC_IDS[/** @type {keyof DYNAMIC_IDS} */ (rel(dest))];
        if (!read(dest).includes(`id="${hash}"`) && !dynamic?.test(hash)) errors.push(`${at}: no id="${hash}" in ${rel(dest)}`);
      }
    }

    const nav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0];
    if (nav) {
      const current = [...nav.matchAll(/href="([^"]+)" aria-current="page"/g)].map(c => c[1]);
      const own = '/' + name.replace(/index\.html$/, '');
      if (current.length !== 1 || current[0] !== own) errors.push(`${name}: the site nav should mark ${own} as the current page`);
      const plain = nav.replaceAll(' aria-current="page"', '');
      if (!firstNav) firstNav = { file: name, nav: plain };
      else if (plain !== firstNav.nav) errors.push(`${name}: the site nav differs from ${firstNav.file}'s (keep them identical)`);
    }
  }

  if (todos.length) console.log(`Check: sections not written yet (class="todo"): ${todos.join(', ')}`);
  for (const e of errors) console.error(`Check: ${e}`);
  console.log(errors.length ? `Check failed: ${errors.length} problem(s).` : `Check passed: ${files.length} pages.`);
  return errors.length === 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(check() ? 0 : 1);
