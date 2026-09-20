const SPREADSHEET_ID = "1C4SA31dGX-6twdyZki68G4sV7j4Gwc21UuZpO0QPtuc";
const INVENTORY_SPREADSHEET_ID = "1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs";
const INVENTORY_SHEET_NAME = "Productos";
const TZ = "America/Bogota";
const HEADER_SCAN_MAX_ROWS = 30;
const HEADER_SCAN_MAX_COLS = 40;
const REQUEST_REGISTRY_PROPERTY = "recent_order_requests_v1";
const REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_MAX_ENTRIES = 200;

const REQUIRED_HEADERS = [
  "Nombre producto",
  "Valor unitario",
  "Cantidad solicitada",
  "Total pedido",
  "Marca",
  "Categoria",
  "Codigo",
  "Numero pedido",
  "Fecha pedido",
  "Nombre cliente",
  "Celular cliente",
  "Direccion cliente",
  "Tipo movimiento"
];

const INVENTORY_REQUIRED_HEADERS = [
  "Código",
  "Categoría",
  "Nombre",
  "Precio"
];

// ===================== ENDPOINTS Y ORQUESTACIÓN =====================
function doGet(e) {
  const q = e && e.parameter ? e.parameter : {};
  const requestId = normalizeClientRequestId_(q.request_id || q.client_request_id || "", false);

  if (requestId) {
    const registry = cleanupRequestRegistry_(readRequestRegistry_());
    const entry = registry[requestId] || null;
    const result = entry
      ? Object.assign({ client_request_id: requestId }, entry.publicResult || {})
      : { ok: false, status: "not_found", client_request_id: requestId };
    return jsonOrJsonp_(result, q.prefix || "");
  }

  return jsonOrJsonp_({
    ok: true,
    message: "Web app activa. Registra pedidos validando los productos contra el inventario oficial."
  }, q.prefix || "");
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let requestId = "";

  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    const body = JSON.parse(raw);
    requestId = normalizeClientRequestId_(body && body.client_request_id, true) || generateRequestId_();

    let registry = cleanupRequestRegistry_(readRequestRegistry_());
    if (registry[requestId] && registry[requestId].publicResult) {
      const previous = Object.assign({}, registry[requestId].publicResult, {
        client_request_id: requestId,
        duplicate: true
      });
      return json_(previous);
    }

    const requestedItems = normalizeRequestedItems_(body && body.items);
    const resolvedItems = resolveInventoryItems_(requestedItems);
    const context = resolveSheetContext_();
    const pricing = calculateOrderPricing_(body, resolvedItems);
    const result = appendMovement_(context, body, resolvedItems, pricing);

    const publicResult = Object.assign({}, result, {
      status: "registered",
      client_request_id: requestId,
      precioPendiente: pricing.hasPendingPrice
    });

    registry[requestId] = {
      ts: Date.now(),
      publicResult: publicResult
    };
    writeRequestRegistry_(registry);
    return json_(publicResult);
  } catch (err) {
    const message = String(err && err.message ? err.message : err);

    if (requestId) {
      const registry = cleanupRequestRegistry_(readRequestRegistry_());
      registry[requestId] = {
        ts: Date.now(),
        publicResult: {
          ok: false,
          status: "error",
          client_request_id: requestId,
          message: message
        }
      };
      writeRequestRegistry_(registry);
    }

    return json_({
      ok: false,
      status: "error",
      client_request_id: requestId || "",
      message: message
    });
  } finally {
    lock.releaseLock();
  }
}