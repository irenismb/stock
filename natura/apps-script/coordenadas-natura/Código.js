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
  "hora"
];

// ===================== ENDPOINTS =====================
function doGet(e)  { return handleRequest_(e); }
function doPost(e) { return handleRequest_(e); }

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
function handleRequest_(e){
  let lock = null;
  let telegramPayload = null;

  try{
    const p = parseParams_(e);

    const latTxt = String(p.lat == null ? "" : p.lat).trim();
    const lngTxt = String(p.lng == null ? "" : p.lng).trim();

    const lat = (latTxt === "") ? NaN : Number(latTxt);
    const lng = (lngTxt === "") ? NaN : Number(lngTxt);
    const hasCoords = isFinite(lat) && isFinite(lng);

    const userIdRaw = String((p.user_id || p.navegador || "")).trim();
    const identity = getBrowserIdentity_(userIdRaw);
    const navegadorVal = identity.navegador || userIdRaw;

    if (shouldSkipOwnVisit_(identity)) return ok_();

    const accTxt = String(p.acc == null ? "" : p.acc).trim();
    const accNum = (accTxt === "") ? NaN : Number(accTxt);
    const accVal = isFinite(accNum) ? accNum : "";

    let fuenteVal = String((p.fuente || p.src || "")).trim();
    if (!fuenteVal){
      fuenteVal = hasCoords ? "GEO" : "SIN_UBICACION";
    }

    const clientAddress = String((p.direccion || "")).trim();
    const cityVal = String((p.ciudad || "")).trim();
    const departmentVal = String((p.departamento || "")).trim();
    const countryVal = String((p.pais || "")).trim();
    const visitId = String((p.load_id || "")).trim();

    const deviceVal = String((p.dispositivo || "")).trim();
    const brandVal = String((p.marca || "")).trim();
    const modelVal = String((p.modelo || "")).trim();
    const ipLocalRaw = String((p.ip_local || "")).trim();
    const ipLocalVal = isPrivateIpv4_(ipLocalRaw) ? ipLocalRaw : "";
    const originVal = String((p.origen || "")).trim();
    const categoryVal = String((p.categoria || "")).trim();
    const productVal = String((p.producto || "")).trim();
    const cartProductsVal = Math.max(0, Number(p.carrito_productos) || 0);
    const cartUnitsVal = Math.max(0, Number(p.carrito_unidades) || 0);
    const cartTotalVal = Math.max(0, Number(p.carrito_total) || 0);

    lock = LockService.getScriptLock();
    if (!lock.tryLock(2000)) return ok_();

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
    if (!sh) return ok_();

    const headerIndex = ensureHeaders_(sh, REQUIRED_HEADERS);
    const lastCol = sh.getLastColumn();

    const now = new Date();
    const dateStr = Utilities.formatDate(now, TZ, "yyyy-MM-dd");
    const timeStr = Utilities.formatDate(now, TZ, "HH:mm:ss");

    const visitMode = getVisitMode_();
    const visitStats = getVisitStats_(sh, headerIndex, userIdRaw);

    if (!shouldRegisterVisit_(sh, headerIndex, userIdRaw, dateStr, visitMode)){
      return ok_();
    }

    let coordText = "";
    let mapsUrl = "";
    let distanceMeters = "";

    if (hasCoords){
      coordText = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(coordText)}`;
      distanceMeters = Math.round(haversineMeters_(REF_LAT, REF_LNG, lat, lng));
    } else {
      const approximateQuery = [cityVal, departmentVal, countryVal].filter(Boolean).join(", ");
      if (approximateQuery){
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(approximateQuery)}`;
      }
    }

    let address = "";
    if (hasCoords && WRITE_ADDRESS){
      const geo = reverseGeocodeCached_(lat, lng);
      address = geo.address || "";
    } else {
      address = clientAddress || "";
    }

    const row = new Array(lastCol).fill("");

    if (headerIndex.navegador != null)      row[headerIndex.navegador]      = navegadorVal;
    if (headerIndex.id_navegador != null)   row[headerIndex.id_navegador]   = userIdRaw;
    if (headerIndex.fecha != null)          row[headerIndex.fecha]          = dateStr;
    if (headerIndex.hora != null)           row[headerIndex.hora]           = timeStr;
    if (headerIndex.fuente != null)         row[headerIndex.fuente]         = fuenteVal;
    if (headerIndex.precision != null)      row[headerIndex.precision]      = accVal;
    if (headerIndex.direccion != null)      row[headerIndex.direccion]      = address;
    if (headerIndex.distancia_m != null)    row[headerIndex.distancia_m]    = distanceMeters;
    if (headerIndex.coordenadas != null)    row[headerIndex.coordenadas]    = coordText;

    // Estas columnas son opcionales y ya existen en el libro.
    // No se crean columnas nuevas para los datos exclusivos de Telegram.
    if (headerIndex.ciudad != null)         row[headerIndex.ciudad]         = cityVal;
    if (headerIndex.departamento != null)   row[headerIndex.departamento]   = departmentVal;
    if (headerIndex.pais != null)           row[headerIndex.pais]           = countryVal;
    if (headerIndex.id_visita != null)      row[headerIndex.id_visita]      = visitId;

    const nextRow = Math.max(2, sh.getLastRow() + 1);
    sh.getRange(nextRow, 1, 1, lastCol).setValues([row]);

    if (hasCoords && headerIndex.coordenadas != null){
      const cell = sh.getRange(nextRow, headerIndex.coordenadas + 1);
      const rich = SpreadsheetApp.newRichTextValue()
        .setText(coordText)
        .setLinkUrl(mapsUrl)
        .build();
      cell.setRichTextValue(rich);
    }

    telegramPayload = {
      fecha: dateStr,
      hora: timeStr,
      direccion: address,
      ciudad: cityVal,
      departamento: departmentVal,
      pais: countryVal,
      coordenadas: coordText,
      precision: accVal,
      fuente: fuenteVal,
      mapsUrl,
      tieneCoordenadas: hasCoords,
      visitanteTipo: visitStats.tipo,
      visitaNumero: visitStats.numero,
      nombre: identity.nombre || "",
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

  }catch(_){
  }finally{
    try{ if (lock) lock.releaseLock(); }catch(_){}
  }

  try{
    if (telegramPayload){
      sendVisitToTelegram_(telegramPayload);
    }
  }catch(error){
    console.error("ERROR TELEGRAM: " + (error && error.stack ? error.stack : error));
  }

  return ok_();
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

// ===================== RESPUESTA OK =====================
function ok_(){
  return ContentService
    .createTextOutput("ok")
    .setMimeType(ContentService.MimeType.TEXT);
}

// ===================== PARSEO PARAMS =====================
function parseParams_(e){
  const out = Object.assign({}, (e && e.parameter) || {});
  try{
    const raw = e && e.postData && e.postData.contents;
    if (!raw) return out;

    const ct = String(e.postData.type || "").toLowerCase();
    if (ct.includes("application/json")){
      const j = JSON.parse(raw);
      if (j && typeof j === "object"){
        Object.keys(j).forEach(k => out[k] = String(j[k]));
      }
      return out;
    }

    raw.split("&").forEach(part => {
      if(!part) return;
      const kv = part.split("=");
      const k = kv[0];
      const v = kv.slice(1).join("=");
      if(!k) return;
      out[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
  }catch(_){}
  return out;
}

// ===================== HEADERS =====================
function norm_(s){
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function ensureHeaders_(sh, required){
  const lastCol = Math.max(1, sh.getLastColumn());
  const headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  const idx = {};
  headerRow.forEach((h, i) => idx[norm_(h)] = i);

  let changed = false;
  const extended = headerRow.slice();

  required.forEach(h => {
    const key = norm_(h);
    if (idx[key] == null){
      extended.push(h);
      idx[key] = extended.length - 1;
      changed = true;
    }
  });

  if (changed){
    sh.getRange(1, 1, 1, extended.length).setValues([extended]);
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
// Prueba de sincronización bidireccional: 2026-09-12