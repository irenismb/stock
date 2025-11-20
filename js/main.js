import { createGallery } from "./gallery.js";
import { getSavedFilters, saveFilters, loadCart, saveCart } from "./storage.js";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxZMU4y0QPazsB0Ps_DiV1jJt5YukPz6RtQP6G7CKelXoEGQcx6r59cHjkUKpBi6MVBQ/exec";
const AUTO_REFRESH_MS = 5 * 60 * 1000;
const PAGE_SIZE = 20;

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
});

const productTableBody = document.querySelector("#productTableBody");
const paginationControls = document.querySelector("#paginationControls");
const tableStatus = document.querySelector("#tableStatus");
const searchInput = document.querySelector("#searchInput");
const sortPriceBtn = document.querySelector("#sortPriceBtn");
const resetFiltersBtn = document.querySelector("#resetFiltersBtn");
const categoryMenu = document.querySelector("#categoryMenu");
const brandMenu = document.querySelector("#brandMenu");
const categoryToggleBtn = document.querySelector("#categoryToggleBtn");
const brandToggleBtn = document.querySelector("#brandToggleBtn");
const whatsappBtn = document.querySelector("#whatsappBtn");
const contactWhatsappLink = document.querySelector("#contactWhatsappLink");
const cartList = document.querySelector("#cartList");
const totalPriceEl = document.querySelector("#totalPrice");
const floatingCartLink = document.querySelector("#floatingCartLink");

const gallery = createGallery({
  previewImg: document.querySelector("#previewImg"),
  previewName: document.querySelector("#previewName"),
  previewCaption: document.querySelector("#previewCaption"),
  thumbs: document.querySelector("#thumbs"),
  galleryPrevBtn: document.querySelector("#galleryPrevBtn"),
  galleryNextBtn: document.querySelector("#galleryNextBtn"),
  imageStatus: document.querySelector("#imageStatus"),
  stage: document.querySelector(".stage"),
});

let products = [];
let currentSortOrder = "default";
let allCategories = [];
let allBrands = [];
let filterListenersAttached = false;
let lastSearchLogged = "";
let cart = loadCart();
let autoRefreshTimer = null;
let currentPage = 1;

function escapeHtml(t) {
  const div = document.createElement("div");
  div.textContent = t;
  return div.innerHTML;
}

function escapeAttr(t) {
  return escapeHtml(t).replace(/"/g, "&quot;");
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s#.,-]/gi, " ")
    .trim();
}

function normalizeBrand(brand) {
  return normalizeText(brand).replace(/\s+/g, " ").trim();
}

function logVisit(clickText, searchText) {
  try {
    const params = new URLSearchParams({
      action: "logVisit",
      clickText: String(clickText || ""),
      searchText: String(searchText || ""),
      ts: Date.now().toString(),
    });
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.src = APPS_SCRIPT_URL + "?" + params.toString();
  } catch (e) {
    console.error("Error en logVisit:", e);
  }
}

function openWhatsApp(message) {
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/573186171915?text=${encoded}`, "_blank", "noopener,noreferrer");
}

function buildClientWhatsAppMsg(items) {
  const lines = items.map(it => `• ${it.name} x${it.quantity} - ${currencyFormatter.format(it.price * it.quantity)}`);
  const total = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  lines.push("", "Total: " + currencyFormatter.format(total));
  return "Hola, me interesan estos productos:%0A" + lines.join("%0A");
}

function updateCart() {
  const items = Object.values(cart);
  cartList.innerHTML = "";
  if (!items.length) {
    cartList.innerHTML = '<li class="cart-item">Tu carrito está vacío</li>';
    totalPriceEl.textContent = currencyFormatter.format(0);
    floatingCartLink.textContent = "Carrito vacío";
    return;
  }

  const frag = document.createDocumentFragment();
  let total = 0;
  items.forEach(item => {
    const li = document.createElement("li");
    li.className = "cart-item";
    li.innerHTML = `
      <span>${escapeHtml(item.name)} (x${item.quantity})</span>
      <span>
        ${currencyFormatter.format(item.price * item.quantity)}
        <button class="remove-item-btn" data-id="${escapeAttr(item.id)}" aria-label="Quitar ${escapeAttr(item.name)}">✕</button>
      </span>
    `;
    frag.appendChild(li);
    total += item.price * item.quantity;
  });
  cartList.appendChild(frag);
  totalPriceEl.textContent = currencyFormatter.format(total);
  floatingCartLink.textContent = `Carrito (${items.length})`;
  saveCart(cart);
}

function refreshFilters() {
  allCategories = [...new Set(products.map(p => p.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  const brandMap = new Map();
  products.forEach(p => {
    const raw = (p.marca || "").trim();
    if (!raw) return;
    const key = normalizeBrand(raw);
    if (!key) return;
    if (!brandMap.has(key)) {
      brandMap.set(key, raw);
    }
  });

  allBrands = Array.from(brandMap.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

  const saved = getSavedFilters();
  const catSaved = saved.category || "Todas";
  let brandSaved = saved.brand || "Todas";

  categoryMenu.innerHTML = ["Todas", ...allCategories].map(c => `
    <label style="display:block;margin-bottom:4px;">
      <input type="radio" name="category" value="${escapeAttr(c)}" ${c === catSaved ? "checked" : ""}>
      ${escapeHtml(c || "Todas")}
    </label>
  `).join("");

  const brandHtml = [
    `<label style="display:block;margin-bottom:4px;">
      <input type="radio" name="brand" value="Todas" ${brandSaved === "Todas" ? "checked" : ""}> Todas
    </label>`,
    ...allBrands.map(b => `
      <label style="display:block;margin-bottom:4px;">
        <input type="radio" name="brand" value="${escapeAttr(b.key)}" data-label="${escapeAttr(b.label)}" ${b.key === brandSaved ? "checked" : ""}>
        ${escapeHtml(b.label)}
      </label>
    `),
  ];
  brandMenu.innerHTML = brandHtml.join("");

  updateCategoryButtonLabel();
  updateBrandButtonLabel();
}

function updateCategoryButtonLabel() {
  const sel = categoryMenu.querySelector('input[name="category"]:checked');
  if (sel && sel.value !== "Todas") {
    categoryToggleBtn.textContent = sel.value + " ▾";
  } else {
    categoryToggleBtn.textContent = "Categorías ▾";
  }
}

function updateBrandButtonLabel() {
  const sel = brandMenu.querySelector('input[name="brand"]:checked');
  if (sel && sel.value !== "Todas") {
    const label = sel.dataset.label || sel.value;
    brandToggleBtn.textContent = label + " ▾";
  } else {
    brandToggleBtn.textContent = "Marcas ▾";
  }
}

function closeDropdowns() {
  document.querySelectorAll(".custom-dropdown.open").forEach(dd => {
    dd.classList.remove("open");
    const menu = dd.querySelector(".custom-menu");
    if (menu) menu.setAttribute("aria-hidden", "true");
    const btn = dd.querySelector(".dropdown-toggle-btn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  });
}

function displayTableMessage(msg) {
  tableStatus.textContent = msg;
}

function filterAndDisplayProducts() {
  let list = [...products];

  const catSel = categoryMenu.querySelector('input[name="category"]:checked');
  const catVal = catSel ? catSel.value : "Todas";
  if (catVal !== "Todas") {
    list = list.filter(p => p.category === catVal);
  }

  const brandSel = brandMenu.querySelector('input[name="brand"]:checked');
  const brandVal = brandSel ? brandSel.value : "Todas";
  if (brandVal !== "Todas") {
    list = list.filter(p => normalizeBrand(p.marca || "") === brandVal);
  }

  const terms = normalizeText(searchInput.value)
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length > 0) {
    list = list.filter(p => {
      const s = normalizeText(`${p.id} ${p.name} ${p.category} ${p.marca} ${p.description || ""}`);
      return terms.every(t => s.includes(t));
    });
  }

  if (currentSortOrder === "asc") {
    list.sort((a, b) => (a.valor_unitario || 0) - (b.valor_unitario || 0));
  } else if (currentSortOrder === "desc") {
    list.sort((a, b) => (b.valor_unitario || 0) - (a.valor_unitario || 0));
  } else {
    sortByOrdenThenId(list);
  }

  currentPage = 1;
  displayProducts(list);
  saveFilters({ category: catVal, brand: brandVal });
}

function displayProducts(list) {
  if (!Array.isArray(list) || list.length === 0) {
    productTableBody.innerHTML = '';
    displayTableMessage("No hay productos.");
    paginationControls.innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(list.length / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const paginated = list.slice(start, end);

  const frag = document.createDocumentFragment();

  paginated.forEach(p => {
    const item = cart[p.id];
    const qty = item ? item.quantity : 0;
    const unitPrice = p.valor_unitario || 0;
    const subtotal = qty * unitPrice;

    const tr = document.createElement("tr");
    tr.setAttribute("data-product-id", p.id);

    tr.innerHTML = `
      <td data-label="Nombre"><span>${escapeHtml(p.name)}</span></td>
      <td data-label="Marca">${escapeHtml(p.marca || "-")}</td>
      <td data-label="Categoría">${escapeHtml(p.category || "-")}</td>
      <td data-label="Descripción">${escapeHtml(p.description || "-")}</td>
      <td data-label="Precio" class="price-cell" aria-label="Precio unitario">${currencyFormatter.format(unitPrice)}</td>
      <td data-label="Cantidad">
        <div class="quantity-control">
          <button class="quantity-btn decrease-btn" aria-label="Disminuir cantidad">−</button>
          <input class="quantity-input" data-id="${escapeAttr(p.id)}" type="number" min="0" value="${qty}" aria-label="Cantidad para ${escapeAttr(p.name)}">
          <button class="quantity-btn increase-btn" aria-label="Incrementar cantidad">+</button>
        </div>
      </td>
    `;

    frag.appendChild(tr);
  });

  productTableBody.innerHTML = "";
  productTableBody.appendChild(frag);
  displayTableMessage(`Mostrando ${paginated.length} de ${list.length} productos`);
  renderPagination(totalPages, list);
}

function renderPagination(totalPages, list) {
  paginationControls.innerHTML = "";
  if (totalPages <= 1) return;

  const prev = document.createElement("button");
  prev.textContent = "Anterior";
  prev.className = "pagination-btn";
  prev.disabled = currentPage === 1;
  prev.addEventListener("click", () => {
    currentPage = Math.max(1, currentPage - 1);
    displayProducts(list);
  });

  const next = document.createElement("button");
  next.textContent = "Siguiente";
  next.className = "pagination-btn";
  next.disabled = currentPage === totalPages;
  next.addEventListener("click", () => {
    currentPage = Math.min(totalPages, currentPage + 1);
    displayProducts(list);
  });

  const info = document.createElement("span");
  info.textContent = `Página ${currentPage} de ${totalPages}`;

  paginationControls.append(prev, info, next);
}

function sortByOrdenThenId(list) {
  list.sort((a, b) => {
    const aVal = typeof a.orden === "number" && !isNaN(a.orden) ? a.orden : 999999;
    const bVal = typeof b.orden === "number" && !isNaN(b.orden) ? b.orden : 999999;
    if (aVal !== bVal) return aVal - bVal;
    return String(a.id).localeCompare(String(b.id));
  });
}

function attachFilterListeners() {
  if (filterListenersAttached) return;
  filterListenersAttached = true;

  categoryMenu.addEventListener("change", () => {
    filterAndDisplayProducts();
    updateCategoryButtonLabel();
    closeDropdowns();
  });

  brandMenu.addEventListener("change", () => {
    filterAndDisplayProducts();
    updateBrandButtonLabel();
    closeDropdowns();
  });

  document.addEventListener("click", e => {
    const t = e.target;
    if (t.classList.contains("dropdown-toggle-btn")) {
      e.stopPropagation();
      const dd = t.closest(".custom-dropdown");
      if (!dd) return;
      const wasOpen = dd.classList.contains("open");
      closeDropdowns();
      dd.classList.toggle("open", !wasOpen);
      const menu = dd.querySelector(".custom-menu");
      if (menu) menu.setAttribute("aria-hidden", wasOpen ? "true" : "false");
      t.setAttribute("aria-expanded", (!wasOpen).toString());
    } else if (!t.closest(".custom-dropdown")) {
      closeDropdowns();
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeDropdowns();
    }
  });

  [categoryToggleBtn, brandToggleBtn].forEach(btn => {
    btn.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        btn.click();
      }
    });
  });

  searchInput.addEventListener("input", debounce(() => {
    const raw = searchInput.value || "";
    const term = raw.trim();

    if (!term) {
      currentSortOrder = "default";
      sortPriceBtn.textContent = "Ordenar por precio";
    }

    filterAndDisplayProducts();

    if (term && term !== lastSearchLogged) {
      lastSearchLogged = term;
      logVisit("busqueda", term);
    }
  }, 500));
}

async function fetchProductsFromBackend() {
  displayTableMessage("Cargando productos...");
  try {
    const resp = await fetch(APPS_SCRIPT_URL + "?action=getAll&ts=" + Date.now());
    if (!resp.ok) throw new Error("Error de red al cargar productos");
    const data = await resp.json();
    if (data.status !== "success" || !Array.isArray(data.products)) {
      throw new Error(data.message || "Respuesta inválida del servidor");
    }

    products = data.products.map(p => {
      const valor = Number(p.valor_unitario);
      const orden = Number(p.orden);
      return {
        ...p,
        valor_unitario: Number.isFinite(valor) ? valor : 0,
        orden: Number.isFinite(orden) ? orden : 999999,
      };
    });

    refreshFilters();
    attachFilterListeners();
    filterAndDisplayProducts();
  } catch (err) {
    console.error("Error al cargar productos:", err);
    productTableBody.innerHTML = "";
    displayTableMessage("Error al cargar productos. Reintenta en unos segundos.");
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = setInterval(() => {
    if (document.hidden) return;
    fetchProductsFromBackend();
  }, AUTO_REFRESH_MS);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

function handleCartEvents() {
  cartList.addEventListener("click", e => {
    if (!e.target.classList.contains("remove-item-btn")) return;
    const id = e.target.dataset.id;
    delete cart[id];
    syncQuantityInput(id, 0);
    updateCart();
  });
}

function syncQuantityInput(id, qty) {
  try {
    const selector = `.quantity-input[data-id="${CSS.escape(id)}"]`;
    const input = productTableBody.querySelector(selector);
    if (input) {
      input.value = qty;
    }
  } catch (err) {
    // noop
  }
}

function handleTableEvents() {
  productTableBody.addEventListener("input", e => {
    if (!e.target.classList.contains("quantity-input")) return;
    const input = e.target;
    const id = input.dataset.id;
    let qty = parseInt(input.value, 10) || 0;
    if (qty < 0) qty = 0;
    input.value = qty;

    const prod = products.find(p => String(p.id) === String(id));
    if (!prod) return;
    const price = prod.valor_unitario || 0;
    if (qty > 0) {
      cart[id] = { id, name: prod.name, quantity: qty, price };
    } else {
      delete cart[id];
    }
    updateCart();
  });

  productTableBody.addEventListener("click", e => {
    const tr = e.target.closest("tr[data-product-id]");
    if (!tr) return;

    if (e.target.classList.contains("quantity-btn")) {
      const input = tr.querySelector(".quantity-input");
      let qty = parseInt(input.value, 10) || 0;
      if (e.target.classList.contains("increase-btn")) qty++;
      else if (e.target.classList.contains("decrease-btn")) qty--;
      if (qty < 0) qty = 0;
      input.value = qty;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    if (e.target.classList.contains("quantity-input")) return;

    const id = tr.getAttribute("data-product-id");
    const prod = products.find(p => String(p.id) === String(id));
    if (prod) {
      gallery.showPreviewForProduct(prod);
      logVisit("producto: " + prod.name, (searchInput.value || "").trim());
    }
  });
}

function initButtons() {
  sortPriceBtn.addEventListener("click", () => {
    if (currentSortOrder === "default" || currentSortOrder === "desc") {
      currentSortOrder = "asc";
      sortPriceBtn.textContent = "Precio $↓";
    } else {
      currentSortOrder = "desc";
      sortPriceBtn.textContent = "Precio $↑";
    }
    filterAndDisplayProducts();
  });

  resetFiltersBtn.addEventListener("click", () => {
    searchInput.value = "";
    currentSortOrder = "default";
    sortPriceBtn.textContent = "Ordenar por precio";
    saveFilters({ category: "Todas", brand: "Todas" });
    refreshFilters();
    filterAndDisplayProducts();
  });

  whatsappBtn.addEventListener("click", () => {
    const items = Object.values(cart);
    if (!items.length) return;
    const msg = buildClientWhatsAppMsg(items);
    openWhatsApp(msg);
  });

  contactWhatsappLink.addEventListener("click", e => {
    e.preventDefault();
    openWhatsApp("Hola, me interesan los productos de Irenismb Stock Natura.");
  });
}

function hydrateFromStorage() {
  const saved = getSavedFilters();
  if (saved.category || saved.brand) {
    refreshFilters();
    const catInput = categoryMenu.querySelector(`input[value="${CSS.escape(saved.category || "Todas")}"]`);
    if (catInput) catInput.checked = true;
    const brandInput = brandMenu.querySelector(`input[value="${CSS.escape(saved.brand || "Todas")}"]`);
    if (brandInput) brandInput.checked = true;
    updateCategoryButtonLabel();
    updateBrandButtonLabel();
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopAutoRefresh();
  else startAutoRefresh();
});

document.addEventListener("DOMContentLoaded", () => {
  hydrateFromStorage();
  updateCart();
  fetchProductsFromBackend();
  attachFilterListeners();
  handleCartEvents();
  handleTableEvents();
  initButtons();
  startAutoRefresh();
  logVisit("entrada_catalogo", "");
});

window.addEventListener("beforeunload", () => {
  saveCart(cart);
  const cat = categoryMenu.querySelector('input[name="category"]:checked')?.value || "Todas";
  const brand = brandMenu.querySelector('input[name="brand"]:checked')?.value || "Todas";
  saveFilters({ category: cat, brand });
});
