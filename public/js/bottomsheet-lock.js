// public/js/bottomsheet-lock.js
// Robust scroll locking for Telegram WebApp (iOS-safe)
// - Prevents scroll-chaining to Telegram's sheet
// - Page never scrolls (only #app does)
// - BottomSheet can be closed by dragging the grabber, not the whole app

window.Telegram?.WebApp?.expand();
window.Telegram?.WebApp?.enableClosingConfirmation();

try {
  tg?.expand();                     // ask for full height
  tg?.enableClosingConfirmation();  // confirm before closing app
} catch (_) {
  // noop outside Telegram
}

/* Find the closest vertically scrollable ancestor */
function findScrollable(el) {
  let node = el;
  while (node && node !== document.documentElement) {
    const sh = node.scrollHeight;
    const ch = node.clientHeight;
    if (sh && ch && sh > ch) return node;
    node = node.parentElement;
  }
  return null;
}

/* Global scroll-chain blocker (captures touchmove before browser) */
(function attachGlobalScrollLock() {
  let startY = 0;
  let scroller = null;

  document.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      startY = t.clientY;

      // Prefer #filterOptions if inside sheet; else nearest scrollable
      const sheetOptions = document.getElementById("filterOptions");
      if (sheetOptions && sheetOptions.contains(e.target)) {
        scroller = sheetOptions;
      } else {
        scroller = findScrollable(e.target) || document.getElementById("app");
      }
    },
    { passive: true, capture: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;

      // If no scroller — block (avoid handing control to Telegram's sheet)
      if (!scroller) {
        e.preventDefault();
        return;
      }

      const st = scroller.scrollTop;
      const ch = scroller.clientHeight;
      const sh = scroller.scrollHeight;

      const dy = t.clientY - startY;
      const movingDown = dy > 0;

      const atTop = st <= 0;
      const atBottom = st + ch >= sh - 1;

      // Block scroll-chaining at edges
      if ((atTop && movingDown) || (atBottom && !movingDown)) {
        e.preventDefault();
      }
    },
    { passive: false, capture: true }
  );

  // Prevent pinch-zoom gesture on iOS
  window.addEventListener(
    "gesturestart",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );
})();

/* BottomSheet drag-to-close only via the grabber */
(function attachBottomSheetDrag() {
  const sheet = document.getElementById("filterSheet");
  const grab  = document.getElementById("sheetGrabber");
  const closeBtn = document.getElementById("filterClose");

  if (!sheet || !grab) return;

  let dragging = false;
  let startY = 0;
  let currentY = 0;

  const setTranslate = (y) => {
    sheet.style.transform = `translateY(${Math.max(0, y)}px)`;
  };

  const endDrag = () => {
    dragging = false;
    sheet.style.transition = ""; // restore transitions
    // If dragged far enough — close sheet; else snap back
    if (currentY > 120) {
      // simulate Close
      closeBtn?.click();
      // reset transform after closing to avoid flicker next open
      requestAnimationFrame(() => setTranslate(0));
    } else {
      setTranslate(0);
    }
  };

  const onStart = (y) => {
    dragging = true;
    startY = y;
    currentY = 0;
    // Disable transitions while dragging
    sheet.style.transition = "none";
  };
  const onMove = (y) => {
    if (!dragging) return;
    currentY = y - startY;
    if (currentY < 0) currentY = 0;
    setTranslate(currentY);
  };

  // Touch events
  grab.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      onStart(t.clientY);
    },
    { passive: true }
  );
  grab.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      onMove(t.clientY);
      e.preventDefault(); // do not pass drag to Telegram sheet
    },
    { passive: false }
  );
  grab.addEventListener(
    "touchend",
    () => {
      endDrag();
    },
    { passive: true }
  );

  // Mouse (desktop dev)
  grab.addEventListener("mousedown", (e) => {
    onStart(e.clientY);
    const onMouseMove = (me) => {
      onMove(me.clientY);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("mouseup", onMouseUp, true);
      endDrag();
    };
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseup", onMouseUp, true);
  });
})();

/* Optional helper to close the app explicitly */
function closeApp() {
  try {
    tg?.disableClosingConfirmation?.();
    tg?.close();
  } catch (_) {
    window.close();
  }
}
window.lyvoCloseApp = closeApp;