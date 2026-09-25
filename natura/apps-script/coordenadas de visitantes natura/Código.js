// ===================== CONFIGURACIÓN =====================
const SPREADSHEET_ID = "1vxxTu4HWcgDm2HcCwPykMXyepVAFQcFsQkHUS6ed81g";
const SHEET_NAME = ""; // vacío = primera hoja
const TZ = "America/Bogota";

const CONFIG_SPREADSHEET_ID = "1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs";
const CONFIG_SHEET_NAME = "Configuracion";
const VISIT_MODE_CONTROL_KEY = "MODO_REGISTRO_VISITAS";
const DEFAULT_VISIT_MODE = "TODAS";
const VISIT_MODES = new Set(["TODAS", "UNA POR DIA", "UNA POR DISPOSITIVO", "NINGUNA"]);

const TELEGRAM_BOT_TOKEN_PROPERTY = "TELEGRAM_BOT_TOKEN";
const TELEGRAM_CHAT_ID_PROPERTY = "TELEGRAM_CHAT_ID";

const MAX_POST_BYTES = 16000;
const VISIT_RATE_SECONDS = 20;
const ALLOWED_SOURCES = new Set(["GPS", "WI-FI", "CELULAR", "GEO", "IP", "SIN_UBICACION"]);

// ✅ Coordenada fija (punto de referencia) para calcular distancia
const REF_LAT = 11.244958;
const REF_LNG = -74.190684;

// ✅ Dirección (reverse geocoding)
const WRITE_ADDRESS = true;

// ✅ Cache para reverse geocoding (mientras más decimales, más exacto, pero menos cache-hit)
const ADDRESS_CACHE_SECONDS = 21600;       // 6h
const ADDRESS_CACHE_EMPTY_SECONDS = 120;   // 2min si sale vacía
const ADDRESS_CACHE_DECIMALS = 6;          // <- antes era “más preciso”: 6 es buena opción

// ===================== IDENTIDAD DE NAVEGADORES =====================
// La hoja id_navegador es la única fuente de nombres.
// A = Id del navegador, B = nombre.
const BROWSER_ID_SHEET_NAME = "id_navegador";
const OWN_VISITS_CONTROL_KEY = "REGISTRAR_VISITAS_PROPIAS";
const OWN_VISITOR_NAMES = new Set(["MARTIN", "IRENIS"]);

// ✅ SOLO estas columnas se crearán/escribirán
// ✅ 'navegador' guardará el alias (si existe) o el user_id
// ✅ 'id navegador' guardará el ID real del navegador (user_id original)
// ✅ 'precision' guardará acc (metros)
// ✅ 'fuente' guardará la fuente (GPS / WI-FI / CELULAR / GEO / SIN_UBICACION / etc.)
const REQUIRED_HEADERS = [
  "navegador",
  "id navegador",
  "coordenadas",
  "precision",
  "fuente",
  "distancia (m)",
  "direccion",
  "fecha",
  "hora",
  "id visita",
  "ip externa"
];

// ===================== ENDPOINTS =====================
function doGet(e) {
  const p = parseParams_(e);
  const callback = safeCallback_(p.prefix || "");
  const visitId = normalizeVisitId_(p.load_id || p.visit_id || "", false);

  if (visitId) {
    const result = {
      ok: true,
      status: visitExistsById_(visitId) ? "registered" : "not_found",
      id_visita: visitId
    };
    return jsonOrJsonp_(result, callback);
  }

  return jsonOrJsonp_({
    ok: true,
    status: "ready",
    message: "Web app activa. Registra visitas por POST con validación y control de duplicados."
  }, callback);
}

function doPost(e) {
  return handleWriteRequest_(e);
}

// Ejecuta 1 vez desde el editor para autorizar Spreadsheet
function authTest(){
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  if (!sh) return;
  sh.getRange(1, 1).getValue();

  const configSs = SpreadsheetApp.openById(CONFIG_SPREADSHEET_ID);
  const configSh = configSs.getSheetByName(CONFIG_SHEET_NAME);
  if (configSh) configSh.getRange(1, 1).getValue();
}

// ✅ Ejecuta 1 vez para autorizar Maps (si WRITE_ADDRESS=true)
function geoAuthTest(){
  const res = Maps.newGeocoder()
    .setLanguage("es")
    .setRegion("co")
    .reverseGeocode(4.7110, -74.0721);
  Logger.log(JSON.stringify(res));
}

function telegramTest(){
  const token = getTelegramProperty_(TELEGRAM_BOT_TOKEN_PROPERTY);
  const chatId = getTelegramProperty_(TELEGRAM_CHAT_ID_PROPERTY);
  if (!token || !chatId) throw new Error("Faltan propiedades privadas de Telegram.");

  sendTelegramMessage_(
    token,
    chatId,
    "Prueba de avisos del catálogo Natura. La conexión con Telegram está funcionando.",
    ""
  );
  Logger.log("telegramTest OK");
}

function telegramListChats(){
  const token = getTelegramProperty_(TELEGRAM_BOT_TOKEN_PROPERTY);
  if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN en Propiedades del script.");

  const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
    method: "get",
    muteHttpExceptions: true
  });

  Logger.log(response.getContentText());
}

// ===================== LÓGICA PRINCIPAL =====================
function handleWriteRequest_(e){
  let lock = null;
  let telegramPayload = null;

  try{
    const rawBody = String(e && e.postData && e.postData.contents || "");
    if (rawBody.length > MAX_POST_BYTES){
      return json_({ ok:false, status:"invalid", message:"Solicitud demasiado grande." });
    }

    const p = parseParams_(e);
    const userIdRaw = normalizeBrowserId_(p.user_id || p.navegador || "", true);
    const visitId = normalizeVisitId_(p.load_id || "", true);
    const location = normalizeLocation_(p);
    const identity = getBrowserIdentity_(userIdRaw);
    const navegadorVal = safeClientText_(identity.navegador || userIdRaw, 120);

    if (shouldSkipOwnVisit_(identity)){
      return json_({ ok:true, status:"skipped", id_visita:visitId });
    }

    const cityVal = safeClientText_(p.ciudad, 80);
    const departmentVal = safeClientText_(p.departamento, 80);
    const countryVal = safeClientText_(p.pais, 80);
    const clientAddress = safeClientText_(p.direccion, 180);

    const deviceVal = safeClientText_(p.dispositivo, 120);
    const brandVal = safeClientText_(p.marca, 80);
    const modelVal = safeClientText_(p.modelo, 120);
    const ipLocalRaw = safePlainText_(p.ip_local, 64);
    const ipLocalVal = isPrivateIpv4_(ipLocalRaw) ? ipLocalRaw : "";
    const ipExternaVal = normalizeExternalIp_(p.ip_externa);
    const originVal = safeClientText_(p.origen, 300);
    const categoryVal = safeClientText_(p.categoria, 120);
    const productVal = safeClientText_(p.producto, 180);
    const cartProductsVal = boundedWholeNumber_(p.carrito_productos, 0, 500);
    const cartUnitsVal = boundedWholeNumber_(p.carrito_unidades, 0, 5000);
    const cartTotalVal = boundedNumber_(p.carrito_total, 0, 100000000);

    lock = LockService.getScriptLock();
    if (!lock.tryLock(3000)){
      return json_({ ok:false, status:"busy", id_visita:visitId });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
    if (!sh) throw new Error("No se encontró la hoja de visitas.");

    const headerIndex = resolveHeaders_(sh, REQUIRED_HEADERS);
    const lastCol = sh.getLastColumn();

    if (visitExistsInSheet_(sh, headerIndex, visitId)){
      return json_({ ok:true, status:"duplicate", id_visita:visitId });
    }

    if (isRateLimited_(userIdRaw)){
      return json_({ ok:false, status:"rate_limited", id_visita:visitId });
    }

    const now = new Date();
    const dateStr = Utilities.formatDate(now, TZ, "yyyy-MM-dd");
    const timeStr = Utilities.formatDate(now, TZ, "HH:mm:ss");
    const visitMode = getVisitMode_();
    const visitStats = getVisitStats_(sh, headerIndex, userIdRaw);

    if (!shouldRegisterVisit_(sh, headerIndex, userIdRaw, dateStr, visitMode)){
      return json_({ ok:true, status:"skipped", id_visita:visitId });
    }

    const externalIpVisitNumber = getExternalIpVisitNumber_(sh, headerIndex, ipExternaVal);

    let coordText = "";
    let mapsUrl = "";
    let distanceMeters = "";

    if (location.hasCoords){
      coordText = `${location.lat.toFixed(6)},${location.lng.toFixed(6)}`;
      mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(coordText)}`;
      distanceMeters = Math.round(haversineMeters_(REF_LAT, REF_LNG, location.lat, location.lng));
    } else {
      const approximateQuery = [cityVal, departmentVal, countryVal].filter(Boolean).join(", ");
      if (approximateQuery){
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(approximateQuery.replace(/^'/, ""))}`;
      }
    }

    let address = "";
    if (location.hasCoords && WRITE_ADDRESS){
      const geo = reverseGeocodeCached_(location.lat, location.lng);
      address = safeClientText_(geo.address || "", 220);
    } else {
      address = clientAddress;
    }

    const row = new Array(lastCol).fill("");
    if (headerIndex.navegador != null)      row[headerIndex.navegador]      = navegadorVal;
    if (headerIndex.id_navegador != null)   row[headerIndex.id_navegador]   = userIdRaw;
    if (headerIndex.fecha != null)          row[headerIndex.fecha]          = dateStr;
    if (headerIndex.hora != null)           row[headerIndex.hora]           = timeStr;
    if (headerIndex.fuente != null)         row[headerIndex.fuente]         = location.fuente;
    if (headerIndex.precision != null)      row[headerIndex.precision]      = location.accuracy;
    if (headerIndex.direccion != null)      row[headerIndex.direccion]      = address;
    if (headerIndex.distancia_m != null)    row[headerIndex.distancia_m]    = distanceMeters;
    if (headerIndex.coordenadas != null)    row[headerIndex.coordenadas]    = coordText;
    if (headerIndex.ciudad != null)         row[headerIndex.ciudad]         = cityVal;
    if (headerIndex.departamento != null)   row[headerIndex.departamento]   = departmentVal;
    if (headerIndex.pais != null)           row[headerIndex.pais]           = countryVal;
    if (headerIndex.id_visita != null)      row[headerIndex.id_visita]      = visitId;
    if (headerIndex.ip_externa != null)      row[headerIndex.ip_externa]      = ipExternaVal;

    const nextRow = Math.max(2, sh.getLastRow() + 1);
    sh.getRange(nextRow, 1, 1, lastCol).setValues([row]);

    if (location.hasCoords && headerIndex.coordenadas != null){
      const cell = sh.getRange(nextRow, headerIndex.coordenadas + 1);
      const rich = SpreadsheetApp.newRichTextValue()
        .setText(coordText)
        .setLinkUrl(mapsUrl)
        .build();
      cell.setRichTextValue(rich);
    }

    markRateLimit_(userIdRaw);

    telegramPayload = {
      fecha: dateStr,
      hora: timeStr,
      direccion: address,
      ciudad: cityVal,
      departamento: departmentVal,
      pais: countryVal,
      coordenadas: coordText,
      precision: location.accuracy,
      fuente: location.fuente,
      mapsUrl,
      tieneCoordenadas: location.hasCoords,
      distanciaMetros: distanceMeters,
      visitanteTipo: visitStats.tipo,
      visitaNumero: visitStats.numero,
      nombre: safeClientText_(identity.nombre || "", 120),
      idNavegador: userIdRaw,
      dispositivo: deviceVal,
      marca: brandVal,
      modelo: modelVal,
      ipLocal: ipLocalVal,
      ipExterna: ipExternaVal,
      visitasIpExterna: externalIpVisitNumber,
      origen: originVal,
      categoria: categoryVal,
      producto: productVal,
      carritoProductos: cartProductsVal,
      carritoUnidades: cartUnitsVal,
      carritoTotal: cartTotalVal
    };

  }catch(error){
    console.error("ERROR VISITAS: " + (error && error.stack ? error.stack : error));
    return json_({
      ok:false,
      status:"invalid",
      message:String(error && error.message ? error.message : error)
    });
  }finally{
    try{ if (lock) lock.releaseLock(); }catch(_){}
  }

  try{
    if (telegramPayload) sendVisitToTelegram_(telegramPayload);
  }catch(error){
    console.error("ERROR TELEGRAM: " + (error && error.stack ? error.stack : error));
  }

  return json_({ ok:true, status:"registered" });
}

function getExternalIpVisitNumber_(sh, headerIndex, ipExterna){
  const ip = normalizeExternalIp_(ipExterna);
  if (!ip || headerIndex.ip_externa == null) return "";

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 1;

  const previous = sh
    .getRange(2, headerIndex.ip_externa + 1, lastRow - 1, 1)
    .createTextFinder(ip)
    .matchCase(false)
    .matchEntireCell(true)
    .findAll()
    .length;

  return previous + 1;
}
