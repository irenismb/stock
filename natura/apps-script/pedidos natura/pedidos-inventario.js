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
// El inventario vigente guarda todos los atributos en una sola celda de texto.
// Resolver por encabezados y etiquetas; nunca interpretar el orden de la ficha como datos.
function compactInventoryRecord_(value, rowNumber) {
  const record = { __duplicates: [] };
  const aliases = {
    "codigo interno del producto": "codigo",
    "nombre comercial del producto": "nombre",
    "categoria del producto": "categoria",
    "marca": "marca",
    "precio de venta": "precio",
    "estado comercial del producto": "estado"
  };
  String(value == null ? "" : value).split(/\r?\n/).forEach(function(line) {
    const colon = line.indexOf(":");
    if (colon < 0) return;
    const label = normalizeHeader_(line.slice(0, colon));
    const field = aliases[label];
    if (!field) return;
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      record.__duplicates.push(label);
      return;
    }
    record[field] = line.slice(colon + 1).trim();
  });
  return record;
}

function resolveInventoryItems_(requestedItems) {
  const context = resolveInventoryContext_();
  const sheet = context.sheet;
  const columns = context.columnByHeader;
  const lastRow = sheet.getLastRow();
  if (lastRow <= context.headerRow) throw new Error("El inventario oficial no contiene productos.");

  const descriptionColumn = columns["Descripción integral del producto"];
  if (!descriptionColumn) throw new Error("Falta la descripción integral en el inventario.");
  const descriptions = sheet.getRange(context.headerRow + 1, descriptionColumn,
    lastRow - context.headerRow, 1).getDisplayValues();
  const wanted = new Set(requestedItems.map(function(item) { return item.codigo; }));
  const found = new Map();

  descriptions.forEach(function(row, index) {
    // Los códigos duplicados son ambiguos aun cuando otro campo tenga errores.
    const parsed = compactInventoryRecord_(row[0], context.headerRow + index + 1);
    const code = safe_(parsed.codigo);
    if (!wanted.has(code)) return;
    if (parsed.__duplicates.length) {
      throw new Error("Atributos duplicados en Productos fila " + (context.headerRow + index + 1) + ": " + parsed.__duplicates.join(", ") + ".");
    }
    if (!found.has(code)) found.set(code, []);
    found.get(code).push(parsed);
  });

  return requestedItems.map(function(requested) {
    const matches = found.get(requested.codigo) || [];
    if (matches.length !== 1) {
      throw new Error("El código " + requested.codigo +
        " debe identificar un único producto vigente. Coincidencias: " + matches.length + ".");
    }
    const product = matches[0];
    const name = safe_(product.nombre);
    const category = safe_(product.categoria);
    const status = normalizeHeader_(product.estado || "");
    if (!name) throw new Error("El producto " + requested.codigo + " no tiene Nombre válido.");
    if (!category) throw new Error("El producto " + requested.codigo + " no tiene Categoría válida.");
    if (status === "no a la venta") {
      throw new Error("El producto " + requested.codigo + " no está a la venta.");
    }
    const price = optionalNonNegativeNumber_(product.precio || "", "Precio", requested.codigo);
    return {
      codigo: requested.codigo,
      cantidadSolicitada: requested.cantidadSolicitada,
      marca: safeClientCell_(product.marca || "", 80),
      nombreProducto: name,
      categoria: category,
      valorUnitario: price
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
