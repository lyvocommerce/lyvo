// public/js/bottomsheet-lock.js
// Prevent Telegram WebApp from closing on swipe-down while Bottom Sheet is open.
// Allow scrolling only inside the sheet content. Close sheet only via "Close" button.

(function () {
  const sheet     = document.getElementById("filterSheet");
  const backdrop  = document.getElementById("filterBackdrop");
  const content   = document.getElementById("filterOptions"); // scrollable area

  if (!sheet || !backdrop) return;

  // If available, ask Telegram to confirm before closing the WebApp.
  const tg = window.Telegram?.WebApp;
  try { tg?.enableClosingConfirmation(); } catch (_) {}

  // -------- CSS-side guard (also add CSS in custom.css below) --------
  // html/body overscroll is disabled via CSS to avoid "rubber-banding".
  // Here we additionally eat touch events on the sheet container & backdrop.

  let startY = 0;

  const preventAll = (e) => {
    // If event came from scrollable content and it CAN scroll in this direction, allow.
    if (content && content.contains(e.target)) {
      if (allowScrollWithinContent(e)) return; // let it bubble
    }
    // Block default to prevent WebView from interpreting a swipe to close.
    e.preventDefault();
  };

  function allowScrollWithinContent(e) {
    if (!content) return false;
    if (e.type !== "touchmove") return false;

    const touch = e.touches && e.touches[0];
    if (!touch) return false;

    const currentY = touch.clientY;
    const deltaY = currentY - startY;

    const atTop    = content.scrollTop <= 0;
    const atBottom = Math.ceil(content.scrollTop + content.clientHeight) >= content.scrollHeight;

    // Scrolling down (deltaY > 0) when at top -> would rubber-band -> block
    if (deltaY > 0 && atTop)  return false;
    // Scrolling up (deltaY < 0) when at bottom -> would rubber-band -> block
    if (deltaY < 0 && atBottom) return false;

    // Otherwise allow natural scroll inside content
    return true;
  }

  // Attach listeners with {passive:false} so we can preventDefault
  const opts = { passive: false };

  // On touchstart, record position
  const onStart = (e) => {
    const t = e.touches && e.touches[0];
    if (t) startY = t.clientY;
  };

  // Eat all moves on backdrop & sheet (header/body); content may pass through if scrollable
  const onMove = (e) => preventAll(e);

  // Enable locks when sheet is shown (we toggle hidden class in app.js)
  const observer = new MutationObserver(() => {
    const isOpen = !sheet.classList.contains("hidden");
    if (isOpen) {
      document.addEventListener("touchstart", onStart, opts);
      document.addEventListener("touchmove", onMove,  opts);
      // Also block the backdrop entirely (no swipe to close)
      backdrop.addEventListener("touchmove", preventAll, opts);
    } else {
      document.removeEventListener("touchstart", onStart, opts);
      document.removeEventListener("touchmove",  onMove,  opts);
      backdrop.removeEventListener("touchmove", preventAll, opts);
    }
  });
  observer.observe(sheet, { attributes: true, attributeFilter: ["class"] });

  // Safety: also block wheel events from bubbling to the page when open
  const onWheel = (e) => {
    const isOpen = !sheet.classList.contains("hidden");
    if (!isOpen) return;

    if (content && content.contains(e.target)) {
      const atTop    = content.scrollTop <= 0;
      const atBottom = Math.ceil(content.scrollTop + content.clientHeight) >= content.scrollHeight;
      const goingUp  = e.deltaY < 0;
      const goingDown= e.deltaY > 0;
      // Prevent rubber band via wheel too
      if ((goingUp && atTop) || (goingDown && atBottom)) {
        e.preventDefault();
        return;
      }
      // else allow
      return;
    }
    // Non-content area: block
    e.preventDefault();
  };
  document.addEventListener("wheel", onWheel, { passive: false });
})();