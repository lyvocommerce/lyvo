// public/js/bottomsheet-lock.js
// Lock swipe-to-close globally, but allow closing the Bottom Sheet by dragging ONLY the grabber.

(function () {
  const sheet    = document.getElementById("filterSheet");
  const backdrop = document.getElementById("filterBackdrop");
  const content  = document.getElementById("filterOptions");
  const grabber  = document.getElementById("sheetGrabber");
  if (!sheet || !backdrop) return;

  const tg = window.Telegram?.WebApp;
  try { tg?.enableClosingConfirmation(); } catch (_) {}

  // ---------- open/close helpers (экспортируем на window) ----------
  function openSheet() {
    sheet.classList.remove("hidden");
    backdrop.classList.remove("hidden");
    document.documentElement.classList.add("no-scroll");
    sheet.style.transform = "translateY(0)";
  }
  function closeSheet() {
    sheet.classList.add("hidden");
    backdrop.classList.add("hidden");
    document.documentElement.classList.remove("no-scroll");
    sheet.style.transform = "translateY(0)";
  }
  window.lyvoOpenSheet  = openSheet;
  window.lyvoCloseSheet = closeSheet;

  // ---------- Блокировка нежелательных жестов вне контента ----------
  let startY = 0;
  const opts = { passive: false };

  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (t) startY = t.clientY;
  };

  const preventAll = (e) => {
    // Разрешаем скролл только в пределах контента и только когда он реально может скроллиться
    if (content && content.contains(e.target)) {
      if (allowScrollWithinContent(e)) return;
    }
    e.preventDefault();
  };

  function allowScrollWithinContent(e) {
    if (e.type !== "touchmove") return false;
    const t = e.touches?.[0];
    if (!t) return false;

    const dy = t.clientY - startY;
    const atTop    = content.scrollTop <= 0;
    const atBottom = Math.ceil(content.scrollTop + content.clientHeight) >= content.scrollHeight;

    if (dy > 0 && atTop)    return false; // вниз на самом верху → блок
    if (dy < 0 && atBottom) return false; // вверх в самом низу → блок
    return true;
  }

  // Включаем/выключаем перехват, когда лист открыт/закрыт
  const observer = new MutationObserver(() => {
    const open = !sheet.classList.contains("hidden");
    if (open) {
      document.addEventListener("touchstart", onTouchStart, opts);
      document.addEventListener("touchmove",  preventAll,  opts);
      backdrop.addEventListener("touchmove",  preventAll,  opts);
    } else {
      document.removeEventListener("touchstart", onTouchStart, opts);
      document.removeEventListener("touchmove",  preventAll,  opts);
      backdrop.removeEventListener("touchmove",  preventAll,  opts);
    }
  });
  observer.observe(sheet, { attributes: true, attributeFilter: ["class"] });

  // Wheel — не отдаём резиновый скролл за пределы контента
  document.addEventListener("wheel", (e) => {
    const open = !sheet.classList.contains("hidden");
    if (!open) return;
    if (content && content.contains(e.target)) {
      const atTop    = content.scrollTop <= 0;
      const atBottom = Math.ceil(content.scrollTop + content.clientHeight) >= content.scrollHeight;
      const up = e.deltaY < 0, down = e.deltaY > 0;
      if ((up && atTop) || (down && atBottom)) e.preventDefault();
      return;
    }
    e.preventDefault();
  }, { passive: false });

  // ---------- Grabber drag: закрыть шит свайпом за "полоску" ----------
  if (grabber) {
    let dragging = false;
    let dragStartY = 0;
    let currentY = 0;
    const THRESHOLD = 80; // px — после этого считаем «закрыть»

    const startDrag = (y) => {
      dragging = true;
      dragStartY = y;
      currentY = 0;
      sheet.classList.remove("animate");
      sheet.style.transition = "none";
    };
    const moveDrag = (y) => {
      if (!dragging) return;
      const dy = Math.max(0, y - dragStartY); // только вниз
      currentY = dy;
      sheet.style.transform = `translateY(${dy}px)`;
    };
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      sheet.classList.add("animate");
      sheet.style.transition = ""; // вернём CSS transition

      if (currentY > THRESHOLD) {
        // плавно уводим вниз и скрываем
        sheet.style.transform = `translateY(100%)`;
        setTimeout(closeSheet, 160);
      } else {
        // возвращаем в исходное
        sheet.style.transform = "translateY(0)";
      }
    };

    // touch
    grabber.addEventListener("touchstart", (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      e.preventDefault(); // чтобы WebView не начал жест закрытия
      startDrag(t.clientY);
    }, opts);

    grabber.addEventListener("touchmove", (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      e.preventDefault();
      moveDrag(t.clientY);
    }, opts);

    grabber.addEventListener("touchend", (e) => {
      e.preventDefault();
      endDrag();
    });

    // поддержка мышью (для десктопа/отладки)
    grabber.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startDrag(e.clientY);
      const onMove = (ev) => { moveDrag(ev.clientY); };
      const onUp   = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        endDrag();
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup",   onUp);
    });
  }
})();