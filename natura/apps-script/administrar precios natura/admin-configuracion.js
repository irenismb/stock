// Configuración pública y administrativa persistida del catálogo.

function obtenerConfiguracionWeb() {
  const publicada = asegurarConfiguracionPublica_();
  return {ok:true, valores:publicada.valores, publicadoEn:publicada.publicadoEn, actualizadoEn:new Date().toISOString()};
}
function obtenerConfiguracionPublicaWeb() {
  const publicada = asegurarConfiguracionPublica_();
  const valores = {};
  CONFIG_PUBLIC_KEYS.forEach(function(clave) { valores[clave] = publicada.valores[clave]; });
  return {ok:true, valores:valores, publicadoEn:publicada.publicadoEn, actualizadoEn:new Date().toISOString()};
}
function actualizarConfiguracionWeb(clave, activado) {
  const claveSegura = String(clave == null ? "" : clave).trim().toUpperCase();
  if (claveSegura === "ORDEN_PRODUCTOS") return actualizarOrdenProductosWeb(activado);
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
    migrarConfiguracionPublicaDesdeHoja_();
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
      publicadoEn: publicarConfiguracionPublica_(valores),
      actualizadoEn: new Date().toISOString()
    };
  } finally {
    bloqueo.releaseLock();
  }
}
function leerValoresConfiguracion_() {
  const propiedades = PropertiesService.getScriptProperties();
  const valores = {};
  const guardadas = propiedades.getProperties();
  CONFIG_KEYS.forEach(function(clave) {
    const guardado = normalizarEstadoConfiguracion_(
      guardadas[CONFIG_PROPERTY_PREFIX + clave]
    );
    valores[clave] = guardado || CONFIG_DEFAULTS[clave];
  });
  valores.ORDEN_PRODUCTOS = normalizarOrdenProductos_(guardadas[CONFIG_PROPERTY_PREFIX + "ORDEN_PRODUCTOS"]) || "price_asc";
  valores[NAVIGATION_ORDER_KEY] = normalizarOrdenNavegacion_(
    guardadas[CONFIG_PROPERTY_PREFIX + NAVIGATION_ORDER_KEY]
  ) || NAVIGATION_ORDER_DEFAULT;
  return valores;
}
function actualizarOrdenNavegacionWeb(orden) {
  const ordenSeguro = normalizarOrdenNavegacion_(orden);
  if (!ordenSeguro) {
    throw new Error("El orden de navegación no es válido.");
  }

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(30000);
  try {
    migrarConfiguracionPublicaDesdeHoja_();
    const propiedades = PropertiesService.getScriptProperties();
    const nombrePropiedad = CONFIG_PROPERTY_PREFIX + NAVIGATION_ORDER_KEY;
    propiedades.setProperty(nombrePropiedad, ordenSeguro);

    const guardado = normalizarOrdenNavegacion_(propiedades.getProperty(nombrePropiedad));
    if (guardado !== ordenSeguro) {
      throw new Error("Apps Script no confirmó el orden de navegación esperado.");
    }

    const valores = leerValoresConfiguracion_();
    return {
      ok: true,
      clave: NAVIGATION_ORDER_KEY,
      orden: valores[NAVIGATION_ORDER_KEY],
      valores: valores,
      publicadoEn: publicarConfiguracionPublica_(valores),
      actualizadoEn: new Date().toISOString()
    };
  } finally {
    bloqueo.releaseLock();
  }
}
function normalizarOrdenNavegacion_(valor) {
  const niveles = ["section", "category", "subcategory", "public", "line", "product"];
  const alias = {
    section: "section", seccion: "section",
    category: "category", categoria: "category",
    subcategory: "subcategory", subcategoria: "subcategory",
    public: "public", publico: "public",
    line: "line", linea: "line",
    product: "product", producto: "product"
  };
  const partes = Array.isArray(valor)
    ? valor
    : String(valor == null ? "" : valor).split(",");
  const vistos = new Set();
  const normalizado = [];
  let tieneEstadoExplicito = false;

  partes.forEach(function(item) {
    let texto = String(item == null ? "" : item).trim();
    let activo = true;
    if (texto.charAt(0) === "!") {
      tieneEstadoExplicito = true;
      activo = false;
      texto = texto.slice(1).trim();
    }
    const clave = normalizarEncabezado_(texto).replace(/\s+/g, "");
    const nivel = alias[clave] || "";
    if (!nivel || vistos.has(nivel)) return;
    vistos.add(nivel);
    normalizado.push((activo ? "" : "!") + nivel);
  });

  const nivelesLeidos = normalizado.map(function(item) { return item.replace(/^!/, ""); });
  const esFormatoAnterior = !tieneEstadoExplicito
    && nivelesLeidos.length === 4
    && nivelesLeidos.indexOf("section") === -1
    && nivelesLeidos.indexOf("product") === -1
    && ["category", "subcategory", "public", "line"].every(function(item) {
      return nivelesLeidos.indexOf(item) !== -1;
    });
  if (esFormatoAnterior) {
    return ["section"].concat(nivelesLeidos, ["product"]).join(",");
  }

  if (!normalizado.length) return "";
  niveles.forEach(function(nivel) {
    if (!vistos.has(nivel)) normalizado.push("!" + nivel);
  });
  return normalizado.join(",");
}
function reflejarConfiguracionEnHojaOpcional_(clave, estadoTexto) {
  if (CONFIG_ADMIN_KEYS.indexOf(clave) !== -1) return false;
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

function normalizarOrdenProductos_(valor) {
  const orden = String(valor || "").trim();
  return ["price_asc", "price_desc", "name_asc", "name_desc"].indexOf(orden) !== -1 ? orden : "";
}
function actualizarOrdenProductosWeb(orden) {
  const seguro = normalizarOrdenProductos_(orden);
  if (!seguro) throw new Error("El orden de productos no es válido.");
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(30000);
  try {
    migrarConfiguracionPublicaDesdeHoja_();
    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty(CONFIG_PROPERTY_PREFIX + "ORDEN_PRODUCTOS", seguro);
    if (propiedades.getProperty(CONFIG_PROPERTY_PREFIX + "ORDEN_PRODUCTOS") !== seguro) throw new Error("No se pudo confirmar el orden.");
    return {ok:true, clave:"ORDEN_PRODUCTOS", estado:seguro, valores:leerValoresConfiguracion_(), publicadoEn:publicarConfiguracionPublica_(leerValoresConfiguracion_())};
  } finally { bloqueo.releaseLock(); }
}


// Solo estos cinco ajustes se publican; los filtros administrativos quedan en Propiedades.
// Todas las escrituras se ejecutan bajo el mismo bloqueo que protege los ajustes.
// Configuración pública persistida en Propiedades. Importar una sola vez.
const CONFIG_MIGRATION_MARKER = "CATALOGO_CONFIG_MIGRADA_V1";
const CONFIG_PUBLISHED_VALUES = "CATALOGO_CONFIG_PUBLIC_SNAPSHOT_V1";
const CONFIG_PUBLISHED_REVISION = "CATALOGO_CONFIG_PUBLIC_REVISION_V1";
function migrarConfiguracionPublicaDesdeHoja_(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty(CONFIG_MIGRATION_MARKER)==="ok")return;
  const sh=SpreadsheetApp.openById(INVENTARIO_SPREADSHEET_ID).getSheetByName("configuracion_publica");
  if(!sh||sh.getLastRow()<6)throw new Error("No hay configuración pública inicial.");
  const rows=sh.getRange(1,1,6,3).getDisplayValues();
  if(rows[0].join("|")!=="Clave|Valor|Actualizado")throw new Error("Encabezados de configuración inesperados.");
  const values={},dates=new Set();
  for(const row of rows.slice(1)){
    if(CONFIG_PUBLIC_KEYS.indexOf(row[0])<0||Object.prototype.hasOwnProperty.call(values,row[0]))throw new Error("Clave pública duplicada.");
    values[row[0]]=String(row[1]);dates.add(String(row[2]));
  }
  if(Object.keys(values).length!==5||dates.size!==1)throw new Error("Configuración pública incompleta.");
  const rev=[...dates][0];
  if(!rev||!Number.isFinite(Date.parse(rev))||CONFIG_BOOLEAN_PUBLIC_KEYS.some(k=>!normalizarEstadoConfiguracion_(values[k]))
      ||!normalizarOrdenNavegacion_(values.ORDEN_NAVEGACION)||!normalizarOrdenProductos_(values.ORDEN_PRODUCTOS))throw new Error("Configuración pública inicial inválida.");
  const migrated={};
  CONFIG_PUBLIC_KEYS.forEach(k=>{migrated[CONFIG_PROPERTY_PREFIX+k]=values[k]});
  migrated[CONFIG_PUBLISHED_VALUES]=JSON.stringify(CONFIG_PUBLIC_KEYS.map(k=>values[k]));
  migrated[CONFIG_PUBLISHED_REVISION]=rev;
  migrated[CONFIG_MIGRATION_MARKER]="ok";
  props.setProperties(migrated,false);
  if(props.getProperty(CONFIG_PUBLISHED_VALUES)!==migrated[CONFIG_PUBLISHED_VALUES])throw new Error("No se confirmó la importación pública.");
}
function asegurarConfiguracionPublica_(){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{migrarConfiguracionPublicaDesdeHoja_();const valores=leerValoresConfiguracion_();return {valores:valores,publicadoEn:publicarConfiguracionPublica_(valores)};}
  finally{lock.releaseLock();}
}
function publicarConfiguracionPublica_(valores){
  const props=PropertiesService.getScriptProperties();
  const content=JSON.stringify(CONFIG_PUBLIC_KEYS.map(k=>String(valores[k])));
  const prev=props.getProperty(CONFIG_PUBLISHED_VALUES),rev=props.getProperty(CONFIG_PUBLISHED_REVISION);
  if(prev===content&&rev&&Number.isFinite(Date.parse(rev)))return rev;
  const next=new Date(Math.max(Date.now(),(Date.parse(rev)||0)+1)).toISOString();
  props.setProperties({[CONFIG_PUBLISHED_VALUES]:content,[CONFIG_PUBLISHED_REVISION]:next},false);
  if(props.getProperty(CONFIG_PUBLISHED_VALUES)!==content||props.getProperty(CONFIG_PUBLISHED_REVISION)!==next)throw new Error("La configuración pública no quedó guardada.");
  return next;
}
