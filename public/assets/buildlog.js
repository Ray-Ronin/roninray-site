// @ts-check
// Shared by the build page (browser) and scripts/build.mjs (Node): reading the game's commit messages and plan.

/** Session tags at the start of a commit subject: P0, S1, S4b, CP-A, A1. */
const TAG = /^(P\d+|S\d+[a-z]?|CP-[A-Z]|A\d+)\b/;
/** Trailer lines that are never shown in the technical notes. */
const TRAILER = /^(Build-log|Co-Authored-By|Claude-Session|Signed-off-by):/i;

/**
 * @typedef {{ hash: string, short: string, date: string, subject: string, summary: string, details: string, live?: boolean }} Commit
 * @typedef {{ tag: string | null, kind: string, title: string, commits: Commit[] }} Group
 * @typedef {{ tag: string, title: string, done: boolean, you: boolean }} PlanItem
 */

/**
 * Splits a commit message into its subject, its plain-English `Build-log:` summary and the rest of the body.
 * @param {string} message
 */
export function parseMessage(message) {
  const lines = message.replace(/\r/g, '').trim().split('\n');
  const body = lines.slice(1);
  const summary = body.map(l => l.match(/^Build-log:\s*(.+)$/i)?.[1].trim()).find(Boolean) || '';
  const details = body.filter(l => !TRAILER.test(l)).join('\n').trim();
  return { subject: lines[0].trim(), summary, details };
}

/** @param {string} subject */
export const tagOf = subject => subject.match(TAG)?.[1] ?? null;

/** @param {string | null} tag */
export function kindOf(tag) {
  if (!tag) return 'setup';
  if (tag.startsWith('CP-')) return 'checkpoint';
  if (tag.startsWith('P')) return 'prep';
  if (tag.startsWith('A')) return 'art';
  return 'session';
}

/**
 * Groups commits (oldest first) into the plan's steps. A tagged commit starts its step;
 * untagged commits (plan edits, small fixes) belong to the step before them.
 * @param {Commit[]} commits
 * @returns {Group[]}
 */
export function groupCommits(commits) {
  /** @type {Group[]} */
  const groups = [];
  /** @type {Group | null} */
  let cur = null;
  for (const c of commits) {
    const tag = tagOf(c.subject);
    if (tag && cur?.tag !== tag) {
      const title = c.subject.replace(TAG, '').replace(/^\s*:?\s*/, '');
      cur = { tag, kind: kindOf(tag), title: title.charAt(0).toUpperCase() + title.slice(1), commits: [] };
      groups.push(cur);
    } else if (!cur) {
      cur = { tag: null, kind: 'setup', title: 'Getting set up', commits: [] };
      groups.push(cur);
    }
    cur.commits.push(c);
  }
  return groups;
}

/**
 * Reads the status list at the top of the game's docs/plan.md.
 * @param {string} md
 */
export function parsePlan(md) {
  /** @type {PlanItem[]} */
  const items = [];
  for (const line of md.replace(/\r/g, '').split('\n')) {
    const m = line.match(/^- \[( |x)\] \*\*([^*]+)\*\* (.+)$/);
    if (!m) continue;
    const you = /\*\(you\)\*/.test(m[3]);
    const title = m[3].replace(/\s*\*\(you\)\*/, '').replace(/[`*]/g, '').trim();
    items.push({ tag: m[2], title, done: m[1] === 'x', you });
  }
  return { items, next: items.filter(i => !i.done).slice(0, 4) };
}
