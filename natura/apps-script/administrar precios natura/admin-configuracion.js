// Configuración pública y persistencia de controles del catálogo.

function obtenerConfiguracionWeb() {
  return {
    ok: true,
    valores: leerValoresConfiguracion_(),
    actualizadoEn: new Date().toISOString()
  };
}
function actualizarConfiguracionWeb(clave, activado) {
  const claveSegura = String(clave == null ? "" : clave).trim().toUpperCase();
  if (CONFIG_KEYS.indexOf(claveSegura) === -1) {
    throw new Error("La clave de configuración no es válida.");
  }

  const estado = normalizarBooleanoConfiguracion_(activado);
  if (estado === null) {
    throw new Error("El estado de configuración no es válido.");
  }

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(30000);
  try {
    const estadoTexto = estado ? "ACTIVADO" : "DESACTIVADO";
    const propiedades = PropertiesService.getScriptProperties();
    const nombrePropiedad = CONFIG_PROPERTY_PREFIX + claveSegura;
    propiedades.setProperty(nombrePropiedad, estadoTexto);

    const guardado = normalizarEstadoConfiguracion_(propiedades.getProperty(nombrePropiedad));
    if (guardado !== estadoTexto) {
      throw new Error("Apps Script no confirmó el estado de configuración esperado.");
    }

    try {
      reflejarConfiguracionEnHojaOpcional_(claveSegura, estadoTexto);
    } catch (error) {
      console.log("No se pudo actualizar el espejo opcional Configuracion: " + error);
    }

    const valores = leerValoresConfiguracion_();
    return {
      ok: true,
      clave: claveSegura,
      estado: valores[claveSegura],
      activado: valores[claveSegura] === "ACTIVADO",
      valores: valores,
      actualizadoEn: new Date().toISOString()
    };
  } finally {
    bloqueo.releaseLock();
  }
}
function leerValoresConfiguracion_() {
  const propiedades = PropertiesService.getScriptProperties();
  const valores = {};
  CONFIG_KEYS.forEach(function(clave) {
    const guardado = normalizarEstadoConfiguracion_(
      propiedades.getProperty(CONFIG_PROPERTY_PREFIX + clave)
    );
    valores[clave] = guardado || CONFIG_DEFAULTS[clave];
  });
  return valores;
}
function reflejarConfiguracionEnHojaOpcional_(clave, estadoTexto) {
  const libro = SpreadsheetApp.openById(INVENTARIO_SPREADSHEET_ID);
  const hoja = libro.getSheetByName(CONFIG_SHEET_NAME);
  if (!hoja) return false;

  const filasALeer = Math.min(Math.max(hoja.getLastRow(), 1), 100);
  const columnasALeer = Math.min(Math.max(hoja.getLastColumn(), 1), 30);
  const valores = hoja.getRange(1, 1, filasALeer, columnasALeer).getDisplayValues();
  const candidatos = [];

  valores.forEach(function(fila, indiceFila) {
    const normalizados = fila.map(normalizarEncabezado_);
    const estados = [];
    const claves = [];
    normalizados.forEach(function(valor, indiceColumna) {
      if (valor === normalizarEncabezado_("Estado")) estados.push(indiceColumna);
      if (valor === normalizarEncabezado_("Clave técnica")) claves.push(indiceColumna);
    });
    if (estados.length === 1 && claves.length === 1) {
      candidatos.push({ fila: indiceFila, estado: estados[0], clave: claves[0] });
    }
  });

  if (candidatos.length !== 1) return false;

  const encabezado = candidatos[0];
  const coincidencias = [];
  for (let indiceFila = encabezado.fila + 1; indiceFila < valores.length; indiceFila++) {
    const claveFila = String(valores[indiceFila][encabezado.clave] || "").trim().toUpperCase();
    if (claveFila === clave) coincidencias.push(indiceFila + 1);
  }
  if (coincidencias.length !== 1) return false;

  hoja.getRange(coincidencias[0], encabezado.estado + 1).setValue(estadoTexto);
  return true;
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