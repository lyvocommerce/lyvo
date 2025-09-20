// public/js/app.js
// Lyvo Mini App — Apple-like light UI + Catalog wiring to backend
// - Telegram WebApp integration (expand)
// - Horizontal category chips inside #chipRow
// - Search, Sort (popup) -> backend query params
// - Products grid with equalized bottom actions (price + cart)
// - Image fallback + smooth fade-in
// - All comments in English

// ---------- Telegram context ----------
const tg = window.Telegram?.WebApp;
try { tg?.expand(); } catch (_) { /* no-op */ }

// ---------- Language stub (EN-only now) ----------
const telLang = tg?.initDataUnsafe?.user?.language_code || "";
const lang = (telLang || navigator.language || "en").slice(0, 2).toLowerCase();

// ---------- DOM refs ----------
const API = "https://lyvo-be.onrender.com"; // Render backend base URL

const chipRowInner = document.querySelector("#chipRow > .flex"); // host for chips
const gridEl       = document.getElementById("grid");
const searchEl     = document.getElementById("search");
const sortBtn      = document.getElementById("sortBtn");
const prevEl       = document.getElementById("prev");
const nextEl       = document.getElementById("next");
const pageinfoEl   = document.getElementById("pageinfo");

// ---------- Catalog state ----------
let state = {
  q: "",
  category: "",
  sort: "",           // "", "price_asc", "price_desc", "popular", "newest"
  page: 1,
  page_size: 6,
  total: 0
};

// ---------- Categories ----------
async function loadCategories() {
  try {
    const res = await fetch(`${API}/categories`);
    const data = await res.json();
    renderCategories(data.items || []);
  } catch (e) {
    console.error("Failed to load categories:", e);
    renderCategories([]);
  }
}

function renderCategories(items) {
  if (!chipRowInner) return;
  chipRowInner.innerHTML = "";

  // small helper to make a chip button
  const chip = (label, active, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button";
    // 36px height, 16px gap handled by parent flex via gap-4 in HTML
    btn.className = [
      "h-9 px-4 rounded-xl border text-[15px] whitespace-nowrap",
      active
        ? "bg-[var(--text)] border-[var(--text)] text-white"
        : "bg-white border-[var(--border)] hover:bg-neutral-50"
    ].join(" ");
    btn.textContent = label;
    btn.onclick = onClick;
    return btn;
  };

  // "All"
  chipRowInner.appendChild(
    chip("All", !state.category, () => {
      state.category = "";
      state.page = 1;
      loadProducts();
      renderCategories(items);
    })
  );

  // Real categories
  items.forEach(cat => {
    chipRowInner.appendChild(
      chip(cat, state.category === cat, () => {
        state.category = cat;
        state.page = 1;
        loadProducts();
        renderCategories(items);
      })
    );
  });
}

// ---------- Products ----------
async function loadProducts() {
  const params = new URLSearchParams();
  if (state.q)        params.set("q", state.q);
  if (state.category) params.set("category", state.category);
  if (state.sort)     params.set("sort", state.sort);
  params.set("page", String(state.page));
  params.set("page_size", String(state.page_size));

  try {
    const res  = await fetch(`${API}/products?` + params.toString());
    const data = await res.json();
    state.total = data.total || 0;
    renderProducts(data.items || []);
    renderPager();
  } catch (e) {
    console.error("Failed to load products:", e);
    state.total = 0;
    renderProducts([]);
    renderPager();
  }
}

function renderProducts(items) {
  gridEl.innerHTML = "";
  if (!items.length) {
    gridEl.innerHTML =
      `<div class="col-span-2 text-center text-[13px] text-[var(--muted)]">No results</div>`;
    return;
  }

  items.forEach(p => {
    const price  = typeof p.price === "number" ? p.price.toFixed(2) : (p.price || "");
    const imgSrc = p.image || "https://via.placeholder.com/800x600?text=No+Image";

    // Full-height vertical card so bottom actions align across different descriptions
    const card = document.createElement("div");
    card.className =
      "h-full flex flex-col rounded-2xl border border-[var(--border)] overflow-hidden bg-white " +
      "transition-shadow hover:shadow";

    card.innerHTML = `
      <!-- Media -->
      <div class="aspect-[4/3] overflow-hidden bg-[var(--card)]">
        <img src="${imgSrc}" alt="${escapeHtml(p.title)}"
             class="w-full h-full object-cover opacity-0 transition-opacity duration-200"/>
      </div>

      <!-- Body -->
      <div class="flex flex-col p-4 h-full">
        <div>
          <h3 class="text-[15px] font-semibold mb-1 leading-snug">${escapeHtml(p.title)}</h3>
          <p class="text-[13px] text-[var(--muted)] leading-snug">${escapeHtml(p.desc || "")}</p>
        </div>

        <div class="mt-auto pt-3 flex items-center justify-between">
          <span class="font-semibold text-[15px]">${price} ${p.currency || ""}</span>
          <button
            class="flex items-center justify-center w-10 h-10 rounded-md bg-[var(--accent)] text-white " +
                   "hover:opacity-90 focus-ring"
            aria-label="Add to cart">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 stroke-width="2" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M2.25 2.25h1.5l1.5 13.5h13.5l1.5-9H6.75" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="17" cy="20" r="1" />
            </svg>
          </button>
        </div>
      </div>
    `;

    const img = card.querySelector("img");
    img.addEventListener("load", () => { img.style.opacity = "1"; });
    img.addEventListener("error", () => {
      img.src = "https://via.placeholder.com/800x600?text=No+Image";
      img.style.opacity = "1";
    });

    // Cart button => affiliate/product link
    card.querySelector("button").addEventListener("click", () => {
      const url = p.aff_url || p.url;
      if (!url) return;
      try { tg?.openLink(url, { try_instant_view: false }); }
      catch { window.open(url, "_blank"); }
    });

    gridEl.appendChild(card);
  });
}

// ---------- Pagination ----------
function renderPager() {
  const totalPages = Math.max(1, Math.ceil(state.total / state.page_size));
  pageinfoEl.textContent = `Page ${state.page} / ${totalPages}`;
  prevEl.disabled = state.page <= 1;
  nextEl.disabled = state.page >= totalPages;
}
prevEl?.addEventListener("click", () => {
  if (state.page > 1) { state.page--; loadProducts(); }
});
nextEl?.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(state.total / state.page_size));
  if (state.page < totalPages) { state.page++; loadProducts(); }
});

// ---------- Search ----------
let searchTimer = null;
searchEl?.addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = (e.target.value || "").trim();
    state.page = 1;
    loadProducts();
  }, 250);
});

// ---------- Sort (popup in Telegram; prompt fallback) ----------
const SORT_OPTIONS = [
  { id: "",          label: "Default" },
  { id: "price_asc", label: "Price: Low → High" },
  { id: "price_desc",label: "Price: High → Low" },
  { id: "popular",   label: "Popular" },
  { id: "newest",    label: "Newest" },
];

sortBtn?.addEventListener("click", () => {
  // In Telegram — native popup with buttons and button_id callback
  if (tg?.showPopup) {
    tg.showPopup({
      title: "Sort by",
      message: "Choose how to sort products",
      buttons: SORT_OPTIONS.map(o => ({ id: o.id, type: "default", text: o.label }))
    });
  } else {
    // Outside Telegram — simple prompt fallback
    const labels = SORT_OPTIONS.map((o, i) => `${i}: ${o.label}`).join("\n");
    const pick = window.prompt(`Sort by:\n${labels}\n\nEnter index (0-${SORT_OPTIONS.length - 1})`, "0");
    const idx = Number(pick);
    if (!Number.isNaN(idx) && idx >= 0 && idx < SORT_OPTIONS.length) {
      state.sort = SORT_OPTIONS[idx].id;
      state.page = 1;
      loadProducts();
    }
  }
});

// Telegram popup callback
if (tg?.onEvent) {
  tg.onEvent("popupClosed", (e) => {
    const id = e?.button_id ?? "";
    // If user tapped a button with id present in our options
    if (SORT_OPTIONS.some(o => o.id === id)) {
      state.sort = id;
      state.page = 1;
      loadProducts();
    }
  });
}

// ---------- Helpers ----------
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Boot ----------
loadCategories();
loadProducts();