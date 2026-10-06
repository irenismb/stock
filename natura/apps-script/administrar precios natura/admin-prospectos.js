// Gestión autenticada de prospectos asociados al catálogo.

const PROSPECTOS_SPREADSHEET_ID = "1C4SA31dGX-6twdyZki68G4sV7j4Gwc21UuZpO0QPtuc";
const PROSPECTOS_SHEET_NAME = "prospectos";
const PROSPECTOS_HEADERS = [
  "id",
  "fecha",
  "perfil_facebook",
  "codigo",
  "producto",
  "estado",
  "nota",
  "ultima_actualizacion"
];
const PROSPECTOS_ESTADOS = ["nuevo", "contactado", "interesado", "venta", "descartado"];
const PROSPECTOS_TZ = "America/Bogota";
const PROSPECTOS_MAX_ROWS_RETURNED = 500;

function obtenerProspectosWeb() {
  const contexto = obtenerContextoProspectos_();
  const hoja = contexto.hoja;
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila <= 1) {
    return { ok: true, prospectos: [], actualizadoEn: new Date().toISOString() };
  }

  const total = ultimaFila - 1;
  const startRow = Math.max(2, ultimaFila - PROSPECTOS_MAX_ROWS_RETURNED + 1);
  const numRows = ultimaFila - startRow + 1;
  const valores = hoja.getRange(startRow, 1, numRows, contexto.ultimaColumna).getDisplayValues();
  const prospectos = valores.map(function(fila) {
    return registroProspectoDesdeFila_(fila, contexto.columnas);
  }).filter(function(item) {
    return item.id && item.perfil_facebook;
  }).reverse();

  return {
    ok: true,
    prospectos: prospectos,
    total: total,
    truncado: total > prospectos.length,
    actualizadoEn: new Date().toISOString()
  };
}

function registrarProspectoWeb(perfilFacebook, codigo, estado, nota) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const perfil = normalizarPerfilFacebook_(perfilFacebook);
    const codigoSeguro = String(codigo == null ? "" : codigo).trim();
    const estadoSeguro = normalizarEstadoProspecto_(estado || "nuevo");
    const notaSegura = textoSeguroProspecto_(nota, 800);
    const producto = codigoSeguro ? resolverProductoProspecto_(codigoSeguro) : { codigo: "", nombre: "" };
    const contexto = obtenerContextoProspectos_();
    const hoja = contexto.hoja;

    const existente = buscarProspectoDuplicado_(contexto, perfil, producto.codigo);
    if (existente) {
      return {
        ok: true,
        duplicate: true,
        prospecto: existente,
        message: "El perfil ya estaba asociado a este producto."
      };
    }

    const ahora = new Date();
    const fecha = Utilities.formatDate(ahora, PROSPECTOS_TZ, "yyyy-MM-dd");
    const id = "p_" + Utilities.getUuid().replace(/-/g, "").slice(0, 18);
    const rowIndex = Math.max(2, hoja.getLastRow() + 1);
    if (rowIndex > hoja.getMaxRows()) {
      hoja.insertRowsAfter(hoja.getMaxRows(), rowIndex - hoja.getMaxRows());
    }
    const fila = new Array(contexto.ultimaColumna).fill("");
    fila[contexto.columnas.id] = id;
    fila[contexto.columnas.fecha] = fecha;
    fila[contexto.columnas.perfil_facebook] = perfil;
    fila[contexto.columnas.codigo] = producto.codigo ? Number(producto.codigo) : "";
    fila[contexto.columnas.producto] = producto.nombre;
    fila[contexto.columnas.estado] = estadoSeguro;
    fila[contexto.columnas.nota] = notaSegura;
    fila[contexto.columnas.ultima_actualizacion] = fecha;

    hoja.getRange(rowIndex, contexto.columnas.codigo + 1).setNumberFormat("0000");
    hoja.getRange(rowIndex, 1, 1, contexto.ultimaColumna).setValues([fila]);
    hoja.getRange(rowIndex, contexto.columnas.perfil_facebook + 1).setRichTextValue(
      SpreadsheetApp.newRichTextValue().setText(perfil).setLinkUrl(perfil).build()
    );
    SpreadsheetApp.flush();

    const guardado = registroProspectoDesdeFila_(
      hoja.getRange(rowIndex, 1, 1, contexto.ultimaColumna).getDisplayValues()[0],
      contexto.columnas
    );
    return { ok: true, duplicate: false, prospecto: guardado };
  } finally {
    lock.releaseLock();
  }
}

function actualizarProspectoWeb(id, estado, nota) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const idSeguro = String(id == null ? "" : id).trim();
    if (!/^p_[a-f0-9]{18}$/i.test(idSeguro)) {
      throw new Error("El identificador del prospecto no es válido.");
    }
    const estadoSeguro = normalizarEstadoProspecto_(estado);
    const notaSegura = textoSeguroProspecto_(nota, 800);
    const contexto = obtenerContextoProspectos_();
    const hoja = contexto.hoja;
    const ultimaFila = hoja.getLastRow();
    if (ultimaFila <= 1) throw new Error("No se encontró el prospecto.");

    const ids = hoja.getRange(2, contexto.columnas.id + 1, ultimaFila - 1, 1).getDisplayValues().flat();
    const coincidencias = [];
    ids.forEach(function(value, index) {
      if (String(value || "").trim() === idSeguro) coincidencias.push(index + 2);
    });
    if (coincidencias.length !== 1) {
      throw new Error("El prospecto debe tener una coincidencia única.");
    }

    const fila = coincidencias[0];
    const fecha = Utilities.formatDate(new Date(), PROSPECTOS_TZ, "yyyy-MM-dd");
    hoja.getRange(fila, contexto.columnas.estado + 1).setValue(estadoSeguro);
    hoja.getRange(fila, contexto.columnas.nota + 1).setValue(notaSegura);
    hoja.getRange(fila, contexto.columnas.ultima_actualizacion + 1).setValue(fecha);
    SpreadsheetApp.flush();

    const actualizado = registroProspectoDesdeFila_(
      hoja.getRange(fila, 1, 1, contexto.ultimaColumna).getDisplayValues()[0],
      contexto.columnas
    );
    return { ok: true, prospecto: actualizado };
  } finally {
    lock.releaseLock();
  }
}

function obtenerContextoProspectos_() {
  const libro = SpreadsheetApp.openById(PROSPECTOS_SPREADSHEET_ID);
  const hoja = libro.getSheetByName(PROSPECTOS_SHEET_NAME);
  if (!hoja) throw new Error("No existe la pestaña prospectos del registro web.");

  const ultimaColumna = Math.max(PROSPECTOS_HEADERS.length, hoja.getLastColumn());
  const encabezados = hoja.getRange(1, 1, 1, ultimaColumna).getDisplayValues()[0];
  const columnas = {};
  PROSPECTOS_HEADERS.forEach(function(header) {
    columnas[header] = buscarEncabezadoUnico_(encabezados, header);
  });

  return { hoja: hoja, ultimaColumna: ultimaColumna, columnas: columnas };
}

function resolverProductoProspecto_(codigo) {
  const codigoNormalizado = normalizarCodigo_(codigo);
  if (!/^\d{4}$/.test(codigoNormalizado)) {
    throw new Error("El código del producto debe contener cuatro dígitos.");
  }
  const contexto = obtenerContextoInventario_();
  const hoja = contexto.hoja;
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila <= INVENTARIO_HEADER_ROW) {
    throw new Error("El inventario no contiene productos.");
  }

  const valores = hoja
    .getRange(INVENTARIO_HEADER_ROW + 1, 1, ultimaFila - INVENTARIO_HEADER_ROW, contexto.ultimaColumna)
    .getDisplayValues();
  const coincidencias = valores.filter(function(fila) {
    return normalizarCodigo_(fila[contexto.columnas.codigo]) === codigoNormalizado;
  });
  if (coincidencias.length !== 1) {
    throw new Error("El código debe tener una coincidencia única en el inventario.");
  }
  const nombre = String(coincidencias[0][contexto.columnas.nombre] || "").trim();
  if (!nombre) throw new Error("El producto no tiene Nombre confirmado en el inventario.");
  return { codigo: codigoNormalizado, nombre: nombre };
}

function buscarProspectoDuplicado_(contexto, perfil, codigo) {
  const hoja = contexto.hoja;
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila <= 1) return null;
  const valores = hoja.getRange(2, 1, ultimaFila - 1, contexto.ultimaColumna).getDisplayValues();
  for (let i = 0; i < valores.length; i++) {
    const item = registroProspectoDesdeFila_(valores[i], contexto.columnas);
    if (!item.id) continue;
    let perfilExistente = "";
    try {
      perfilExistente = normalizarPerfilFacebook_(item.perfil_facebook);
    } catch (_) {
      perfilExistente = String(item.perfil_facebook || "").trim();
    }
    if (perfilExistente === perfil && String(item.codigo || "") === String(codigo || "")) {
      return item;
    }
  }
  return null;
}

function registroProspectoDesdeFila_(fila, columnas) {
  return {
    id: String(fila[columnas.id] || "").trim(),
    fecha: String(fila[columnas.fecha] || "").trim(),
    perfil_facebook: String(fila[columnas.perfil_facebook] || "").trim(),
    codigo: normalizarCodigo_(fila[columnas.codigo]),
    producto: String(fila[columnas.producto] || "").trim(),
    estado: String(fila[columnas.estado] || "").trim(),
    nota: String(fila[columnas.nota] || "").trim().replace(/^'/, ""),
    ultima_actualizacion: String(fila[columnas.ultima_actualizacion] || "").trim()
  };
}

function normalizarEstadoProspecto_(estado) {
  const seguro = normalizarEncabezado_(estado);
  if (PROSPECTOS_ESTADOS.indexOf(seguro) === -1) {
    throw new Error("Estado de prospecto no válido.");
  }
  return seguro;
}

function normalizarPerfilFacebook_(valor) {
  let raw = String(valor == null ? "" : valor).trim();
  if (!raw) throw new Error("Pega el enlace del perfil de Facebook.");
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw.replace(/^\/+/, "");

  const match = raw.match(/^https?:\/\/([^\/?#]+)(\/[^?#]*)?(\?[^#]*)?/i);
  if (!match) throw new Error("El enlace de Facebook no es válido.");
  let host = String(match[1] || "").toLowerCase().replace(/\.$/, "");
  if (host.startsWith("www.")) host = host.slice(4);
  const permitido = host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com";
  if (!permitido) throw new Error("El enlace debe pertenecer a Facebook.");

  let path = String(match[2] || "/").replace(/\/+/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  const lowerPath = path.toLowerCase();
  const bloqueados = ["/groups", "/marketplace", "/watch", "/events", "/reel", "/reels", "/stories", "/photo", "/photos", "/share"];
  if (bloqueados.some(function(prefix) { return lowerPath === prefix || lowerPath.indexOf(prefix + "/") === 0; })) {
    throw new Error("Usa el enlace directo al perfil de Facebook, no a una publicación, grupo o Marketplace.");
  }

  if (lowerPath === "/profile.php") {
    const query = String(match[3] || "");
    const idMatch = query.match(/[?&]id=(\d+)(?:&|$)/i);
    if (!idMatch) throw new Error("El enlace profile.php debe incluir el id del perfil.");
    return "https://www.facebook.com/profile.php?id=" + idMatch[1];
  }
  if (path === "/" || path.length < 2) {
    throw new Error("Pega el enlace directo al perfil de Facebook.");
  }
  const people = path.match(/^\/people\/[^/]+\/(\d+)$/i);
  if (people) return "https://www.facebook.com/profile.php?id=" + people[1];
  if (!/^\/[A-Za-z0-9._-]+$/.test(path) || ["/login", "/login.php", "/help", "/search", "/photo.php", "/story.php", "/permalink.php", "/dialog", "/sharer.php"].indexOf(lowerPath) !== -1) {
    throw new Error("Usa el enlace directo al perfil de Facebook, no a una publicación u otra página.");
  }
  return "https://www.facebook.com" + lowerPath;
}

function textoSeguroProspecto_(valor, maximo) {
  let texto = String(valor == null ? "" : valor).trim();
  if (texto.length > maximo) texto = texto.slice(0, maximo);
  if (/^[=+\-@]/.test(texto)) texto = "'" + texto;
  return texto;
}
