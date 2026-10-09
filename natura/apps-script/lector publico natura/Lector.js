// Implementación inmutable, pública y de SOLO LECTURA del catálogo.
// No contiene el panel administrativo ni métodos de actualización.
// Comparte PropertiesService con la implementación administrativa mediante el mismo scriptId.
const INVENTARIO_SPREADSHEET_ID = '1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs';
const VISIBILIDAD_PROPERTY_KEY = 'CATALOGO_VISIBILIDAD_REGLAS_V1';
const CONFIG_MIGRATION_MARKER = 'CATALOGO_CONFIG_MIGRADA_V1';
const CONFIG_PUBLISHED_VALUES = 'CATALOGO_CONFIG_PUBLIC_SNAPSHOT_V1';
const CONFIG_PUBLISHED_REVISION = 'CATALOGO_CONFIG_PUBLIC_REVISION_V1';
const CONFIG_PROPERTY_PREFIX = 'CATALOGO_CONFIG_';
const CONFIG_PUBLIC_KEYS = ['REGISTRAR_VISITAS_PROPIAS','MOSTRAR_CANTIDAD_STOCK','MOSTRAR_PRECIOS_PRODUCTO','ORDEN_NAVEGACION','ORDEN_PRODUCTOS'];
const VISIBILIDAD_TIPOS = ['producto','seccion','categoria','subcategoria','publico','linea','familia'];

function doGet(evento) {
  const p = evento && evento.parameter || {};
  const modo = String(p.modo || '').trim().toLowerCase();
  let payload;
  try {
    if (modo === 'visibilidad') payload = leerVisibilidadPublica_();
    else if (modo === 'config') payload = leerConfiguracionPublica_();
    else if (modo === 'productos') payload = leerProductosPublicos_();
    else payload = {ok:false,error:'Modo público inexistente.'};
  } catch (e) {
    payload = {ok:false,error:'El control público no está disponible.'};
  }
  const callback = String(p.callback || '').trim();
  const json = JSON.stringify(payload);
  if (callback && !/^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(callback)) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Callback no válido.'})).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(callback ? callback+'('+json+');' : json)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
function normalizar_(valor) {
  return String(valor == null ? '' : valor).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
}
// Lista explícita: ningún encabezado nuevo se publica automáticamente.
const PRODUCTOS_PUBLIC_HEADERS = ['Código','Nombre','Precio','Stock','Sección','Categoría','Subcategoría','Marca','Línea','Tipo de producto','Variante','Característica','Público','Presentación','Contenido','Unidad','Cantidad de unidades','Modelo','Código Natura','Clase de componente','Nombre del componente 1','Cantidad de unidades del componente 1','Contenido del componente 1','Unidad del componente 1','Nombre del componente 2','Cantidad de unidades del componente 2','Contenido del componente 2','Unidad del componente 2','Nombre del componente 3','Cantidad de unidades del componente 3','Contenido del componente 3','Unidad del componente 3','Nombre del componente 4','Cantidad de unidades del componente 4','Contenido del componente 4','Unidad del componente 4','Condición','Estado comercial','Marketplace','Descripción','Necesidades de asesoría','Modo de uso','Adecuado para'];
function productoOcultoPublico_(producto,ocultas) {
  const sec=normalizar_(producto['Sección']),cat=normalizar_(producto['Categoría']),sub=normalizar_(producto['Subcategoría']),pub=normalizar_(producto['Público']),line=normalizar_(producto['Línea']);
  const codigo=String(producto['Código']||'').trim().padStart(4,'0');
  const regla=(tipo,id)=>Boolean(id)&&ocultas.has(tipo+'::'+id);
  return regla('producto',codigo)||regla('seccion',sec)||
    regla('categoria',cat?[sec,cat].join('|'):'')||regla('categoria',sec)||regla('categoria',cat)||
    regla('subcategoria',sub?[sec,cat,sub].join('|'):'')||regla('subcategoria',sec&&cat?[sec,cat].join('|'):'')||
    regla('publico',pub?[sec,cat,sub,pub].join('|'):'')||regla('linea',line?[sec,cat,sub,pub,line].join('|'):'')||
    regla('familia',cat&&sub&&line?[cat,sub,line].join('|'):'');
}
function tablaProductosPublicos_(encabezados,datos,reglas) {
  const indices=new Map();
  encabezados.forEach((header,index)=>{const key=normalizar_(header);if(indices.has(key))throw new Error('Encabezado duplicado');indices.set(key,index);});
  ['Código','Nombre','Categoría','Precio','Sección','Estado comercial'].forEach(header=>{if(!indices.has(normalizar_(header)))throw new Error('Encabezado obligatorio ausente');});
  const columnas=PRODUCTOS_PUBLIC_HEADERS.filter(header=>indices.has(normalizar_(header)));
  const ocultas=new Set(confirmarReglas_(reglas).filter(regla=>regla.oculto).map(regla=>regla.tipo+'::'+regla.identificador));
  const rows=[];
  for(const datosFila of datos){
    const producto={};columnas.forEach(header=>{producto[header]=datosFila[indices.get(normalizar_(header))];});
    if(!String(producto['Código']||'').trim()||normalizar_(producto['Estado comercial'])==='no a la venta'||normalizar_(producto['Categoría'])==='medicamentos'||productoOcultoPublico_(producto,ocultas))continue;
    rows.push({c:columnas.map(header=>{let value=producto[header];if(header==='Código')value=String(value||'').trim().padStart(4,'0');if(value instanceof Date)value=value.toISOString();return {v:value===''||value==null?null:value,f:value===''||value==null?'':String(value)};})});
  }
  return {cols:columnas.map(label=>({label:label})),rows:rows};
}
function leerProductosPublicos_() {
  const visibilidad=leerVisibilidadPublica_();
  const hoja=SpreadsheetApp.openById(INVENTARIO_SPREADSHEET_ID).getSheetByName('Productos');
  if(!hoja||hoja.getLastRow()<2)throw new Error('Catálogo sin productos');
  const values=hoja.getRange(1,1,hoja.getLastRow(),hoja.getLastColumn()).getValues();
  const tabla=tablaProductosPublicos_(values[0],values.slice(1),visibilidad.reglas);
  return {ok:true,status:'ok',table:tabla,actualizadoEn:new Date().toISOString()};
}
function confirmarReglas_(raw) {
  if (!Array.isArray(raw) || !raw.length) throw new Error('Visibilidad vacía');
  const claves = new Set();
  return raw.map(function(regla) {
    if (!regla || typeof regla.oculto !== 'boolean') throw new Error('Regla inválida');
    const tipo = normalizar_(regla.tipo).replace(/\s+/g,'');
    let identificador = normalizar_(regla.identificador).slice(0,500);
    if (tipo==='producto' && /^\d{1,4}$/.test(identificador)) identificador=identificador.padStart(4,'0');
    if (!VISIBILIDAD_TIPOS.includes(tipo) || !identificador || (tipo==='producto'&&!/^\d{4}$/.test(identificador))) throw new Error('Identificador inválido');
    const clave=tipo+'::'+identificador;
    if (claves.has(clave)) throw new Error('Duplicado');
    claves.add(clave);
    return {tipo:tipo,identificador:identificador,oculto:regla.oculto,etiqueta:String(regla.etiqueta||'').slice(0,250)};
  });
}
function leerVisibilidadPublica_() {
  const p = PropertiesService.getScriptProperties();
  let raw=p.getProperty(VISIBILIDAD_PROPERTY_KEY);
  if(!raw){
    const lock=LockService.getScriptLock();lock.waitLock(30000);
    try {raw=p.getProperty(VISIBILIDAD_PROPERTY_KEY);if(!raw)raw=importarVisibilidadPublica_(p);} finally {lock.releaseLock();}
  }
  const obj=JSON.parse(raw);
  if(!obj || obj.version!==1) throw new Error('Versión desconocida');
  return {ok:true,reglas:confirmarReglas_(obj.reglas),actualizadoEn:new Date().toISOString()};
}
function importarVisibilidadPublica_(p) {
  const sh=SpreadsheetApp.openById(INVENTARIO_SPREADSHEET_ID).getSheetByName('Visibilidad');
  if(!sh||sh.getLastRow()<2)throw new Error('Sin visibilidad inicial');
  const data=sh.getRange(1,1,sh.getLastRow(),5).getDisplayValues();
  if(data[0].join('|')!=='Tipo|Identificador|Oculto|Etiqueta|Actualizado')throw new Error('Encabezados de visibilidad incorrectos');
  const reglas=data.slice(1).filter(r=>r.some(x=>String(x||'').trim())).map(r=>{
    const estado=normalizar_(r[2]);
    if(!['','no','false','0','visible','x','si','true','1','oculto'].includes(estado))throw new Error('Estado incorrecto');
    return {tipo:r[0],identificador:r[1],oculto:['x','si','true','1','oculto'].includes(estado),etiqueta:r[3]};
  });
  const normalizadas=confirmarReglas_(reglas);
  const value=JSON.stringify({version:1,reglas:normalizadas});
  if(encodeURIComponent(value).length>8500)throw new Error('Capacidad insuficiente');
  p.setProperty(VISIBILIDAD_PROPERTY_KEY,value);
  if(p.getProperty(VISIBILIDAD_PROPERTY_KEY)!==value)throw new Error('No persistió visibilidad');
  return value;
}
function confirmarConfiguracion_(valores,revision) {
  if(!Array.isArray(valores) || valores.length!==5 || !revision || !Number.isFinite(Date.parse(revision)))throw new Error('Configuración incompleta');
  for(let i=0;i<3;i++)if(!['ACTIVADO','DESACTIVADO'].includes(valores[i]))throw new Error('Configuración de booleanos inválida');
  if(!/^!?section,!?category,!?subcategory,!?public,!?line,!?product$/.test(valores[3]) && !validarOrdenPublico_(valores[3]))throw new Error('Orden de navegación inválido');
  if(!['price_asc','price_desc','name_asc','name_desc'].includes(valores[4]))throw new Error('Orden de productos inválido');
  const result={};CONFIG_PUBLIC_KEYS.forEach((key,i)=>{result[key]=valores[i]});return result;
}
function validarOrdenPublico_(orden) {
  const parts=String(orden||'').split(',');
  const found=new Set();
  if(parts.length!==6)return false;
  for(const part of parts){const key=part.replace(/^!/,'');if(!['section','category','subcategory','public','line','product'].includes(key)||found.has(key))return false;found.add(key)}
  return found.size===6;
}
function leerConfiguracionPublica_() {
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty(CONFIG_MIGRATION_MARKER)!=='ok'){
    const lock=LockService.getScriptLock();lock.waitLock(30000);
    try{if(p.getProperty(CONFIG_MIGRATION_MARKER)!=='ok')importarConfiguracionPublica_(p);}finally{lock.releaseLock();}
  }
  const snapshot=p.getProperty(CONFIG_PUBLISHED_VALUES),revision=p.getProperty(CONFIG_PUBLISHED_REVISION);
  if(!snapshot)throw new Error('Configuración no publicada');
  return {ok:true,valores:confirmarConfiguracion_(JSON.parse(snapshot),revision),publicadoEn:revision,actualizadoEn:new Date().toISOString()};
}
function importarConfiguracionPublica_(p) {
  const sh=SpreadsheetApp.openById(INVENTARIO_SPREADSHEET_ID).getSheetByName('configuracion_publica');
  if(!sh||sh.getLastRow()<6)throw new Error('Sin configuración inicial');
  const rows=sh.getRange(1,1,6,3).getDisplayValues();
  if(rows[0].join('|')!=='Clave|Valor|Actualizado')throw new Error('Encabezado de configuración incorrecto');
  const map={},dates=new Set();
  for(const r of rows.slice(1)){
    if(!CONFIG_PUBLIC_KEYS.includes(r[0])||Object.prototype.hasOwnProperty.call(map,r[0]))throw new Error('Configuración duplicada');
    map[r[0]]=r[1];dates.add(r[2]);
  }
  if(dates.size!==1)throw new Error('Revision de configuración contradictoria');
  const revision=[...dates][0],values=CONFIG_PUBLIC_KEYS.map(k=>map[k]);
  confirmarConfiguracion_(values,revision);
  const props={};CONFIG_PUBLIC_KEYS.forEach((key,i)=>{props[CONFIG_PROPERTY_PREFIX+key]=values[i]});
  props[CONFIG_PUBLISHED_VALUES]=JSON.stringify(values);
  props[CONFIG_PUBLISHED_REVISION]=revision;
  props[CONFIG_MIGRATION_MARKER]='ok';
  p.setProperties(props,false);
  if(p.getProperty(CONFIG_PUBLISHED_VALUES)!==props[CONFIG_PUBLISHED_VALUES])throw new Error('No persistió configuración');
}

