const SPREADSHEET_ID = "1C4SA31dGX-6twdyZki68G4sV7j4Gwc21UuZpO0QPtuc";
const HEADER_ROW = 1;
const START_COL = 2; // B
const TZ = "America/Bogota";

const HEADERS = [
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
  "Direccion cliente"
];

function getSheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
}

function doGet(e) {
  const q = e && e.parameter ? e.parameter : {};

  if (q.test === "1") {
    const sheet = getSheet_();
    ensureHeaders_(sheet);

    const numeroPedido = nextOrderNumber_(sheet);
    const fechaPedido = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");

    const row = [[
      "PRODUCTO PRUEBA",
      1000,
      1,
      1000,
      "MARCA PRUEBA",
      "CATEGORIA PRUEBA",
      "COD-PRUEBA",
      numeroPedido,
      fechaPedido,
      "CLIENTE PRUEBA",
      "3000000000",
      "Calle 10A #20A-06, Santa Marta, Magdalena, Barrio Los Almendros"
    ]];

    const startRow = Math.max(HEADER_ROW + 1, sheet.getLastRow() + 1);
    sheet.getRange(startRow, START_COL, 1, HEADERS.length).setValues(row);

    setDireccionClienteRichText_(
      sheet,
      startRow,
      1,
      "Calle 10A #20A-06, Santa Marta, Magdalena, Barrio Los Almendros",
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent_("Calle 10A #20A-06, Santa Marta, Magdalena")
    );

    return json_({
      ok: true,
      modo: "test_get",
      numeroPedido: numeroPedido,
      fechaPedido: fechaPedido
    });
  }

  return json_({
    ok: true,
    message: "Web app activa. Usa ?test=1 para insertar una fila de prueba."
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSheet_();
    ensureHeaders_(sheet);

    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    const body = JSON.parse(raw);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return json_({ ok: false, message: "No hay productos para registrar." });
    }

    const numeroPedido = nextOrderNumber_(sheet);
    const fechaPedido = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");

    const nombreCliente = safe_(body && body.cliente && body.cliente.nombre);
    const celularCliente = safe_(body && body.cliente && body.cliente.celular);
    const direccionClienteVisible = buildDireccionClienteVisible_(body);
    const direccionClienteMapa = buildDireccionClienteMapa_(body);
    const totalPedidoGeneral = num_(body && body.totalPedido);

    const rows = items.map(function(item) {
      return [
        safe_(item && item.nombreProducto),
        num_(item && item.valorUnitario),
        num_(item && item.cantidadSolicitada),
        totalPedidoGeneral || num_(item && item.totalPedido),
        safe_(item && item.marca),
        safe_(item && item.categoria),
        safe_(item && item.codigo),
        numeroPedido,
        fechaPedido,
        nombreCliente,
        celularCliente,
        direccionClienteVisible
      ];
    });

    const startRow = Math.max(HEADER_ROW + 1, sheet.getLastRow() + 1);
    sheet.getRange(startRow, START_COL, rows.length, HEADERS.length).setValues(rows);

    if (direccionClienteVisible) {
      setDireccionClienteRichText_(sheet, startRow, rows.length, direccionClienteVisible, direccionClienteMapa);
    }

    return json_({
      ok: true,
      numeroPedido: numeroPedido,
      fechaPedido: fechaPedido,
      filas: rows.length
    });
  } catch (err) {
    return json_({
      ok: false,
      message: String(err)
    });
  } finally {
    lock.releaseLock();
  }
}

function probarRegistroManual_() {
  const sheet = getSheet_();
  ensureHeaders_(sheet);

  const numeroPedido = nextOrderNumber_(sheet);
  const fechaPedido = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");

  const direccionVisible = "Calle 10A #20A-06, Santa Marta, Magdalena, Barrio Los Almendros";
  const direccionMapa = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent_("Calle 10A #20A-06, Santa Marta, Magdalena");

  const startRow = Math.max(HEADER_ROW + 1, sheet.getLastRow() + 1);

  sheet.getRange(startRow, START_COL, 1, HEADERS.length)
    .setValues([[
      "MANUAL PRUEBA",
      5000,
      2,
      10000,
      "NATURA",
      "PRUEBA",
      "MAN-001",
      numeroPedido,
      fechaPedido,
      "MARTIN PRUEBA",
      "3001112233",
      direccionVisible
    ]]);

  setDireccionClienteRichText_(sheet, startRow, 1, direccionVisible, direccionMapa);
}

function ensureHeaders_(sheet) {
  const range = sheet.getRange(HEADER_ROW, START_COL, 1, HEADERS.length);
  const current = range.getValues()[0].map(function(v) { return String(v).trim(); });

  let same = true;
  for (let i = 0; i < HEADERS.length; i++) {
    if (current[i] !== HEADERS[i]) {
      same = false;
      break;
    }
  }

  if (!same) {
    range.setValues([HEADERS]);
    range.setFontWeight("bold");
  }
}

function nextOrderNumber_(sheet) {
  const props = PropertiesService.getScriptProperties();
  let last = Number(props.getProperty("ultimo_numero_pedido") || "0");

  if (!last) {
    const lastRow = sheet.getLastRow();
    if (lastRow > HEADER_ROW) {
      const colNumeroPedido = START_COL + 7; // I dentro del bloque B:M
      const values = sheet.getRange(HEADER_ROW + 1, colNumeroPedido, lastRow - HEADER_ROW, 1)
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

  if (direccionVisible) {
    return direccionVisible;
  }

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

  if (direccionMapa) {
    return direccionMapa;
  }

  const direccionBase = safe_(cliente.direccionBase);
  if (direccionBase) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent_(direccionBase);
  }

  return "";
}

function setDireccionClienteRichText_(sheet, startRow, numRows, visibleText, linkUrl) {
  if (!numRows || numRows < 1) return;

  const colDireccionCliente = START_COL + HEADERS.indexOf("Direccion cliente");
  if (colDireccionCliente < START_COL) return;

  const values = [];
  for (let i = 0; i < numRows; i++) {
    if (visibleText && linkUrl) {
      values.push([
        SpreadsheetApp.newRichTextValue()
          .setText(visibleText)
          .setLinkUrl(linkUrl)
          .build()
      ]);
    } else {
      values.push([
        SpreadsheetApp.newRichTextValue()
          .setText(visibleText || "")
          .build()
      ]);
    }
  }

  sheet.getRange(startRow, colDireccionCliente, numRows, 1).setRichTextValues(values);
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
