// Lyvo Mini App — sticky header with collapsible chips, active tokens and multi-category filters

const tg = window.Telegram?.WebApp;
try { tg?.expand(); } catch (_) {}

const API = "https://lyvo-be.onrender.com";

const toolbar       = document.getElementById("toolbar");
const container     = document.querySelector(".container");
const chipRowInner  = document.querySelector("#chipRow .flex");
const activeChipsEl = document.getElementById("activeChips");
const gridEl        = document.getElementById("grid");
const searchEl      = document.getElementById("search");
const prevEl        = document.getElementById("prev");
const nextEl        = document.getElementById("next");
const pageinfoEl    = document.getElementById("pageinfo");

const filterBtn       = document.getElementById("filterBtn");
const filterSheet     = document.getElementById("filterSheet");
const filterBackdrop  = document.getElementById("filterBackdrop");
const filterOptionsEl = document.getElementById("filterOptions");
const filterApplyBtn  = document.getElementById("filterApply");
const filterClearBtn  = document.getElementById("filterClear");
const filterCloseBtn  = document.getElementById("filterClose");

// ---- State ----
let loadedCategories = []; // cache for filter sheet
let state = {
  q: "",
  sort: "",
  page: 1,
  page_size: 6,
  total: 0,
  filters: {
    // Multi-select categories (this replaces old single `category`)
    category: new Set(),
    brand: new Set(),
    price: new Set(),
    rating: new Set(),
  },
};

// ---- Utils ----
const FALLBACK_IMG = "img/placeholder.jpg";
const IMAGE_MAP = {
  "wireless-earbuds": "img/earbuds.jpg",
  "smart-watch": "img/smartwatch.jpg",
  "laptop": "img/laptop.jpg",
  "mechanical-keyboard": "img/keyboard.jpg",
  "dog-bed": "img/dogbed.jpg",
  "automatic-cat-feeder": "img/catfeeder.jpg",
  "hoodie": "img/hoodie.jpg",
  "sneakers": "img/sneakers.jpg",

  // NEW mappings for your current demo titles:
  "running-shoes": "img/running-shoes.jpg",
  "yoga-mat": "img/yoga-mat.jpg",
  "t-shirt": "img/tshirt.jpg",
  "denim-jacket": "img/denim-jacket.jpg",
  "coffee-maker": "img/coffee-maker.jpg",
  "vacuum-cleaner": "img/vacuum-cleaner.jpg",
};

const norm = s => String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
const isHttpsOrLocal = u => {
  if (!u) return false;
  if (u.startsWith("/img/") || u.startsWith("img/")) return true;
  try { return new URL(u).protocol === "https:"; } catch { return false; }
};
const imgSrc = p => {
  const m = IMAGE_MAP[norm(p?.title)];
  if (isHttpsOrLocal(m)) return m;
  if (isHttpsOrLocal(p?.image)) return p.image;
  return FALLBACK_IMG;
};
const escapeHtml = s => String(s)
  .replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;")
  .replaceAll("'","&#039;");

// ---- Sticky chips collapse on scroll ----
(function initCollapseOnScroll(){
  if (!toolbar || !container) return;
  let last = 0;
  container.addEventListener("scroll", () => {
    const y = container.scrollTop;
    // Collapse whenever scrolled more than 24px from top
    if (y > 24) toolbar.classList.add("chips-collapsed");
    else        toolbar.classList.remove("chips-collapsed");
    last = y;
  }, { passive:true });
})();

// ---- Categories ----
async function loadCategories() {
  try {
    const res = await fetch(`${API}/categories`);
    const data = await res.json();
    loadedCategories = Array.isArray(data.items) ? data.items : [];
    renderChips(loadedCategories);
  } catch (e) {
    console.warn("categories failed", e);
    loadedCategories = [];
    renderChips([]);
  }
}

function renderChips(items) {
  if (!chipRowInner) return;
  chipRowInner.innerHTML = "";

  // "All" toggles everything off
  chipRowInner.appendChild(makeChip("All", state.filters.category.size === 0, () => {
    state.filters.category.clear();
    updateActiveChips();
    state.page = 1;
    loadProducts();
    renderChips(items);
  }));

  items.forEach(cat => {
    const id = norm(cat);
    chipRowInner.appendChild(makeChip(cat, state.filters.category.has(id), () => {
      // toggle
      if (state.filters.category.has(id)) state.filters.category.delete(id);
      else state.filters.category.add(id);
      updateActiveChips();
      state.page = 1;
      loadProducts();
      renderChips(items);
    }));
  });

  updateActiveChips();
}

function makeChip(label, active, onClick){
  const b = document.createElement("button");
  b.type = "button";
  b.className = [
    "h-9 px-4 rounded-xl border text-[15px] whitespace-nowrap",
    active ? "bg-[var(--text)] border-[var(--text)] text-white"
           : "bg-white border-[var(--border)] hover:bg-neutral-50"
  ].join(" ");
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

// ---- Active tokens row in header ----
function updateActiveChips(){
  if (!activeChipsEl) return;
  activeChipsEl.innerHTML = "";
  const cats = Array.from(state.filters.category);
  if (!cats.length) return;

  cats.forEach(id => {
    const label = (loadedCategories.find(c => norm(c) === id) || id);
    const tag = document.createElement("button");
    tag.type = "button";
    tag.className =
      "px-3 py-1.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-[13px] flex items-center gap-2";
    tag.innerHTML = `<span>${escapeHtml(label)}</span>
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/>
      </svg>`;
    tag.onclick = () => {
      state.filters.category.delete(id);
      updateActiveChips();
      renderChips(loadedCategories);
      state.page = 1;
      loadProducts();
    };
    activeChipsEl.appendChild(tag);
  });
}

// ---- Products ----
async function loadProducts() {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.sort) params.set("sort", state.sort);

  const cats = Array.from(state.filters.category);
  if (cats.length) params.set("category", cats.join(","));

  // (other filters can be added similarly)
  params.set("page", String(state.page));
  params.set("page_size", String(state.page_size));

  try {
    const res = await fetch(`${API}/products?` + params.toString());
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    // Fallback: if backend ignores categories, filter client-side
    const filtered = cats.length ? items.filter(p => cats.includes(norm(p.category || ""))) : items;
    state.total = Number.isFinite(data.total) ? data.total : filtered.length;
    renderProducts(filtered);
    renderPager();
  } catch (e) {
    console.error("products failed", e);
    state.total = 0;
    renderProducts([]);
    renderPager();
  }
}

function renderProducts(items){
  gridEl.innerHTML = "";
  if (!items.length){
    gridEl.innerHTML = `<div class="col-span-2 text-center text-[13px] text-[var(--muted)]">No results</div>`;
    return;
  }
  items.forEach(p => {
    const price = typeof p.price === "number" ? p.price.toFixed(2) : (p.price || "");
    const card = document.createElement("div");
    card.className = "h-full flex flex-col rounded-2xl border border-[var(--border)] overflow-hidden bg-white hover:shadow transition-shadow";
    card.innerHTML = `
      <div class="aspect-[4/3] overflow-hidden bg-[var(--card)] flex items-center justify-center">
        <img src="${imgSrc(p)}" alt="${escapeHtml(p.title)}" class="max-w-full max-h-full object-contain opacity-0 transition-opacity duration-200"/>
      </div>
      <div class="flex flex-col p-4 h-full">
        <div>
          <h3 class="text-[15px] font-semibold mb-1 leading-snug">${escapeHtml(p.title)}</h3>
          <p class="text-[13px] text-[var(--muted)] leading-snug">${escapeHtml(p.desc || "")}</p>
        </div>
        <div class="mt-auto pt-3 flex items-center justify-between">
          <span class="font-semibold text-[15px]">${price} ${p.currency || ""}</span>
          <button class="flex items-center justify-center w-10 h-10 rounded-md bg-[var(--accent)] text-white hover:opacity-90 focus-ring" aria-label="Open link">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2.25 2.25h1.5l1.5 13.5h13.5l1.5-9H6.75" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    const img = card.querySelector("img");
    img.addEventListener("load", ()=> img.style.opacity="1");
    img.addEventListener("error", ()=> { img.src = FALLBACK_IMG; img.style.opacity="1"; });

    card.querySelector("button").addEventListener("click", ()=>{
      const url = p.aff_url || p.url;
      if (!url) return;
      try { tg?.openLink(url, { try_instant_view:false }); } catch { window.open(url, "_blank"); }
    });

    gridEl.appendChild(card);
  });
}

// ---- Pager ----
function renderPager(){
  const totalPages = Math.max(1, Math.ceil(state.total / state.page_size));
  pageinfoEl.textContent = `Page ${state.page} / ${totalPages}`;
  prevEl.disabled = state.page <= 1;
  nextEl.disabled = state.page >= totalPages;
}
prevEl.addEventListener("click", ()=> { if (state.page>1){ state.page--; loadProducts(); }});
nextEl.addEventListener("click", ()=> {
  const totalPages = Math.max(1, Math.ceil(state.total / state.page_size));
  if (state.page < totalPages){ state.page++; loadProducts(); }
});

// ---- Search ----
let t = null;
searchEl.addEventListener("input", e=>{
  clearTimeout(t);
  t = setTimeout(()=>{
    state.q = (e.target.value||"").trim();
    state.page = 1;
    loadProducts();
  }, 250);
});

// ---- Sort popup (unchanged API) ----
const SORT_OPTIONS = [
  { id: "",          label: "Default" },
  { id: "price_asc", label: "Price: Low → High" },
  { id: "price_desc",label: "Price: High → Low" },
  { id: "popular",   label: "Popular" },
  { id: "newest",    label: "Newest" },
];
document.getElementById("sortBtn")?.addEventListener("click", ()=>{
  if (tg?.showPopup){
    tg.showPopup({ title:"Sort by", message:"Choose how to sort products",
      buttons: SORT_OPTIONS.map(o=>({ id:o.id, type:"default", text:o.label })) });
  } else {
    const labels = SORT_OPTIONS.map((o,i)=>`${i}: ${o.label}`).join("\n");
    const idx = Number(prompt(`Sort by:\n${labels}\n\nEnter index (0-${SORT_OPTIONS.length-1})`, "0"));
    if (!Number.isNaN(idx) && SORT_OPTIONS[idx]) {
      state.sort = SORT_OPTIONS[idx].id; state.page=1; loadProducts();
    }
  }
});
tg?.onEvent?.("popupClosed", e=>{
  const id = e?.button_id ?? "";
  if (SORT_OPTIONS.some(o=>o.id===id)){ state.sort = id; state.page=1; loadProducts(); }
});

// ---- Bottom sheet filters (now includes dynamic Categories) ----
function renderFilterOptions(){
  if (!filterOptionsEl) return;
  filterOptionsEl.innerHTML = "";

  // Categories group from loadedCategories
  const catGroup = {
    key: "category", label: "Categories",
    options: loadedCategories.map(c => ({ id: norm(c), label: c }))
  };
  const miscGroups = [
    { key:"brand",  label:"Brand",  options:[{id:"apple",label:"Apple"}, {id:"samsung",label:"Samsung"}, {id:"xiaomi",label:"Xiaomi"}, {id:"other",label:"Other"}] },
    { key:"price",  label:"Price",  options:[{id:"0-100",label:"€0 – €100"}, {id:"100-300",label:"€100 – €300"}, {id:"300+",label:"€300+"}] },
    { key:"rating", label:"Rating", options:[{id:"4+",label:"4.0★ +"}, {id:"4.5+",label:"4.5★ +"}] },
  ];
  [catGroup, ...miscGroups].forEach(group=>{
    const wrap = document.createElement("div");
    wrap.className = "mb-4";
    wrap.innerHTML = `<h4 class="text-[15px] font-semibold mb-2">${group.label}</h4>`;
    const list = document.createElement("div");
    list.className = "flex flex-wrap gap-2";
    group.options.forEach(opt=>{
      const id = `${group.key}__${opt.id}`;
      const label = document.createElement("label");
      label.className =
        "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-white text-[14px] cursor-pointer select-none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "accent-[var(--accent)]";
      input.checked = !!state.filters[group.key]?.has(opt.id);
      input.addEventListener("change", ()=>{
        const set = state.filters[group.key];
        if (!(set instanceof Set)) return;
        if (input.checked) set.add(opt.id); else set.delete(opt.id);
      });
      const span = document.createElement("span"); span.textContent = opt.label;
      label.append(input, span); list.appendChild(label);
    });
    wrap.appendChild(list); filterOptionsEl.appendChild(wrap);
  });
}
function openSheet(){ renderFilterOptions(); filterSheet.classList.remove("hidden"); filterBackdrop.classList.remove("hidden"); }
function closeSheet(){ filterSheet.classList.add("hidden"); filterBackdrop.classList.add("hidden"); }

filterBtn?.addEventListener("click", openSheet);
filterCloseBtn?.addEventListener("click", closeSheet);
filterBackdrop?.addEventListener("click", closeSheet);
filterClearBtn?.addEventListener("click", ()=>{
  Object.keys(state.filters).forEach(k => { if (state.filters[k] instanceof Set) state.filters[k].clear(); });
  updateActiveChips(); renderFilterOptions();
});
filterApplyBtn?.addEventListener("click", ()=>{
  updateActiveChips();
  state.page = 1;
  closeSheet();
  loadProducts();
});

// ---- Boot ----
loadCategories();
loadProducts();