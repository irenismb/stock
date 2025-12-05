// ================== UTILIDADES GENERALES ==================
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

// ======== BROWSER ID (IDENTIFICADOR DE NAVEGADOR) ========
function generateBrowserId() {
  // 1) Si el navegador soporta randomUUID
  try {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
  } catch (e) {}

  // 2) Si soporta getRandomValues
  try {
    const cryptoObj = window.crypto || window.msCrypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
      const arr = new Uint8Array(16);
      cryptoObj.getRandomValues(arr);
      return Array.from(arr)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (e) {}

  // 3) Fallback simple
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function ensureBrowserId() {
  try {
    let id = localStorage.getItem(BROWSER_ID_LS_KEY);
    if (!id) {
      id = generateBrowserId();
      localStorage.setItem(BROWSER_ID_LS_KEY, id);
    }
    browserId = id;
    return id;
  } catch (e) {
    // Si localStorage falla (modo incógnito raro), generamos uno en memoria
    browserId = generateBrowserId();
    return browserId;
  }
}

// ======== SESIÓN (ID POR SESIÓN) ========
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

// ================== IMÁGENES (UNA POR PRODUCTO) ==================
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

// ================== NAVEGACIÓN ENTRE PRODUCTOS ==================
function updateNavButtons() {
  const len = currentFilteredProducts && currentFilteredProducts.length
    ? currentFilteredProducts.length
    : 0;
  const disabled = len <= 1;
  if (galleryPrevBtn) galleryPrevBtn.disabled = disabled;
  if (galleryNextBtn) galleryNextBtn.disabled = disabled;
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
  previewImg.alt = name ? `Foto ${name}` : "Imagen del producto";

  updateNavButtons();

  if (imageStatus) {
    imageStatus.textContent = "Cargando imagen...";
    imageStatus.classList.add("visible");
  }

  const imgUrl = await resolveImageForCode(prod.id);

  // Evitar condiciones de carrera si el usuario cambia rápido de producto
  if (requestId !== lastPreviewRequestId) return;

  if (!imgUrl) {
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

  previewImg.style.display = "block";
  previewImg.src = imgUrl;
}

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

// Botones prev/next → producto anterior/siguiente
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

  el.addEventListener(
    "touchstart",
    e => {
      startX = e.changedTouches[0].clientX;
    },
    { passive: true }
  );

  el.addEventListener(
    "touchend",
    e => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;

      if (Math.abs(dx) > 40) {
        if (dx > 0) showRelativeProduct(-1);
        else showRelativeProduct(1);
      }
      startX = null;
    },
    { passive: true }
  );
})(document.querySelector(".stage"));

// Navegación con teclado en el panel de vista previa
if (productPreview) {
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
}

// Clic sobre la imagen grande de la vista previa → abrir modal
if (previewImg) {
  previewImg.addEventListener("click", () => {
    const src = previewImg.currentSrc || previewImg.src;
    if (!src) return;

    const alt =
      previewImg.alt ||
      (previewName && previewName.textContent) ||
      "Imagen ampliada del producto";

    openImageModal(src, alt);
  });
}

