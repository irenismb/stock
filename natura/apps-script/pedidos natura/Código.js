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

function normalizeHeader_(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function canonicalHeaderMap_(headers) {
  const map = {};
  (headers || []).forEach(function(header) {
    map[normalizeHeader_(header)] = header;
  });
  return map;
}

function resolveTableContext_(spreadsheet, requiredHeaders, onlySheetName) {
  const canonical = canonicalHeaderMap_(requiredHeaders);
  const requiredKeys = Object.keys(canonical);
  const matches = [];
  const duplicateRows = [];
  const sheets = onlySheetName ? [spreadsheet.getSheetByName(onlySheetName)] : spreadsheet.getSheets();

  if (onlySheetName && !sheets[0]) {
    throw new Error("No existe la pestaña requerida: " + onlySheetName);
  }

  sheets.forEach(function(sheet) {
    if (!sheet) return;
    const rowCount = Math.min(sheet.getMaxRows(), HEADER_SCAN_MAX_ROWS);
    const colCount = Math.min(sheet.getMaxColumns(), HEADER_SCAN_MAX_COLS);
    if (rowCount < 1 || colCount < 1) return;

    const values = sheet.getRange(1, 1, rowCount, colCount).getDisplayValues();
    values.forEach(function(row, rowIndex) {
      const found = {};
      const duplicates = [];

      row.forEach(function(value, colIndex) {
        const key = normalizeHeader_(value);
        if (!canonical[key]) return;
        if (found[key]) {
          duplicates.push(canonical[key]);
          return;
        }
        found[key] = colIndex + 1;
      });

      if (duplicates.length) {
        duplicateRows.push(sheet.getName() + " fila " + (rowIndex + 1) + ": " + duplicates.join(", "));
        return;
      }

      const complete = requiredKeys.every(function(key) { return !!found[key]; });
      if (!complete) return;

      const columnByHeader = {};
      requiredKeys.forEach(function(key) {
        columnByHeader[canonical[key]] = found[key];
      });

      matches.push({
        sheet: sheet,
        headerRow: rowIndex + 1,
        columnByHeader: columnByHeader
      });
    });
  });

  if (matches.length !== 1) {
    const duplicateDetail = duplicateRows.length ? " Encabezados duplicados: " + duplicateRows.join(" | ") : "";
    throw new Error(
      "No se pudo identificar de forma única la tabla por sus encabezados. Coincidencias: " + matches.length + "." + duplicateDetail
    );
  }

  return matches[0];
}

function resolveSheetContext_() {
  return resolveTableContext_(SpreadsheetApp.openById(SPREADSHEET_ID), REQUIRED_HEADERS, "");
}

function resolveInventoryContext_() {
  return resolveTableContext_(
    SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID),
    INVENTORY_REQUIRED_HEADERS,
    INVENTORY_SHEET_NAME
  );
}

function movementType_(body) {
  const raw = safe_(body && (body.tipoMovimiento || body.tipo_movimiento || body.movimiento));
  const normalized = normalizeHeader_(raw);
  if (normalized === "venta") return "Venta";
  return "Pedido";
}

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

function normalizeRequestedItems_(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error("No hay productos para registrar.");
  }
  if (items.length > 50) {
    throw new Error("El pedido supera el máximo de productos permitido.");
  }

  const grouped = {};
  items.forEach(function(item) {
    const code = normalizeProductCode_(item && item.codigo);
    const qty = positiveInteger_(item && item.cantidadSolicitada, "Cantidad solicitada");
    const brand = safeClientCell_(item && item.marca, 80);

    if (!grouped[code]) {
      grouped[code] = { codigo: code, cantidadSolicitada: 0, marca: brand };
    }
    grouped[code].cantidadSolicitada += qty;
    if (grouped[code].cantidadSolicitada > 9999) {
      throw new Error("Cantidad solicitada fuera de rango para el código " + code + ".");
    }
  });

  return Object.keys(grouped).map(function(code) { return grouped[code]; });
}

function resolveInventoryItems_(requestedItems) {
  const context = resolveInventoryContext_();
  const sheet = context.sheet;
  const columns = context.columnByHeader;
  const lastRow = sheet.getLastRow();

  if (lastRow <= context.headerRow) {
    throw new Error("El inventario oficial no contiene productos.");
  }

  const maxCol = Math.max.apply(null, Object.keys(columns).map(function(header) { return columns[header]; }));
  const numRows = lastRow - context.headerRow;
  const range = sheet.getRange(context.headerRow + 1, 1, numRows, maxCol);
  const rawValues = range.getValues();
  const displayValues = range.getDisplayValues();
  const requestedCodes = {};
  requestedItems.forEach(function(item) { requestedCodes[item.codigo] = true; });
  const matchesByCode = {};

  displayValues.forEach(function(row, rowIndex) {
    const code = safe_(row[columns["Código"] - 1]);
    if (!requestedCodes[code]) return;
    if (!matchesByCode[code]) matchesByCode[code] = [];
    matchesByCode[code].push(rowIndex);
  });

  return requestedItems.map(function(requested) {
    const matches = matchesByCode[requested.codigo] || [];
    if (matches.length !== 1) {
      throw new Error(
        "El código " + requested.codigo + " debe identificar un único producto vigente. Coincidencias: " + matches.length + "."
      );
    }

    const rowIndex = matches[0];
    const display = displayValues[rowIndex];
    const raw = rawValues[rowIndex];
    const nombre = safe_(display[columns["Nombre"] - 1]);
    const categoria = safe_(display[columns["Categoría"] - 1]);
    const precio = optionalNonNegativeNumber_(raw[columns["Precio"] - 1], "Precio", requested.codigo);

    if (!nombre) throw new Error("El producto " + requested.codigo + " no tiene Nombre válido en el inventario.");
    if (!categoria) throw new Error("El producto " + requested.codigo + " no tiene Categoría válida en el inventario.");

    return {
      codigo: requested.codigo,
      cantidadSolicitada: requested.cantidadSolicitada,
      marca: requested.marca,
      nombreProducto: nombre,
      categoria: categoria,
      valorUnitario: precio
    };
  });
}

function calculateOrderPricing_(body, items) {
  const hasPendingPrice = items.some(function(item) { return item.valorUnitario == null; });
  const subtotal = items.reduce(function(sum, item) {
    if (item.valorUnitario == null) return sum;
    return sum + (item.valorUnitario * item.cantidadSolicitada);
  }, 0);

  let shipping = optionalRequestAmount_(body && body.envio, "Envío");

  // Compatibilidad temporal con catálogos antiguos que todavía envían totalPedido.
  if (shipping == null && !hasPendingPrice) {
    const legacyTotal = optionalRequestAmount_(body && body.totalPedido, "Total pedido");
    if (legacyTotal != null) shipping = Math.max(0, legacyTotal - subtotal);
  }

  if (shipping == null) shipping = 0;
  if (shipping > 1000000) throw new Error("El valor de envío está fuera del rango permitido.");

  return {
    hasPendingPrice: hasPendingPrice,
    subtotal: subtotal,
    shipping: shipping,
    totalPedido: hasPendingPrice ? "" : subtotal + shipping
  };
}

function appendMovement_(context, body, items, pricing) {
  const sheet = context.sheet;
  const columns = context.columnByHeader;
  const numeroPedido = nextOrderNumber_(context);
  const fechaPedido = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");
  const tipoMovimiento = movementType_(body);

  const nombreCliente = safeClientCell_(body && body.cliente && body.cliente.nombre, 120);
  const celularCliente = safeClientCell_(body && body.cliente && body.cliente.celular, 50);
  const direccionClienteVisible = buildDireccionClienteVisible_(body);
  const direccionClienteMapa = buildDireccionClienteMapa_(body);

  const records = items.map(function(item) {
    return {
      "Nombre producto": item.nombreProducto,
      "Valor unitario": item.valorUnitario == null ? "" : item.valorUnitario,
      "Cantidad solicitada": item.cantidadSolicitada,
      "Total pedido": pricing.totalPedido,
      "Marca": item.marca,
      "Categoria": item.categoria,
      "Codigo": item.codigo,
      "Numero pedido": numeroPedido,
      "Fecha pedido": fechaPedido,
      "Nombre cliente": nombreCliente,
      "Celular cliente": celularCliente,
      "Direccion cliente": direccionClienteVisible,
      "Tipo movimiento": tipoMovimiento
    };
  });

  const startRow = Math.max(context.headerRow + 1, sheet.getLastRow() + 1);

  REQUIRED_HEADERS.forEach(function(header) {
    const col = columns[header];
    if (!col) throw new Error("Falta el encabezado requerido: " + header);
    const values = records.map(function(record) { return [record[header]]; });
    sheet.getRange(startRow, col, values.length, 1).setValues(values);
  });

  if (direccionClienteVisible) {
    setDireccionClienteRichText_(context, startRow, records.length, direccionClienteVisible, direccionClienteMapa);
  }

  return {
    ok: true,
    numeroPedido: numeroPedido,
    fechaPedido: fechaPedido,
    tipoMovimiento: tipoMovimiento,
    filas: records.length
  };
}

function nextOrderNumber_(context) {
  const props = PropertiesService.getScriptProperties();
  let last = Number(props.getProperty("ultimo_numero_pedido") || "0");

  if (!last) {
    const sheet = context.sheet;
    const lastRow = sheet.getLastRow();
    const numeroCol = context.columnByHeader["Numero pedido"];
    if (!numeroCol) throw new Error("No se encontró el encabezado Numero pedido.");

    if (lastRow > context.headerRow) {
      const values = sheet.getRange(context.headerRow + 1, numeroCol, lastRow - context.headerRow, 1)
        .getValues()
        .flat();
      last = values.reduce(function(max, value) {
        return Math.max(max, Number(value) || 0);
      }, 0);
    }
  }

  const next = last + 1;
  props.setProperty("ultimo_numero_pedido", String(next));
  return next;
}

function buildDireccionClienteVisible_(body) {
  const cliente = body && body.cliente ? body.cliente : {};
  const direccionVisible = safeClientCell_(cliente.direccion, 300);
  if (direccionVisible) return direccionVisible;

  const direccionBase = safeClientCell_(cliente.direccionBase, 240);
  const barrio = safeClientCell_(cliente.barrio, 100);
  return joinParts_([
    direccionBase,
    barrio ? "Barrio " + barrio : ""
  ], ", ");
}

function buildDireccionClienteMapa_(body) {
  const cliente = body && body.cliente ? body.cliente : {};
  const direccionBase = safeClientCell_(cliente.direccionBase, 240);
  if (!direccionBase) return "";
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent_(direccionBase.replace(/^'/, ""));
}

function setDireccionClienteRichText_(context, startRow, numRows, visibleText, linkUrl) {
  if (!numRows || numRows < 1) return;
  const colDireccionCliente = context.columnByHeader["Direccion cliente"];
  if (!colDireccionCliente) throw new Error("No se encontró el encabezado Direccion cliente.");

  const values = [];
  for (let i = 0; i < numRows; i++) {
    const builder = SpreadsheetApp.newRichTextValue().setText(visibleText || "");
    if (visibleText && linkUrl) builder.setLinkUrl(linkUrl);
    values.push([builder.build()]);
  }

  context.sheet.getRange(startRow, colDireccionCliente, numRows, 1).setRichTextValues(values);
}

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

function normalizeProductCode_(value) {
  const code = safe_(value);
  if (!/^\d{4}$/.test(code)) {
    throw new Error("Cada producto debe enviar un Código válido de cuatro dígitos.");
  }
  return code;
}

function positiveInteger_(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error((label || "Cantidad") + " debe ser un entero mayor que cero.");
  }
  return n;
}

function optionalNonNegativeNumber_(value, label, code) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error((label || "Valor") + " inválido en el inventario" + (code ? " para " + code : "") + ".");
  }
  return n;
}

function optionalRequestAmount_(value, label) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error((label || "Valor") + " inválido.");
  }
  return Math.round(n);
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
