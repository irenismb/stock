// Lectura y actualización segura de precios del inventario oficial.

function actualizarPrecioCompacto_(contexto,codigo,precioNuevo,precioAnterior){
  const hoja=contexto.hoja,count=hoja.getLastRow()-INVENTARIO_HEADER_ROW;
  if(count<=0)throw new Error("Productos no contiene registros.");
  const values=hoja.getRange(INVENTARIO_HEADER_ROW+1,contexto.columnas.descripcion+1,count,1).getDisplayValues();
  const matches=[];
  values.forEach((row,index)=>{
    const record=catalogDescriptionRecord(row[0]);
    const identity=record.byKey.get("codigo");
    if(identity&&normalizarCodigo_(identity.value)===codigo)matches.push({row:INVENTARIO_HEADER_ROW+1+index,record:record,text:String(row[0])});
  });
  if(matches.length!==1)throw new Error(matches.length?"Código duplicado. No se modificó ninguna fila.":"No se encontró el producto.");
  const match=matches[0];
  if(match.record.duplicates.has("codigo")||match.record.duplicates.has("precio"))throw new Error("Código o precio ambiguo en la descripción. No se modificó ninguna fila.");
  const actual=match.record.byKey.get("precio")?.value||"",number=catalogCompactNumber(actual);
  if(!number.valid)throw new Error("El precio actual no es válido. Corrige la descripción antes de guardar.");
  if((number.value===null?"":String(number.value))!==precioAnterior)throw new Error("El precio cambió desde que se abrió el administrador. Recarga la lista antes de guardar.");
  const cell=hoja.getRange(match.row,contexto.columnas.descripcion+1);
  if(cell.getFormula())throw new Error("La descripción es una fórmula. No se sobrescribió.");
  if(String(cell.getValue())!==match.text)throw new Error("La descripción cambió. Recarga antes de guardar.");
  let replaced=false;
  let next=match.text.replace(/^([^:\r\n]+):([ \t]*)([^\r\n]*)/gm,(line,label,space)=>{
    if(catalogFieldKey(label)!=="precio")return line;
    replaced=true;return label+":"+space+precioNuevo;
  });
  if(!replaced&&precioNuevo!=="")next+=(/\r?\n$/.test(next)?"":next.includes("\r\n")?"\r\n":"\n")+"Precio de venta: "+precioNuevo;
  if(next!==match.text){cell.setValue(next);SpreadsheetApp.flush();}
  if(String(cell.getValue())!==next)throw new Error("Google Sheets no confirmó la descripción esperada.");
  return {ok:true,codigo:codigo,precioAnterior:actual,precioGuardado:precioNuevo,actualizadoEn:new Date().toISOString()};
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
      if(contexto.compacto){
        const record=catalogDescriptionRecord(fila[contexto.columnas.descripcion]);
        const get=label=>record.byKey.get(catalogFieldKey(label))?.value||"";
        if(["codigo","nombre","precio"].some(key=>record.duplicates.has(key)))return {codigo:"",nombre:"",precio:""};
        return {codigo:normalizarCodigo_(get("Código")),nombre:get("Nombre")||get("Nombre completo"),precio:get("Precio")};
      }
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
    if(contexto.compacto)return actualizarPrecioCompacto_(contexto,codigoSeguro,precioNormalizado,precioAnteriorNormalizado);
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
