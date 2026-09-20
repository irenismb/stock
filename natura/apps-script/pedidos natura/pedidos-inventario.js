// Validación de productos contra el inventario oficial y cálculo del pedido.

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