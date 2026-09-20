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
  "id visita"
];

// ===================== ENDPOINTS =====================
function doGet(e) {
  const p = parseParams_(e);

  // Compatibilidad temporal durante la transición del catálogo de GET a POST.
  // Se retira en el despliegue final, una vez publicado el cliente nuevo.
  if (p.user_id || p.navegador) {
    return handleWriteRequest_(e);
  }

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

// ===================== NAVEGADORES (FUNCIONES) =====================
function normalizeName_(value){
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function getBrowserIdentity_(userId){
  const id = String(userId || "").trim();
  if (!id) return { id:"", nombre:"", navegador:"" };

  try{
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName(BROWSER_ID_SHEET_NAME);
    if (!sh || sh.getLastRow() < 2){
      return { id, nombre:"", navegador:id };
    }

    const found = sh
      .getRange(2, 1, sh.getLastRow() - 1, 1)
      .createTextFinder(id)
      .matchEntireCell(true)
      .findNext();

    if (!found) return { id, nombre:"", navegador:id };

    const nombre = String(sh.getRange(found.getRow(), 2).getDisplayValue() || "").trim();
    return { id, nombre, navegador:nombre || id };
  }catch(error){
    console.error("No se pudo consultar id_navegador: " + error);
    return { id, nombre:"", navegador:id };
  }
}

function getConfigValueByKey_(key){
  try{
    const ss = SpreadsheetApp.openById(CONFIG_SPREADSHEET_ID);
    const sh = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sh) return "";

    const lastRow = sh.getLastRow();
    if (lastRow < 1) return "";

    const values = sh
      .getRange(1, 1, lastRow, Math.min(5, sh.getLastColumn()))
      .getDisplayValues();

    const wanted = String(key || "").trim().toUpperCase();
    for (const row of values){
      const current = String(row[4] || "").trim().toUpperCase();
      if (current === wanted) return String(row[1] || "").trim();
    }
  }catch(error){
    console.error("No se pudo leer Configuracion: " + error);
  }
  return "";
}

function shouldSkipOwnVisit_(identity){
  const normalizedName = normalizeName_(identity && identity.nombre);
  if (!OWN_VISITOR_NAMES.has(normalizedName)) return false;

  const state = normalizeName_(getConfigValueByKey_(OWN_VISITS_CONTROL_KEY));
  return state === "DESACTIVADO";
}

function isPrivateIpv4_(value){
  const ip = String(value || "").trim();
  const match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const p = match.slice(1).map(Number);
  if (p.some(n => n < 0 || n > 255)) return false;
  if (p[0] === 10) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  return false;
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
      visitanteTipo: visitStats.tipo,
      visitaNumero: visitStats.numero,
      nombre: safeClientText_(identity.nombre || "", 120),
      idNavegador: userIdRaw,
      dispositivo: deviceVal,
      marca: brandVal,
      modelo: modelVal,
      ipLocal: ipLocalVal,
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

// ===================== DISTANCIA (HAVERSINE) =====================
function haversineMeters_(lat1, lng1, lat2, lng2){
  const R = 6371000; // metros
  const toRad = (x) => x * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const aLat1 = toRad(lat1);
  const aLat2 = toRad(lat2);

  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(aLat1) * Math.cos(aLat2) *
    Math.sin(dLng/2) * Math.sin(dLng/2);

  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}

// ===================== RESPUESTAS Y VALIDACIÓN =====================
function json_(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonOrJsonp_(obj, callback){
  if (!callback) return json_(obj);
  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(obj) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function safeCallback_(value){
  const callback = String(value || "").trim();
  if (!callback) return "";
  return /^[A-Za-z_$][A-Za-z0-9_$]{0,80}$/.test(callback) ? callback : "";
}

function parseParams_(e){
  const out = Object.assign({}, (e && e.parameter) || {});
  try{
    const raw = e && e.postData && e.postData.contents;
    if (!raw) return out;

    const ct = String(e.postData.type || "").toLowerCase();
    if (ct.includes("application/json")){
      const j = JSON.parse(raw);
      if (j && typeof j === "object"){
        Object.keys(j).forEach(k => out[k] = String(j[k] == null ? "" : j[k]));
      }
      return out;
    }

    raw.split("&").forEach(part => {
      if(!part) return;
      const kv = part.split("=");
      const k = kv[0];
      const v = kv.slice(1).join("=");
      if(!k) return;
      out[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent((v || "").replace(/\+/g, " "));
    });
  }catch(_){}
  return out;
}

function normalizeBrowserId_(value, required){
  const id = safePlainText_(value, 100);
  if (!id){
    if (required) throw new Error("Falta user_id.");
    return "";
  }
  if (!/^[A-Za-z0-9_-]{12,100}$/.test(id)){
    throw new Error("user_id inválido.");
  }
  return id;
}

function normalizeVisitId_(value, required){
  const id = safePlainText_(value, 100);
  if (!id){
    if (required) throw new Error("Falta load_id.");
    return "";
  }
  if (!/^[A-Za-z0-9_-]{12,100}$/.test(id)){
    if (required) throw new Error("load_id inválido.");
    return "";
  }
  return id;
}

function safePlainText_(value, maxLen){
  let text = String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (maxLen && text.length > maxLen) text = text.slice(0, maxLen);
  return text;
}

function safeClientText_(value, maxLen){
  let text = safePlainText_(value, maxLen).replace(/[<>]/g, "");
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function boundedWholeNumber_(value, min, max){
  if (value == null || String(value).trim() === "") return min;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error("Valor entero fuera de rango.");
  return n;
}

function boundedNumber_(value, min, max){
  if (value == null || String(value).trim() === "") return min;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error("Valor numérico fuera de rango.");
  return n;
}

function normalizeLocation_(p){
  const latTxt = safePlainText_(p.lat, 40);
  const lngTxt = safePlainText_(p.lng, 40);
  const hasLat = latTxt !== "";
  const hasLng = lngTxt !== "";

  if (hasLat !== hasLng) throw new Error("Latitud y longitud deben enviarse juntas.");

  let hasCoords = false;
  let lat = NaN;
  let lng = NaN;

  if (hasLat && hasLng){
    lat = Number(latTxt);
    lng = Number(lngTxt);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error("Latitud inválida.");
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error("Longitud inválida.");
    hasCoords = true;
  }

  let fuente = safePlainText_(p.fuente || p.src || "", 30).toUpperCase();
  if (!fuente) fuente = hasCoords ? "GEO" : "SIN_UBICACION";
  if (!ALLOWED_SOURCES.has(fuente)) throw new Error("Fuente de ubicación inválida.");

  if (hasCoords && !["GPS", "WI-FI", "CELULAR", "GEO"].includes(fuente)){
    throw new Error("La fuente indicada no corresponde a coordenadas GPS.");
  }
  if (!hasCoords && !["IP", "SIN_UBICACION"].includes(fuente)){
    throw new Error("La fuente indicada requiere coordenadas.");
  }

  const accTxt = safePlainText_(p.acc, 40);
  let accuracy = "";
  if (accTxt !== ""){
    const acc = Number(accTxt);
    if (!Number.isFinite(acc) || acc < 0 || acc > 100000) throw new Error("Precisión inválida.");
    accuracy = acc;
  }

  return { hasCoords, lat, lng, accuracy, fuente };
}

function norm_(s){
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function resolveHeaders_(sh, required){
  const lastCol = Math.max(1, sh.getLastColumn());
  const headerRow = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const idx = {};
  const duplicateKeys = [];

  headerRow.forEach((h, i) => {
    const key = norm_(h);
    if (!key) return;
    if (idx[key] != null) duplicateKeys.push(key);
    else idx[key] = i;
  });

  if (duplicateKeys.length){
    throw new Error("Hay encabezados duplicados en la hoja de visitas: " + [...new Set(duplicateKeys)].join(", "));
  }

  const missing = (required || []).filter(h => idx[norm_(h)] == null);
  if (missing.length){
    throw new Error("Faltan encabezados requeridos en la hoja de visitas: " + missing.join(", "));
  }

  return {
    navegador:      idx[norm_("navegador")],
    id_navegador:   idx[norm_("id navegador")],
    coordenadas:    idx[norm_("coordenadas")],
    precision:      idx[norm_("precision")],
    fuente:         idx[norm_("fuente")],
    distancia_m:    idx[norm_("distancia (m)")],
    direccion:      idx[norm_("direccion")],
    fecha:          idx[norm_("fecha")],
    hora:           idx[norm_("hora")],
    ciudad:         idx[norm_("ciudad")],
    departamento:   idx[norm_("departamento")],
    pais:           idx[norm_("pais")],
    id_visita:      idx[norm_("id visita")]
  };
}

function visitExistsById_(visitId){
  const normalized = normalizeVisitId_(visitId, false);
  if (!normalized) return false;
  try{
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
    if (!sh) return false;
    const headers = resolveHeaders_(sh, REQUIRED_HEADERS);
    return visitExistsInSheet_(sh, headers, normalized);
  }catch(error){
    console.error("No se pudo comprobar id visita: " + error);
    return false;
  }
}

function visitExistsInSheet_(sh, headerIndex, visitId){
  if (!visitId || headerIndex.id_visita == null) return false;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return false;
  return !!sh
    .getRange(2, headerIndex.id_visita + 1, lastRow - 1, 1)
    .createTextFinder(visitId)
    .matchEntireCell(true)
    .findNext();
}

function rateCacheKey_(userId){
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(userId || ""),
    Utilities.Charset.UTF_8
  );
  return "visit_rate_" + Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, "").slice(0, 40);
}

function isRateLimited_(userId){
  if (!userId) return true;
  return CacheService.getScriptCache().get(rateCacheKey_(userId)) === "1";
}

function markRateLimit_(userId){
  if (!userId) return;
  CacheService.getScriptCache().put(rateCacheKey_(userId), "1", VISIT_RATE_SECONDS);
}

// ===================== CONTROL DE VISITAS =====================
function getVisitMode_(){
  try{
    const ss = SpreadsheetApp.openById(CONFIG_SPREADSHEET_ID);
    const sh = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sh) return DEFAULT_VISIT_MODE;

    const lastRow = sh.getLastRow();
    if (lastRow < 1) return DEFAULT_VISIT_MODE;

    const values = sh
      .getRange(1, 1, lastRow, Math.min(5, sh.getLastColumn()))
      .getDisplayValues();

    for (const row of values){
      const key = String(row[4] || "").trim().toUpperCase();
      if (key !== VISIT_MODE_CONTROL_KEY) continue;
      return normalizeVisitMode_(row[1]);
    }
  }catch(_){
  }

  return DEFAULT_VISIT_MODE;
}

function normalizeVisitMode_(value){
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  return VISIT_MODES.has(normalized) ? normalized : DEFAULT_VISIT_MODE;
}

function getVisitStats_(sh, headerIndex, userIdRaw){
  const id = String(userIdRaw || "").trim();
  if (!id || headerIndex.id_navegador == null){
    return { tipo:"No identificado", numero:"" };
  }

  const lastRow = sh.getLastRow();
  if (lastRow < 2){
    return { tipo:"Nuevo", numero:1 };
  }

  const matches = sh
    .getRange(2, headerIndex.id_navegador + 1, lastRow - 1, 1)
    .createTextFinder(id)
    .matchEntireCell(true)
    .findAll();

  const previous = matches.length;
  return {
    tipo: previous > 0 ? "Recurrente" : "Nuevo",
    numero: previous + 1
  };
}

function shouldRegisterVisit_(sh, headerIndex, userIdRaw, dateStr, mode){
  const normalizedMode = normalizeVisitMode_(mode);

  if (normalizedMode === "NINGUNA") return false;
  if (normalizedMode === "TODAS") return true;

  const id = String(userIdRaw || "").trim();

  // El catálogo normalmente envía user_id. Si faltara, se conserva la visita
  // porque no existe una identidad fiable con la cual deduplicarla.
  if (!id) return true;

  const idIndex = headerIndex.id_navegador;
  if (idIndex == null) return true;

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return true;

  const matches = sh
    .getRange(2, idIndex + 1, lastRow - 1, 1)
    .createTextFinder(id)
    .matchEntireCell(true)
    .findAll();

  if (!matches.length) return true;

  if (normalizedMode === "UNA POR DISPOSITIVO"){
    return false;
  }

  if (normalizedMode === "UNA POR DIA"){
    const dateIndex = headerIndex.fecha;
    if (dateIndex == null) return false;

    for (const match of matches){
      const existingDate = String(
        sh.getRange(match.getRow(), dateIndex + 1).getDisplayValue() || ""
      ).trim();

      if (existingDate === dateStr) return false;
    }
  }

  return true;
}

// ===================== TELEGRAM =====================
function sendVisitToTelegram_(data){
  const token = getTelegramProperty_(TELEGRAM_BOT_TOKEN_PROPERTY);
  const chatId = getTelegramProperty_(TELEGRAM_CHAT_ID_PROPERTY);
  if (!token || !chatId) return;

  const visitLabel = data.visitaNumero
    ? `${data.visitanteTipo || "Visitante"} · visita #${data.visitaNumero}`
    : (data.visitanteTipo || "Visitante");

  const approximateLocation = [data.ciudad, data.departamento, data.pais]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

  const locationText = data.tieneCoordenadas && data.direccion
    ? data.direccion
    : (approximateLocation || data.direccion || "Ubicación no disponible");

  let gpsText = "No disponible";
  const source = String(data.fuente || "").trim().toUpperCase();

  if (data.tieneCoordenadas){
    gpsText = data.precision !== ""
      ? `Autorizado · precisión ${Math.round(Number(data.precision) || 0)} m`
      : "Autorizado";
  } else if (source === "IP"){
    gpsText = "No autorizado · ubicación aproximada por IP";
  }

  const interestParts = [data.categoria, data.producto]
    .map(value => String(value || "").trim())
    .filter(Boolean);

  const visibleName = String(data.nombre || "").trim() || "Sin identificar";

  const parts = [
    "🔔 Nueva visita al catálogo Natura",
    `👤 Visitante: ${visibleName} · ${visitLabel}`,
    data.idNavegador ? `🆔 ID navegador: ${data.idNavegador}` : "",
    data.ipLocal ? `🏠 IP local: ${data.ipLocal}` : "",
    `📍 Ubicación: ${locationText}`,
    `🎯 GPS: ${gpsText}`,
    [data.marca, data.modelo, data.dispositivo]
      .map(value => String(value || "").trim())
      .filter(Boolean)
      .length
        ? `📱 Dispositivo: ${[data.marca, data.modelo, data.dispositivo]
            .map(value => String(value || "").trim())
            .filter(Boolean)
            .join(" · ")}`
        : "",
    data.origen ? `🌐 Origen: ${data.origen}` : "",
    interestParts.length ? `🛍️ Interés: ${interestParts.join(" · ")}` : "",
    data.carritoProductos > 0
      ? `🛒 Carrito: ${data.carritoProductos} producto${data.carritoProductos === 1 ? "" : "s"} · ${data.carritoUnidades} unidad${data.carritoUnidades === 1 ? "" : "es"} · ${formatCop_(data.carritoTotal)}`
      : "",
    `📅 Fecha y hora: ${data.fecha || ""} · ${data.hora || ""}`
  ].filter(Boolean);

  sendTelegramMessage_(token, chatId, parts.join("\n"), data.mapsUrl || "");
}

function formatCop_(value){
  const amount = Math.max(0, Number(value) || 0);
  return "$" + Math.round(amount).toLocaleString("es-CO");
}

function sendTelegramMessage_(token, chatId, text, mapsUrl){
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: String(text || "")
  };

  if (mapsUrl){
    payload.reply_markup = {
      inline_keyboard: [[
        { text: "Abrir en Google Maps", url: mapsUrl }
      ]]
    };
  }

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code < 200 || code >= 300){
    throw new Error(`Telegram respondió ${code}: ${body}`);
  }

  let parsed = null;
  try{ parsed = JSON.parse(body); }catch(_){}
  if (parsed && parsed.ok === false){
    throw new Error(`Telegram rechazó el mensaje: ${body}`);
  }
}

function getTelegramProperty_(name){
  return String(
    PropertiesService.getScriptProperties().getProperty(name) || ""
  ).trim();
}

// ===================== REVERSE GEOCODING + CACHE =====================
function reverseGeocodeCached_(lat, lng){
  try{
    const cache = CacheService.getScriptCache();

    // ✅ más preciso que toFixed(4)
    const key = "addr_" + lat.toFixed(ADDRESS_CACHE_DECIMALS) + "_" + lng.toFixed(ADDRESS_CACHE_DECIMALS);

    const cached = cache.get(key);
    if (cached != null){
      const sep = cached.indexOf("|");
      if (sep >= 0) return { status: cached.slice(0, sep), address: cached.slice(sep + 1) };
      return { status: "CACHED", address: cached };
    }

    const res = Maps.newGeocoder()
      .setLanguage("es")
      .setRegion("co")
      .reverseGeocode(lat, lng);

    const status = String(res && res.status ? res.status : "");
    let addr = "";

    if (status === "OK" && res.results && res.results.length){
      addr = res.results[0].formatted_address || "";
    }

    const toStore = status + "|" + addr;
    cache.put(key, toStore, addr ? ADDRESS_CACHE_SECONDS : ADDRESS_CACHE_EMPTY_SECONDS);

    return { status: status || "NO_STATUS", address: addr };
  }catch(_){
    return { status: "EXCEPTION", address: "" };
  }
}
