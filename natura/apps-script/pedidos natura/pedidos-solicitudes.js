// Idempotencia de solicitudes, sanitización y respuestas HTTP/JSONP.

function readRequestRegistry_() {
  const raw = PropertiesService.getScriptProperties().getProperty(REQUEST_REGISTRY_PROPERTY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}
function cleanupRequestRegistry_(registry) {
  const now = Date.now();
  const valid = [];
  Object.keys(registry || {}).forEach(function(key) {
    const entry = registry[key];
    const ts = Number(entry && entry.ts) || 0;
    if (ts && now - ts <= REQUEST_TTL_MS) valid.push([key, entry]);
  });

  valid.sort(function(a, b) { return Number(b[1].ts) - Number(a[1].ts); });
  const cleaned = {};
  valid.slice(0, REQUEST_MAX_ENTRIES).forEach(function(pair) {
    cleaned[pair[0]] = pair[1];
  });
  return cleaned;
}
function writeRequestRegistry_(registry) {
  const cleaned = cleanupRequestRegistry_(registry || {});
  PropertiesService.getScriptProperties().setProperty(REQUEST_REGISTRY_PROPERTY, JSON.stringify(cleaned));
}
function normalizeClientRequestId_(value, rejectInvalid) {
  const id = safe_(value);
  if (!id) return "";
  if (/^[A-Za-z0-9_-]{16,120}$/.test(id)) return id;
  if (rejectInvalid) throw new Error("client_request_id inválido.");
  return "";
}
function generateRequestId_() {
  return "legacy_" + Utilities.getUuid().replace(/-/g, "");
}
function safeClientCell_(value, maxLen) {
  let text = safe_(value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ");
  if (maxLen && text.length > maxLen) text = text.slice(0, maxLen);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}
function joinParts_(parts, sep) {
  return (parts || [])
    .filter(function(part) { return !!part; })
    .join(sep || " ")
    .replace(/\s+/g, " ")
    .trim();
}
function safe_(value) {
  return String(value == null ? "" : value).trim();
}
function encodeURIComponent_(text) {
  return encodeURIComponent(String(text == null ? "" : text));
}
function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function jsonOrJsonp_(obj, prefix) {
  const callback = safe_(prefix);
  if (!callback) return json_(obj);
  if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,80}$/.test(callback)) {
    return json_({ ok: false, status: "error", message: "Callback JSONP inválido." });
  }
  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(obj) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}