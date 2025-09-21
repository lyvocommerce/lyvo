// bottomsheet-lock.js (ES module)
// Prevents Telegram BottomSheet from collapsing on scroll/overscroll.
// Allows closing ONLY via explicit call to closeApp().
// All comments in English.

function lockScrollIn(scrollHost) {
  // Avoid iOS rubber-banding which can trigger sheet-dismiss
  let startY = 0;

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
  }

  function onTouchMove(e) {
    if (e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - startY;

    const atTop    = scrollHost.scrollTop <= 0;
    const atBottom = Math.ceil(scrollHost.scrollTop + scrollHost.clientHeight) >= scrollHost.scrollHeight;

    // Prevent rubber-band when pulling down at top or up at bottom
    if ((atTop && dy > 0) || (atBottom && dy < 0)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onWheel(e) {
    const atTop    = scrollHost.scrollTop <= 0;
    const atBottom = Math.ceil(scrollHost.scrollTop + scrollHost.clientHeight) >= scrollHost.scrollHeight;
    const goingUp  = e.deltaY < 0;
    const goingDown= e.deltaY > 0;

    if ((atTop && goingUp) || (atBottom && goingDown)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // Passive:false to allow preventDefault on touchmove/wheel
  scrollHost.addEventListener("touchstart", onTouchStart, { passive: true });
  scrollHost.addEventListener("touchmove",  onTouchMove,  { passive: false });
  scrollHost.addEventListener("wheel",      onWheel,      { passive: false });

  // Keep body from passing overscroll to sheet
  document.documentElement.style.overscrollBehaviorY = "contain";
  document.body.style.overscrollBehaviorY = "contain";
}

/**
 * Initialize BottomSheet protection and closing policy.
 * @param {any} tg - Telegram WebApp object
 * @param {{hostSelector?:string}} opts
 */
export function initBottomSheetLock(tg, { hostSelector = "body" } = {}) {
  try { tg?.expand?.(); } catch {}

  // Do not let user accidentally dismiss the sheet
  tg?.enableClosingConfirmation?.();

  // Hide Telegram back button in header of WebApp
  try { tg?.BackButton?.hide?.(); } catch {}

  // Re-apply expand when viewport changes (Android)
  tg?.onEvent?.("viewportChanged", () => {
    try { tg.expand(); } catch {}
  });

  // Set theme colors if needed (optional safe defaults)
  try {
    tg?.setHeaderColor?.("#ffffff");
    tg?.setBottomBarColor?.("#ffffff");
  } catch {}

  // Lock scroll within chosen host (the element that actually scrolls)
  const host = document.querySelector(hostSelector) || document.body;
  lockScrollIn(host);
}

/**
 * Close Mini App explicitly (for your custom Close button).
 * Will work only when you call it—otherwise the app stays open.
 */
export function closeApp(tg) {
  try {
    tg?.disableClosingConfirmation?.();
    tg?.close?.();
  } catch {
    window.close();
  }
}