const INVENTARIO_SPREADSHEET_ID = "1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs";
const INVENTARIO_SHEET_NAME = "Productos";
const INVENTARIO_HEADER_ROW = 1;

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile("Admin")
    .setTitle("Administrar precios · Irenismb Stock Natura");
}

function obtenerProductosPrecios() {
  const contexto = obtenerContextoInventario_();
  const ultimaFila = contexto.hoja.getLastRow();

  if (ultimaFila <= INVENTARIO_HEADER_ROW) {
    return { productos: [], actualizadoEn: new Date().toISOString() };
  }

  const valores = contexto.hoja
    .getRange(
      INVENTARIO_HEADER_ROW + 1,
      1,
      ultimaFila - INVENTARIO_HEADER_ROW,
      contexto.ultimaColumna
    )
    .getDisplayValues();

  const productos = valores
    .map(function(fila) {
      return {
        codigo: normalizarCodigo_(fila[contexto.columnas.codigo]),
        nombre: String(fila[contexto.columnas.nombre] || "").trim(),
        precio: String(fila[contexto.columnas.precio] || "").trim()
      };
    })
    .filter(function(producto) {
      return /^\d{4}$/.test(producto.codigo) && producto.nombre;
    });

  return {
    productos: productos,
    actualizadoEn: new Date().toISOString()
  };
}

function actualizarPrecioWeb(codigo, precioNuevo, precioAnterior) {
  const codigoSeguro = normalizarCodigo_(codigo);
  if (!/^\d{4}$/.test(codigoSeguro)) {
    throw new Error("El código debe contener exactamente cuatro dígitos.");
  }

  const precioNormalizado = normalizarPrecioEntrada_(precioNuevo);
  const precioAnteriorNormalizado = normalizarPrecioComparable_(precioAnterior);
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(30000);

  try {
    const contexto = obtenerContextoInventario_();
    const ultimaFila = contexto.hoja.getLastRow();
    if (ultimaFila <= INVENTARIO_HEADER_ROW) {
      throw new Error("La pestaña Productos no contiene registros.");
    }

    const rangoCodigos = contexto.hoja.getRange(
      INVENTARIO_HEADER_ROW + 1,
      contexto.columnas.codigo + 1,
      ultimaFila - INVENTARIO_HEADER_ROW,
      1
    );
    const codigos = rangoCodigos.getDisplayValues();
    const coincidencias = [];

    for (let i = 0; i < codigos.length; i++) {
      if (normalizarCodigo_(codigos[i][0]) === codigoSeguro) {
        coincidencias.push(INVENTARIO_HEADER_ROW + 1 + i);
      }
    }

    if (coincidencias.length === 0) {
      throw new Error("No se encontró el producto con código " + codigoSeguro + ".");
    }
    if (coincidencias.length > 1) {
      throw new Error("El código " + codigoSeguro + " está duplicado. No se modificó ninguna fila.");
    }

    const fila = coincidencias[0];
    const celdaPrecio = contexto.hoja.getRange(fila, contexto.columnas.precio + 1);
    const precioActual = String(celdaPrecio.getDisplayValue() || "").trim();

    if (normalizarPrecioComparable_(precioActual) !== precioAnteriorNormalizado) {
      throw new Error(
        "El precio cambió desde que se abrió el administrador. Recarga la lista antes de guardar."
      );
    }

    celdaPrecio.setValue(precioNormalizado === "" ? "" : Number(precioNormalizado));
    SpreadsheetApp.flush();

    const precioGuardado = String(celdaPrecio.getDisplayValue() || "").trim();
    if (normalizarPrecioComparable_(precioGuardado) !== precioNormalizado) {
      throw new Error("Google Sheets no confirmó el precio esperado.");
    }

    return {
      ok: true,
      codigo: codigoSeguro,
      precioAnterior: precioActual,
      precioGuardado: precioGuardado,
      actualizadoEn: new Date().toISOString()
    };
  } finally {
    bloqueo.releaseLock();
  }
}

function obtenerContextoInventario_() {
  const libro = SpreadsheetApp.openById(INVENTARIO_SPREADSHEET_ID);
  const hoja = libro.getSheetByName(INVENTARIO_SHEET_NAME);
  if (!hoja) {
    throw new Error("No existe la pestaña Productos en el inventario oficial.");
  }

  const ultimaColumna = Math.max(1, hoja.getLastColumn());
  const encabezados = hoja
    .getRange(INVENTARIO_HEADER_ROW, 1, 1, ultimaColumna)
    .getDisplayValues()[0];

  return {
    hoja: hoja,
    ultimaColumna: ultimaColumna,
    columnas: {
      codigo: buscarEncabezadoUnico_(encabezados, "Código"),
      nombre: buscarEncabezadoUnico_(encabezados, "Nombre"),
      precio: buscarEncabezadoUnico_(encabezados, "Precio")
    }
  };
}

function buscarEncabezadoUnico_(encabezados, nombre) {
  const esperado = normalizarEncabezado_(nombre);
  const coincidencias = [];

  encabezados.forEach(function(encabezado, indice) {
    if (normalizarEncabezado_(encabezado) === esperado) {
      coincidencias.push(indice);
    }
  });

  if (coincidencias.length !== 1) {
    throw new Error(
      "El encabezado " + nombre + " debe existir exactamente una vez en la fila de encabezados."
    );
  }
  return coincidencias[0];
}

function normalizarEncabezado_(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizarCodigo_(valor) {
  const texto = String(valor == null ? "" : valor).trim();
  if (!/^\d{1,4}$/.test(texto)) return texto;
  return texto.padStart(4, "0");
}

function normalizarPrecioEntrada_(valor) {
  const texto = String(valor == null ? "" : valor).trim();
  if (!texto) return "";

  if (!/^(?:\d+|\d{1,3}(?:[.\s]\d{3})+)$/.test(texto)) {
    throw new Error(
      "El precio debe ser un número entero, puede usar puntos o espacios de miles, o quedar vacío."
    );
  }

  const digitos = texto.replace(/[.\s]/g, "");
  const numero = Number(digitos);
  if (!Number.isSafeInteger(numero) || numero < 0) {
    throw new Error("El precio indicado no es válido.");
  }
  return String(numero);
}

function normalizarPrecioComparable_(valor) {
  const texto = String(valor == null ? "" : valor).trim();
  if (!texto) return "";
  const digitos = texto.replace(/[^\d]/g, "");
  return digitos ? String(Number(digitos)) : "";
}
