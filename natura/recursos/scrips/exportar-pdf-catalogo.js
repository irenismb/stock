// ================== EXPORTACIÓN DE CATÁLOGO A PDF ==================
// Requiere: config-estado-dom.js, utilidades-imagenes-galeria.js
//          y la librería jsPDF UMD cargada en catalogo.html

const PDF_PRODUCTS_PER_PAGE = 6; // ✅ máximo 6 por página
const PDF_COLS = 2;
const PDF_ROWS = 3;

// ✅ Nuevo umbral para decidir si el resumen puede ir en la última página
const PDF_INLINE_TOTAL_MIN_FREE_H = 28; // mm mínimos libres para insertar resumen en la última página

// ✅ QR en encabezado
const PDF_QR_TARGET_URL = "https://irenismb.github.io/stock/natura/catalogo.html";
const PDF_QR_SIZE_PX = 180; // tamaño de generación del QR (imagen)
const PDF_QR_SIZE_MM = 14;  // tamaño de impresión dentro del PDF

// Estado de selección para exportar
const pdfSelection = new Set(); // ids como string

// Cache simple de imágenes para el PDF
const pdfImageCache = new Map(); // url -> { dataUrl, format }

// Cache específico para QR
const pdfQrCache = new Map(); // targetUrl -> { dataUrl, format }

// ---------- Utilidades ----------
function getJsPDFClass() {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  if (window.jsPDF) return window.jsPDF;
  return null;
}

function safeArray(a) {
  return Array.isArray(a) ? a : [];
}

function getBaseListForPdfModal() {
  if (Array.isArray(currentFilteredProducts) && currentFilteredProducts.length) {
    return currentFilteredProducts;
  }
  return safeArray(products);
}

function getProductById(id) {
  const sid = String(id);
  const p =
    safeArray(products).find(x => String(x.id) === sid) ||
    safeArray(currentFilteredProducts).find(x => String(x.id) === sid);
  return p || null;
}

function chunkArray(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

function todayLabel() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Formato amigable de WhatsApp para metaLine en el header del PDF
function formatWhatsAppNumber(raw) {
  const s = String(raw || "").replace(/\D/g, "");
  if (!s) return "";
  if (s.startsWith("57") && s.length === 12) {
    return `+57 ${s.slice(2, 5)} ${s.slice(5, 8)} ${s.slice(8, 12)}`;
  }
  return `+${s}`;
}

// Construir URL de QR usando un generador público de PNG
function buildQrApiUrl(data, sizePx) {
  const sz = Math.max(120, Number(sizePx) || 180);
  return (
    "https://api.qrserver.com/v1/create-qr-code/" +
    `?format=png&size=${sz}x${sz}&data=${encodeURIComponent(String(data || ""))}`
  );
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

// Guardar mientras escribe
if (pdfCustomTitle) {
  pdfCustomTitle.addEventListener(
    "input",
    debounce(() => {
      saveSubtitleToStorage();
    }, 250)
  );
}

// ---------- Modal ----------
function openPdfModal() {
  if (!pdfModal) return;
  loadSubtitleFromStorage();
  renderPdfSelectionList();
  pdfModal.classList.add("open");
  pdfModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  try { pdfCustomTitle && pdfCustomTitle.focus(); } catch (e) {}
}

function closePdfModal() {
  if (!pdfModal) return;
  saveSubtitleToStorage();
  pdfModal.classList.remove("open");
  pdfModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

if (pdfBtn) {
  pdfBtn.addEventListener("click", openPdfModal);
}
if (pdfBtnMobile) {
  pdfBtnMobile.addEventListener("click", openPdfModal);
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

// ---------- Render de lista seleccionable ----------
function renderPdfSelectionList() {
  if (!pdfProductList) return;
  const baseList = getBaseListForPdfModal();
  if (!baseList.length) {
    pdfProductList.innerHTML =
      `<div class="pdf-empty">No hay productos cargados aún.</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  baseList.forEach(p => {
    const id = String(p.id);
    const checked = pdfSelection.has(id);
    const thumbSrc = IMG_BASE_PATH + encodeURIComponent(p.id) + ".webp";
    const price = Number(p.valor_unitario) || 0;
    const label = document.createElement("label");
    label.className = "pdf-product-item";
    label.setAttribute("role", "listitem");
    label.innerHTML = `
      <input
        type="checkbox"
        class="pdf-product-check"
        data-id="${escapeAttr(id)}"
        ${checked ? "checked" : ""}
      >
      <img
        class="pdf-product-thumb"
        loading="lazy"
        src="${thumbSrc}"
        alt="Imagen ${escapeAttr(p.name)}"
        onerror="this.style.visibility='hidden';"
      >
      <div class="pdf-product-meta">
        <div class="pdf-product-name">${escapeHtml(p.name)}</div>
        <div class="pdf-product-sub">
          ${escapeHtml(p.marca || "")}${p.marca && p.category ? " • " : ""}
          ${escapeHtml(p.category || "")}
        </div>
        <div class="pdf-product-price">
          ${currencyFormatter.format(price)}
        </div>
      </div>
    `;
    frag.appendChild(label);
  });
  pdfProductList.innerHTML = "";
  pdfProductList.appendChild(frag);
}

// Delegación de cambios de checkbox
if (pdfProductList) {
  pdfProductList.addEventListener("change", e => {
    const chk = e.target;
    if (!chk || !chk.classList.contains("pdf-product-check")) return;
    const id = chk.dataset.id;
    if (!id) return;
    if (chk.checked) pdfSelection.add(String(id));
    else pdfSelection.delete(String(id));
  });
}

// ---------- Botones de selección rápida ----------
function selectAllFrom(list) {
  pdfSelection.clear();
  list.forEach(p => {
    if (p && p.id != null) pdfSelection.add(String(p.id));
  });
  renderPdfSelectionList();
}

function selectNone() {
  pdfSelection.clear();
  renderPdfSelectionList();
}

function selectFiltered() {
  const list = getBaseListForPdfModal();
  selectAllFrom(list);
}

function selectFromCart() {
  const items = Object.values(cart || {}).filter(it => it && it.quantity > 0);
  if (!items.length) {
    alert("Tu carrito está vacío. Primero agrega productos si deseas usar esta opción.");
    return;
  }
  pdfSelection.clear();
  items.forEach(it => pdfSelection.add(String(it.id)));
  renderPdfSelectionList();
}

if (pdfSelectAllBtn) {
  pdfSelectAllBtn.addEventListener("click", () => selectAllFrom(safeArray(products)));
}
if (pdfSelectNoneBtn) {
  pdfSelectNoneBtn.addEventListener("click", selectNone);
}
if (pdfSelectFilteredBtn) {
  pdfSelectFilteredBtn.addEventListener("click", selectFiltered);
}
if (pdfSelectCartBtn) {
  pdfSelectCartBtn.addEventListener("click", selectFromCart);
}

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

// Cargar QR sin convertir a JPEG
async function loadQrForPdf(targetUrl) {
  const key = String(targetUrl || "").trim();
  if (!key) return null;
  if (pdfQrCache.has(key)) return pdfQrCache.get(key);
  const qrUrl = buildQrApiUrl(key, PDF_QR_SIZE_PX);
  const raw = await urlToDataUrl(qrUrl);
  if (!raw) {
    pdfQrCache.set(key, null);
    return null;
  }
  let format = "PNG";
  if (raw.startsWith("data:image/jpeg")) format = "JPEG";
  const pack = { dataUrl: raw, format };
  pdfQrCache.set(key, pack);
  return pack;
}

// ---------- Encabezado (CON QR A LA DERECHA) ----------
function drawHeader(
  doc,
  pageW,
  companyName,
  catalogName,
  metaLine,
  logoPack,
  qrPack,
  pageIndex,
  totalPages
) {
  const headerMarginX = 12;
  const headerY = 8;

  // Logo
  doc.setDrawColor(226, 232, 240);
  if (logoPack && logoPack.dataUrl) {
    try {
      doc.addImage(logoPack.dataUrl, logoPack.format, headerMarginX, headerY, 11, 11);
    } catch (e) {}
  }

  // QR en el lado derecho
  if (qrPack && qrPack.dataUrl) {
    const qrSize = PDF_QR_SIZE_MM;
    const qrX = pageW - headerMarginX - qrSize;
    const qrY = headerY + 1;
    try {
      doc.addImage(qrPack.dataUrl, qrPack.format, qrX, qrY, qrSize, qrSize);
      doc.setDrawColor(226, 232, 240);
      doc.rect(qrX, qrY, qrSize, qrSize);
    } catch (e) {}
  }

  // Texto izquierda
  let textX = headerMarginX + 15;
  let lineY = headerY + 6.2;

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text(companyName, textX, lineY);

  if (catalogName) {
    lineY += 4.4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    doc.setTextColor(51, 65, 85);
    doc.text(catalogName, textX, lineY);
  }

  if (metaLine) {
    lineY += 4.0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(metaLine, textX, lineY);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  doc.setTextColor(100, 116, 139);
  const pageLabel = `Página ${pageIndex + 1} de ${totalPages}`;
  doc.text(pageLabel, pageW - headerMarginX, headerY + 18, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.line(headerMarginX, 27, pageW - headerMarginX, 27);

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

  const name = (p.name || "").toString().trim();
  const marca = (p.marca || "").toString().trim();
  const category = (p.category || "").toString().trim();
  const price = Number(p.valor_unitario) || 0;

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

// ✅ NUEVO: Resumen inline para evitar página casi vacía
function drawInlineTotalSummary(doc, pageW, y, data) {
  const { itemCount, totalValue } = data;

  const marginX = 12;
  const boxW = pageW - marginX * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Resumen del catálogo", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  doc.setTextColor(71, 85, 105);
  const desc = "Suma de los precios unitarios de los productos seleccionados.";
  const descLines = doc.splitTextToSize(desc, boxW);
  doc.text(descLines.slice(0, 2), marginX, y + 5);

  const boxY = y + 10;
  const boxH = 22;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  try {
    doc.roundedRect(marginX, boxY, boxW, boxH, 3, 3, "FD");
  } catch (e) {
    doc.rect(marginX, boxY, boxW, boxH, "FD");
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Productos seleccionados:", marginX + 6, boxY + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(String(itemCount), marginX + 62, boxY + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total:", marginX + 6, boxY + 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(5, 150, 105);
  doc.text(currencyFormatter.format(totalValue), marginX + 62, boxY + 17);
}

// ✅ REEMPLAZO: Página final de total/resumen más compacta
function drawTotalSummaryPage(doc, pageW, pageH, data) {
  const {
    companyName,
    catalogName,
    metaLine,
    logoPack,
    qrPack,
    pageIndex,
    totalPages,
    itemCount,
    totalValue
  } = data;

  drawHeader(
    doc,
    pageW,
    companyName,
    catalogName,
    metaLine,
    logoPack,
    qrPack,
    pageIndex,
    totalPages
  );

  const marginX = 16;
  const startY = 36;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text("Resumen del catálogo", marginX, startY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.2);
  doc.setTextColor(71, 85, 105);

  const desc =
    "Este total corresponde a la suma de los precios unitarios de los productos seleccionados.";
  const descLines = doc.splitTextToSize(desc, pageW - marginX * 2);
  doc.text(descLines.slice(0, 3), marginX, startY + 7);

  const boxX = marginX;
  const boxY = startY + 16;
  const boxW = pageW - marginX * 2;
  const boxH = 32;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  try {
    doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "FD");
  } catch (e) {
    doc.rect(boxX, boxY, boxW, boxH, "FD");
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Productos seleccionados:", boxX + 8, boxY + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.text(String(itemCount), boxX + 68, boxY + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Total:", boxX + 8, boxY + 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14.5);
  doc.setTextColor(5, 150, 105);
  doc.text(currencyFormatter.format(totalValue), boxX + 68, boxY + 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Escanea el QR para ver el catálogo en línea y confirmar disponibilidad.",
    marginX,
    boxY + boxH + 10
  );
}

// ---------- Generación del PDF ----------
async function generatePdf() {
  const jsPDF = getJsPDFClass();
  if (!jsPDF) {
    alert("No se pudo cargar la librería de PDF. Verifica tu conexión o el enlace de jsPDF.");
    return;
  }

  const selectedIds = Array.from(pdfSelection);
  const selectedProducts = selectedIds
    .map(id => getProductById(id))
    .filter(Boolean);

  if (!selectedProducts.length) {
    alert("No has seleccionado productos para exportar.");
    return;
  }

  const includePrices = !!(pdfIncludePrices && pdfIncludePrices.checked);
  const includeTotal = !!(pdfIncludeTotal && pdfIncludeTotal.checked);

  // Ordenar productos por nombre para el PDF
  selectedProducts.sort((a, b) => {
    const na = (a.name || "").toString();
    const nb = (b.name || "").toString();
    const cmp = na.localeCompare(nb, "es", { sensitivity: "base" });
    if (cmp !== 0) return cmp;
    return String(a.id).localeCompare(String(b.id));
  });

  const productPages = chunkArray(selectedProducts, PDF_PRODUCTS_PER_PAGE);
  const basePagesCount = productPages.length;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Totales para resumen
  const itemCount = selectedProducts.length;
  const totalValue = selectedProducts.reduce(
    (acc, p) => acc + (Number(p.valor_unitario) || 0),
    0
  );

  // Layout base
  const marginX = 10;
  const headerBottomY = 30;
  const bottomMargin = 10;
  const gapX = 6;
  const gapY = 6;

  const usableW = pageW - marginX * 2;
  const usableH = pageH - headerBottomY - bottomMargin;

  const cardW = (usableW - gapX * (PDF_COLS - 1)) / PDF_COLS;
  const cardH = (usableH - gapY * (PDF_ROWS - 1)) / PDF_ROWS;

  // ¿Cabe el resumen dentro de la última página de productos?
  let willInlineTotal = false;
  if (includeTotal && basePagesCount > 0) {
    const lastItemsCount = productPages[basePagesCount - 1].length;
    const usedRows = Math.max(1, Math.ceil(lastItemsCount / PDF_COLS));
    const lastRowBottom =
      headerBottomY + (usedRows - 1) * (cardH + gapY) + cardH;

    const freeStartY = lastRowBottom + 6;
    const freeH = pageH - bottomMargin - freeStartY;

    willInlineTotal = freeH >= PDF_INLINE_TOTAL_MIN_FREE_H;
  }

  // Total real para encabezados
  const totalPages = !includeTotal
    ? basePagesCount
    : (willInlineTotal ? basePagesCount : basePagesCount + 1);

  // Cargar logo y QR
  let logoUrl = null;
  try {
    logoUrl = await resolveOtherImage("logo_empresa");
  } catch (e) {}

  const logoPack = logoUrl ? await loadImageForPdf(logoUrl) : null;
  const qrPack = await loadQrForPdf(PDF_QR_TARGET_URL);

  const companyName = "IRENISMB STOCK NATURA";
  const catalogName = getCustomPdfSubtitle() || "Catálogo";
  const whatsappTxt = formatWhatsAppNumber(DEFAULT_WHATSAPP);
  const metaLine = [whatsappTxt, `Fecha: ${todayLabel()}`].filter(Boolean).join(" • ");

  // 1) Páginas de productos
  for (let pageIndex = 0; pageIndex < productPages.length; pageIndex++) {
    if (pageIndex > 0) doc.addPage();

    drawHeader(
      doc,
      pageW,
      companyName,
      catalogName,
      metaLine,
      logoPack,
      qrPack,
      pageIndex,
      totalPages
    );

    const pageItems = productPages[pageIndex];

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

    // ✅ Resumen inline en la última página si hay espacio real
    if (includeTotal && willInlineTotal && pageIndex === productPages.length - 1) {
      const usedRows = Math.max(1, Math.ceil(pageItems.length / PDF_COLS));
      const lastRowBottom =
        headerBottomY + (usedRows - 1) * (cardH + gapY) + cardH;

      const inlineY = lastRowBottom + 8;

      drawInlineTotalSummary(doc, pageW, inlineY, {
        itemCount,
        totalValue
      });
    }
  }

  // 2) Página final de total (solo si NO se pudo inline)
  if (includeTotal && !willInlineTotal) {
    doc.addPage();
    drawTotalSummaryPage(doc, pageW, pageH, {
      companyName,
      catalogName,
      metaLine,
      logoPack,
      qrPack,
      pageIndex: totalPages - 1,
      totalPages,
      itemCount,
      totalValue
    });
  }

  // Guardamos por si generas sin cerrar el modal
  saveSubtitleToStorage();

  const safeSub = (catalogName || "catalogo")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);

  const filename = `catalogo-${safeSub}-${todayLabel()}.pdf`;
  doc.save(filename);
}

// Botón generar
if (pdfGenerateBtn) {
  pdfGenerateBtn.addEventListener("click", async () => {
    try {
      pdfGenerateBtn.disabled = true;
      pdfGenerateBtn.classList.add("is-loading");
      await generatePdf();
    } catch (e) {
      console.error("Error generando PDF:", e);
      alert("Ocurrió un error generando el PDF. Revisa la consola para más detalles.");
    } finally {
      pdfGenerateBtn.disabled = false;
      pdfGenerateBtn.classList.remove("is-loading");
    }
  });
}

