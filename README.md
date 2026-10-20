# roninray.com

The homepage and build log for **Hogg Squash**, Ronin Ray's GT Capstone project.

- `public/` is served by the Cloudflare Worker `roninray-site` (see `wrangler.jsonc`) on `roninray.com/*`.
- The game is a separate repo and Worker: [Ray-Ronin/hogg-squash](https://github.com/Ray-Ronin/hogg-squash), served at https://roninray.com/hogg-squash/.
- Every push to `main` builds and deploys the site. **Cloudflare build command: `npm run build`** (Worker → Settings → Builds).

## Pages
| Path | File | What it is |
| --- | --- | --- |
| `/` | `public/index.html` | Arcade-style title screen: play the game, or see how it was built |
| `/build/` | `public/build/index.html` | The build log: every game commit in plain English, playable old versions, and what's next |
| `/versions/<id>/` | generated | The game exactly as it was at an older commit |
| any unknown path | `public/404.html` | "Out of court" page |

## How the build log works
`npm run build` (`scripts/build.mjs`) copies the game repo and writes two generated, git-ignored outputs:
- `public/build/data.json`: every commit, the next steps from the game's `docs/plan.md`, and the playable versions.
- `public/versions/<id>/`: the game's files at each commit in `content/versions.json`. The game has no build step, so those files are the whole game.

Where the words come from:
- **Commit summaries:** the `Build-log:` line at the end of each game commit message (the game's `CLAUDE.md` explains the rule). Commits from before that rule use `content/summaries.json`.
- **Playable versions:** `content/versions.json`. To add one, add an entry with the commit, a title, a short description and the controls, then push.
- **Intro text:** `public/build/index.html`.

The page also asks GitHub for game commits made since the last deploy, so new commits show up without redeploying the site. New playable versions need a push here.

## Run locally
```bash
npm run dev
```
Then open http://localhost:8788. This runs the build first, so it needs git and an internet connection.
