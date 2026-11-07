# roninray.com

The homepage and build log for **Hogg Squash**, Ronin Ray's GT Capstone project.

- `public/` is served by the Cloudflare Worker `roninray-site` (see `wrangler.jsonc`) on `roninray.com/*`.
- The game is a separate repo and Worker: [Ray-Ronin/hogg-squash](https://github.com/Ray-Ronin/hogg-squash), served at https://roninray.com/hogg-squash/.
- Every push to `main` builds and deploys the site. **Cloudflare build command: `npm run build`** (Worker → Settings → Builds).

## Pages
| Path | File | What it is |
| --- | --- | --- |
| `/` | `public/index.html` | Arcade-style title screen: play the game, or read about the project |
| `/about/` | `public/about/index.html` | Start here: purpose, guiding question, what was made, milestones |
| `/research/` | `public/research/index.html` | The 1992 arcade game, research methods, tools, how the game works |
| `/build/` | `public/build/index.html` | The build log (process record): every game commit in plain English, playable old versions, and what's next |
| `/findings/` | `public/findings/index.html` | Data, conclusions, limitations, perspectives and ethics |
| `/sources/` | `public/sources/index.html` | Works cited (MLA) and glossary |
| `/faq/` | `public/faq/index.html` | Answers to the hard questions |
| `/versions/<id>/` | generated | The game exactly as it was at an older commit |
| any unknown path | `public/404.html` | "Out of court" page |

The reading pages share `assets/page.css`, the same site nav (in each page's HTML; keep them identical) and previous/next links in reading order: About, Research, Build log, Findings, Sources, FAQ.

## Checks before a deploy
`npm run check` (also the first step of `npm run build`, so a failure stops the deploy):
- **`class="draft"`** marks text Claude drafted that Ronin must rewrite in his own words. Any left fails the check, so it can't go live.
- **`class="todo"`** marks a section not written yet. It's listed, not failed (the page says "coming soon").
- Internal links, files and `#anchors` must exist, and the site nav must match on every page.

## How the build log works
`npm run build` (`scripts/build.mjs`) copies the game repo and writes two generated, git-ignored outputs:
- `public/build/data.json`: every commit, the next steps from the game's `docs/plan-v2.md` (or `docs/plan.md` if it's missing), and the playable versions.
- `public/versions/<id>/`: the game's files at each commit in `content/versions.json`. The game has no build step, so those files are the whole game.

Where the words come from:
- **Commit summaries:** the `Build-log:` line at the end of each game commit message (the game's `CLAUDE.md` explains the rule). Commits from before that rule use `content/summaries.json`.
- **Playable versions:** `content/versions.json`. To add one, add an entry with the commit, a title, a short description and the controls, then push.
- **Intro text:** `public/build/index.html`.
- **Research entry** (the first step in the log, from before the game repo's code): written by hand in `public/build/index.html`, inside `<ol id="log">`. `build-page.js` keeps it at the top when it rebuilds the log.

The page also asks GitHub for game commits made since the last deploy, so new commits show up without redeploying the site. New playable versions need a push here.

## Run locally
```bash
npm run dev
```
Then open http://localhost:8788. This runs the build first, so it needs git and an internet connection.
