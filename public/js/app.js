// public/js/app.js
// Lyvo Mini App — Apple-like light UI + Catalog wiring to backend
// - Telegram WebApp integration (expand, openLink, sendData)
// - Optional welcome banner via start_param / ?startapp=welcome
// - Categories, filters, products grid, pagination
// - Image fallback + smooth fade-in
// - All comments in English

// ---------- Telegram context ----------
const tg = window.Telegram?.WebApp;
try { tg?.expand(); } catch (_) { /* no-op */ }

// ---------- Language (kept for future i18n, EN-only for now) ----------
const telLang = tg?.initDataUnsafe?.user?.language_code || "";
const lang = (telLang || navigator.language || "en").slice(0, 2).toLowerCase();

// ---------- Welcome banner (only if deep-linked) ----------
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

// ---------- Hero buttons wiring (index.html binds ids) ----------
const heroOpenBtn = document.getElementById("openBtnHero");
const heroTestBtn = document.getElementById("testEventHero");
const openChatTop = document.getElementById("openChatTop");

heroOpenBtn?.addEventListener("click", () => {
  const url = "https://lyvo.vercel.app";
  try { tg?.openLink(url, { try_instant_view: false }); }
  catch { window.open(url, "_blank"); }
});

heroTestBtn?.addEventListener("click", () => {
  try {
    tg?.sendData(JSON.stringify({ event: "demo_click", ts: Date.now(), lang }));
    tg?.showPopup({ title: "Sent", message: "Event sent to bot", buttons: [{ type: "close" }] });
  } catch (e) {
    console.warn("sendData failed:", e);
  }
});

openChatTop?.addEventListener("click", (e) => {
  e.preventDefault();
  const url = "https://t.me/LyvoShopBot?start=welcome";
  try { tg?.openLink(url); } catch { window.open(url, "_blank"); }
});

// ---------- Catalog state & elements ----------
const API = "https://lyvo-be.onrender.com"; // Render backend base URL

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
  catsEl.innerHTML = "";

  // Apple-like segmented buttons (simple version)
  const mk = (label, active, onClick) => {
    const btn = document.createElement("button");
    btn.className =
      "px-3 py-1 rounded-md border border-[var(--border)] bg-white text-[14px] " +
      (active ? "shadow-sm" : "hover:bg-[var(--card)]");
    btn.textContent = label;
    btn.onclick = onClick;
    return btn;
  };

  catsEl.appendChild(
    mk("All", !state.category, () => {
      state.category = "";
      state.page = 1;
      loadProducts();
      renderCategories(items);
    })
  );

  items.forEach((cat) => {
    catsEl.appendChild(
      mk(cat, state.category === cat, () => {
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
    gridEl.innerHTML =
      `<div class="col-span-2 text-center text-[13px] text-[var(--muted)]">
         No results
       </div>`;
    return;
  }

  items.forEach((p) => {
    const price = typeof p.price === "number" ? p.price.toFixed(2) : (p.price || "");
    const imgSrc = p.image || "https://via.placeholder.com/800x600?text=No+Image";

    const card = document.createElement("div");
    card.className =
      "rounded-2xl border border-[var(--border)] overflow-hidden bg-white transition-shadow hover:shadow";

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
          <button
            class="flex items-center justify-center w-10 h-10 rounded-md bg-[var(--accent)]
                   text-white hover:opacity-90 focus-ring"
            aria-label="Add to cart">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 stroke-width="2" stroke="currentColor"
                 class="w-5 h-5">
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

    // Click → open product / affiliate URL
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

// ---------- Search & Sort ----------
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