const SPREADSHEET_ID = "1C4SA31dGX-6twdyZki68G4sV7j4Gwc21UuZpO0QPtuc";
const TZ = "America/Bogota";
const HEADER_SCAN_MAX_ROWS = 30;
const HEADER_SCAN_MAX_COLS = 40;

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

function normalizeHeader_(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function canonicalHeaderMap_() {
  const map = {};
  REQUIRED_HEADERS.forEach(function(header) {
    map[normalizeHeader_(header)] = header;
  });
  return map;
}

function resolveSheetContext_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const canonical = canonicalHeaderMap_();
  const requiredKeys = Object.keys(canonical);
  const matches = [];
  const duplicateRows = [];

  spreadsheet.getSheets().forEach(function(sheet) {
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
      "No se pudo identificar de forma única la tabla de pedidos por sus encabezados. Coincidencias: " + matches.length + "." + duplicateDetail
    );
  }

  return matches[0];
}

function movementType_(body) {
  const raw = safe_(body && (body.tipoMovimiento || body.tipo_movimiento || body.movimiento));
  const normalized = normalizeHeader_(raw);
  if (normalized === "venta") return "Venta";
  if (normalized === "pedido") return "Pedido";
  return "Pedido";
}

function doGet(e) {
  const q = e && e.parameter ? e.parameter : {};

  if (q.test === "1") {
    const context = resolveSheetContext_();
    const payload = {
      tipoMovimiento: "Pedido",
      totalPedido: 1000,
      cliente: {
        nombre: "CLIENTE PRUEBA",
        celular: "3000000000",
        direccion: "Calle 10A #20A-06, Santa Marta, Magdalena, Barrio Los Almendros",
        direccionBase: "Calle 10A #20A-06, Santa Marta, Magdalena"
      },
      items: [{
        nombreProducto: "PRODUCTO PRUEBA",
        valorUnitario: 1000,
        cantidadSolicitada: 1,
        totalPedido: 1000,
        marca: "MARCA PRUEBA",
        categoria: "CATEGORIA PRUEBA",
        codigo: "COD-PRUEBA"
      }]
    };
    const result = appendMovement_(context, payload, payload.items);
    result.modo = "test_get";
    return json_(result);
  }

  return json_({
    ok: true,
    message: "Web app activa. Registra pedidos y ventas según Tipo movimiento."
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const context = resolveSheetContext_();
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    const body = JSON.parse(raw);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return json_({ ok: false, message: "No hay productos para registrar." });
    }

    return json_(appendMovement_(context, body, items));
  } catch (err) {
    return json_({
      ok: false,
      message: String(err)
    });
  } finally {
    lock.releaseLock();
  }
}

function appendMovement_(context, body, items) {
  const sheet = context.sheet;
  const columns = context.columnByHeader;
  const numeroPedido = nextOrderNumber_(context);
  const fechaPedido = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");
  const tipoMovimiento = movementType_(body);

  const nombreCliente = safe_(body && body.cliente && body.cliente.nombre);
  const celularCliente = safe_(body && body.cliente && body.cliente.celular);
  const direccionClienteVisible = buildDireccionClienteVisible_(body);
  const direccionClienteMapa = buildDireccionClienteMapa_(body);
  const totalPedidoGeneral = num_(body && body.totalPedido);

  const records = items.map(function(item) {
    return {
      "Nombre producto": safe_(item && item.nombreProducto),
      "Valor unitario": num_(item && item.valorUnitario),
      "Cantidad solicitada": num_(item && item.cantidadSolicitada),
      "Total pedido": totalPedidoGeneral || num_(item && item.totalPedido),
      "Marca": safe_(item && item.marca),
      "Categoria": safe_(item && item.categoria),
      "Codigo": safe_(item && item.codigo),
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

function probarRegistroManual_() {
  const context = resolveSheetContext_();
  const payload = {
    tipoMovimiento: "Pedido",
    totalPedido: 10000,
    cliente: {
      nombre: "MARTIN PRUEBA",
      celular: "3001112233",
      direccion: "Calle 10A #20A-06, Santa Marta, Magdalena, Barrio Los Almendros",
      direccionBase: "Calle 10A #20A-06, Santa Marta, Magdalena"
    },
    items: [{
      nombreProducto: "MANUAL PRUEBA",
      valorUnitario: 5000,
      cantidadSolicitada: 2,
      totalPedido: 10000,
      marca: "NATURA",
      categoria: "PRUEBA",
      codigo: "MAN-001"
    }]
  };
  return appendMovement_(context, payload, payload.items);
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
  const direccionVisible = safe_(cliente.direccion);

  if (direccionVisible) return direccionVisible;

  const direccionBase = safe_(cliente.direccionBase);
  const barrio = safe_(cliente.barrio);
  return joinParts_([
    direccionBase,
    barrio ? "Barrio " + barrio : ""
  ], ", ");
}

function buildDireccionClienteMapa_(body) {
  const cliente = body && body.cliente ? body.cliente : {};
  const direccionMapa = safe_(cliente.direccionMapa);
  if (direccionMapa) return direccionMapa;

  const direccionBase = safe_(cliente.direccionBase);
  if (direccionBase) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent_(direccionBase);
  }
  return "";
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

function num_(value) {
  return Number(value) || 0;
}

function encodeURIComponent_(text) {
  return encodeURIComponent(String(text == null ? "" : text));
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
