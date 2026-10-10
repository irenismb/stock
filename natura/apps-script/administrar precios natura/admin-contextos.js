// Resolución de hojas, encabezados y normalización compartida.
function catalogHeaderKey(value){return normalizarEncabezado_(value);}
// Contrato compacto: datos etiquetados y títulos de ficha, sin columnas posicionales.
const CATALOG_COMPACT_ALIASES = {"Código":["Código interno del producto"],"Nombre":["Nombre comercial del producto"],"Nombre completo":["Nombre completo para publicar"],"Sección":["Sección del catálogo"],"Categoría":["Categoría del producto"],"Subcategoría":["Subcategoría del producto"],"Línea":["Línea comercial"],"Característica":["Característica distintiva"],"Público":["Público destinatario"],"Presentación":["Tipo de presentación"],"Condición":["Condición del producto"],"Estado comercial":["Estado comercial del producto"],"Precio":["Precio de venta"],"Código Natura":["Código de catálogo Natura"],"Referencia externa":["Enlace de referencia del producto"],"Descripción":["Descripción sensorial y uso recomendado"],"Beneficios":["Beneficios y funciones del producto"],"Variante":["Variante del producto"],"Contenido":["Cantidad de contenido"],"Unidad":["Unidad de medida del contenido"],"Costo":["Costo de adquisición"]};
function catalogFieldKey(label){
  const key=catalogHeaderKey(String(label||"").replace(/:\s*$/,""));
  for(const [canonical,aliases] of Object.entries(CATALOG_COMPACT_ALIASES)){
    if([canonical,...aliases].some(alias=>catalogHeaderKey(alias)===key))return catalogHeaderKey(canonical);
  }
  return key;
}
function catalogPrivateField(label){
  return /^(?:costo|coste|numero de serie|serial|mac|direccion mac|p\/n|numero de parte|ubicacion interna|proveedor|margen|rentabilidad|precio de compra)(?:\b|$)/.test(catalogFieldKey(label));
}
function catalogDescriptionRecord(text){
  const fields=[],byKey=new Map(),duplicates=new Set();let current=null;
  for(const line of String(text||"").split(/\r?\n/)){
    const match=/^([^:\n]+):[ \t]*(.*)$/.exec(line);
    if(match){
      const key=catalogFieldKey(match[1]);
      current={key,label:match[1].trim(),value:match[2].trim()};
      fields.push(current);
      if(byKey.has(key))duplicates.add(key);else byKey.set(key,current);
    }else if(current&&line.trim())current.value+="\n"+line.trim();
  }
  return {fields,byKey,duplicates};
}
function catalogCompactNumber(text){
  let value=String(text||"").trim();
  if(!value)return {value:null,valid:true};
  value=value.replace(/^(?:COP\s*|\$\s*)/i,"").replace(/\s/g,"");
  if(/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(value))value=value.replace(/\./g,"").replace(",",".");
  else if(/^\d+(?:,\d+)?$/.test(value))value=value.replace(",",".");
  if(!/^\d+(?:\.\d+)?$/.test(value))return {value:null,valid:false};
  const number=Number(value);return {value:Number.isFinite(number)?number:null,valid:Number.isFinite(number)&&number>=0};
}
function catalogOrderedFields(record,selection){
  const seen=new Set(),fields=[];
  for(const title of String(selection||"").split(/[\n;|,]+/)){
    const label=title.trim().replace(/:\s*$/,""),key=catalogFieldKey(label);
    if(!label||seen.has(key))continue;seen.add(key);
    const field=record.byKey.get(key);
    if(field&&!record.duplicates.has(key)&&!catalogPrivateField(key)&&field.value)
      fields.push({key,label,value:field.value});
  }
  return fields;
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

  if(encabezados.some(h=>normalizarEncabezado_(h)==="descripcion integral del producto")){
    return {hoja:hoja,ultimaColumna:ultimaColumna,compacto:true,columnas:{
      descripcion:buscarEncabezadoUnico_(encabezados,"Descripción integral del producto"),
      ficha:buscarEncabezadoUnico_(encabezados,"Campos y orden de la ficha")
    }};
  }
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

  // Pestaña heredada: no recrearla bajo ninguna circunstancia.
  if(!hoja)return null;

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
