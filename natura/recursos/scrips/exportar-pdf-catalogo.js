// ================== EXPORTACIÓN DE CATÁLOGO A PDF ==================
// Requiere: config-estado-dom.js, utilidades-imagenes-galeria.js
//          y la librería jsPDF UMD cargada en catalogo.html

const PDF_PRODUCTS_PER_PAGE = 6; // ✅ máximo 6 por página
const PDF_COLS = 2;
const PDF_ROWS = 3;

// Estado de selección para exportar
const pdfSelection = new Set(); // ids como string

// Cache simple de imágenes para el PDF
const pdfImageCache = new Map(); // url -> { dataUrl, format }

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

// ✅ NUEVO: formato amigable de WhatsApp para el header del PDF
function formatWhatsAppNumber(raw) {
  const s = String(raw || "").replace(/\D/g, "");
  if (!s) return "";
  // Caso típico Colombia: 57 + 10 dígitos
  if (s.startsWith("57") && s.length === 12) {
    return `+57 ${s.slice(2, 5)} ${s.slice(5, 8)} ${s.slice(8, 12)}`;
  }
  return `+${s}`;
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
  // Fallback: si por alguna razón el input está vacío pero hay algo guardado
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

// NUEVO: conectar también el botón compacto de PDF de la fila de redes (móvil)
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

// ---------- Encabezado (MEJORADO) ----------
function drawHeader(
  doc,
  pageW,
  companyName,
  tagline,
  customSubtitle,
  metaLine,       // ✅ NUEVO
  badgeText,
  logoPack,
  pageIndex,
  totalPages
) {
  // Margen propio del header
  const headerMarginX = 12;
  const headerY = 8;

  // Logo
  doc.setDrawColor(226, 232, 240);
  if (logoPack && logoPack.dataUrl) {
    try {
      doc.addImage(logoPack.dataUrl, logoPack.format, headerMarginX, headerY, 11, 11);
    } catch (e) {}
  }

  // Bloque texto izquierda
  let textX = headerMarginX + 15;
  let lineY = headerY + 6.2;

  // Nombre de la tienda
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text(companyName, textX, lineY);

  // Tagline
  if (tagline) {
    lineY += 4.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.6);
    doc.setTextColor(71, 85, 105);
    doc.text(tagline, textX, lineY);
  }

  // Subtítulo personalizado (color elegante, no tipo enlace)
  if (customSubtitle) {
    lineY += 4.1;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.9);
    doc.setTextColor(51, 65, 85);
    doc.text(customSubtitle, textX, lineY);
  }

  // MetaLine sutil (WhatsApp + Fecha)
  if (metaLine) {
    lineY += 3.9;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(metaLine, textX, lineY);
  }

  // Cápsula derecha más discreta
  if (badgeText) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);

    const badgePaddingX = 4.5;
    const textWidth = doc.getTextWidth(badgeText);
    const badgeW = textWidth + badgePaddingX * 2;
    const badgeH = 6;

    const badgeX = pageW - headerMarginX - badgeW;
    const badgeY = headerY + 3.2;

    doc.setFillColor(34, 197, 94);
    doc.setDrawColor(22, 163, 74);

    try {
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.6, 2.6, "FD");
    } catch (e) {
      doc.rect(badgeX, badgeY, badgeW, badgeH, "FD");
    }

    doc.setTextColor(255, 255, 255);
    doc.text(
      badgeText,
      badgeX + badgeW / 2,
      badgeY + badgeH / 2 + 1.5,
      { align: "center" }
    );
  }

  // Número de página con mejor margen
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(100, 116, 139);
  const pageLabel = `Página ${pageIndex + 1} de ${totalPages}`;
  doc.text(pageLabel, pageW - headerMarginX, headerY + 17.8, { align: "right" });

  // Línea de separación más baja para dar aire
  doc.setDrawColor(226, 232, 240);
  doc.line(headerMarginX, 30, pageW - headerMarginX, 30);
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

  // Ordenar productos por nombre para el PDF
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

  let logoUrl = null;
  try {
    logoUrl = await resolveOtherImage("logo_empresa");
  } catch (e) {}

  const logoPack = logoUrl ? await loadImageForPdf(logoUrl) : null;

  const companyName = "IRENISMB STOCK NATURA";
  const tagline = "Catálogo inteligente • Envíos a toda Colombia";
  const customSubtitle = getCustomPdfSubtitle();
  const badgeText = "Natura · Maquillaje · Cuidado personal";

  // ✅ NUEVO: metaLine sutil (WhatsApp + Fecha)
  const whatsappTxt = formatWhatsAppNumber(DEFAULT_WHATSAPP);
  const metaLine = [whatsappTxt, `Fecha: ${todayLabel()}`].filter(Boolean).join(" • ");

  const marginX = 10;
  const headerBottomY = 32; // ✅ más aire en el header
  const bottomMargin = 10;

  const gapX = 6;
  const gapY = 6;

  const usableW = pageW - marginX * 2;
  const usableH = pageH - headerBottomY - bottomMargin;

  const cardW = (usableW - gapX * (PDF_COLS - 1)) / PDF_COLS;
  const cardH = (usableH - gapY * (PDF_ROWS - 1)) / PDF_ROWS;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    if (pageIndex > 0) doc.addPage();

    drawHeader(
      doc,
      pageW,
      companyName,
      tagline,
      customSubtitle,
      metaLine,
      badgeText,
      logoPack,
      pageIndex,
      totalPages
    );

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

  const safeSub = (customSubtitle || "catalogo")
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

