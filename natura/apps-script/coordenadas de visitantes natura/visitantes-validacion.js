// Respuestas HTTP, parámetros, validación y normalización de entradas.

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


function normalizeExternalIp_(value){
  const ip = safePlainText_(value, 64);
  if (!ip || /\s/.test(ip)) return "";

  const ipv4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4){
    const parts = ipv4.slice(1).map(Number);
    if (parts.some(part => part < 0 || part > 255)) return "";
    return ip;
  }

  return /^[0-9a-f:]+$/i.test(ip) && ip.includes(":") ? ip : "";
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
