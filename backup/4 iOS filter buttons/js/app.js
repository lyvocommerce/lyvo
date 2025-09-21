// public/js/app.js
// Lyvo Mini App — Apple-like light UI + Catalog wiring to backend
// - Telegram WebApp integration (expand)
// - Horizontal category chips inside #chipRow
// - Search, Sort (popup) -> backend query params
// - Products grid with equalized bottom actions (price + cart)
// - Safe image resolution (local mapping + https-only guard + local fallback)
// - Bottom Sheet Filter (multi-select) + client-side fallback filtering with correct pagination
// - Defensive null checks to avoid runtime errors
// - All comments in English

// ---------- Telegram context ----------
const tg = window.Telegram?.WebApp;
try { tg?.expand(); } catch (_) { /* no-op */ }

// ---------- Language (EN-only for now) ----------
const telLang = tg?.initDataUnsafe?.user?.language_code || "";
const lang = (telLang || navigator.language || "en").slice(0, 2).toLowerCase();

// ---------- DOM refs ----------
const API = "https://lyvo-be.onrender.com"; // Render backend base URL

const chipRowInner = document.querySelector("#chipRow .flex");
const gridEl       = document.getElementById("grid");
const searchEl     = document.getElementById("search");
const sortBtn      = document.getElementById("sortBtn");
const prevEl       = document.getElementById("prev");
const nextEl       = document.getElementById("next");
const pageinfoEl   = document.getElementById("pageinfo");

// Bottom sheet filter elements
const filterBtn       = document.getElementById("filterBtn");
const filterSheet     = document.getElementById("filterSheet");
const filterBackdrop  = document.getElementById("filterBackdrop");
const filterOptionsEl = document.getElementById("filterOptions");
const filterApplyBtn  = document.getElementById("filterApply");
const filterClearBtn  = document.getElementById("filterClear");
const filterCloseBtn  = document.getElementById("filterClose");

// ---------- Catalog state ----------
let state = {
  q: "",
  category: "",
  sort: "",           // "", "price_asc", "price_desc", "popular", "newest"
  page: 1,
  page_size: 6,
  total: 0,
  // multi-select filters (keys must match query param names)
  filters: {
    brand: new Set(),       // "apple", "samsung", "xiaomi", "other"
    price: new Set(),       // "0-100", "100-300", "300+"
    rating: new Set(),      // "4+", "4.5+"
  },
};

// ---------- Filter groups config (for bottom sheet) ----------
const FILTER_GROUPS = [
  {
    key: "brand",
    label: "Brand",
    options: [
      { id: "apple",   label: "Apple" },
      { id: "samsung", label: "Samsung" },
      { id: "xiaomi",  label: "Xiaomi" },
      { id: "other",   label: "Other" },
    ],
  },
  {
    key: "price",
    label: "Price",
    options: [
      { id: "0-100",   label: "€0 – €100" },
      { id: "100-300", label: "€100 – €300" },
      { id: "300+",    label: "€300+" },
    ],
  },
  {
    key: "rating",
    label: "Rating",
    options: [
      { id: "4+",   label: "4.0★ +" },
      { id: "4.5+", label: "4.5★ +" },
    ],
  },
];

// ---------- Categories ----------
async function loadCategories() {
  try {
    const res = await fetch(`${API}/categories`);
    const data = await res.json();
    renderCategories(Array.isArray(data.items) ? data.items : []);
  } catch (e) {
    console.error("Failed to load categories:", e);
    renderCategories([]);
  }
}

function renderCategories(items) {
  if (!chipRowInner) return;
  chipRowInner.innerHTML = "";

  const chip = (label, active, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button";
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

  chipRowInner.appendChild(
    chip("All", !state.category, () => {
      state.category = "";
      state.page = 1;
      loadProducts();
      renderCategories(items);
    })
  );

  items.forEach((cat) => {
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

// ---------- Local image map + safe resolution ----------
function normTitle(t) {
  return String(t || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const IMAGE_MAP = {
  "wireless-earbuds": "img/earbuds.jpg",
  "smart-watch": "img/smartwatch.jpg",
  "laptop": "img/laptop.jpg",
  "mechanical-keyboard": "img/keyboard.jpg",
  "dog-bed": "img/dogbed.jpg",
  "automatic-cat-feeder": "img/catfeeder.jpg",
  "hoodie": "img/hoodie.jpg",
  "sneakers": "img/sneakers.jpg",
};
const FALLBACK_IMG = "img/placeholder.jpg";

function isSafeImageUrl(u) {
  if (!u || typeof u !== "string") return false;
  if (u.startsWith("/img/") || u.startsWith("img/")) return true;
  try {
    const url = new URL(u);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
function getImageSrc(p) {
  const key = normTitle(p?.title);
  const mapped = IMAGE_MAP[key];
  if (isSafeImageUrl(mapped)) return mapped;
  const apiImage = p?.image;
  if (isSafeImageUrl(apiImage)) return apiImage;
  return FALLBACK_IMG;
}

// ---------- Products ----------
async function loadProducts() {
  const params = new URLSearchParams();
  if (state.q)        params.set("q", state.q);
  if (state.category) params.set("category", state.category);
  if (state.sort)     params.set("sort", state.sort);

  // add selected filters as query params (backend may ignore)
  const f = state.filters;
  if (f.brand.size)  params.set("brand",  Array.from(f.brand).join(","));
  if (f.price.size)  params.set("price",  Array.from(f.price).join(","));
  if (f.rating.size) params.set("rating", Array.from(f.rating).join(","));

  params.set("page", String(state.page));
  params.set("page_size", String(state.page_size));

  try {
    const res  = await fetch(`${API}/products?` + params.toString());
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    // If backend supports filtering, total will already match.
    // If not, we'll recalc total after client-side filtering.
    let totalFromApi = Number.isFinite(data.total) ? data.total : items.length;

    // Client-side fallback filtering
    const filtered = applyClientFilters(items);

    // If filtering changed the list, fix pagination and total on the client
    const usingClientFilter =
      (f.brand.size || f.price.size || f.rating.size) ? true : false;

    if (usingClientFilter) {
      state.total = filtered.length;
      const start = (state.page - 1) * state.page_size;
      const paged = filtered.slice(start, start + state.page_size);
      renderProducts(paged);
      renderPager();
    } else {
      state.total = totalFromApi;
      renderProducts(items);
      renderPager();
    }
  } catch (e) {
    console.error("Failed to load products:", e);
    state.total = 0;
    renderProducts([]);
    renderPager();
  }
}

function applyClientFilters(items) {
  const f = state.filters;
  if (!f.brand.size && !f.price.size && !f.rating.size) return items;

  const inRange = (val, range) => {
    const num = typeof val === "number" ? val : Number(val);
    if (!Number.isFinite(num)) return false;
    if (range === "0-100")   return num >= 0 && num < 100;
    if (range === "100-300") return num >= 100 && num < 300;
    if (range === "300+")    return num >= 300;
    return true;
  };

  // rating OR logic: if both selected => threshold 4.0; if only 4.5+ => 4.5; if only 4+ => 4.0
  let ratingThreshold = null;
  if (f.rating.size) {
    if (f.rating.has("4.5+") && f.rating.has("4+")) ratingThreshold = 4.0;
    else if (f.rating.has("4.5+")) ratingThreshold = 4.5;
    else if (f.rating.has("4+")) ratingThreshold = 4.0;
  }

  return items.filter(p => {
    // brand
    if (f.brand.size) {
      const brand = (p.brand || "").toString().toLowerCase();
      let ok = false;
      for (const b of f.brand) {
        if (b === "other") {
          if (brand && !["apple","samsung","xiaomi"].includes(brand)) ok = true;
        } else if (brand === b) ok = true;
      }
      if (!ok) return false;
    }
    // price
    if (f.price.size) {
      const price = typeof p.price === "number" ? p.price : Number(p.price);
      let ok = false;
      for (const r of f.price) { if (inRange(price, r)) { ok = true; break; } }
      if (!ok) return false;
    }
    // rating (OR threshold)
    if (ratingThreshold !== null) {
      const r = typeof p.rating === "number" ? p.rating : Number(p.rating || 0);
      if (!(r >= ratingThreshold)) return false;
    }
    return true;
  });
}

function renderProducts(items) {
  if (!gridEl) return;
  gridEl.innerHTML = "";
  if (!items.length) {
    gridEl.innerHTML =
      `<div class="col-span-2 text-center text-[13px] text-[var(--muted)]">No results</div>`;
    return;
  }

  items.forEach((p) => {
    const price  = typeof p.price === "number" ? p.price.toFixed(2) : (p.price || "");
    const imgSrc = getImageSrc(p);

    const card = document.createElement("div");
    card.className =
      "h-full flex flex-col rounded-2xl border border-[var(--border)] overflow-hidden bg-white " +
      "transition-shadow hover:shadow";

    card.innerHTML = `
      <!-- Media -->
      <div class="aspect-[4/3] overflow-hidden bg-[var(--card)] flex items-center justify-center">
        <img src="${imgSrc}" alt="${escapeHtml(p.title)}"
             class="max-w-full max-h-full object-contain opacity-0 transition-opacity duration-200"/>
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
            class="flex items-center justify-center w-10 h-10 rounded-md bg-[var(--accent)] text-white hover:opacity-90 focus-ring"
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
    if (img) {
      img.addEventListener("load", () => { img.style.opacity = "1"; });
      img.addEventListener("error", () => {
        if (img.src.endsWith(FALLBACK_IMG)) { img.style.opacity = "1"; return; }
        img.src = FALLBACK_IMG;
        img.style.opacity = "1";
      });
    }

    const btn = card.querySelector("button");
    if (btn) {
      btn.addEventListener("click", () => {
        const url = p.aff_url || p.url;
        if (!url) return;
        try { tg?.openLink(url, { try_instant_view: false }); }
        catch { window.open(url, "_blank"); }
      });
    }

    gridEl.appendChild(card);
  });
}

// ---------- Pagination ----------
function renderPager() {
  if (!pageinfoEl || !prevEl || !nextEl) return;
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
  if (tg?.showPopup) {
    tg.showPopup({
      title: "Sort by",
      message: "Choose how to sort products",
      buttons: SORT_OPTIONS.map(o => ({ id: o.id, type: "default", text: o.label }))
    });
  } else {
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
if (tg?.onEvent) {
  tg.onEvent("popupClosed", (e) => {
    const id = e?.button_id ?? "";
    if (SORT_OPTIONS.some(o => o.id === id)) {
      state.sort = id;
      state.page = 1;
      loadProducts();
    }
  });
}

// ---------- Bottom Sheet Filter wiring ----------
function renderFilterOptions() {
  if (!filterOptionsEl) return;
  filterOptionsEl.innerHTML = "";

  FILTER_GROUPS.forEach(group => {
    const wrap = document.createElement("div");
    wrap.className = "mb-4";
    wrap.innerHTML = `<h4 class="text-[15px] font-semibold mb-2">${group.label}</h4>`;
    const list = document.createElement("div");
    list.className = "flex flex-wrap gap-2";

    group.options.forEach(opt => {
      const id = `${group.key}__${opt.id}`;
      const label = document.createElement("label");
      label.setAttribute("for", id);
      label.className =
        "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-white text-[14px] cursor-pointer select-none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = id;
      input.className = "accent-[var(--accent)]";
      input.checked = !!state.filters[group.key]?.has(opt.id);
      input.addEventListener("change", () => {
        const set = state.filters[group.key];
        if (!(set instanceof Set)) return;
        if (input.checked) set.add(opt.id);
        else set.delete(opt.id);
      });
      const span = document.createElement("span");
      span.textContent = opt.label;
      label.appendChild(input);
      label.appendChild(span);
      list.appendChild(label);
    });

    wrap.appendChild(list);
    filterOptionsEl.appendChild(wrap);
  });
}

function openFilterSheet() {
  if (!filterSheet || !filterBackdrop) return;
  renderFilterOptions();
  filterSheet.classList.add("animate");
  filterSheet.classList.remove("hidden");
  filterBackdrop.classList.remove("hidden");
  document.documentElement.classList.add("no-scroll");
}
function closeFilterSheet() {
  if (!filterSheet || !filterBackdrop) return;
  filterSheet.classList.add("animate");
  filterSheet.classList.add("hidden");
  filterBackdrop.classList.add("hidden");
  document.documentElement.classList.remove("no-scroll");
}

filterBtn?.addEventListener("click", openFilterSheet);
filterBackdrop?.addEventListener("click", closeFilterSheet);
filterCloseBtn?.addEventListener("click", closeFilterSheet);

filterClearBtn?.addEventListener("click", () => {
  Object.keys(state.filters).forEach(k => {
    if (state.filters[k] instanceof Set) state.filters[k].clear();
  });
  renderFilterOptions();
});

filterApplyBtn?.addEventListener("click", () => {
  state.page = 1;
  closeFilterSheet();
  loadProducts();
});

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