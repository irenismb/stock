// Reglas de visibilidad persistentes; la hoja anterior se importa una sola vez.
const VISIBILIDAD_PROPERTY_KEY = "CATALOGO_VISIBILIDAD_REGLAS_V1";
function validarReglasVisibilidad_(reglas) {
  if(!Array.isArray(reglas)||!reglas.length) throw new Error("Reglas de visibilidad no disponibles.");
  const llaves={};
  return reglas.map(function(r){
    if(!r||typeof r!=="object"||typeof r.oculto!=="boolean") throw new Error("Regla de visibilidad inválida.");
    const tipo=normalizarTipoVisibilidad_(r.tipo);
    const identificador=normalizarIdentificadorVisibilidadPorTipo_(tipo,r.identificador);
    if(VISIBILIDAD_TIPOS.indexOf(tipo)<0||!identificador||(tipo==="producto"&&!/^\d{4}$/.test(identificador)))throw new Error("Identificador de visibilidad inválido.");
    const clave=tipo+"::"+identificador;
    if(Object.prototype.hasOwnProperty.call(llaves,clave))throw new Error("Reglas de visibilidad duplicadas.");
    llaves[clave]=true;
    return {tipo:tipo,identificador:identificador,oculto:r.oculto,etiqueta:String(r.etiqueta||"").slice(0,250)};
  });
}
function guardarReglasVisibilidad_(props,reglas){
  const normalizadas=validarReglasVisibilidad_(reglas);
  const data=JSON.stringify({version:1,reglas:normalizadas});
  if(encodeURIComponent(data).length>8500)throw new Error("Las reglas exceden la capacidad de una propiedad.");
  props.setProperty(VISIBILIDAD_PROPERTY_KEY,data);
  if(props.getProperty(VISIBILIDAD_PROPERTY_KEY)!==data)throw new Error("No se confirmó la persistencia de la visibilidad.");
  return normalizadas;
}
function cargarReglasVisibilidad_(props){
  const data=props.getProperty(VISIBILIDAD_PROPERTY_KEY);
  if(!data)return null;
  let parsed;
  try{parsed=JSON.parse(data);}catch(_){throw new Error("No se pueden interpretar las reglas de visibilidad.");}
  if(!parsed||parsed.version!==1)throw new Error("Versión de visibilidad desconocida.");
  return validarReglasVisibilidad_(parsed.reglas);
}
function importarVisibilidadDesdeHoja_(props){
  const ctx=obtenerContextoVisibilidad_(false);
  if(!ctx||ctx.hoja.getLastRow()<2)throw new Error("No hay reglas de visibilidad iniciales; no se publica el catálogo.");
  const rows=ctx.hoja.getRange(2,1,ctx.hoja.getLastRow()-1,ctx.ultimaColumna).getDisplayValues();
  const rules=rows.filter(r=>r.some(x=>String(x||"").trim())).map(function(r){
    const tipo=normalizarTipoVisibilidad_(r[ctx.columnas.tipo]);
    const id=normalizarIdentificadorVisibilidadPorTipo_(tipo,r[ctx.columnas.identificador]);
    const estado=normalizarEncabezado_(r[ctx.columnas.oculto]);
    if(["","no","false","0","visible","x","si","true","1","oculto"].indexOf(estado)<0)throw new Error("Regla anterior inválida.");
    return {tipo:tipo,identificador:id,oculto:normalizarEstadoOculto_(estado),etiqueta:String(r[ctx.columnas.etiqueta]||"").trim()};
  });
  return guardarReglasVisibilidad_(props,rules);
}
function obtenerVisibilidadWeb(){
  const props=PropertiesService.getScriptProperties();
  let reglas=cargarReglasVisibilidad_(props);
  if(!reglas){
    const lock=LockService.getScriptLock();lock.waitLock(30000);
    try{reglas=cargarReglasVisibilidad_(props)||importarVisibilidadDesdeHoja_(props);}finally{lock.releaseLock();}
  }
  return {ok:true,reglas:reglas,actualizadoEn:new Date().toISOString()};
}
function actualizarVisibilidadWeb(tipo,identificador,ocultoNuevo,etiqueta){
  const t=normalizarTipoVisibilidad_(tipo),id=normalizarIdentificadorVisibilidadPorTipo_(t,identificador);
  if(VISIBILIDAD_TIPOS.indexOf(t)<0||!id||(t==="producto"&&!/^\d{4}$/.test(id)))throw new Error("Tipo o identificador de visibilidad inválido.");
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const props=PropertiesService.getScriptProperties();
    const reglas=cargarReglasVisibilidad_(props)||importarVisibilidadDesdeHoja_(props);
    const coinciden=reglas.filter(r=>r.tipo===t&&r.identificador===id);
    const siguientes=reglas.filter(r=>r.tipo!==t||r.identificador!==id);
    siguientes.push({tipo:t,identificador:id,oculto:Boolean(ocultoNuevo),etiqueta:String(etiqueta==null?"":etiqueta).trim().slice(0,250)});
    guardarReglasVisibilidad_(props,siguientes);
    return {ok:true,tipo:t,identificador:id,etiqueta:String(etiqueta==null?"":etiqueta).trim().slice(0,250),oculto:Boolean(ocultoNuevo),filasActualizadas:coinciden.length||1,actualizadoEn:new Date().toISOString()};
  }finally{lock.releaseLock();}
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
