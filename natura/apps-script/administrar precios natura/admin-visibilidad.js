// Lectura y actualización de reglas de visibilidad del catálogo.

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