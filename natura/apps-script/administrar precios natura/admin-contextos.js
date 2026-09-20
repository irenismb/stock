// Resolución de hojas, encabezados y normalización compartida.

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
function obtenerContextoVisibilidad_(crearSiFalta) {
  const libro = SpreadsheetApp.openById(INVENTARIO_SPREADSHEET_ID);
  let hoja = libro.getSheetByName(VISIBILIDAD_SHEET_NAME);

  if (!hoja && !crearSiFalta) return null;
  if (!hoja) {
    hoja = libro.insertSheet(VISIBILIDAD_SHEET_NAME);
    hoja.getRange(1, 1, 1, VISIBILIDAD_HEADERS.length).setValues([VISIBILIDAD_HEADERS]);
    SpreadsheetApp.flush();
  }

  const ultimaColumna = Math.max(VISIBILIDAD_HEADERS.length, hoja.getLastColumn());
  const encabezados = hoja.getRange(1, 1, 1, ultimaColumna).getDisplayValues()[0];

  return {
    hoja: hoja,
    ultimaColumna: ultimaColumna,
    columnas: {
      tipo: buscarEncabezadoUnico_(encabezados, "Tipo"),
      identificador: buscarEncabezadoUnico_(encabezados, "Identificador"),
      oculto: buscarEncabezadoUnico_(encabezados, "Oculto"),
      etiqueta: buscarEncabezadoUnico_(encabezados, "Etiqueta"),
      actualizado: buscarEncabezadoUnico_(encabezados, "Actualizado")
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