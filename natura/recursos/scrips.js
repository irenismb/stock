// ================== CONFIG ==================
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgRlyQfToDd8O7JOyRP0XXdryqpksSTu04zuhaZHYnun59S0ALXR_vnHZGfY5ch7SP/exec";
const DEFAULT_WHATSAPP = "573042088961";
const AUTO_REFRESH_MS = 20000;
const LS_FILTERS_KEY = "naturaFilters";
const LS_CART_KEY = "shoppingCart";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0
});

// ================== IMÁGENES (carpeta recursos/productos) ==================
const IMG_BASE_PATH = "recursos/imagenes_de_productos/";
const IMG_EXTS = ["webp", "WEBP"];
const imageCache = new Map();

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

// ================== DOM ==================
const searchInput = document.getElementById("searchInput");
const productTableBody = document.getElementById("productTableBody");
const cartList = document.getElementById("cartList");
const totalPriceElement = document.getElementById("totalPrice");
const whatsappBtn = document.getElementById("whatsappBtn");
const contactWhatsappLink = document.getElementById("contactWhatsappLink");
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
  })[s]);
}

function escapeAttr(t) {
  return escapeHtml(t).replace(/"/g, "&quot;");
}

// ================== REGISTRO DE VISITAS ==================
function logVisit(clickText, searchText) {
  try {
    const params = new URLSearchParams({
      action: "logVisit",
      clickText: String(clickText || ""),
      searchText: String(searchText || ""),
      ts: Date.now().toString()
    });
    const img = new Image();
    img.src = APPS_SCRIPT_URL + "?" + params.toString();
  } catch (e) {
    console.error("Error en logVisit:", e);
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

async function resolveImageForCode(code, name) {
  if (!code) return null;
  const safeName = (name || "").trim();
  const baseVariants = [];

  // 1) Código solo: 123.webp
  baseVariants.push(String(code));

  if (safeName) {
    const safeNameSlug = safeName
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (safeNameSlug) {
      baseVariants.push(`${code}-${safeNameSlug}`);
    }
    // Código + nombre original
    baseVariants.push(`${code}-${safeName}`);
    // Patrón antiguo: 123@Nombre
    baseVariants.push(`${code}@${safeName}`);
  }

  for (const base of baseVariants) {
    for (const ext of IMG_EXTS) {
      const key = `${base}.${ext}`;
      const cached = imageCache.get(key);
      if (cached) {
        if (cached.ok) return cached.url;
        continue;
      }
      const url = IMG_BASE_PATH + encodeURIComponent(base) + "." + ext;
      const ok = await testImageOnce(url);
      imageCache.set(key, { ok, url });
      if (ok) return url;
    }
  }
  return null;
}

async function findAllImagesForProduct(prod, maxChildren = 12) {
  if (!prod || !prod.id) return [];
  const id = String(prod.id).trim();
  const name = String(prod.name || "").trim();
  const images = [];
  const main = await resolveImageForCode(id, name);
  if (main) images.push(main);
  for (let i = 1; i <= maxChildren; i++) {
    const childCode = `${id}-${i}`;
    const url = await resolveImageForCode(childCode, name);
    if (url) images.push(url);
  }
  return images;
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

function updateNavButtons() {
  const len = currentGallery.images.length;
  const disabled = len <= 1;
  galleryPrevBtn.disabled = disabled;
  galleryNextBtn.disabled = disabled;
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
  if (requestId !== lastPreviewRequestId) {
    return;
  }
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

// Navegación de galería
galleryPrevBtn.addEventListener("click", () => {
  setGalleryIndex(currentGallery.index - 1, true);
});
galleryNextBtn.addEventListener("click", () => {
  setGalleryIndex(currentGallery.index + 1, true);
});

// Swipe en móvil
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
      if (dx > 0) setGalleryIndex(currentGallery.index - 1, true);
      else setGalleryIndex(currentGallery.index + 1, true);
    }
    startX = null;
  }, { passive: true });
})(document.querySelector(".stage"));

productPreview.tabIndex = 0;
productPreview.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    setGalleryIndex(currentGallery.index - 1, true);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    setGalleryIndex(currentGallery.index + 1, true);
  }
});

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
  // === CATEGORÍAS: unificadas por clave normalizada (sin mayúsculas/acentos) ===
  const categoryMap = new Map();

  products.forEach(p => {
    const raw = (p.category || "").trim();
    if (!raw) return;
    const key = normalizeText(raw);
    if (!key) return;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, raw); // guardamos la primera forma escrita
    }
  });

  allCategories = Array.from(categoryMap.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

  // ==== MARCAS ====
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

  // Filtros guardados
  const saved = getSavedFilters();
  let catSaved = saved.category || "Todas";
  const brandSaved = saved.brand || "Todas";

  // Compatibilidad con valores antiguos (etiquetas en vez de claves)
  if (catSaved !== "Todas") {
    catSaved = normalizeText(catSaved);
  }

  // Construcción del menú de categorías
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

  // Construcción del menú de marcas
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
      logVisit("busqueda", term);
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

      // LÓGICA DE STOCK AGREGADA: Leer la columna stock
      // Se asume que en el JSON viene como "stock". Si está vacío, se asume disponible (9999),
      // pero si es explícitamente 0, se marca como tal.
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
        stock: stockNum // Guardamos el stock normalizado
      };
    });
    refreshFilters();
    setupFilterListenersOnce();
    filterAndDisplayProducts();
  } catch (err) {
    console.error("Error al cargar productos:", err);
    productTableBody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;">Error al cargar productos.</td></tr>';
  }
}

// Orden por columna "orden" y luego por id
function sortByOrdenThenId(list) {
  list.sort((a, b) => {
    const aVal = typeof a.orden === "number" && !isNaN(a.orden) ? a.orden : 999999;
    const bVal = typeof b.orden === "number" && !isNaN(b.orden) ? b.orden : 999999;
    if (aVal !== bVal) return aVal - bVal;
    return String(a.id).localeCompare(String(b.id));
  });
}

// ================== LISTADO / FILTRADO ==================
function filterAndDisplayProducts() {
  let list = [...products];

  // ==== FILTRO POR CATEGORÍA (usa clave normalizada) ====
  const catSel = categoryMenu.querySelector('input[name="category"]:checked');
  const catKey = catSel ? catSel.value : "Todas";

  if (catKey !== "Todas") {
    list = list.filter(p => normalizeText(p.category) === catKey);
  }

  // ==== FILTRO POR MARCA (ya usaba clave normalizada) ====
  const brandSel = brandMenu.querySelector('input[name="brand"]:checked');
  const brandVal = brandSel ? brandSel.value : "Todas";
  if (brandVal !== "Todas") {
    list = list.filter(p => normalizeBrand(p.marca || "") === brandVal);
  }

  // ==== BÚSQUEDA POR TEXTO ====
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

  // ==== ORDEN ====
  if (currentSortOrder === "asc") {
    list.sort((a, b) => (a.valor_unitario || 0) - (b.valor_unitario || 0));
  } else if (currentSortOrder === "desc") {
    list.sort((a, b) => (b.valor_unitario || 0) - (a.valor_unitario || 0));
  } else {
    sortByOrdenThenId(list);
  }

  displayProducts(list);
}

function displayProducts(list) {
  if (!Array.isArray(list) || list.length === 0) {
    productTableBody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;">No hay productos.</td></tr>';
    return;
  }
  const frag = document.createDocumentFragment();

  list.forEach(p => {
    const item = cart[p.id];
    const qty = item ? item.quantity : 0;
    const unitPrice = p.valor_unitario || 0;
    const subtotal = qty * unitPrice;

    // LÓGICA STOCK: Si stock es menor o igual a 0, marcamos el producto.
    const isOutOfStock = (p.stock <= 0);

    const tr = document.createElement("tr");
    tr.setAttribute("data-product-id", p.id);

    // Agregamos clase CSS si está agotado
    if (isOutOfStock) {
      tr.classList.add("product-row-out-of-stock");
    }

    let quantityHtml = "";

    if (isOutOfStock) {
      // Si no hay stock, mostramos mensaje y no botones
      quantityHtml = `<span class="stock-status-msg">AGOTADO</span>`;
    } else {
      // Si hay stock, botones normales
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

function buildClientWhatsAppMsg(items, header = "Hola, deseo comprar estos productos en Irenismb Stock Natura:") {
  let msg = header + "\n\n";
  let total = 0;
  items.forEach(it => {
    const sub = it.quantity * it.price;
    total += sub;
    msg += `• ${it.quantity} x ${it.name} = ${currencyFormatter.format(sub)}\n`;
  });
  msg += `\nTotal: ${currencyFormatter.format(total)}\n`;
  msg += `\nUbicación (GPS): https://maps.google.com/?q=11.244833370782679,-74.19066001689564`;
  msg += `\nInstagram: https://www.instagram.com/irenismb_stocknaturasm`;
  msg += `\nTikTok: https://www.tiktok.com/@irenismbstocknatura`;
  msg += `\nFacebook Marketplace: https://www.facebook.com/marketplace/profile/100084865295132`;
  msg += `\n\nGracias.`;
  return msg;
}

function handleWhatsAppClick() {
  const items = Object.values(cart).filter(it => it.quantity > 0);
  if (!items.length) {
    alert("El carrito está vacío. Agrega productos antes de comprar por WhatsApp.");
    return;
  }
  const phone = DEFAULT_WHATSAPP || contactWhatsappLink.textContent.replace(/[^\d]/g, "");
  const msg = buildClientWhatsAppMsg(items);
  const url = `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
  logVisit("whatsapp_compra", searchInput.value || "");
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

// Eventos en la tabla de productos
productTableBody.addEventListener("click", e => {
  const decBtn = e.target.closest(".decrease-btn");
  const incBtn = e.target.closest(".increase-btn");
  const tr = e.target.closest("tr");
  if (!tr) return;

  // Verificación extra: si el tr tiene la clase de agotado, no hacemos nada
  if (tr.classList.contains("product-row-out-of-stock")) return;

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

  // Clic en la fila para ver vista previa (evita los controles de cantidad)
  if (e.target.closest(".quantity-control") || e.target.classList.contains("quantity-input")) {
    return;
  }
  const productId = tr.getAttribute("data-product-id");
  if (!productId) return;
  const prod = products.find(p => String(p.id) === String(productId));
  if (prod) {
    showPreviewForProduct(prod);
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

// Ajustar enlace de contacto de WhatsApp
if (contactWhatsappLink) {
  const phone = DEFAULT_WHATSAPP;
  contactWhatsappLink.href = `https://wa.me/${encodeURIComponent(phone)}`;
}

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
  logVisit("visita", "");
})();
