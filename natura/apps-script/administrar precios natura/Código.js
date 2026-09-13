const INVENTARIO_SPREADSHEET_ID = "1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs";
const INVENTARIO_SHEET_NAME = "Productos";
const INVENTARIO_HEADER_ROW = 1;
const VISIBILIDAD_SHEET_NAME = "Visibilidad";
const VISIBILIDAD_HEADERS = ["Tipo", "Identificador", "Oculto", "Etiqueta", "Actualizado"];
const VISIBILIDAD_TIPOS = ["producto", "seccion", "categoria", "subcategoria", "familia"];

const CONFIG_LEGACY_SHEET_NAME = "Configuracion";
const CONFIG_KEYS = [
  "REGISTRAR_VISITAS_PROPIAS",
  "MOSTRAR_CANTIDAD_STOCK",
  "MOSTRAR_PRECIOS_PRODUCTO"
];
const CONFIG_DEFAULTS = {
  REGISTRAR_VISITAS_PROPIAS: "DESACTIVADO",
  MOSTRAR_CANTIDAD_STOCK: "DESACTIVADO",
  MOSTRAR_PRECIOS_PRODUCTO: "ACTIVADO"
};
const CONFIG_MIGRATION_FLAG = "CONFIGURACION_MIGRADA_DESDE_SHEET_V1";
const CONFIG_UPDATED_AT_KEY = "CONFIGURACION_ACTUALIZADA_EN";

function doGet(evento) {
  const parametros = evento && evento.parameter ? evento.parameter : {};
  const modo = String(parametros.modo || "").trim().toLowerCase();

  if (modo === "config") {
    return responderConfiguracionPublica_(parametros.callback);
  }

  const archivo = modo === "puente" ? "Puente" : "Admin";
  return HtmlService
    .createHtmlOutputFromFile(archivo)
    .setTitle("Administrar catálogo · Irenismb Stock Natura");
}

function responderConfiguracionPublica_(callback) {
  let payload;
  try {
    payload = obtenerConfiguracionWeb();
  } catch (error) {
    payload = {
      ok: false,
      error: error && error.message ? error.message : String(error || "No se pudo leer la configuración.")
    };
  }

  const callbackSeguro = String(callback || "").trim();
  const json = JSON.stringify(payload);
  if (callbackSeguro) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(callbackSeguro)) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: "Callback no válido." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService
      .createTextOutput(callbackSeguro + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function obtenerConfiguracionWeb() {
  asegurarConfiguracionMigrada_();
  const propiedades = PropertiesService.getScriptProperties();
  const valores = {};

  CONFIG_KEYS.forEach(function(clave) {
    const guardado = normalizarEstadoConfiguracion_(propiedades.getProperty(clave));
    valores[clave] = guardado || CONFIG_DEFAULTS[clave];
  });

  return {
    ok: true,
    valores: valores,
    actualizadoEn: propiedades.getProperty(CONFIG_UPDATED_AT_KEY) || ""
  };
}

function actualizarConfiguracionWeb(clave, activado) {
  asegurarConfiguracionMigrada_();
  const claveSegura = String(clave == null ? "" : clave).trim().toUpperCase();
  if (CONFIG_KEYS.indexOf(claveSegura) === -1) {
    throw new Error("La clave de configuración no es válida.");
  }

  const estado = normalizarBooleanoConfiguracion_(activado);
  if (estado === null) {
    throw new Error("El estado de configuración no es válido.");
  }

  const propiedades = PropertiesService.getScriptProperties();
  const ahora = new Date().toISOString();
  propiedades.setProperty(claveSegura, estado ? "ACTIVADO" : "DESACTIVADO");
  propiedades.setProperty(CONFIG_UPDATED_AT_KEY, ahora);

  const resultado = obtenerConfiguracionWeb();
  return {
    ok: true,
    clave: claveSegura,
    estado: resultado.valores[claveSegura],
    activado: resultado.valores[claveSegura] === "ACTIVADO",
    valores: resultado.valores,
    actualizadoEn: ahora
  };
}

function asegurarConfiguracionMigrada_() {
  const propiedades = PropertiesService.getScriptProperties();
  if (propiedades.getProperty(CONFIG_MIGRATION_FLAG) === "1") {
    completarConfiguracionFaltante_(propiedades, {});
    return;
  }

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(30000);
  try {
    if (propiedades.getProperty(CONFIG_MIGRATION_FLAG) === "1") {
      completarConfiguracionFaltante_(propiedades, {});
      return;
    }

    const heredados = leerConfiguracionLegacy_();
    completarConfiguracionFaltante_(propiedades, heredados);
    propiedades.setProperty(CONFIG_MIGRATION_FLAG, "1");
    propiedades.setProperty(CONFIG_UPDATED_AT_KEY, new Date().toISOString());
  } finally {
    bloqueo.releaseLock();
  }
}

function completarConfiguracionFaltante_(propiedades, heredados) {
  CONFIG_KEYS.forEach(function(clave) {
    const actual = normalizarEstadoConfiguracion_(propiedades.getProperty(clave));
    if (actual) {
      if (actual !== propiedades.getProperty(clave)) propiedades.setProperty(clave, actual);
      return;
    }

    const heredado = normalizarEstadoConfiguracion_(heredados && heredados[clave]);
    propiedades.setProperty(clave, heredado || CONFIG_DEFAULTS[clave]);
  });
}

function leerConfiguracionLegacy_() {
  const resultado = {};
  try {
    const libro = SpreadsheetApp.openById(INVENTARIO_SPREADSHEET_ID);
    const hoja = libro.getSheetByName(CONFIG_LEGACY_SHEET_NAME);
    if (!hoja || hoja.getLastRow() < 1 || hoja.getLastColumn() < 1) return resultado;

    const filasALeer = Math.min(Math.max(hoja.getLastRow(), 1), 30);
    const columnasALeer = Math.min(Math.max(hoja.getLastColumn(), 1), 20);
    const valores = hoja.getRange(1, 1, filasALeer, columnasALeer).getDisplayValues();
    let filaEncabezado = -1;
    let indiceEstado = -1;
    let indiceClave = -1;

    for (let fila = 0; fila < valores.length; fila++) {
      const normalizados = valores[fila].map(normalizarEncabezado_);
      const estados = [];
      const claves = [];
      normalizados.forEach(function(valor, indice) {
        if (valor === normalizarEncabezado_("Estado")) estados.push(indice);
        if (valor === normalizarEncabezado_("Clave técnica")) claves.push(indice);
      });
      if (estados.length === 1 && claves.length === 1) {
        filaEncabezado = fila;
        indiceEstado = estados[0];
        indiceClave = claves[0];
        break;
      }
    }

    if (filaEncabezado < 0) return resultado;

    for (let fila = filaEncabezado + 1; fila < valores.length; fila++) {
      const clave = String(valores[fila][indiceClave] || "").trim().toUpperCase();
      if (CONFIG_KEYS.indexOf(clave) === -1) continue;
      const estado = normalizarEstadoConfiguracion_(valores[fila][indiceEstado]);
      if (estado) resultado[clave] = estado;
    }
  } catch (_) {
    return resultado;
  }
  return resultado;
}

function normalizarEstadoConfiguracion_(valor) {
  const normalizado = normalizarEncabezado_(valor);
  if (["activado", "activo", "true", "verdadero", "si", "1", "on"].indexOf(normalizado) !== -1) {
    return "ACTIVADO";
  }
  if (["desactivado", "inactivo", "false", "falso", "no", "0", "off"].indexOf(normalizado) !== -1) {
    return "DESACTIVADO";
  }
  return "";
}

function normalizarBooleanoConfiguracion_(valor) {
  if (valor === true) return true;
  if (valor === false) return false;
  const estado = normalizarEstadoConfiguracion_(valor);
  if (estado === "ACTIVADO") return true;
  if (estado === "DESACTIVADO") return false;
  return null;
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

function obtenerVisibilidadWeb() {
  const contexto = obtenerContextoVisibilidad_(false);
  if (!contexto) {
    return { reglas: [], actualizadoEn: new Date().toISOString() };
  }

  const ultimaFila = contexto.hoja.getLastRow();
  if (ultimaFila <= 1) {
    return { reglas: [], actualizadoEn: new Date().toISOString() };
  }

  const valores = contexto.hoja
    .getRange(2, 1, ultimaFila - 1, contexto.ultimaColumna)
    .getDisplayValues();

  const reglas = valores
    .map(function(fila) {
      const tipo = normalizarTipoVisibilidad_(fila[contexto.columnas.tipo]);
      return {
        tipo: tipo,
        identificador: normalizarIdentificadorVisibilidadPorTipo_(tipo, fila[contexto.columnas.identificador]),
        oculto: normalizarEstadoOculto_(fila[contexto.columnas.oculto]),
        etiqueta: String(fila[contexto.columnas.etiqueta] || "").trim()
      };
    })
    .filter(function(regla) {
      return regla.tipo && regla.identificador;
    });

  return { reglas: reglas, actualizadoEn: new Date().toISOString() };
}

function actualizarVisibilidadWeb(tipo, identificador, ocultoNuevo, etiqueta) {
  const tipoSeguro = normalizarTipoVisibilidad_(tipo);
  const identificadorSeguro = normalizarIdentificadorVisibilidadPorTipo_(tipoSeguro, identificador);
  const etiquetaSegura = String(etiqueta == null ? "" : etiqueta).trim().slice(0, 250);
  const ocultoSeguro = Boolean(ocultoNuevo);

  if (VISIBILIDAD_TIPOS.indexOf(tipoSeguro) === -1) {
    throw new Error("El tipo de regla de visibilidad no es válido.");
  }
  if (!identificadorSeguro) {
    throw new Error("La regla de visibilidad necesita un identificador.");
  }
  if (tipoSeguro === "producto" && !/^\d{4}$/.test(identificadorSeguro)) {
    throw new Error("El identificador de producto debe contener exactamente cuatro dígitos.");
  }

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(30000);

  try {
    const contexto = obtenerContextoVisibilidad_(true);
    const ultimaFila = contexto.hoja.getLastRow();
    const coincidencias = [];

    if (ultimaFila > 1) {
      const valores = contexto.hoja
        .getRange(2, 1, ultimaFila - 1, contexto.ultimaColumna)
        .getDisplayValues();

      valores.forEach(function(fila, indice) {
        const tipoFila = normalizarTipoVisibilidad_(fila[contexto.columnas.tipo]);
        const idFila = normalizarIdentificadorVisibilidadPorTipo_(tipoFila, fila[contexto.columnas.identificador]);
        if (tipoFila === tipoSeguro && idFila === identificadorSeguro) {
          coincidencias.push(indice + 2);
        }
      });
    }

    const filasDestino = coincidencias.length
      ? coincidencias
      : [contexto.hoja.getLastRow() + 1];
    const ahora = new Date();

    filasDestino.forEach(function(filaDestino) {
      contexto.hoja.getRange(filaDestino, contexto.columnas.tipo + 1).setValue(tipoSeguro);
      const celdaIdentificador = contexto.hoja.getRange(filaDestino, contexto.columnas.identificador + 1);
      if (tipoSeguro === "producto") celdaIdentificador.setNumberFormat("@");
      celdaIdentificador.setValue(identificadorSeguro);
      contexto.hoja.getRange(filaDestino, contexto.columnas.oculto + 1).setValue(ocultoSeguro ? "X" : "");
      contexto.hoja.getRange(filaDestino, contexto.columnas.etiqueta + 1).setValue(etiquetaSegura);
      contexto.hoja.getRange(filaDestino, contexto.columnas.actualizado + 1).setValue(ahora);
    });
    SpreadsheetApp.flush();

    filasDestino.forEach(function(filaDestino) {
      const ocultoGuardado = normalizarEstadoOculto_(
        contexto.hoja.getRange(filaDestino, contexto.columnas.oculto + 1).getDisplayValue()
      );
      if (ocultoGuardado !== ocultoSeguro) {
        throw new Error("Google Sheets no confirmó la visibilidad esperada.");
      }
    });

    return {
      ok: true,
      tipo: tipoSeguro,
      identificador: identificadorSeguro,
      etiqueta: etiquetaSegura,
      oculto: ocultoSeguro,
      filasActualizadas: filasDestino.length,
      actualizadoEn: ahora.toISOString()
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

function normalizarTipoVisibilidad_(valor) {
  return normalizarEncabezado_(valor).replace(/\s+/g, "");
}

function normalizarIdentificadorVisibilidad_(valor) {
  return normalizarEncabezado_(valor).slice(0, 500);
}

function normalizarIdentificadorVisibilidadPorTipo_(tipo, valor) {
  const normalizado = normalizarIdentificadorVisibilidad_(valor);
  if (tipo === "producto" && /^\d{1,4}$/.test(normalizado)) {
    return normalizado.padStart(4, "0");
  }
  return normalizado;
}

function normalizarEstadoOculto_(valor) {
  const normalizado = normalizarEncabezado_(valor);
  return ["x", "si", "true", "1", "oculto"].indexOf(normalizado) !== -1;
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
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new Error("El precio debe ser un entero mayor que cero o quedar vacío.");
  }
  return String(numero);
}

function normalizarPrecioComparable_(valor) {
  const texto = String(valor == null ? "" : valor).trim();
  if (!texto) return "";
  const digitos = texto.replace(/[^\d]/g, "");
  return digitos ? String(Number(digitos)) : "";
}
