// @ts-check
// Build log page: renders public/build/data.json (made by scripts/build.mjs at deploy time),
// then asks GitHub for anything committed to the game since that deploy.
import { parseMessage, groupCommits } from './buildlog.js';

const REPO = 'Ray-Ronin/hogg-squash';
const KIND_LABEL = { setup: 'SETUP', prep: 'PREP', session: 'SESSION', checkpoint: 'PLAY-TEST', art: 'ART' };
const TZ = 'America/Chicago';

/** @param {string} iso @param {boolean} [year] */
const day = (iso, year = false) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year && { year: 'numeric' }), timeZone: TZ });

/**
 * Small element builder. Text is always added as text, never as HTML.
 * @param {string} tag @param {Record<string, any>} [attrs] @param {...any} kids
 */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid);
  return el;
}
/** @param {string} id */
const $ = id => /** @type {HTMLElement} */ (document.getElementById(id));

/** @param {any} data */
function render(data) {
  /** @type {import('./buildlog.js').Commit[]} */
  const commits = data.commits;
  const groups = groupCommits(commits);
  const byTag = new Map((data.versions ?? []).map((/** @type {any} */ v) => [v.tag, v]));

  // Stats line
  const steps = groups.filter(g => g.kind === 'session').length;
  const tests = groups.filter(g => g.kind === 'checkpoint').length;
  $('stats').replaceChildren(
    h('span', {}, h('b', {}, String(commits.length)), ' COMMITS'),
    h('span', {}, h('b', {}, String(steps)), ' SESSIONS'),
    h('span', {}, h('b', {}, String(tests)), ' PLAY-TESTS'),
    commits.length ? h('span', {}, `${day(commits[0].date).toUpperCase()} – ${day(commits[commits.length - 1].date, true).toUpperCase()}`) : null,
  );
  document.getElementById('hud-commits')?.replaceChildren(`COMMITS ${commits.length}`);

  // Playable versions
  $('versions').replaceChildren(...(data.versions ?? []).map((/** @type {any} */ v) => h('article', { class: 'version', id: `v-${v.id}` },
    h('div', { class: 'v-head' }, h('span', { class: 'tag kind-session' }, v.tag), h('span', {}, day(v.date, true))),
    h('h3', {}, v.title),
    h('p', {}, v.about),
    h('dl', { class: 'keys' }, v.controls.map((/** @type {[string, string]} */ [key, what]) =>
      [h('dt', {}, h('kbd', {}, key)), h('dd', {}, what)])),
    v.note ? h('p', { class: 'v-note' }, v.note) : null,
    h('a', { class: 'play', href: `/versions/${v.id}/` }, `PLAY ${v.tag}`),
  )));
  $('versions-section').hidden = !(data.versions ?? []).length;

  // The log, oldest first
  $('log').replaceChildren(...groups.map((g, i) => {
    const first = g.commits[0].date, last = g.commits[g.commits.length - 1].date;
    const when = day(first) === day(last) ? day(first, true) : `${day(first)} – ${day(last, true)}`;
    const v = g.tag ? byTag.get(g.tag) : null;
    return h('li', { class: 'step', id: i === groups.length - 1 ? 'latest' : `step-${g.tag ?? 'setup'}` },
      h('div', { class: 'step-side' },
        h('span', { class: `tag kind-${g.kind}` }, g.tag ?? 'GO'),
        h('span', { class: 'kind' }, KIND_LABEL[/** @type {keyof KIND_LABEL} */ (g.kind)] ?? ''),
      ),
      h('div', { class: 'step-body' },
        h('h3', {}, g.title),
        h('p', { class: 'step-date' }, `${when} · ${g.commits.length} commit${g.commits.length === 1 ? '' : 's'}`),
        h('ol', { class: 'commits' }, g.commits.map(c => h('li', { class: 'commit' },
          h('p', { class: 'sum' }, c.live ? h('span', { class: 'new' }, 'NEW') : null, c.summary || c.subject),
          h('p', { class: 'meta' },
            h('a', { href: `https://github.com/${REPO}/commit/${c.hash}` }, h('code', {}, c.short)),
            ` · ${day(c.date)}`, c.summary ? ` · ${c.subject}` : null),
          c.details ? h('details', {}, h('summary', {}, 'Technical notes'), h('pre', {}, c.details)) : null,
        ))),
        v ? h('a', { class: 'play', href: `/versions/${v.id}/` }, 'Play this version') : null,
      ),
    );
  }));

  // Up next, from the game's plan
  $('next').replaceChildren(...(data.next ?? []).map((/** @type {any} */ n) => h('li', {},
    h('span', {}, h('span', { class: `tag kind-${n.tag.startsWith('CP-') ? 'checkpoint' : n.tag.startsWith('A') ? 'art' : 'session'}` }, n.tag)),
    h('span', {}, n.title, n.you ? h('span', { class: 'you' }, ' (play-test by me)') : null),
  )));
  $('next-section').hidden = !(data.next ?? []).length;

  if (data.generatedAt) $('updated').textContent = `Log rebuilt ${day(data.generatedAt, true)}. Newer commits appear here as soon as they're on GitHub.`;
}

async function main() {
  /** @type {any} */
  let data = null;
  try {
    const res = await fetch('/build/data.json', { cache: 'no-cache' });
    if (res.ok) data = await res.json();
  } catch { /* fall through to GitHub only */ }
  if (data) render(data);
  else data = { commits: [], versions: [], next: [], head: null };

  // Anything committed since the last deploy comes straight from GitHub (60 requests an hour per visitor).
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=50`);
    if (!res.ok) throw new Error(String(res.status));
    /** @type {{ sha: string, commit: { message: string, author: { date: string } } }[]} */
    const list = await res.json();
    const fresh = [];
    for (const c of list) {
      if (c.sha === data.head) break;
      fresh.push({ hash: c.sha, short: c.sha.slice(0, 7), date: c.commit.author.date, ...parseMessage(c.commit.message), live: true });
    }
    if (fresh.length) {
      data.commits = data.commits.concat(fresh.reverse());
      render(data);
    }
  } catch {
    if (!data.commits.length) $('updated').textContent = "The build log couldn't load. The full history is on GitHub.";
  }
}

main();
