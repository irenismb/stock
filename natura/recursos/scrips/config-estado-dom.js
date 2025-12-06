// ================== CONFIGURACIÓN GENERAL ==================
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwgRlyQfToDd8O7JOyRP0XXdryqpksSTu04zuhaZHYnun59S0ALXR_vnHZGfY5ch7SP/exec";
const DEFAULT_WHATSAPP = "573042088961";
const AUTO_REFRESH_MS = 20000;
const LS_FILTERS_KEY = "naturaFilters";
const LS_CART_KEY = "shoppingCart";
const BROWSER_ID_LS_KEY = "naturaBrowserId";
// ✅ NUEVO: subtítulo personalizado del PDF
const LS_PDF_SUBTITLE_KEY = "naturaPdfSubtitle";
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

// ================== EXPORTACIÓN PDF (DOM) ==================
const pdfBtn = document.getElementById("pdfBtn");
// NUEVO: botón extra PDF en la barra de redes (móvil)
const pdfBtnMobile = document.getElementById("pdfBtnMobile");

const pdfModal = document.getElementById("pdfModal");
const pdfModalClose = document.getElementById("pdfModalClose");
const pdfModalBackdrop = document.getElementById("pdfModalBackdrop");
const pdfProductList = document.getElementById("pdfProductList");
const pdfSelectFilteredBtn = document.getElementById("pdfSelectFilteredBtn");
const pdfSelectCartBtn = document.getElementById("pdfSelectCartBtn");
const pdfSelectAllBtn = document.getElementById("pdfSelectAllBtn");
const pdfSelectNoneBtn = document.getElementById("pdfSelectNoneBtn");
const pdfGenerateBtn = document.getElementById("pdfGenerateBtn");
const pdfIncludePrices = document.getElementById("pdfIncludePrices");
const pdfCustomTitle = document.getElementById("pdfCustomTitle");


