// Every page: the game's own HARD and SOFT keys work the site too. F is OK (like Enter, or A on a pad): it opens the
// focused link, else the highlighted menu item. G is back (like B): it goes to the start page (it does nothing there,
// since the start page is the top).
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
  if (e.code === 'KeyF') {
    const focused = document.activeElement;
    const target = focused instanceof HTMLAnchorElement || focused instanceof HTMLButtonElement
      ? focused : document.querySelector('.menu a.on');
    if (target) { e.preventDefault(); /** @type {HTMLElement} */ (target).click(); }
  } else if (e.code === 'KeyG' && location.pathname !== '/') {
    e.preventDefault();
    location.href = '/';
  }
});
