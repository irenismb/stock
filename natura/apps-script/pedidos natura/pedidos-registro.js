// Escritura del pedido, numeración y dirección del cliente.

function movementType_(body) {
  const raw = safe_(body && (body.tipoMovimiento || body.tipo_movimiento || body.movimiento));
  const normalized = normalizeHeader_(raw);
  if (normalized === "venta") return "Venta";
  return "Pedido";
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