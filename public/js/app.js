function renderProducts(items) {
  gridEl.innerHTML = "";
  if (!items.length) {
    gridEl.innerHTML = `<div class="col-span-2 text-center text-[13px] text-[var(--muted)]">No results</div>`;
    return;
  }

  items.forEach((p) => {
    const price = typeof p.price === "number" ? p.price.toFixed(2) : (p.price || "");
    const imgSrc = p.image || "https://via.placeholder.com/800x600?text=No+Image";

    const card = document.createElement("div");
    card.className = "rounded-2xl border border-[var(--border)] overflow-hidden bg-white transition-shadow hover:shadow";

    card.innerHTML = `
      <div class="aspect-[4/3] overflow-hidden bg-[var(--card)]">
        <img src="${imgSrc}" alt="${escapeHtml(p.title)}"
             class="w-full h-full object-cover opacity-0 transition-opacity duration-200"/>
      </div>
      <div class="p-4">
        <h3 class="text-[15px] font-semibold mb-1 leading-snug">${escapeHtml(p.title)}</h3>
        <p class="text-[13px] text-[var(--muted)] mb-3 leading-snug">${escapeHtml(p.desc || "")}</p>
        <div class="flex items-center justify-between">
          <span class="font-semibold text-[15px]">${price} ${p.currency || ""}</span>
          <button class="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-[14px] font-medium hover:opacity-90 focus-ring">
            View
          </button>
        </div>
      </div>
    `;

    // Image fade-in + fallback
    const img = card.querySelector("img");
    img.addEventListener("load", () => { img.style.opacity = "1"; });
    img.addEventListener("error", () => {
      img.src = "https://via.placeholder.com/800x600?text=No+Image";
      img.style.opacity = "1";
    });

    // View button
    card.querySelector("button").addEventListener("click", () => {
      const url = p.aff_url || p.url;
      if (!url) return;
      try { tg?.openLink(url, { try_instant_view: false }); }
      catch { window.open(url, "_blank"); }
    });

    gridEl.appendChild(card);
  });
}