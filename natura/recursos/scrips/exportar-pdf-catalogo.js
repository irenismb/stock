// ================== EXPORTACIÓN DE CATÁLOGOS A PDF ==================
// Nuevo flujo:
// 1) Catálogos definidos en la hoja por columnas tipo "Catalogo1", "Catalogo2"... (marcados con X)
// 2) Catálogo actual según filtros/búsqueda en la web
// 3) Opción global: "Solo productos con imágenes"
// 4) Mantener título/subtítulo personalizado persistente

// Requiere: config-estado-dom.js, utilidades-imagenes-galeria.js
//          y la librería jsPDF UMD cargada en catalogo.html

const PDF_PRODUCTS_PER_PAGE = 6;
const PDF_COLS = 2;
const PDF_ROWS = 3;

const PDF_CURRENT_KEY = "__current__";

// Cache simple de imágenes para el PDF
const pdfImageCache = new Map(); // url -> { dataUrl, format }

// Estado UI del modal
let availablePdfCatalogs = []; // [{ key, label, source, count }]
let selectedPdfCatalogKey = PDF_CURRENT_KEY;

// ---------- Utilidades base ----------
function getJsPDFClass() {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  if (window.jsPDF) return window.jsPDF;
  return null;
}

function safeArray(a) {
  return Array.isArray(a) ? a : [];
}

function todayLabel() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

// ---------- Subtítulo PDF (persistente) ----------
function loadSubtitleFromStorage() {
  if (!pdfCustomTitle) return "";
  try {
    const saved = localStorage.getItem(LS_PDF_SUBTITLE_KEY) || "";
    const val = String(saved).trim();
    pdfCustomTitle.value = val;
    return val;
  } catch (e) {
    return "";
  }
}

function saveSubtitleToStorage() {
  if (!pdfCustomTitle) return;
  try {
    const val = String(pdfCustomTitle.value || "").trim();
    if (!val) {
      localStorage.removeItem(LS_PDF_SUBTITLE_KEY);
    } else {
      localStorage.setItem(LS_PDF_SUBTITLE_KEY, val);
    }
  } catch (e) {}
}

function getCustomPdfSubtitle() {
  const raw = pdfCustomTitle ? String(pdfCustomTitle.value || "") : "";
  const t = raw.trim();
  if (t) return t;
  try {
    const saved = localStorage.getItem(LS_PDF_SUBTITLE_KEY) || "";
    return String(saved).trim();
  } catch (e) {
    return "";
  }
}

// Guardar mientras escribe (suave y sin ruido)
if (pdfCustomTitle) {
  pdfCustomTitle.addEventListener(
    "input",
    debounce(() => {
      saveSubtitleToStorage();
    }, 250)
  );
}

// ---------- Catálogo seleccionado (persistente) ----------
function loadSelectedCatalogFromStorage() {
  try {
    const saved = localStorage.getItem(LS_PDF_SELECTED_CATALOG_KEY);
    if (saved) selectedPdfCatalogKey = String(saved);
  } catch (e) {}
}

function saveSelectedCatalogToStorage() {
  try {
    localStorage.setItem(LS_PDF_SELECTED_CATALOG_KEY, String(selectedPdfCatalogKey));
  } catch (e) {}
}

// ---------- Detección de catálogos desde productos ----------
function normalizeCatalogKeyName(name) {
  return normalizeText(String(name || "")).replace(/\s+/g, "");
}

function extractSheetCatalogNamesFromProducts(list) {
  const outMap = new Map(); // norm -> label
  const arr = safeArray(list);

  arr.forEach(p => {
    if (!p) return;

    // Preferimos estructura esperada desde Apps Script:
    if (p.catalogos && typeof p.catalogos === "object") {
      Object.keys(p.catalogos).forEach(rawName => {
        const label = String(rawName || "").trim();
        if (!label) return;
        const norm = normalizeCatalogKeyName(label);
        if (!norm) return;

        // Solo columnas tipo Catalogo1, Catalogo2...
        if (/^catalogo\d+$/i.test(norm)) {
          if (!outMap.has(norm)) outMap.set(norm, label);
        }
      });
    } else {
      // Fallback por si aún no está el campo "catalogos"
      Object.keys(p).forEach(k => {
        const label = String(k || "").trim();
        const norm = normalizeCatalogKeyName(label);
        if (/^catalogo\d+$/i.test(norm)) {
          if (!outMap.has(norm)) outMap.set(norm, label);
        }
      });
    }
  });

  // Orden natural por número si aplica
  const labels = Array.from(outMap.entries())
    .map(([norm, label]) => ({ norm, label }))
    .sort((a, b) => {
      const na = parseInt(a.norm.replace("catalogo", ""), 10);
      const nb = parseInt(b.norm.replace("catalogo", ""), 10);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
    })
    .map(x => x.label);

  return labels;
}

function isMarkedXValue(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return false;
  return s === "x" || s === "✔" || s === "✓";
}

function isProductInSheetCatalog(prod, catalogName) {
  if (!prod || !catalogName) return false;

  // 1) Con estructura "catalogos"
  if (prod.catalogos && typeof prod.catalogos === "object") {
    // Intento exacto
    if (Object.prototype.hasOwnProperty.call(prod.catalogos, catalogName)) {
      return !!prod.catalogos[catalogName];
    }
    // Intento por normalización de claves
    const targetNorm = normalizeCatalogKeyName(catalogName);
    const keys = Object.keys(prod.catalogos);
    for (const k of keys) {
      if (normalizeCatalogKeyName(k) === targetNorm) {
        return !!prod.catalogos[k];
      }
    }
  }

  // 2) Fallback a propiedad directa
  if (Object.prototype.hasOwnProperty.call(prod, catalogName)) {
    return isMarkedXValue(prod[catalogName]) || prod[catalogName] === true;
  }

  return false;
}

function getProductsForCatalogKey(key) {
  if (key === PDF_CURRENT_KEY) {
    if (Array.isArray(currentFilteredProducts) && currentFilteredProducts.length) {
      return currentFilteredProducts;
    }
    return safeArray(products);
  }

  return safeArray(products).filter(p => isProductInSheetCatalog(p, key));
}

function buildAvailablePdfCatalogs() {
  const sheetCatalogs = extractSheetCatalogNamesFromProducts(products);

  const list = [];

  // 1) Catálogo actual
  const currentCount =
    (Array.isArray(currentFilteredProducts) && currentFilteredProducts.length)
      ? currentFilteredProducts.length
      : safeArray(products).length;

  list.push({
    key: PDF_CURRENT_KEY,
    label: "Catálogo actual (según filtros)",
    source: "current",
    count: currentCount
  });

  // 2) Catálogos desde la hoja
  sheetCatalogs.forEach(name => {
    const cCount = getProductsForCatalogKey(name).length;
    list.push({
      key: name,
      label: name,
      source: "sheet",
      count: cCount
    });
  });

  return list;
}

// ---------- Render de lista de catálogos ----------
function renderPdfCatalogList() {
  if (!pdfCatalogList) return;

  availablePdfCatalogs = buildAvailablePdfCatalogs();

  // Ajuste defensivo: si el seleccionado no existe, volvemos a actual
  const keys = new Set(availablePdfCatalogs.map(c => c.key));
  if (!keys.has(selectedPdfCatalogKey)) {
    selectedPdfCatalogKey = PDF_CURRENT_KEY;
    saveSelectedCatalogToStorage();
  }

  if (!availablePdfCatalogs.length) {
    pdfCatalogList.innerHTML =
      `<div class="pdf-empty">No hay catálogos disponibles aún.</div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  availablePdfCatalogs.forEach(cat => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pdf-catalog-item";
    btn.setAttribute("role", "listitem");
    btn.dataset.key = cat.key;

    if (cat.key === selectedPdfCatalogKey) {
      btn.classList.add("is-active");
    }

    const countLabel = Number.isFinite(cat.count) ? cat.count : 0;

    btn.innerHTML = `
      <span class="pdf-catalog-name">${escapeHtml(cat.label)}</span>
      <span class="pdf-catalog-count">${countLabel} producto${countLabel === 1 ? "" : "s"}</span>
    `;

    frag.appendChild(btn);
  });

  pdfCatalogList.innerHTML = "";
  pdfCatalogList.appendChild(frag);
}

if (pdfCatalogList) {
  pdfCatalogList.addEventListener("click", e => {
    const btn = e.target.closest(".pdf-catalog-item");
    if (!btn) return;
    const key = btn.dataset.key;
    if (!key) return;

    selectedPdfCatalogKey = key;
    saveSelectedCatalogToStorage();

    // Actualizar estilos activos
    pdfCatalogList.querySelectorAll(".pdf-catalog-item").forEach(b => {
      b.classList.toggle("is-active", b === btn);
    });
  });
}

// ---------- Modal ----------
function openPdfModal() {
  if (!pdfModal) return;
  loadSubtitleFromStorage();
  loadSelectedCatalogFromStorage();
  renderPdfCatalogList();
  pdfModal.classList.add("open");
  pdfModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  try { pdfCustomTitle && pdfCustomTitle.focus(); } catch (e) {}
}

function closePdfModal() {
  if (!pdfModal) return;
  saveSubtitleToStorage();
  saveSelectedCatalogToStorage();
  pdfModal.classList.remove("open");
  pdfModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

if (pdfBtn) {
  pdfBtn.addEventListener("click", openPdfModal);
}
if (pdfModalClose) {
  pdfModalClose.addEventListener("click", closePdfModal);
}
if (pdfModalBackdrop) {
  pdfModalBackdrop.addEventListener("click", closePdfModal);
}
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && pdfModal && pdfModal.classList.contains("open")) {
    closePdfModal();
  }
});

// ---------- Carga de imágenes para PDF ----------
async function urlToDataUrl(url) {
  try {
    const resp = await fetch(url, { cache: "force-cache" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

async function dataUrlToJpegDataUrl(dataUrl) {
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = dataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    const canvas = document.createElement("canvas");
    const w = img.naturalWidth || 300;
    const h = img.naturalHeight || 300;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.88);
  } catch (e) {
    return null;
  }
}

async function loadImageForPdf(url) {
  if (!url) return null;
  if (pdfImageCache.has(url)) return pdfImageCache.get(url);
  const raw = await urlToDataUrl(url);
  if (!raw) {
    pdfImageCache.set(url, null);
    return null;
  }
  const jpg = await dataUrlToJpegDataUrl(raw);
  const pack = jpg ? { dataUrl: jpg, format: "JPEG" } : null;
  pdfImageCache.set(url, pack);
  return pack;
}

// ---------- Encabezado ----------
function drawHeader(doc, pageW, companyName, customSubtitle, logoPack, pageIndex, totalPages) {
  const marginX = 10;
  const headerY = 8;

  doc.setDrawColor(226, 232, 240);

  if (logoPack && logoPack.dataUrl) {
    try {
      doc.addImage(logoPack.dataUrl, logoPack.format, marginX, headerY, 12, 12);
    } catch (e) {}
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(companyName, marginX + 16, headerY + 8);

  if (customSubtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(customSubtitle, marginX + 16, headerY + 13);
  }

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const pageLabel = `Página ${pageIndex + 1} de ${totalPages}`;
  doc.text(pageLabel, pageW - marginX, headerY + 8, { align: "right" });

  doc.line(marginX, 22, pageW - marginX, 22);
}

// ---------- Tarjeta de producto (SIN descripción) ----------
function drawProductCard(doc, p, x, y, w, h, options) {
  const { imgPack, includePrices } = options;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);

  try {
    doc.roundedRect(x, y, w, h, 3, 3, "FD");
  } catch (e) {
    doc.rect(x, y, w, h, "FD");
  }

  const pad = 4;
  const innerX = x + pad;
  const innerY = y + pad;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const maxByHeight = innerH * 0.78;
  const imgSize = Math.max(32, Math.min(innerW, maxByHeight));
  const imgW = imgSize;
  const imgH = imgSize;
  const imgY = innerY;
  const imgX = innerX + (innerW - imgW) / 2;

  if (imgPack && imgPack.dataUrl) {
    try {
      doc.addImage(imgPack.dataUrl, imgPack.format, imgX, imgY, imgW, imgH);
    } catch (e) {
      doc.setDrawColor(226, 232, 240);
      doc.rect(imgX, imgY, imgW, imgH);
    }
  } else {
    doc.setDrawColor(226, 232, 240);
    doc.rect(imgX, imgY, imgW, imgH);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Sin imagen", imgX + imgW / 2, imgY + imgH / 2, { align: "center" });
  }

  let cursorY = imgY + imgH + 4;

  const name = (p.name || p.nombre || "").toString().trim();
  const marca = (p.marca || "").toString().trim();
  const category = (p.category || p.categoria || "").toString().trim();
  const price = Number(p.valor_unitario || p.precio || 0) || 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.2);
  doc.setTextColor(15, 23, 42);

  const nameLines = doc.splitTextToSize(name || "Producto", innerW);
  const limitedName = nameLines.slice(0, 2);
  doc.text(limitedName, innerX, cursorY);
  cursorY += limitedName.length * 4.3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(71, 85, 105);

  const subText = [marca, category].filter(Boolean).join(" • ");
  if (subText) {
    const subLines = doc.splitTextToSize(subText, innerW);
    doc.text(subLines.slice(0, 1), innerX, cursorY);
    cursorY += 4.2;
  }

  if (includePrices) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(5, 150, 105);
    doc.text(currencyFormatter.format(price), innerX, cursorY + 1);
  }
}

// ---------- Helpers de selección por imágenes ----------
async function filterProductsOnlyWithImages(list) {
  const arr = safeArray(list);
  if (!arr.length) return [];

  // Usamos la función ya existente que prueba si existe la imagen principal .webp
  const checks = await Promise.all(
    arr.map(async p => {
      try {
        const url = await resolveImageForCode(p && p.id);
        return !!url;
      } catch (e) {
        return false;
      }
    })
  );

  return arr.filter((_, idx) => checks[idx]);
}

// ---------- Generación del PDF desde lista ----------
function chunkArray(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

async function generatePdfFromProducts(selectedProducts, selectedLabelForFile) {
  const jsPDF = getJsPDFClass();
  if (!jsPDF) {
    alert("No se pudo cargar la librería de PDF. Verifica tu conexión o el enlace de jsPDF.");
    return;
  }

  const arr = safeArray(selectedProducts);

  if (!arr.length) {
    alert("No hay productos para este catálogo.");
    return;
  }

  const includePrices = !!(pdfIncludePrices && pdfIncludePrices.checked);

  // Orden alfabético por nombre
  arr.sort((a, b) => {
    const na = (a.name || a.nombre || "").toString();
    const nb = (b.name || b.nombre || "").toString();
    const cmp = na.localeCompare(nb, "es", { sensitivity: "base" });
    if (cmp !== 0) return cmp;
    return String(a.id).localeCompare(String(b.id));
  });

  const pages = chunkArray(arr, PDF_PRODUCTS_PER_PAGE);
  const totalPages = pages.length;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  let logoUrl = null;
  try {
    logoUrl = await resolveOtherImage("logo_empresa");
  } catch (e) {}
  const logoPack = logoUrl ? await loadImageForPdf(logoUrl) : null;

  const companyName = "Irenismb Stock Natura";
  const customSubtitle = getCustomPdfSubtitle();

  const marginX = 10;
  const headerBottomY = 24;
  const bottomMargin = 10;
  const gapX = 6;
  const gapY = 6;

  const usableW = pageW - marginX * 2;
  const usableH = pageH - headerBottomY - bottomMargin;

  const cardW = (usableW - gapX) / PDF_COLS;
  const cardH = (usableH - gapY * (PDF_ROWS - 1)) / PDF_ROWS;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    if (pageIndex > 0) doc.addPage();

    drawHeader(doc, pageW, companyName, customSubtitle, logoPack, pageIndex, totalPages);

    const pageItems = pages[pageIndex];

    for (let i = 0; i < pageItems.length; i++) {
      const p = pageItems[i];
      const row = Math.floor(i / PDF_COLS);
      const col = i % PDF_COLS;

      const x = marginX + col * (cardW + gapX);
      const y = headerBottomY + row * (cardH + gapY);

      const imgUrl = `${IMG_BASE_PATH}${encodeURIComponent(p.id)}.webp`;
      const imgPack = await loadImageForPdf(imgUrl);

      drawProductCard(doc, p, x, y, cardW, cardH, {
        imgPack,
        includePrices
      });
    }
  }

  // Guardamos por si generas sin cerrar el modal
  saveSubtitleToStorage();

  const labelSlug = slugify(selectedLabelForFile || "catalogo");
  const subSlug = slugify(customSubtitle || "sin-titulo");

  const filename = `catalogo-${labelSlug}-${subSlug}-${todayLabel()}.pdf`;
  doc.save(filename);
}

// ---------- Acción principal del botón Generar ----------
async function handleGeneratePdfClick() {
  const selectedMeta =
    availablePdfCatalogs.find(c => c.key === selectedPdfCatalogKey) ||
    { key: selectedPdfCatalogKey, label: selectedPdfCatalogKey };

  let baseList = getProductsForCatalogKey(selectedPdfCatalogKey);

  // Opción global: solo con imágenes
  if (pdfOnlyWithImages && pdfOnlyWithImages.checked) {
    baseList = await filterProductsOnlyWithImages(baseList);
  }

  if (!baseList.length) {
    const msg =
      (pdfOnlyWithImages && pdfOnlyWithImages.checked)
        ? "No hay productos con imágenes para este catálogo."
        : "No hay productos para este catálogo.";
    alert(msg);
    return;
  }

  await generatePdfFromProducts(baseList, selectedMeta.label);
}

// Botón generar
if (pdfGenerateBtn) {
  pdfGenerateBtn.addEventListener("click", async () => {
    try {
      pdfGenerateBtn.disabled = true;
      pdfGenerateBtn.classList.add("is-loading");
      await handleGeneratePdfClick();
    } catch (e) {
      console.error("Error generando PDF:", e);
      alert("Ocurrió un error generando el PDF. Revisa la consola para más detalles.");
    } finally {
      pdfGenerateBtn.disabled = false;
      pdfGenerateBtn.classList.remove("is-loading");
    }
  });
}

