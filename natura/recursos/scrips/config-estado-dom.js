// ================== CONFIGURACIÓN GENERAL ==================
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwgRlyQfToDd8O7JOyRP0XXdryqpksSTu04zuhaZHYnun59S0ALXR_vnHZGfY5ch7SP/exec";

// ✅ Unificado: WhatsApp real (mismo número que el catálogo simple)
const DEFAULT_WHATSAPP = "573042088961";

// ✅ PDF desactivado (ya no se usa)
const ENABLE_PDF = false;

const AUTO_REFRESH_MS = 20000;
const LS_FILTERS_KEY = "naturaFilters";
const LS_CART_KEY = "shoppingCart";
const BROWSER_ID_LS_KEY = "naturaBrowserId";

// (Se deja la key por compatibilidad por si existía guardada; ya no se usa)
const LS_PDF_SUBTITLE_KEY = "naturaPdfSubtitle";

// Servicio externo para IP pública + ciudad
const CLIENT_INFO_URL = "https://ipapi.co/json/";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0
});

// ================== IMÁGENES (carpetas y extensiones) ==================
const IMG_EXTS = ["webp", "jpeg", "jpg", "png"];
const IMG_BASE_PATH = "recursos/imagenes_de_productos/";
const OTRAS_IMG_BASE_PATH = "recursos/otras_imagenes/";

// ================== ESTADO GLOBAL ==================
let products = [];
let allCategories = []; // [{ key, label }]
let allBrands = [];     // [{ key, label }]
let currentSortOrder = "default"; // default → Orden hoja, asc → precio menor, desc → precio mayor
let cart = {};                    // id -> { id, name, price, quantity }
let lastPreviewRequestId = 0;
let filterListenersAttached = false;
let lastSearchLogged = "";
let autoRefreshTimer = null;

// Estado para visitas por sesión
let sessionId = "";
let clientIpPublica = "";
let clientCiudad = "";
let userName = "";  // opcional
let browserId = ""; // identificador estable del navegador

// Lista de productos actualmente filtrados y posición del producto mostrado
let currentFilteredProducts = [];
let currentPreviewProductIndex = -1;
let currentPreviewProductId = null;

// ================== HELPERS (robustez) ==================
const NOOP_CLASSLIST = {
  add() {},
  remove() {},
  toggle() { return false; },
  contains() { return false; }
};

function makeNoopEl() {
  return {
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild() {},
    remove() {},
    focus() {},
    blur() {},
    click() {},
    classList: NOOP_CLASSLIST,
    style: {},
    dataset: {},
    innerHTML: "",
    textContent: "",
    value: "",
    disabled: true
  };
}
const NOOP_EL = makeNoopEl();
const NOOP_INPUT = Object.assign(makeNoopEl(), { checked: false });

// ================== REFERENCIAS AL DOM ==================
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

// NUEVO: referencias para filtros y acciones móviles
const filtersRow = document.querySelector(".filters-row");
const mobileFiltersBtn = document.getElementById("mobileFiltersBtn");
const mobileCartBtn = document.getElementById("mobileCartBtn");
const mobileActionsRow = document.getElementById("mobileActionsRow");

const productPreview = document.getElementById("productPreview");
const previewImg = document.getElementById("previewImg");
const previewCaption = document.getElementById("previewCaption");
const galleryPrevBtn = document.getElementById("galleryPrevBtn");
const galleryNextBtn = document.getElementById("galleryNextBtn");
const previewName = document.getElementById("previewName");
const imageStatus = document.getElementById("imageStatus");

// Elementos del modal de imagen ampliada
const imageModal = document.getElementById("imageModal");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalClose = document.getElementById("imageModalClose");
const imageModalBackdrop = document.getElementById("imageModalBackdrop");

// NUEVO: carrito como modal (vista móvil)
const cartModal = document.getElementById("cartModal");
const cartModalClose = document.getElementById("cartModalClose");
const cartModalBackdrop = document.getElementById("cartModalBackdrop");

// ================== EXPORTACIÓN PDF (DESACTIVADO) ==================
// Para evitar errores si quedó algún script antiguo intentando usar estos IDs,
// los exponemos como elementos "no-op" cuando ENABLE_PDF = false.
const pdfBtn = ENABLE_PDF ? (document.getElementById("pdfBtn") || NOOP_EL) : NOOP_EL;
const pdfBtnMobile = ENABLE_PDF ? (document.getElementById("pdfBtnMobile") || NOOP_EL) : NOOP_EL;
const pdfModal = ENABLE_PDF ? (document.getElementById("pdfModal") || NOOP_EL) : NOOP_EL;
const pdfModalClose = ENABLE_PDF ? (document.getElementById("pdfModalClose") || NOOP_EL) : NOOP_EL;
const pdfModalBackdrop = ENABLE_PDF ? (document.getElementById("pdfModalBackdrop") || NOOP_EL) : NOOP_EL;
const pdfProductList = ENABLE_PDF ? (document.getElementById("pdfProductList") || NOOP_EL) : NOOP_EL;
const pdfSelectFilteredBtn = ENABLE_PDF ? (document.getElementById("pdfSelectFilteredBtn") || NOOP_EL) : NOOP_EL;
const pdfSelectCartBtn = ENABLE_PDF ? (document.getElementById("pdfSelectCartBtn") || NOOP_EL) : NOOP_EL;
const pdfSelectAllBtn = ENABLE_PDF ? (document.getElementById("pdfSelectAllBtn") || NOOP_EL) : NOOP_EL;
const pdfSelectNoneBtn = ENABLE_PDF ? (document.getElementById("pdfSelectNoneBtn") || NOOP_EL) : NOOP_EL;
const pdfGenerateBtn = ENABLE_PDF ? (document.getElementById("pdfGenerateBtn") || NOOP_EL) : NOOP_EL;
const pdfIncludePrices = ENABLE_PDF ? (document.getElementById("pdfIncludePrices") || NOOP_INPUT) : NOOP_INPUT;
const pdfCustomTitle = ENABLE_PDF ? (document.getElementById("pdfCustomTitle") || NOOP_EL) : NOOP_EL;
const pdfIncludeTotal = ENABLE_PDF ? (document.getElementById("pdfIncludeTotal") || NOOP_INPUT) : NOOP_INPUT;

