// app.js — Lyvo Mini App UI logic
// - Reads user language from Telegram (fallback to navigator.language)
// - Loads categories and products from backend
// - Renders filters, grid and pagination
// - All comments are in English

// --- Telegram WebApp context ---
const tg = window.Telegram?.WebApp;
try { tg?.expand(); } catch (_) { /* no-op */ }

// --- Language (kept for future i18n; not used for translation yet) ---
const telLang = tg?.initDataUnsafe?.user?.language_code || "";
const lang = (telLang || navigator.language || "en").slice(0, 2).toLowerCase();

// --- Optional welcome banner if started via ?startapp=welcome ---
const params = new URLSearchParams(window.location.search);
const startParam = tg?.initDataUnsafe?.start_param || params.get("startapp") || "";
const banner = document.getElementById("welcome-banner");
const openChatBtn = document.getElementById("open-chat");
const dismissBtn = document.getElementById("dismiss");
const SEEN_KEY = "lyvo_seen_welcome";
if (startParam && !localStorage.getItem(SEEN_KEY)) {
  banner?.classList.remove("hidden");
}
dismissBtn?.addEventListener("click", () => {
  banner?.classList.add("hidden");
  localStorage.setItem(SEEN_KEY, "1");
});
openChatBtn?.addEventListener("click", () => {
  const url = "https://t.me/LyvoShopBot?start=welcome";
  try { tg?.openLink(url); } catch { window.open(url, "_blank"); }
});

// --- Catalog state & elements ---
const API = "https://lyvo-be.onrender.com"; // your Render backend
let state = {
  q: "",
  category: "",
  sort: "",
  page: 1,
  page_size: 6,
  total: 0
};

const catsEl = document.getElementById("cats");
const gridEl = document.getElementById("grid");
const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort");
const prevEl = document.getElementById("prev");
const nextEl = document.getElementById("next");
const pageinfoEl = document.getElementById("pageinfo");

// --- Load & render categories ---
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
  catsEl.innerHTML = "";
  const makeBtn = (label, isActive, onClick) => {
    const btn = document.createElement("button");
    btn.className =
      "px-3 py-1 rounded border border-slate-700 " + (isActive ? "bg-slate-800" : "");
    btn.textContent = label;
    btn.onclick = onClick;
    return btn;
  };
  catsEl.appendChild(
    makeBtn("All", !state.category, () => {
      state.category = "";
      state.page = 1;
      loadProducts();
      renderCategories(items);
    })
  );
  items.forEach((cat) => {
    catsEl.appendChild(
      makeBtn(cat, state.category === cat, () => {
        state.category = cat;
        state.page = 1;
        loadProducts();
        renderCategories(items);
      })
    );
  });
}

// --- Load & render products ---
async function loadProducts() {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.category) params.set("category", state.category);
  if (state.sort) params.set("sort", state.sort);
  params.set("page", String(state.page));
  params.set("page_size", String(state.page_size));

  try {
    const res = await fetch(`${API}/products?` + params.toString());
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
    gridEl.innerHTML = `<div class="col-span-2 text-sm text-slate-400">No results</div>`;
    return;
  }
  items.forEach((p) => {
    const price =
      typeof p.price === "number" ? p.price.toFixed(2) : (p.price || "");
    const card = document.createElement("div");
    card.className = "rounded-xl border border-slate-700 overflow-hidden bg-slate-900";
    card.innerHTML = `
      <div class="aspect-[4/3] overflow-hidden">
        <img src="${p.image}" alt="${escapeHtml(p.title)}" class="w-full h-full object-cover"/>
      </div>
      <div class="p-3">
        <div class="text-sm font-semibold mb-1 line-clamp-2">${escapeHtml(p.title)}</div>
        <div class="text-sm text-slate-300 mb-2 line-clamp-2">${escapeHtml(p.desc || "")}</div>
        <div class="flex items-center justify-between">
          <div class="font-semibold">${price} ${p.currency || ""}</div>
          <button class="px-3 py-1 rounded border border-slate-700">View</button>
        </div>
      </div>
    `;
    const btn = card.querySelector("button");
    btn.addEventListener("click", () => {
      const url = p.aff_url || p.url;
      if (!url) return;
      try { tg?.openLink(url, { try_instant_view: false }); }
      catch { window.open(url, "_blank"); }
    });
    gridEl.appendChild(card);
  });
}

// --- Pagination ---
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

// --- Search & Sort handlers ---
let searchTimer = null;
searchEl?.addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = (e.target.value || "").trim();
    state.page = 1;
    loadProducts();
  }, 300);
});
sortEl?.addEventListener("change", (e) => {
  state.sort = e.target.value || "";
  state.page = 1;
  loadProducts();
});

// --- Helpers ---
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --- Boot ---
loadCategories();
loadProducts();

// (Optional) keep your previous "Send test event" code below if you still use it.