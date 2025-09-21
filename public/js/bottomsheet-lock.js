// public/js/bottomsheet-lock.js
// Prevent Telegram WebApp from collapsing/closing on scroll.
// Keep the app open until user taps explicit Close (or grabber-controlled close if implemented).

const tg = window.Telegram?.WebApp;

try {
  tg?.expand();                     // request full height
  tg?.enableClosingConfirmation();  // confirm before closing
} catch (_) {
  // no-op outside Telegram
}

/**
 * Prevent rubber-band overscroll from reaching Telegram's sheet.
 * Locks scroll within given element.
 * @param {HTMLElement} el - scrollable container
 */
function lockScrollIn(el) {
  if (!el) return;
  let startY = 0;

  el.addEventListener("touchstart", (e) => {
    const t = e.touches && e.touches[0];
    if (t) startY = t.clientY;
  }, { passive: true });

  el.addEventListener("touchmove", (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;

    const scrollTop    = el.scrollTop;
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;

    const atTop    = scrollTop <= 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

    const currentY  = t.clientY;
    const movingDown = currentY > startY;

    // Block scroll-chaining when user hits top or bottom
    if ((atTop && movingDown) || (atBottom && !movingDown)) {
      e.preventDefault();
    }
  }, { passive: false });
}

// Init on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  // Primary scroll host (page)
  const scrollHost =
    document.getElementById("app") ||
    document.querySelector(".container") ||
    document.scrollingElement;

  lockScrollIn(scrollHost);

  // Also lock gestures inside BottomSheet content area
  const filterOptions = document.getElementById("filterOptions");
  if (filterOptions) lockScrollIn(filterOptions);
});

/**
 * Optional helper for custom Close button.
 * Exposed globally for convenience: window.lyvoCloseApp()
 */
function closeApp() {
  try {
    tg?.disableClosingConfirmation?.();
    tg?.close();
  } catch (_) {
    window.close();
  }
}
window.lyvoCloseApp = closeApp;