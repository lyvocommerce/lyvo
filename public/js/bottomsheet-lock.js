// public/js/bottomsheet-lock.js
// Keep BottomSheet open while allowing normal in-content scrolling.
// Works by preventing only those gestures that would dismiss the sheet.
// Comments are in English by request.

let tgRef = null;
let host = null;
let startY = 0;

function canScroll(el) {
  if (!el) return false;
  return el.scrollHeight > el.clientHeight + 1;
}
function atTop(el) {
  return el.scrollTop <= 0;
}
function atBottom(el) {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
}

function onTouchStart(e) {
  if (!host) return;
  // remember finger position
  startY = (e.touches && e.touches[0] ? e.touches[0].clientY : 0) || 0;
}

function onTouchMove(e) {
  if (!host) return;
  if (!canScroll(host)) {
    // no scrollable content → block vertical drag to avoid sheet close
    e.preventDefault();
    return;
  }
  const y = e.touches && e.touches[0] ? e.touches[0].clientY : 0;
  const dy = y - startY;

  // Dragging down at top? block. Dragging up at bottom? block.
  if ((atTop(host) && dy > 0) || (atBottom(host) && dy < 0)) {
    e.preventDefault(); // stop “rubber band” → prevents sheet collapse
  }
  // else let the browser scroll normally
}

function onWheel(e) {
  if (!host) return;
  if (!canScroll(host)) {
    e.preventDefault();
    return;
  }
  const dy = e.deltaY || 0;
  if ((atTop(host) && dy < 0) || (atBottom(host) && dy > 0)) {
    e.preventDefault(); // don’t bubble an edge-overscroll to the sheet
  }
}

export function initBottomSheetLock(tg, opts = {}) {
  tgRef = tg || null;

  // Try to keep the sheet expanded and ask for explicit confirmation on close.
  try {
    tgRef?.expand();
    tgRef?.enableClosingConfirmation();
  } catch (_) {}

  const selector = opts.hostSelector || "body";
  host = document.querySelector(selector) || document.body;

  // Safe defaults for mobile scroll behavior.
  // (Add the CSS equivalents as well if you maintain a stylesheet.)
  host.style.overscrollBehaviorY = "contain";
  document.documentElement.style.overscrollBehaviorY = "contain";
  document.body.style.overscrollBehaviorY = "contain";
  document.body.style.webkitOverflowScrolling = "touch";

  // Register listeners: touch listeners MUST be {passive:false} to allow preventDefault.
  host.addEventListener("touchstart", onTouchStart, { passive: true });
  host.addEventListener("touchmove", onTouchMove, { passive: false });
  host.addEventListener("wheel", onWheel, { passive: false });

  // Cleanup on hot-reload or navigation
  window.addEventListener("beforeunload", () => {
    host.removeEventListener("touchstart", onTouchStart);
    host.removeEventListener("touchmove", onTouchMove);
    host.removeEventListener("wheel", onWheel);
    try { tgRef?.disableClosingConfirmation(); } catch (_) {}
  });
}

// Optional helper for your custom Close button
export function closeApp(tg) {
  try { tg?.disableClosingConfirmation(); } catch (_) {}
  try { tg?.close(); } catch (_) {}
  try { window.close(); } catch (_) {}
}