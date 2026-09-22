const INVENTARIO_SPREADSHEET_ID = "1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs";
const INVENTARIO_SHEET_NAME = "Productos";
const INVENTARIO_HEADER_ROW = 1;
const VISIBILIDAD_SHEET_NAME = "Visibilidad";
const VISIBILIDAD_HEADERS = ["Tipo", "Identificador", "Oculto", "Etiqueta", "Actualizado"];
const VISIBILIDAD_TIPOS = ["producto", "seccion", "categoria", "subcategoria", "familia"];

const CONFIG_SHEET_NAME = "Configuracion";
const CONFIG_PROPERTY_PREFIX = "CATALOGO_CONFIG_";
const CONFIG_KEYS = [
  "REGISTRAR_VISITAS_PROPIAS",
  "MOSTRAR_CANTIDAD_STOCK",
  "MOSTRAR_PRECIOS_PRODUCTO",
  "MOSTRAR_SPRE",
  "MOSTRAR_FOLLETO"
];
const CONFIG_DEFAULTS = Object.freeze({
  REGISTRAR_VISITAS_PROPIAS: "DESACTIVADO",
  MOSTRAR_CANTIDAD_STOCK: "DESACTIVADO",
  MOSTRAR_PRECIOS_PRODUCTO: "ACTIVADO",
  MOSTRAR_SPRE: "DESACTIVADO",
  MOSTRAR_FOLLETO: "DESACTIVADO"
});

// ===================== ENDPOINT PRINCIPAL =====================
function doGet(evento) {
  const parametros = evento && evento.parameter ? evento.parameter : {};
  const modo = String(parametros.modo || "").trim().toLowerCase();

  if (modo === "config") {
    return responderConfiguracionPublica_(parametros.callback);
  }

  const archivo = modo === "puente" ? "Puente" : "Admin";
  const salida = HtmlService
    .createHtmlOutputFromFile(archivo)
    .setTitle("Administrar catálogo · Irenismb Stock Natura");

  if (modo === "puente") {
    salida.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return salida;
}
function responderConfiguracionPublica_(callback) {
  let payload;
  try {
    payload = obtenerConfiguracionWeb();
  } catch (error) {
    payload = {
      ok: false,
      error: error && error.message ? error.message : String(error || "No se pudo leer la configuración.")
    };
  }

  const callbackSeguro = String(callback || "").trim();
  const json = JSON.stringify(payload);
  if (callbackSeguro) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(callbackSeguro)) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: "Callback no válido." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService
      .createTextOutput(callbackSeguro + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
