// Almacén persistente de visibilidad (no depende de una hoja después de migrar).
const VISIBILIDAD_PROPERTY_KEY = "CATALOGO_VISIBILIDAD_REGLAS_V1";

function validarReglasVisibilidad_(reglas) {
  if (!Array.isArray(reglas)) throw new Error("Reglas de visibilidad no disponibles.");
  const llaves = {};
  return reglas.map(function(regla) {
    if (!regla || typeof regla !== "object") throw new Error("Regla de visibilidad inválida.");
    const tipo = normalizarTipoVisibilidad_(regla.tipo);
    const identificador = normalizarIdentificadorVisibilidadPorTipo_(tipo, regla.identificador);
    if (VISIBILIDAD_TIPOS.indexOf(tipo) < 0 || !identificador
        || (tipo === "producto" && !/^\d{4}$/.test(identificador))
        || typeof regla.oculto !== "boolean") {
      throw new Error("La regla de visibilidad guardada no es válida.");
    }
    const llave = tipo + "::" + identificador;
    if (Object.prototype.hasOwnProperty.call(llaves, llave)) {
      throw new Error("Existen reglas de visibilidad duplicadas.");
    }
    llaves[llave] = true;
    return {tipo:tipo, identificador:identificador, oculto:regla.oculto,
      etiqueta:String(regla.etiqueta || "").slice(0,250)};
  });
}
function guardarReglasVisibilidad_(propiedades, reglas) {
  const normalizadas = validarReglasVisibilidad_(reglas);
  const payload = JSON.stringify({version:1, reglas:normalizadas});
  if (encodeURIComponent(payload).length > 8500) {
    throw new Error("Las reglas exceden la capacidad de una propiedad de Apps Script. No se modificó ninguna regla.");
  }
  propiedades.setProperty(VISIBILIDAD_PROPERTY_KEY, payload);
  if (propiedades.getProperty(VISIBILIDAD_PROPERTY_KEY) !== payload) {
    throw new Error("No se pudo confirmar la persistencia de las reglas de visibilidad.");
  }
  return normalizadas;
}
function cargarReglasVisibilidad_(propiedades) {
  const texto = propiedades.getProperty(VISIBILIDAD_PROPERTY_KEY);
  if (!texto) return null;
  let guardado;
  try { guardado = JSON.parse(texto); }
  catch (error) { throw new Error("Las reglas de visibilidad guardadas no se pueden interpretar."); }
  if (!guardado || guardado.version !== 1) throw new Error("Versión de visibilidad desconocida.");
  return validarReglasVisibilidad_(guardado.reglas);
}
function importarVisibilidadDesdeHoja_(propiedades) {
  // Importación inicial de una sola vez. Nunca recrear una hoja ausente ni asumir visibilidad completa.
  const contexto = obtenerContextoVisibilidad_(false);
  if (!contexto || contexto.hoja.getLastRow() < 2) {
    throw new Error("No existe una fuente de visibilidad inicial válida. No se publican productos.");
  }
  const filas = contexto.hoja.getRange(2, 1, contexto.hoja.getLastRow() - 1, contexto.ultimaColumna).getDisplayValues();
  const reglas = filas.filter(function(fila) {
    return fila.some(function(x) { return String(x || "").trim(); });
  }).map(function(fila) {
    const tipo = normalizarTipoVisibilidad_(fila[contexto.columnas.tipo]);
    const identificador = normalizarIdentificadorVisibilidadPorTipo_(tipo, fila[contexto.columnas.identificador]);
    const estado = normalizarEncabezado_(fila[contexto.columnas.oculto]);
    if (["", "no", "false", "0", "visible", "x", "si", "true", "1", "oculto"].indexOf(estado) < 0) {
      throw new Error("Existe una regla de visibilidad inicial no interpretable.");
    }
    return {tipo:tipo, identificador:identificador, oculto:normalizarEstadoOculto_(estado),
      etiqueta:String(fila[contexto.columnas.etiqueta] || "").trim()};
  });
  if (!reglas.length) throw new Error("La fuente de visibilidad inicial está vacía.");
  return guardarReglasVisibilidad_(propiedades, reglas);
}
function obtenerReglasVisibilidadConBloqueo_(propiedades) {
  return cargarReglasVisibilidad_(propiedades) || importarVisibilidadDesdeHoja_(propiedades);
}
function obtenerVisibilidadWeb() {
  const propiedades = PropertiesService.getScriptProperties();
  let reglas = cargarReglasVisibilidad_(propiedades);
  if (!reglas) {
    const bloqueo = LockService.getScriptLock();
    bloqueo.waitLock(30000);
    try { reglas = obtenerReglasVisibilidadConBloqueo_(propiedades); }
    finally { bloqueo.releaseLock(); }
  }
  return {ok:true, reglas:reglas, actualizadoEn:new Date().toISOString()};
}
function actualizarVisibilidadWeb(tipo, identificador, ocultoNuevo, etiqueta) {
  const tipoSeguro = normalizarTipoVisibilidad_(tipo);
  const identificadorSeguro = normalizarIdentificadorVisibilidadPorTipo_(tipoSeguro, identificador);
  const etiquetaSegura = String(etiqueta == null ? "" : etiqueta).trim().slice(0,250);
  const ocultoSeguro = Boolean(ocultoNuevo);
  if (VISIBILIDAD_TIPOS.indexOf(tipoSeguro) < 0 || !identificadorSeguro
    || (tipoSeguro === "producto" && !/^\d{4}$/.test(identificadorSeguro))) {
    throw new Error("Tipo o identificador de visibilidad inválido.");
  }
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(30000);
  try {
    const propiedades = PropertiesService.getScriptProperties();
    const reglas = obtenerReglasVisibilidadConBloqueo_(propiedades);
    const existentes = reglas.filter(function(x) { return x.tipo === tipoSeguro && x.identificador === identificadorSeguro; });
    const siguientes = reglas.filter(function(x) { return x.tipo !== tipoSeguro || x.identificador !== identificadorSeguro; });
    siguientes.push({tipo:tipoSeguro, identificador:identificadorSeguro, oculto:ocultoSeguro, etiqueta:etiquetaSegura});
    guardarReglasVisibilidad_(propiedades, siguientes);
    return {ok:true, tipo:tipoSeguro, identificador:identificadorSeguro,
      etiqueta:etiquetaSegura, oculto:ocultoSeguro, filasActualizadas:existentes.length || 1,
      actualizadoEn:new Date().toISOString()};
  } finally { bloqueo.releaseLock(); }
}
function normalizarTipoVisibilidad_(valor) {
  return normalizarEncabezado_(valor).replace(/\s+/g, "");
}
function normalizarIdentificadorVisibilidad_(valor) {
  return normalizarEncabezado_(valor).slice(0,500);
}
function normalizarIdentificadorVisibilidadPorTipo_(tipo, valor) {
  const normalizado = normalizarIdentificadorVisibilidad_(valor);
  return tipo === "producto" && /^\d{1,4}$/.test(normalizado) ? normalizado.padStart(4, "0") : normalizado;
}
function normalizarEstadoOculto_(valor) {
  return ["x", "si", "true", "1", "oculto"].indexOf(normalizarEncabezado_(valor)) !== -1;
}
