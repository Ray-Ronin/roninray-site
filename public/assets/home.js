// roninray.com homepage: the court behind the title, the menu cursor, and live build stats from GitHub.

const REPO = 'Ray-Ronin/hogg-squash';

// ---------- Court: a 192×108 pixel view from behind the player, like the game's camera ----------
(() => {
  const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('court'));
  if (!cv) return;
  const g = cv.getContext('2d');
  const W = 192, H = 108;
  const FW = { l: 58, r: 134, t: 8, b: 58 };            // front wall rectangle
  const SHORT = 80;                                      // y of the short line on the floor
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function court() {
    g.fillStyle = '#d7b47c';                             // maple floor
    g.beginPath(); g.moveTo(FW.l, FW.b); g.lineTo(FW.r, FW.b); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillStyle = '#c9c9c4';                             // side walls
    g.beginPath(); g.moveTo(0, 0); g.lineTo(FW.l, FW.t); g.lineTo(FW.l, FW.b); g.lineTo(0, H); g.fill();
    g.beginPath(); g.moveTo(W, 0); g.lineTo(FW.r, FW.t); g.lineTo(FW.r, FW.b); g.lineTo(W, H); g.fill();
    g.fillStyle = '#efefea';                             // front wall
    g.fillRect(FW.l, FW.t, FW.r - FW.l, FW.b - FW.t);

    g.fillStyle = '#c8102e';                             // red lines
    g.fillRect(FW.l, FW.t + 3, FW.r - FW.l, 1);          // out line
    g.fillRect(FW.l, FW.t + 25, FW.r - FW.l, 1);         // service line
    g.fillRect(FW.l, FW.b - 5, FW.r - FW.l, 5);          // tin
    const st = (SHORT - FW.b) / (H - FW.b);
    const sl = Math.round(lerp(FW.l, 0, st)), sr = Math.round(lerp(FW.r, W, st));
    g.fillRect(sl, SHORT, sr - sl, 1);                   // short line
    g.fillRect(W / 2, SHORT, 1, H - SHORT);              // half-court line
    g.strokeStyle = '#c8102e'; g.lineWidth = 1;          // service boxes
    g.beginPath(); g.moveTo(sl, SHORT + .5); g.lineTo(sl + 28, SHORT + .5); g.lineTo(16, H); g.stroke();
    g.beginPath(); g.moveTo(sr, SHORT + .5); g.lineTo(sr - 28, SHORT + .5); g.lineTo(W - 16, H); g.stroke();
  }

  function frame(/** @type {number} */ t) {
    g.clearRect(0, 0, W, H);
    court();
    const p = (t / 1800) % 1;                            // one trip to the front wall and back
    const z = p < .5 ? p * 2 : 2 - p * 2;                // 0 = near the camera, 1 = front wall
    const drift = Math.sin(t / 2600) * .35;              // slow drift across the court
    const floorY = lerp(H - 6, FW.b, z);
    const halfW = lerp(W / 2, (FW.r - FW.l) / 2, z);
    const x = Math.round(W / 2 + drift * halfW);
    const h = Math.abs(Math.sin(p * Math.PI * 2)) * lerp(24, 11, z);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 1, Math.round(floorY), 3, 1);  // shadow
    g.fillStyle = '#111'; g.fillRect(x - 1, Math.round(floorY - h) - 2, 2, 2);     // ball
    if (!reduce) requestAnimationFrame(frame);
  }
  reduce ? frame(900) : requestAnimationFrame(frame);
})();

// ---------- Menu: hover, focus, arrow keys and W/S move the cursor; Enter starts (F too: assets/keys.js) ----------
(() => {
  const items = /** @type {HTMLAnchorElement[]} */ ([...document.querySelectorAll('.menu a')]);
  if (!items.length) return;
  let on = 0;
  const select = (/** @type {number} */ i, focus = false) => {
    on = (i + items.length) % items.length;
    items.forEach((el, j) => el.classList.toggle('on', j === on));
    if (focus) items[on].focus();
  };
  items.forEach((el, i) => {
    el.addEventListener('mouseenter', () => select(i));
    el.addEventListener('focus', () => select(i));
  });
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowdown' || k === 's') { e.preventDefault(); select(on + 1, true); }
    else if (k === 'arrowup' || k === 'w') { e.preventDefault(); select(on - 1, true); }
    else if (k === 'enter' && !items.includes(/** @type {any} */ (document.activeElement))) {
      location.href = items[on].href;
    }
  });
})();

// ---------- HUD: commit count and latest session from the game repo (keeps the built-in numbers if GitHub can't be reached) ----------
(async () => {
  const commitsEl = document.getElementById('hud-commits');
  const buildEl = document.getElementById('hud-build');
  const api = `https://api.github.com/repos/${REPO}/commits`;
  try {
    const [one, recent] = await Promise.all([fetch(`${api}?per_page=1`), fetch(`${api}?per_page=30`)]);
    if (one.ok && commitsEl) {
      // With one commit per page, the "last" page number is the total commit count.
      const last = (one.headers.get('link') || '').match(/[?&]page=(\d+)>;\s*rel="last"/);
      const count = last ? Number(last[1]) : (await one.json()).length;
      if (count) commitsEl.textContent = `COMMITS ${count}`;
    }
    if (recent.ok && buildEl) {
      /** @type {{commit: {message: string}}[]} */
      const list = await recent.json();
      // Session commits start with a tag like "S5:" or "S4b:"; the newest one is the current build.
      for (const c of list) {
        const m = c.commit.message.match(/^(S\d+[a-z]?)\b/);
        if (m) { buildEl.textContent = `BUILD ${m[1].toUpperCase()}`; break; }
      }
    }
  } catch { /* offline or rate-limited: keep the numbers in the HTML */ }
})();
