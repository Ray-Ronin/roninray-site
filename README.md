# roninray.com

The homepage and build log for **Hogg Squash**, Ronin Ray's GT Capstone project.

- `public/` is served as-is by the Cloudflare Worker `roninray-site` (see `wrangler.jsonc`) on `roninray.com/*`.
- The game is a separate repo and Worker: [Ray-Ronin/hogg-squash](https://github.com/Ray-Ronin/hogg-squash), served at https://roninray.com/hogg-squash/.
- Every push to `main` deploys the site.

## Pages
| Path | File | What it is |
| --- | --- | --- |
| `/` | `public/index.html` | Arcade-style title screen with two choices: play the game, or see how it was built |
| `/build/` | `public/build/index.html` | The build log (placeholder for now) |
| any unknown path | `public/404.html` | "Out of court" page |

Shared styles are in `public/assets/arcade.css`. The homepage court animation and live GitHub stats are in `public/assets/home.js`.

## Run locally
```bash
npm run dev
```
Then open http://localhost:8788.
