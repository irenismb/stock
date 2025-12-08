// ================== FILTROS (CATEGORÍA / MARCA / BÚSQUEDA) ==================
//
// ✅ NUEVA REGLA DE VISIBILIDAD (SEGÚN TU SOLICITUD):
// - Los productos con stock = 0 SÍ deben estar disponibles como los demás.
// - Los NO disponibles serán únicamente los que en la columna
//   "mostrar_catalogo" tengan la palabra "no" (sin discriminar capitalización).
//
// Regla:
// - Si existe el campo mostrar_catalogo y su valor es "no" => NO mostrar.
// - Cualquier otro valor (incluyendo vacío) => mostrar.
// - Si la columna no existe => mostrar por defecto.
//

function hasOwn(obj, key) {
  return obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function shouldShowInCatalog(p) {
  if (!p) return false;

  if (hasOwn(p, "mostrar_catalogo")) {
    const s = String(p.mostrar_catalogo ?? "")
      .trim()
      .toLowerCase();
    if (s === "no") return false;
  }

  return true;
}

// ✅ MEJORADO (según nueva regla):
// Limpia el carrito SOLO de productos que ya no estén visibles
// o que ya no existan en el backend.
// NO elimina por stock.
function pruneCartAgainstVisibleProducts() {
  try {
    if (!cart || typeof cart !== "object") return;

    // products ya está filtrado por shouldShowInCatalog
    const allowedMap = new Map((products || []).map(p => [String(p.id), p]));
    let changed = false;

    Object.keys(cart).forEach(id => {
      const p = allowedMap.get(String(id));
      // Si no existe o ya no es visible => eliminar del carrito
      if (!p) {
        delete cart[id];
        changed = true;
      }
    });

    if (changed && typeof updateCart === "function") {
      updateCart();
    } else if (changed) {
      // Por si el orden de carga cambiara en el futuro
      try {
        localStorage.setItem(LS_CART_KEY, JSON.stringify(cart));
      } catch (e) {}
    }
  } catch (e) {}
}

// ----------------------------------------------------------------

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
      <input type="radio" name="category" value="Todas" ${
        catSaved === "Todas" ? "checked" : ""
      }>
      Todas
    </label>`,
    ...allCategories.map(
      c => `
      <label style="display:block;margin-bottom:4px;">
        <input type="radio"
               name="category"
               value="${escapeAttr(c.key)}"
               data-label="${escapeAttr(c.label)}"
               ${c.key === catSaved ? "checked" : ""}>
        ${escapeHtml(c.label)}
      </label>
    `
    )
  ];
  categoryMenu.innerHTML = categoryOptionsHtml.join("");

  const brandHtml = [
    `<label style="display:block;margin-bottom:4px;">
      <input type="radio" name="brand" value="Todas" ${
        brandSaved === "Todas" ? "checked" : ""
      }> Todas
    </label>`,
    ...allBrands.map(
      b => `
      <label style="display:block;margin-bottom:4px;">
        <input type="radio"
               name="brand"
               value="${escapeAttr(b.key)}"
               data-label="${escapeAttr(b.label)}"
               ${b.key === brandSaved ? "checked" : ""}>
        ${escapeHtml(b.label)}
      </label>
    `
    )
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
    // Si se selecciona algo, cerramos el panel de filtros en móvil
    if (filtersRow && filtersRow.classList.contains("is-open")) {
      filtersRow.classList.remove("is-open");
      if (mobileFiltersBtn) mobileFiltersBtn.setAttribute("aria-pressed", "false");
    }
  });

  brandMenu.addEventListener("change", () => {
    saveFiltersToStorage();
    filterAndDisplayProducts();
    updateBrandButtonLabel();
    closeDropdowns();
    // También cerramos el panel de filtros al elegir marca en móvil
    if (filtersRow && filtersRow.classList.contains("is-open")) {
      filtersRow.classList.remove("is-open");
      if (mobileFiltersBtn) mobileFiltersBtn.setAttribute("aria-pressed", "false");
    }
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
  searchInput.addEventListener(
    "input",
    debounce(() => {
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
    }, 500)
  );

  // Botón de filtros en móvil → mostrar/ocultar bloque de filtros
  if (mobileFiltersBtn && filtersRow) {
    mobileFiltersBtn.addEventListener("click", () => {
      const isOpen = filtersRow.classList.toggle("is-open");
      mobileFiltersBtn.setAttribute("aria-pressed", isOpen ? "true" : "false");
    });
  }
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

    // 1) Normalizamos y preservamos columnas extras del backend
    const normalized = data.products.map(p => {
      const valor = Number(p.valor_unitario);
      let rawStock = p.stock;
      let stockNum = 9999;
      if (rawStock !== undefined && rawStock !== null && rawStock !== "") {
        stockNum = Number(rawStock);
        if (isNaN(stockNum)) stockNum = 9999;
      }
      return {
        ...p,
        valor_unitario: Number.isFinite(valor) ? valor : 0,
        stock: stockNum
      };
    });

    // 2) Aplicamos la nueva visibilidad por mostrar_catalogo
    products = normalized.filter(shouldShowInCatalog);

    // 3) Limpiamos carrito solo por visibilidad/ existencia
    pruneCartAgainstVisibleProducts();

    refreshFilters();
    setupFilterListenersOnce();
    filterAndDisplayProducts();
  } catch (err) {
    console.error("Error al cargar productos:", err);
    productTableBody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;">Error al cargar productos.</td></tr>';
  }
}

/**
 * Orden por defecto → alfabético por nombre de producto.
 * Si hay empate, se usa el id como desempate.
 */
function sortByOrdenThenId(list) {
  list.sort((a, b) => {
    const nameA = (a.name || "").toString();
    const nameB = (b.name || "").toString();
    const cmp = nameA.localeCompare(nameB, "es", { sensitivity: "base" });
    if (cmp !== 0) return cmp;
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

  // En móviles: siempre mostrar el primer producto de la lista actual.
  // En PC: intentar mantener el producto que ya estaba seleccionado.
  const isMobile = window.innerWidth <= 768;
  let index = -1;

  if (!isMobile && currentPreviewProductId != null) {
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
    // Orden por defecto: alfabético por nombre
    sortByOrdenThenId(list);
  }

  // Guardar lista filtrada actual y mostrar en tabla
  currentFilteredProducts = list;
  displayProducts(list);

  // Ajustar vista previa (con comportamiento especial en móvil)
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

    const tr = document.createElement("tr");
    tr.setAttribute("data-product-id", p.id);

    const thumbSrc = IMG_BASE_PATH + encodeURIComponent(p.id) + ".webp";

    // ✅ NUEVO: SIEMPRE mostrar controles de cantidad
    const quantityHtml = `
      <div class="quantity-control">
        <button type="button" class="quantity-btn decrease-btn" aria-label="Disminuir">-</button>
        <input type="number" class="quantity-input" min="0" value="${qty}"
          data-price="${unitPrice}" data-id="${escapeAttr(p.id)}" data-name="${escapeAttr(
      p.name
    )}">
        <button type="button" class="quantity-btn increase-btn" aria-label="Aumentar">+</button>
      </div>
    `;

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
      <td data-label="Valor unitario" class="price-cell">${currencyFormatter.format(
        unitPrice
      )}</td>
      <td data-label="Cantidad">
        ${quantityHtml}
      </td>
      <td data-label="Total" class="price-cell total-pay">${currencyFormatter.format(
        subtotal
      )}</td>
    `;

    frag.appendChild(tr);
  });

  productTableBody.innerHTML = "";
  productTableBody.appendChild(frag);
}

