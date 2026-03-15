const SPREADSHEET_ID = "1C4SA31dGX-6twdyZki68G4sV7j4Gwc21UuZpO0QPtuc";
const HEADER_ROW = 2;
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
      "DIRECCION PRUEBA"
    ]];

    const startRow = Math.max(HEADER_ROW + 1, sheet.getLastRow() + 1);
    sheet.getRange(startRow, START_COL, 1, HEADERS.length).setValues(row);

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

    const nombreCliente = safe_(body?.cliente?.nombre);
    const celularCliente = safe_(body?.cliente?.celular);
    const direccionCliente = safe_(body?.cliente?.direccion);
    const totalPedidoGeneral = num_(body?.totalPedido);

    const rows = items.map(item => [
      safe_(item?.nombreProducto),
      num_(item?.valorUnitario),
      num_(item?.cantidadSolicitada),
      totalPedidoGeneral || num_(item?.totalPedido),
      safe_(item?.marca),
      safe_(item?.categoria),
      safe_(item?.codigo),
      numeroPedido,
      fechaPedido,
      nombreCliente,
      celularCliente,
      direccionCliente
    ]);

    const startRow = Math.max(HEADER_ROW + 1, sheet.getLastRow() + 1);
    sheet.getRange(startRow, START_COL, rows.length, HEADERS.length).setValues(rows);

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

  sheet.getRange(Math.max(HEADER_ROW + 1, sheet.getLastRow() + 1), START_COL, 1, HEADERS.length)
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
      "SANTA MARTA PRUEBA"
    ]]);
}

function ensureHeaders_(sheet) {
  const range = sheet.getRange(HEADER_ROW, START_COL, 1, HEADERS.length);
  const current = range.getValues()[0].map(v => String(v).trim());

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
      last = values.reduce((max, value) => Math.max(max, Number(value) || 0), 0);
    }
  }

  const next = last + 1;
  props.setProperty("ultimo_numero_pedido", String(next));
  return next;
}

function safe_(value) {
  return String(value == null ? "" : value).trim();
}

function num_(value) {
  return Number(value) || 0;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}