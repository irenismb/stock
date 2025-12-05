// ================== EXPORTACIÓN DE CATÁLOGO A PDF ==================
// Requiere: config-estado-dom.js, utilidades-imagenes-galeria.js
//          y la librería jsPDF UMD cargada en catalogo.html

const PDF_PRODUCTS_PER_PAGE = 6; // ✅ requisito del usuario
const PDF_COLS = 2;
const PDF_ROWS = 3;

// Estado de selección para exportar
const pdfSelection = new Set(); // ids como string

// Cache simple de imágenes para el PDF
const pdfImageCache = new Map(); // url -> { dataUrl, format }

// ---------- Utilidades ----------
function getJsPDFClass() {
  // jsPDF UMD suele exponer window.jspdf.jsPDF
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  if (window.jsPDF) return window.jsPDF;
  return null;
}

function safeArray(a) {
  return Array.isArray(a) ? a : [];
}

function getBaseListForPdfModal() {
  // Preferimos mostrar la lista filtrada actual si existe
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

// ---------- Modal ----------
function openPdfModal() {
  if (!pdfModal) return;
  renderPdfSelectionList();
  pdfModal.classList.add("open");
  pdfModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closePdfModal() {
  if (!pdfModal) return;
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
        alt="Foto ${escapeAttr(p.name)}"
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
  // Convertimos a JPEG para máxima compatibilidad con jsPDF
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

    // fondo blanco para evitar transparencias raras
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

// ---------- Dibujo de página / tarjetas ----------
function drawHeader(doc, pageW, titleText, subtitleText, logoPack, pageIndex, totalPages) {
  const marginX = 10;
  const headerY = 8;

  // Línea superior suave
  doc.setDrawColor(226, 232, 240);

  // Logo opcional
  if (logoPack && logoPack.dataUrl) {
    try {
      doc.addImage(logoPack.dataUrl, logoPack.format, marginX, headerY, 12, 12);
    } catch (e) {}
  }

  // Título
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titleText, marginX + 16, headerY + 8);

  // Subtítulo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(subtitleText, marginX + 16, headerY + 13);

  // Paginación
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const pageLabel = `Página ${pageIndex + 1} de ${totalPages}`;
  doc.text(pageLabel, pageW - marginX, headerY + 8, { align: "right" });

  // Separador
  doc.line(marginX, 22, pageW - marginX, 22);
}

function drawProductCard(doc, p, x, y, w, h, options) {
  const { imgPack, includeDescription, includePrices } = options;

  // Tarjeta
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

  // Área de imagen
  const imgH = 26; // mm
  const imgY = innerY;
  const imgX = innerX + (innerW - 26) / 2;
  const imgW = 26;

  if (imgPack && imgPack.dataUrl) {
    try {
      doc.addImage(imgPack.dataUrl, imgPack.format, imgX, imgY, imgW, imgH);
    } catch (e) {
      // fallback simple
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

  // Textos
  let cursorY = imgY + imgH + 4;

  const name = (p.name || "").toString().trim();
  const marca = (p.marca || "").toString().trim();
  const category = (p.category || "").toString().trim();
  const price = Number(p.valor_unitario) || 0;
  const desc = (p.description || "").toString().trim();

  // Nombre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const nameLines = doc.splitTextToSize(name || "Producto", innerW);
  const limitedName = nameLines.slice(0, 2);
  doc.text(limitedName, innerX, cursorY);
  cursorY += limitedName.length * 4.2;

  // Marca / categoría
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const subText = [marca, category].filter(Boolean).join(" • ");
  if (subText) {
    const subLines = doc.splitTextToSize(subText, innerW);
    doc.text(subLines.slice(0, 1), innerX, cursorY);
    cursorY += 4.2;
  }

  // Precio
  if (includePrices) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text(currencyFormatter.format(price), innerX, cursorY + 1);
    cursorY += 5;
  } else {
    cursorY += 2;
  }

  // Descripción
  if (includeDescription && desc) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);

    const maxDescLines = 3;
    const descLines = doc.splitTextToSize(desc, innerW).slice(0, maxDescLines);
    doc.text(descLines, innerX, cursorY + 1);
  }
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

  const includeDescription = !!(pdfIncludeDescription && pdfIncludeDescription.checked);
  const includePrices = !!(pdfIncludePrices && pdfIncludePrices.checked);

  // Orden estable: por nombre
  selectedProducts.sort((a, b) => {
    const na = (a.name || "").toString();
    const nb = (b.name || "").toString();
    const cmp = na.localeCompare(nb, "es", { sensitivity: "base" });
    if (cmp !== 0) return cmp;
    return String(a.id).localeCompare(String(b.id));
  });

  const pages = chunkArray(selectedProducts, PDF_PRODUCTS_PER_PAGE);
  const totalPages = pages.length;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Logo (si existe)
  let logoUrl = null;
  try {
    logoUrl = await resolveOtherImage("logo_empresa");
  } catch (e) {}
  const logoPack = logoUrl ? await loadImageForPdf(logoUrl) : null;

  const titleText = "Irenismb Stock Natura";
  const subtitleText = `Catálogo generado ${todayLabel()} • Envíos a toda Colombia`;

  // Layout de tarjetas
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

    drawHeader(doc, pageW, titleText, subtitleText, logoPack, pageIndex, totalPages);

    const pageItems = pages[pageIndex];

    for (let i = 0; i < pageItems.length; i++) {
      const p = pageItems[i];

      const pos = i; // 0..5
      const row = Math.floor(pos / PDF_COLS);
      const col = pos % PDF_COLS;

      const x = marginX + col * (cardW + gapX);
      const y = headerBottomY + row * (cardH + gapY);

      // Imagen del producto
      const imgUrl = `${IMG_BASE_PATH}${encodeURIComponent(p.id)}.webp`;
      const imgPack = await loadImageForPdf(imgUrl);

      drawProductCard(doc, p, x, y, cardW, cardH, {
        imgPack,
        includeDescription,
        includePrices
      });
    }
  }

  const filename = `catalogo-irenismb-${todayLabel()}.pdf`;
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
