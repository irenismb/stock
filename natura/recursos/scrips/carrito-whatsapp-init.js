// ================== CARRITO Y WHATSAPP ==================
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
    cartList.innerHTML = items
      .map(it => {
        const sub = it.quantity * it.price;
        total += sub;
        return `
        <li class="cart-item">
          <span class="cart-item-title">${it.quantity} x ${escapeHtml(
          it.name
        )} <strong>(${currencyFormatter.format(sub)})</strong></span>
          <button class="remove-item-btn" data-id="${escapeAttr(it.id)}">X</button>
        </li>
      `;
      })
      .join("");
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

// ✅ Nuevo: detectar móvil vs PC (app en móvil, web en PC)
function isMobileDevice() {
  try {
    const ua = (navigator.userAgent || "").toLowerCase();
    const byUA = /android|iphone|ipad|ipod|iemobile|opera mini/.test(ua);
    const byPointer = window.matchMedia && window.matchMedia("(pointer:coarse)").matches;
    return Boolean(byUA || byPointer);
  } catch (e) {
    return false;
  }
}

function buildWhatsAppUrl(phone, msg) {
  const p = String(phone || "").replace(/[^\d]/g, ""); // solo dígitos
  const t = String(msg || "");
  if (isMobileDevice()) {
    // App en móvil (o prompt)
    return `https://wa.me/${encodeURIComponent(p)}?text=${encodeURIComponent(t)}`;
  }
  // Web solo en PC
  return `https://web.whatsapp.com/send?phone=${encodeURIComponent(p)}&text=${encodeURIComponent(t)}`;
}

function handleWhatsAppClick() {
  const items = Object.values(cart).filter(it => it.quantity > 0);
  if (!items.length) {
    alert("El carrito está vacío. Agrega productos antes de comprar por WhatsApp.");
    return;
  }
  const phone = DEFAULT_WHATSAPP;
  const msg = buildClientWhatsAppMsg(items);

  // ✅ Cambio clave: app en móvil / web en PC
  const url = buildWhatsAppUrl(phone, msg);

  window.open(url, "_blank");

  // ✅ Guard extra por robustez
  if (typeof sendVisitEvent === "function") {
    sendVisitEvent("update", { clickText: "whatsapp_compra" });
  }
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

// ================== EVENTOS EN LA TABLA / CARRITO ==================
productTableBody.addEventListener("click", e => {
  const decBtn = e.target.closest(".decrease-btn");
  const incBtn = e.target.closest(".increase-btn");
  const tr = e.target.closest("tr");
  if (!tr) return;
  const productId = tr.getAttribute("data-product-id");

  // Clic en la miniatura → vista previa + modal grande
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
      currentPreviewProductIndex = idx !== -1 ? idx : 0;
      currentPreviewProductId = prod.id;
      showPreviewForProduct(prod);
      const clickName = prod.name || prod.nombre || "";
      if (clickName && typeof sendVisitEvent === "function") {
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
    currentPreviewProductIndex = idx !== -1 ? idx : 0;
    currentPreviewProductId = prod.id;
    showPreviewForProduct(prod);
    const clickName = prod.name || prod.nombre || "";
    if (typeof sendVisitEvent === "function") {
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

// ================== MODAL DEL CARRITO (VISTA MÓVIL) ==================
function openCartModal() {
  if (!cartModal) return;
  cartModal.classList.add("open");
  cartModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeCartModal() {
  if (!cartModal) return;
  cartModal.classList.remove("open");
  cartModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
if (mobileCartBtn && cartModal) {
  mobileCartBtn.addEventListener("click", openCartModal);
}
if (cartModalClose) {
  cartModalClose.addEventListener("click", closeCartModal);
}
if (cartModalBackdrop) {
  cartModalBackdrop.addEventListener("click", closeCartModal);
}
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && cartModal && cartModal.classList.contains("open")) {
    closeCartModal();
  }
});

// Click en botón de WhatsApp (dentro del carrito)
whatsappBtn.addEventListener("click", handleWhatsAppClick);

// ================== AUTO REFRESCO DE PRODUCTOS ==================
function setupAutoRefresh() {
  if (!AUTO_REFRESH_MS || AUTO_REFRESH_MS <= 0) return;
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    fetchProductsFromBackend();
  }, AUTO_REFRESH_MS);
}

// ================== INICIALIZACIÓN GENERAL ==================
(function init() {
  ensureBrowserId();
  loadCartFromStorage();
  updateCart();
  fetchProductsFromBackend();
  setupAutoRefresh();
  userName = detectDeviceLabel();
  ensureSessionId();
  if (typeof sendVisitEvent === "function") {
    sendVisitEvent("start");
  }
  if (typeof initClientLocation === "function") {
    initClientLocation();
  }
})();

// Registrar SALIDA del catálogo
window.addEventListener("beforeunload", function () {
  try {
    if (typeof sendVisitEvent === "function") {
      sendVisitEvent("end");
    }
  } catch (e) {
    console.error("Error al registrar salida:", e);
  }
});

/**
 * Fondos fijos usando tus archivos en recursos/otras_imagenes:
 * - logo_pagina.webp              → BODY
 * - logo_panel_de_controles.webp  → .container
 * - logo_encabezado.webp          → .site-header
 *
 * Si usas otra extensión, CAMBIA .webp por .png / .jpg / .jpeg según corresponda.
 */
(function setStaticBackgrounds() {
  try {
    const pageBg   = "recursos/otras_imagenes/logo_pagina.webp";
    const panelBg  = "recursos/otras_imagenes/logo_panel_de_controles.webp";
    const headerBg = "recursos/otras_imagenes/logo_encabezado.webp";
    console.log("[Fondos] Usando:", { pageBg, panelBg, headerBg });

    if (pageBg) {
      document.body.style.backgroundImage = `url("${pageBg}")`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundAttachment = "fixed";
    }

    const container = document.querySelector(".container");
    if (container && panelBg) {
      container.style.backgroundImage = `url("${panelBg}")`;
      container.style.backgroundSize = "cover";
      container.style.backgroundPosition = "center";
      container.style.backgroundRepeat = "no-repeat";
    }

    const header = document.querySelector(".site-header");
    if (header && headerBg) {
      header.style.backgroundImage = `url("${headerBg}")`;
      header.style.backgroundSize = "cover";
      header.style.backgroundPosition = "center";
      header.style.backgroundRepeat = "no-repeat";
    }
  } catch (e) {
    console.error("No se pudieron aplicar los fondos estáticos:", e);
  }
})();

