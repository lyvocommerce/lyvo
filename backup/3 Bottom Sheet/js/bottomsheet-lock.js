// bottomsheet-lock.js
// Prevent Telegram WebApp bottom sheet from collapsing on scroll.
// Keeps the app open until user taps an explicit Close button.

// ---------- Telegram WebApp ----------
const tg = window.Telegram?.WebApp;

try {
  tg?.expand();                     // request full height
  tg?.enableClosingConfirmation();  // show confirm dialog before closing
} catch (_) {
  // no-op if not inside Telegram
}

/**
 * Prevent rubber-band overscroll from reaching Telegram's sheet.
 * @param {HTMLElement} el - scrollable container
 */
function lockScrollIn(el) {
  if (!el) return;
  let startY = 0;

  el.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length) {
      startY = e.touches[0].clientY;
    }
  }, { passive: true });

  el.addEventListener("touchmove", (e) => {
    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight;
    const offsetHeight = el.offsetHeight;
    const atTop = scrollTop <= 0;
    const atBottom = scrollTop + offsetHeight >= scrollHeight;
    const currentY = e.touches[0].clientY;
    const movingDown = currentY > startY;

    // Block scroll-chaining when user hits top or bottom
    if ((atTop && movingDown) || (atBottom && !movingDown)) {
      e.preventDefault();
    }
  }, { passive: false });
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  const scrollHost =
    document.getElementById("app") ||
    document.querySelector(".container") ||
    document.scrollingElement;

  lockScrollIn(scrollHost);
});

// ---------- Optional helper for custom Close button ----------
export function closeApp() {
  try {
    tg?.disableClosingConfirmation?.();
    tg?.close();
  } catch (_) {
    window.close();
  }
}