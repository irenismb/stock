// ================== CONFIG ==================
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwgRlyQfToDd8O7JOyRP0XXdryqpksSTu04zuhaZHYnun59S0ALXR_vnHZGfY5ch7SP/exec";
const DEFAULT_WHATSAPP = "573042088961";
const AUTO_REFRESH_MS = 20000;
const LS_FILTERS_KEY = "naturaFilters";
const LS_CART_KEY = "shoppingCart";
// Servicio externo para IP pública + ciudad
const CLIENT_INFO_URL = "https://ipapi.co/json/";
const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0
});
// ================== IMÁGENES (carpetas y extensiones) ==================
// Para productos se usa .webp; en otras imágenes se prueban varios formatos
const IMG_EXTS = ["webp", "jpeg", "jpg", "png"];
const IMG_BASE_PATH = "recursos/imagenes_de_productos/";
const OTRAS_IMG_BASE_PATH = "recursos/otras_imagenes/";
// ================== ESTADO ==================
let products = [];
let allCategories = []; // [{ key, label }]
let allBrands = [];     // [{ key, label }]
let currentSortOrder = "default"; // default → Orden, asc → precio menor, desc → precio mayor
let cart = {};          // id -> { id, name, price, quantity }
let currentGallery = { productId: null, images: [], index: 0 };
let lastPreviewRequestId = 0;
let filterListenersAttached = false;
let lastSearchLogged = "";
let autoRefreshTimer = null;
// Estado para visitas por sesión
let sessionId = "";
let clientIpPublica = "";
let clientCiudad = "";
let userName = ""; // opcional

// NUEVO: lista de productos actualmente filtrados y posición del producto mostrado
let currentFilteredProducts = [];
let currentPreviewProductIndex = -1;
let currentPreviewProductId = null;

// ================== DOM ==================
const searchInput = document.getElementById("searchInput");
const productTableBody = document.getElementById("productTableBody");
const cartList = document.getElementById("cartList");
const totalPriceElement = document.getElementById("totalPrice");
const whatsappBtn = document.getElementById("whatsappBtn");
const sortPriceBtn = document.getElementById("sortPriceBtn");
const categoryMenu = document.getElementById("categoryMenu");
const brandMenu = document.getElementById("brandMenu");
const categoryToggleBtn = document.getElementById("categoryToggleBtn");
const brandToggleBtn = document.getElementById("brandToggleBtn");
const productPreview = document.getElementById("productPreview");
const previewImg = document.getElementById("previewImg");
const previewCaption = document.getElementById("previewCaption");
const galleryPrevBtn = document.getElementById("galleryPrevBtn");
const galleryNextBtn = document.getElementById("galleryNextBtn");
const thumbs = document.getElementById("thumbs");
const previewName = document.getElementById("previewName");
const imageStatus = document.getElementById("imageStatus");
// Elementos del modal de imagen ampliada
const imageModal = document.getElementById("imageModal");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalClose = document.getElementById("imageModalClose");
const imageModalBackdrop = document.getElementById("imageModalBackdrop");

// ================== UTIL ==================
function debounce(fn, ms = 300) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
function normalizeText(t) {
  return (t || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function normalizeBrand(str) {
  return normalizeText((str || "").trim());
}
function escapeHtml(t) {
  if (t == null) return "";
  return String(t).replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[s]));
}
function escapeAttr(t) {
  return escapeHtml(t).replace(/"/g, "&quot;");
}
function detectDeviceLabel() {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "Celular Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iPhone / iPad";
  if (/windows/i.test(ua)) return "PC Windows";
  if (/macintosh|mac os x/i.test(ua)) return "Mac";
  if (/linux/i.test(ua)) return "PC Linux";
  return "Dispositivo web";
}

// ================== MODAL DE IMAGEN ==================
function openImageModal(src, alt) {
  if (!imageModal || !imageModalImg || !src) return;
  imageModalImg.src = src;
  imageModalImg.alt = alt || "Imagen ampliada del producto";
  imageModal.classList.add("open");
  imageModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeImageModal() {
  if (!imageModal || !imageModalImg) return;
  imageModal.classList.remove("open");
  imageModal.setAttribute("aria-hidden", "true");
  imageModalImg.src = "";
  document.body.style.overflow = "";
}
if (imageModalClose) {
  imageModalClose.addEventListener("click", closeImageModal);
}
if (imageModalBackdrop) {
  imageModalBackdrop.addEventListener("click", closeImageModal);
}
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && imageModal && imageModal.classList.contains("open")) {
    closeImageModal();
  }
});

// ================== REGISTRO DE VISITAS (POR SESIÓN) ==================
function generateSessionId() {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${ts}-${rand}`;
}
function ensureSessionId() {
  if (!sessionId) {
    sessionId = generateSessionId();
  }
  return sessionId;
}
/**
 * Envía un evento de visita al Apps Script
 */
function sendVisitEvent(phase, { clickText = "", searchText = "" } = {}) {
  try {
    const sid = ensureSessionId();
    const params = new URLSearchParams();
    params.set("action", "logVisit");
    params.set("sessionId", sid);
    params.set("phase", (phase || "update"));
    if (userName)        params.set("userName", userName);
    if (clientIpPublica) params.set("ipPublica", clientIpPublica);
    if (clientCiudad)    params.set("ciudad", clientCiudad);
    if (clickText)       params.set("clickText", String(clickText));
    if (searchText)      params.set("searchText", String(searchText));
    const url = APPS_SCRIPT_URL + "?" + params.toString();
    const options = { method: "GET", mode: "cors" };
    if (phase === "end") options.keepalive = true;
    fetch(url, options).catch(err => {
      console.error("Error enviando visita:", err);
    });
  } catch (e) {
    console.error("Error en sendVisitEvent:", e);
  }
}
async function initClientLocation() {
  try {
    const resp = await fetch(CLIENT_INFO_URL);
    if (!resp.ok) return;
    const data = await resp.json();
    clientIpPublica = data.ip || "";
    clientCiudad = data.city || "";
    sendVisitEvent("update");
  } catch (e) {
    console.error("No se pudo obtener IP/ciudad:", e);
  }
}

// ================== IMÁGENES / GALERÍA ==================
function testImageOnce(url, timeout = 1200) {
  return new Promise(resolve => {
    const img = new Image();
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        img.src = "";
        resolve(false);
      }
    }, timeout);
    img.onload = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(true);
      }
    };
    img.onerror = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(false);
      }
    };
    img.decoding = "async";
    img.loading = "eager";
    img.src = url;
  });
}
async function resolveOtherImage(baseName) {
  if (!baseName) return null;
  for (const ext of IMG_EXTS) {
    const url = `${OTRAS_IMG_BASE_PATH}${baseName}.${ext}`;
    const ok = await testImageOnce(url);
    if (ok) return url;
  }
  return null;
}
async function resolveImageForCode(code) {
  if (!code) return null;
  const id = String(code).trim();
  if (!id) return null;
  const url = `${IMG_BASE_PATH}${encodeURIComponent(id)}.webp`;
  const ok = await testImageOnce(url, 400);
  return ok ? url : null;
}
async function findAllImagesForProduct(prod) {
  if (!prod || !prod.id) return [];
  const main = await resolveImageForCode(prod.id);
  return main ? [main] : [];
}
function renderThumbs(imgs, activeIndex) {
  thumbs.innerHTML = "";
  imgs.forEach((url, idx) => {
    const im = document.createElement("img");
    im.src = url;
    im.alt = `Miniatura ${idx + 1}`;
    if (idx === activeIndex) im.classList.add("active");
    im.addEventListener("click", () => setGalleryIndex(idx, true));
    thumbs.appendChild(im);
  });
}
// AHORA: los botones prev/next se basan en productos, no en imágenes.
function updateNavButtons() {
  const len = currentFilteredProducts && currentFilteredProducts.length
    ? currentFilteredProducts.length
    : 0;
  const disabled = len <= 1;
  if (galleryPrevBtn) galleryPrevBtn.disabled = disabled;
  if (galleryNextBtn) galleryNextBtn.disabled = disabled;
}
function setGalleryIndex(newIndex, userAction) {
  const imgs = currentGallery.images;
  const len = imgs.length;
  if (!len) return;
  if (newIndex < 0) newIndex = len - 1;
  if (newIndex >= len) newIndex = 0;
  currentGallery.index = newIndex;
  const url = imgs[newIndex];
  previewImg.style.display = "block";
  previewImg.src = url;
  thumbs.querySelectorAll("img").forEach((im, idx) => {
    im.classList.toggle("active", idx === newIndex);
  });
  updateNavButtons();
}
async function showPreviewForProduct(prod) {
  if (!prod) return;
  const requestId = ++lastPreviewRequestId;
  const name = (prod.name || "").trim();
  const descriptionText = prod.description || "Sin descripción para este producto.";
  previewName.textContent = name ? name.toUpperCase() : "";
  previewCaption.textContent = descriptionText;
  previewCaption.classList.remove("loading");
  previewImg.style.display = "none";
  previewImg.src = "";
  thumbs.innerHTML = "";
  currentGallery = { productId: prod.id, images: [], index: 0 };
  updateNavButtons();
  if (imageStatus) {
    imageStatus.textContent = "Cargando imagen...";
    imageStatus.classList.add("visible");
  }
  const imgs = await findAllImagesForProduct(prod);
  if (requestId !== lastPreviewRequestId) return;
  currentGallery.images = imgs;
  currentGallery.index = 0;
  if (!imgs.length) {
    if (imageStatus) {
      imageStatus.textContent = "Próximamente tendrás la imagen de tu producto aquí";
      imageStatus.classList.add("visible");
    }
    updateNavButtons();
    return;
  }
  if (imageStatus) {
    imageStatus.textContent = "";
    imageStatus.classList.remove("visible");
  }
  renderThumbs(imgs, 0);
  setGalleryIndex(0);
}

// Navegación de productos en la vista previa (prev/next)
function showRelativeProduct(step) {
  if (!currentFilteredProducts || currentFilteredProducts.length === 0) return;
  const len = currentFilteredProducts.length;
  if (currentPreviewProductIndex == null || currentPreviewProductIndex < 0) {
    currentPreviewProductIndex = 0;
  }
  let newIndex = currentPreviewProductIndex + step;
  if (newIndex < 0) newIndex = len - 1;
  if (newIndex >= len) newIndex = 0;
  const prod = currentFilteredProducts[newIndex];
  currentPreviewProductIndex = newIndex;
  currentPreviewProductId = prod.id;
  showPreviewForProduct(prod);
}

// Botones prev/next del panel de imagen → producto anterior/siguiente
if (galleryPrevBtn) {
  galleryPrevBtn.addEventListener("click", () => {
    showRelativeProduct(-1);
  });
}
if (galleryNextBtn) {
  galleryNextBtn.addEventListener("click", () => {
    showRelativeProduct(1);
  });
}

// Swipe en móvil sobre la imagen grande → producto anterior/siguiente
(function addSwipe(el) {
  if (!el) return;
  let startX = null;
  el.addEventListener("touchstart", e => {
    startX = e.changedTouches[0].clientX;
  }, { passive: true });
  el.addEventListener("touchend", e => {
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) {
      if (dx > 0) showRelativeProduct(-1);
      else showRelativeProduct(1);
    }
    startX = null;
  }, { passive: true });
})(document.querySelector(".stage"));

productPreview.tabIndex = 0;
productPreview.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    showRelativeProduct(-1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    showRelativeProduct(1);
  }
});

// Clic sobre la imagen grande de la vista previa → abrir modal
if (previewImg) {
  previewImg.addEventListener("click", () => {
    const src = previewImg.currentSrc || previewImg.src;
    if (!src) return;
    const alt = previewImg.alt || (previewName && previewName.textContent) || "Imagen ampliada del producto";
    openImageModal(src, alt);
  });
}

// ================== FILTROS ==================
function getSavedFilters() {
  try {
    return JSON.parse(localStorage.getItem(LS_FILTERS_KEY) || "{}");
  } catch (e) {
    return {};
  }
}
function saveFiltersToStorage() {
  const catInput = categoryMenu.querySelector('input[name="category"]:checked');
  const brandInput = brandMenu.querySelector('input[name="brand"]:checked');
  const cat = catInput ? catInput.value : "Todas";
  const brand = brandInput ? brandInput.value : "Todas";
  localStorage.setItem(LS_FILTERS_KEY, JSON.stringify({ category: cat, brand }));
}
function updateCategoryButtonLabel() {
  const sel = categoryMenu.querySelector('input[name="category"]:checked');
  if (sel && sel.value !== "Todas") {
    const label = sel.dataset.label || sel.value;
    categoryToggleBtn.textContent = label + " ▾";
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
function refreshFilters() {
  const categoryMap = new Map();
  products.forEach(p => {
    const raw = (p.category || "").trim();
    if (!raw) return;
    const key = normalizeText(raw);
    if (!key) return;
    if (!categoryMap.has(key)) categoryMap.set(key, raw);
  });
  allCategories = Array.from(categoryMap.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

  const brandMap = new Map();
  products.forEach(p => {
    const raw = (p.marca || "").trim();
    if (!raw) return;
    const key = normalizeBrand(raw);
    if (!key) return;
    if (!brandMap.has(key)) brandMap.set(key, raw);
  });
  allBrands = Array.from(brandMap.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

  const saved = getSavedFilters();
  let catSaved = saved.category || "Todas";
  const brandSaved = saved.brand || "Todas";
  if (catSaved !== "Todas") catSaved = normalizeText(catSaved);

  const categoryOptionsHtml = [
    `<label style="display:block;margin-bottom:4px;">
      <input type="radio" name="category" value="Todas" ${catSaved === "Todas" ? "checked" : ""}>
      Todas
    </label>`,
    ...allCategories.map(c => `
      <label style="display:block;margin-bottom:4px;">
        <input type="radio"
               name="category"
               value="${escapeAttr(c.key)}"
               data-label="${escapeAttr(c.label)}"
               ${c.key === catSaved ? "checked" : ""}>
        ${escapeHtml(c.label)}
      </label>
    `)
  ];
  categoryMenu.innerHTML = categoryOptionsHtml.join("");

  const brandHtml = [
    `<label style="display:block;margin-bottom:4px;">
      <input type="radio" name="brand" value="Todas" ${brandSaved === "Todas" ? "checked" : ""}> Todas
    </label>`,
    ...allBrands.map(b => `
      <label style="display:block;margin-bottom:4px;">
        <input type="radio"
               name="brand"
               value="${escapeAttr(b.key)}"
               data-label="${escapeAttr(b.label)}"
               ${b.key === brandSaved ? "checked" : ""}>
        ${escapeHtml(b.label)}
      </label>
    `)
  ];
  brandMenu.innerHTML = brandHtml.join("");

  updateCategoryButtonLabel();
  updateBrandButtonLabel();
}
function setupFilterListenersOnce() {
  if (filterListenersAttached) return;
  filterListenersAttached = true;

  categoryMenu.addEventListener("change", () => {
    saveFiltersToStorage();
    filterAndDisplayProducts();
    updateCategoryButtonLabel();
    closeDropdowns();
  });
  brandMenu.addEventListener("change", () => {
    saveFiltersToStorage();
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
    if (e.key === "Escape") closeDropdowns();
  });
  [categoryToggleBtn, brandToggleBtn].forEach(btn => {
    btn.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        btn.click();
      }
    });
  });
  // Búsqueda con debounce
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
      sendVisitEvent("update", { searchText: term });
    }
  }, 500));
}

// ================== CARGA DE PRODUCTOS ==================
async function fetchProductsFromBackend() {
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
      let rawStock = p.stock;
      let stockNum = 9999;
      if (rawStock !== undefined && rawStock !== null && rawStock !== "") {
        stockNum = Number(rawStock);
        if (isNaN(stockNum)) stockNum = 9999;
      }
      return {
        ...p,
        valor_unitario: Number.isFinite(valor) ? valor : 0,
        orden: Number.isFinite(orden) ? orden : 999999,
        stock: stockNum
      };
    });
    refreshFilters();
    setupFilterListenersOnce();
    filterAndDisplayProducts();
  } catch (err) {
    console.error("Error al cargar productos:", err);
    productTableBody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;">Error al cargar productos.</td></tr>';
  }
}
function sortByOrdenThenId(list) {
  list.sort((a, b) => {
    const aVal = typeof a.orden === "number" && !isNaN(a.orden) ? a.orden : 999999;
    const bVal = typeof b.orden === "number" && !isNaN(b.orden) ? b.orden : 999999;
    if (aVal !== bVal) return aVal - bVal;
    return String(a.id).localeCompare(String(b.id));
  });
}

// ================== LISTADO / FILTRADO ==================
function syncPreviewWithFilteredList() {
  if (!currentFilteredProducts || currentFilteredProducts.length === 0) {
    currentPreviewProductIndex = -1;
    currentPreviewProductId = null;
    previewName.textContent = "";
    previewCaption.textContent = "Haz clic en un producto para ver su descripción";
    previewCaption.classList.remove("loading");
    previewImg.style.display = "none";
    previewImg.src = "";
    if (imageStatus) {
      imageStatus.textContent = "";
      imageStatus.classList.remove("visible");
    }
    updateNavButtons();
    return;
  }
  let index = -1;
  if (currentPreviewProductId != null) {
    index = currentFilteredProducts.findIndex(
      p => String(p.id) === String(currentPreviewProductId)
    );
  }
  if (index === -1) index = 0;
  const prod = currentFilteredProducts[index];
  currentPreviewProductIndex = index;
  currentPreviewProductId = prod.id;
  showPreviewForProduct(prod);
}

function filterAndDisplayProducts() {
  let list = [...products];

  // Filtro por categoría
  const catSel = categoryMenu.querySelector('input[name="category"]:checked');
  const catKey = catSel ? catSel.value : "Todas";
  if (catKey !== "Todas") {
    list = list.filter(p => normalizeText(p.category) === catKey);
  }

  // Filtro por marca
  const brandSel = brandMenu.querySelector('input[name="brand"]:checked');
  const brandVal = brandSel ? brandSel.value : "Todas";
  if (brandVal !== "Todas") {
    list = list.filter(p => normalizeBrand(p.marca || "") === brandVal);
  }

  // Búsqueda por texto
  const terms = normalizeText(searchInput.value)
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length > 0) {
    list = list.filter(p => {
      const s = normalizeText(
        `${p.id} ${p.name} ${p.category} ${p.marca} ${p.description || ""}`
      );
      return terms.every(t => s.includes(t));
    });
  }

  // Orden
  if (currentSortOrder === "asc") {
    list.sort((a, b) => (a.valor_unitario || 0) - (b.valor_unitario || 0));
  } else if (currentSortOrder === "desc") {
    list.sort((a, b) => (b.valor_unitario || 0) - (a.valor_unitario || 0));
  } else {
    sortByOrdenThenId(list);
  }

  // Guardar lista filtrada actual y mostrar en tabla
  currentFilteredProducts = list;
  displayProducts(list);
  // Ajustar vista previa (primer producto o mantener el actual si sigue en la lista)
  syncPreviewWithFilteredList();
}

function displayProducts(list) {
  if (!Array.isArray(list) || list.length === 0) {
    productTableBody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;">No hay productos.</td></tr>';
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach(p => {
    const item = cart[p.id];
    const qty = item ? item.quantity : 0;
    const unitPrice = p.valor_unitario || 0;
    const subtotal = qty * unitPrice;
    const isOutOfStock = (p.stock <= 0);
    const tr = document.createElement("tr");
    tr.setAttribute("data-product-id", p.id);
    if (isOutOfStock) tr.classList.add("product-row-out-of-stock");

    const thumbSrc = IMG_BASE_PATH + encodeURIComponent(p.id) + ".webp";
    let quantityHtml = "";
    if (isOutOfStock) {
      quantityHtml = `<span class="stock-status-msg">AGOTADO</span>`;
    } else {
      quantityHtml = `
        <div class="quantity-control">
          <button type="button" class="quantity-btn decrease-btn" aria-label="Disminuir">-</button>
          <input type="number" class="quantity-input" min="0" value="${qty}"
            data-price="${unitPrice}" data-id="${escapeAttr(p.id)}" data-name="${escapeAttr(p.name)}">
          <button type="button" class="quantity-btn increase-btn" aria-label="Aumentar">+</button>
        </div>
      `;
    }
    tr.innerHTML = `
      <td data-label="Foto">
        <img
          class="product-thumb"
          loading="lazy"
          src="${thumbSrc}"
          alt="Foto ${escapeAttr(p.name)}"
          onerror="this.style.display='none';"
        >
      </td>
      <td data-label="Nombre"><span>${escapeHtml(p.name)}</span></td>
      <td data-label="Categoría">${escapeHtml(p.category)}</td>
      <td data-label="Marca">${escapeHtml(p.marca)}</td>
      <td data-label="Valor unitario" class="price-cell">${currencyFormatter.format(unitPrice)}</td>
      <td data-label="Cantidad">
        ${quantityHtml}
      </td>
      <td data-label="Total" class="price-cell total-pay">${currencyFormatter.format(subtotal)}</td>
    `;
    frag.appendChild(tr);
  });
  productTableBody.innerHTML = "";
  productTableBody.appendChild(frag);
}

// ================== CARRITO ==================
function loadCartFromStorage() {
  const saved = localStorage.getItem(LS_CART_KEY);
  if (!saved) {
    cart = {};
    return;
  }
  try {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === "object") {
      cart = parsed;
    } else {
      cart = {};
    }
  } catch (e) {
    cart = {};
  }
}
function updateCart() {
  const items = Object.values(cart);
  let total = 0;
  if (items.length === 0) {
    cartList.innerHTML =
      '<li class="cart-item"><span class="cart-item-title">El carrito está vacío.</span></li>';
  } else {
    cartList.innerHTML = items.map(it => {
      const sub = it.quantity * it.price;
      total += sub;
      return `
        <li class="cart-item">
          <span class="cart-item-title">${it.quantity} x ${escapeHtml(it.name)} <strong>(${currencyFormatter.format(sub)})</strong></span>
          <button class="remove-item-btn" data-id="${escapeAttr(it.id)}">X</button>
        </li>
      `;
    }).join("");
  }
  totalPriceElement.textContent = "Total: " + currencyFormatter.format(total);
  localStorage.setItem(LS_CART_KEY, JSON.stringify(cart));
}
function buildClientWhatsAppMsg(
  items,
  header = "Hola, deseo comprar estos productos en Irenismb Stock Natura:"
) {
  let msg = header + "\n\n";
  let total = 0;
  items.forEach(it => {
    const sub = it.quantity * it.price;
    total += sub;
    msg += `• ${it.quantity} x ${it.name} = ${currencyFormatter.format(sub)}\n`;
  });
  msg += `\nTotal: ${currencyFormatter.format(total)}\n`;
  msg += `\nGracias.`;
  return msg;
}
function handleWhatsAppClick() {
  const items = Object.values(cart).filter(it => it.quantity > 0);
  if (!items.length) {
    alert("El carrito está vacío. Agrega productos antes de comprar por WhatsApp.");
    return;
  }
  const phone = DEFAULT_WHATSAPP;
  const msg = buildClientWhatsAppMsg(items);
  const url = `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
  sendVisitEvent("update", { clickText: "whatsapp_compra" });
}
function updateRowTotal(tr, qty, price) {
  const cell = tr.querySelector(".total-pay");
  if (!cell) return;
  const subtotal = (qty || 0) * (price || 0);
  cell.textContent = currencyFormatter.format(subtotal);
}
function updateCartEntry(id, name, price, qty) {
  if (!id) return;
  const quantity = Math.max(0, Number(qty) || 0);
  if (!quantity) {
    delete cart[id];
  } else {
    cart[id] = {
      id,
      name: name || "",
      price: Number(price) || 0,
      quantity
    };
  }
  updateCart();
}

// ================== EVENTOS EN LA TABLA ==================
productTableBody.addEventListener("click", e => {
  const decBtn = e.target.closest(".decrease-btn");
  const incBtn = e.target.closest(".increase-btn");
  const tr = e.target.closest("tr");
  if (!tr) return;

  const productId = tr.getAttribute("data-product-id");

  // Clic en la miniatura → vista previa + modal grande encima de la vista actual
  const thumbImg = e.target.closest(".product-thumb");
  if (thumbImg) {
    let idx = -1;
    let prod = null;
    if (productId) {
      idx = currentFilteredProducts.findIndex(p => String(p.id) === String(productId));
      if (idx !== -1) {
        prod = currentFilteredProducts[idx];
      } else {
        prod = products.find(p => String(p.id) === String(productId));
      }
    }
    if (prod) {
      currentPreviewProductIndex = (idx !== -1) ? idx : 0;
      currentPreviewProductId = prod.id;
      // Actualiza también la vista previa lateral/inferior
      showPreviewForProduct(prod);
      const clickName = prod.name || prod.nombre || "";
      if (clickName) {
        sendVisitEvent("update", { clickText: clickName + " (imagen)" });
      }
    }
    const src = thumbImg.currentSrc || thumbImg.src;
    const alt = thumbImg.alt || (prod && prod.name) || "Imagen del producto";
    openImageModal(src, alt);
    return;
  }

  // Controles de cantidad
  const input = tr.querySelector(".quantity-input");
  if (decBtn || incBtn) {
    if (!input) return;
    let qty = parseInt(input.value, 10);
    if (!Number.isFinite(qty) || qty < 0) qty = 0;
    const price = Number(input.dataset.price) || 0;
    const id = input.dataset.id;
    const name = input.dataset.name || "";
    if (incBtn) qty += 1;
    if (decBtn) qty = Math.max(0, qty - 1);
    input.value = qty;
    updateRowTotal(tr, qty, price);
    updateCartEntry(id, name, price, qty);
    return;
  }

  // Clic en la fila para ver vista previa (evita controles de cantidad)
  if (e.target.closest(".quantity-control") || e.target.classList.contains("quantity-input")) {
    return;
  }
  if (!productId) return;

  let idx = currentFilteredProducts.findIndex(p => String(p.id) === String(productId));
  let prod;
  if (idx !== -1) {
    prod = currentFilteredProducts[idx];
  } else {
    prod = products.find(p => String(p.id) === String(productId));
  }
  if (prod) {
    currentPreviewProductIndex = (idx !== -1) ? idx : 0;
    currentPreviewProductId = prod.id;
    showPreviewForProduct(prod);
    const clickName = prod.name || prod.nombre || "";
    if (clickName) {
      sendVisitEvent("update", { clickText: clickName });
    }
  }
});

productTableBody.addEventListener("change", e => {
  const input = e.target;
  if (!input.classList.contains("quantity-input")) return;
  const tr = input.closest("tr");
  if (!tr) return;
  let qty = parseInt(input.value, 10);
  if (!Number.isFinite(qty) || qty < 0) qty = 0;
  const price = Number(input.dataset.price) || 0;
  const id = input.dataset.id;
  const name = input.dataset.name || "";
  input.value = qty;
  updateRowTotal(tr, qty, price);
  updateCartEntry(id, name, price, qty);
});

// Eliminar desde el carrito
cartList.addEventListener("click", e => {
  const btn = e.target.closest(".remove-item-btn");
  if (!btn) return;
  const id = btn.dataset.id;
  if (!id) return;
  delete cart[id];
  const row = productTableBody.querySelector(`tr[data-product-id="${id}"]`);
  if (row) {
    const input = row.querySelector(".quantity-input");
    if (input) input.value = 0;
    const totalCell = row.querySelector(".total-pay");
    if (totalCell) totalCell.textContent = currencyFormatter.format(0);
  }
  updateCart();
});

// Ordenar por precio
sortPriceBtn.addEventListener("click", () => {
  if (currentSortOrder === "default") {
    currentSortOrder = "asc";
    sortPriceBtn.textContent = "Precio: menor a mayor";
  } else if (currentSortOrder === "asc") {
    currentSortOrder = "desc";
    sortPriceBtn.textContent = "Precio: mayor a menor";
  } else {
    currentSortOrder = "default";
    sortPriceBtn.textContent = "Ordenar por precio";
  }
  filterAndDisplayProducts();
});

// Click en botón de WhatsApp
whatsappBtn.addEventListener("click", handleWhatsAppClick);

// Auto refresco de productos
function setupAutoRefresh() {
  if (!AUTO_REFRESH_MS || AUTO_REFRESH_MS <= 0) return;
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    fetchProductsFromBackend();
  }, AUTO_REFRESH_MS);
}

// Inicialización
(function init() {
  loadCartFromStorage();
  updateCart();
  fetchProductsFromBackend();
  setupAutoRefresh();
  userName = detectDeviceLabel();
  ensureSessionId();
  sendVisitEvent("start");
  initClientLocation();
})();

// Registrar SALIDA del catálogo (hora de salida)
window.addEventListener("beforeunload", function () {
  try {
    sendVisitEvent("end");
  } catch (e) {
    console.error("Error al registrar salida:", e);
  }
});

// Fondo dinámico con logo_natura (admite varias extensiones)
(async function setDynamicBackground() {
  try {
    const bgUrl = await resolveOtherImage("logo_natura");
    if (bgUrl) {
      document.body.style.backgroundImage = `url("${bgUrl}")`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundAttachment = "fixed";
    }
  } catch (e) {
    console.error("No se pudo cargar el fondo logo_natura:", e);
  }
})();
