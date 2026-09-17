// Edición segura de precios dentro de las tarjetas del catálogo.
(() => {
  const boton = document.getElementById("priceAdminBtn");
  const grid = document.getElementById("grid");
  if (!boton || !grid) return;

  const parametros = new URL(window.location.href).searchParams;
  const modoAdministrador = parametros.get("administrar") === "precios";
  const endpoint = String(window.PRECIOS_ADMIN_CONFIG?.endpoint || "").trim();
  const endpointValido = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint);
  if (!modoAdministrador || !endpointValido) return;

  const estilos = document.createElement("style");
  estilos.textContent = `
    .price-admin-editor{display:grid;grid-template-columns:minmax(90px,1fr) auto;align-items:center;gap:7px;flex:1 1 220px;min-width:0}
    .price-admin-input{width:100%;min-width:0;height:40px;padding:8px 10px;border:1px solid #d8c9c6;border-radius:10px;background:#fff;color:#352b2c;font:750 15px/1 Arial,sans-serif;text-align:right}
    .price-admin-save{min-width:86px;height:40px;padding:8px 13px;border-radius:10px;font-weight:850}
    .price-admin-status{grid-column:1/-1;min-height:17px;color:#78696b;font-size:11.5px;font-weight:750;text-align:left}
    .price-admin-status:empty{display:none}
    .price-admin-status.is-ok{color:#176b3a}
    .price-admin-status.is-error{color:#a02323}
    .card .row.price-admin-active{align-items:flex-start;flex-wrap:wrap;gap:8px}
    .card .row.price-admin-active>[data-role="qty"]{margin-left:auto}
    #priceAdminBtn[aria-pressed="true"]{color:#8d5360!important;border-color:#cfa8b0!important;background:#f5e5e8!important}
    @media(max-width:520px){.price-admin-editor{flex-basis:100%}.price-admin-input{font-size:16px}}
  `;
  document.head.appendChild(estilos);

  let editando = false;
  let conectando = false;
  let ventanaPuente = null;
  let puerto = null;
  let canalPendiente = "";
  let activarAlConectar = false;
  let secuencia = 0;
  const solicitudes = new Map();

  boton.hidden = false;
  boton.setAttribute("aria-pressed", "false");
  boton.addEventListener("click", alternarEdicion);

  const observador = new MutationObserver(() => window.requestAnimationFrame(sincronizarInterfaz));
  observador.observe(grid, {childList:true, subtree:true});
  window.addEventListener("message", recibirConexion);
  window.addEventListener("beforeunload", cerrarConexion);
  sincronizarInterfaz();

  function hayTarjetasDeProductos(){
    return !grid.classList.contains("album-grid-mode") &&
      Boolean(grid.querySelector(":scope > .card:not(.album-card)"));
  }

  function sincronizarInterfaz(){
    const disponible = hayTarjetasDeProductos();
    if(!disponible && editando) detenerEdicion();
    if(!conectando) boton.disabled = !disponible;
    boton.title = disponible
      ? "Editar los precios de los productos visibles"
      : "Abre una categoría hasta llegar a sus productos";
    if(editando) instalarEditores();
  }

  function alternarEdicion(){
    if(editando){
      detenerEdicion();
      return;
    }
    if(!hayTarjetasDeProductos()) return;
    if(puerto && ventanaPuente && !ventanaPuente.closed){
      iniciarEdicion();
      return;
    }
    conectarConGoogle();
  }

  function conectarConGoogle(){
    if(conectando) return;
    conectando = true;
    activarAlConectar = true;
    boton.disabled = true;
    boton.textContent = "Conectando…";
    canalPendiente = crearCanalSeguro();

    const url = new URL(endpoint);
    url.searchParams.set("modo", "puente");
    url.searchParams.set("canal", canalPendiente);
    ventanaPuente = window.open(
      url.toString(),
      "irenismbPreciosGoogle",
      "popup=yes,width=500,height=300,resizable=yes,scrollbars=yes"
    );

    if(!ventanaPuente){
      conectando = false;
      activarAlConectar = false;
      boton.textContent = "Precios";
      sincronizarInterfaz();
      window.alert("El navegador bloqueó la conexión con Google. Permite ventanas emergentes para este sitio.");
    }
  }

  function crearCanalSeguro(){
    const bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  }

  function esOrigenGoogleConfiable(origen){
    return origen === "https://script.google.com" ||
      /^https:\/\/[a-z0-9.-]*googleusercontent\.com$/i.test(origen);
  }

  function recibirConexion(evento){
    const mensaje = evento && evento.data || {};
    if(mensaje.tipo !== "irenismb-precios-puente-listo") return;
    if(!esOrigenGoogleConfiable(evento.origin)) return;
    if(!canalPendiente || mensaje.canal !== canalPendiente) return;
    if(!evento.ports || !evento.ports[0]) return;

    puerto?.close();
    puerto = evento.ports[0];
    puerto.onmessage = recibirRespuesta;
    puerto.start();
    canalPendiente = "";
    conectando = false;
    boton.textContent = "Precios";

    if(activarAlConectar && hayTarjetasDeProductos()) iniciarEdicion();
    else sincronizarInterfaz();
    activarAlConectar = false;
  }

  function iniciarEdicion(){
    editando = true;
    boton.textContent = "Terminar edición";
    boton.setAttribute("aria-pressed", "true");
    instalarEditores();
  }

  function detenerEdicion(){
    editando = false;
    boton.textContent = "Precios";
    boton.setAttribute("aria-pressed", "false");
    for(const card of grid.querySelectorAll(".card")) retirarEditor(card);
    sincronizarInterfaz();
  }

  function instalarEditores(){
    if(!editando) return;
    for(const card of grid.querySelectorAll(":scope > .card:not(.album-card)")) instalarEditor(card);
  }

  function instalarEditor(card){
    if(card.querySelector(".price-admin-editor")) return;
    const price = card.querySelector(".price");
    const row = card.querySelector(".row");
    const code = String(card.dataset.id || "").trim();
    if(!price || !row || !/^\d{4}$/.test(code)) return;

    const previous = precioComparable(price.textContent);
    const editor = document.createElement("div");
    editor.className = "price-admin-editor";
    editor.dataset.previous = previous;

    const input = document.createElement("input");
    input.className = "price-admin-input";
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.placeholder = "Escribe el precio";
    input.value = formatoEditable(previous);
    input.setAttribute("aria-label", "Precio del producto " + code);

    const save = document.createElement("button");
    save.className = "btn-acc price-admin-save";
    save.type = "button";
    save.textContent = "Guardar";
    save.disabled = true;

    const status = document.createElement("span");
    status.className = "price-admin-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    input.addEventListener("input", () => {
      limpiarEstado(status);
      const parsed = validarPrecio(input.value, false);
      save.disabled = !parsed.valido || parsed.normalizado === editor.dataset.previous;
    });
    input.addEventListener("keydown", event => {
      if(event.key === "Enter" && !save.disabled){
        event.preventDefault();
        guardarPrecio(card, price, editor, input, save, status);
      }else if(event.key === "Escape"){
        input.value = formatoEditable(editor.dataset.previous);
        save.disabled = true;
        limpiarEstado(status);
      }
    });
    save.addEventListener("click", () => guardarPrecio(card, price, editor, input, save, status));

    editor.append(input, save, status);
    price.hidden = true;
    row.classList.add("price-admin-active");
    price.insertAdjacentElement("afterend", editor);
  }

  function retirarEditor(card){
    const price = card.querySelector(".price");
    const row = card.querySelector(".row");
    card.querySelector(".price-admin-editor")?.remove();
    if(price) price.hidden = false;
    row?.classList.remove("price-admin-active");
  }

  async function guardarPrecio(card, price, editor, input, save, status){
    const parsed = validarPrecio(input.value, true);
    if(!parsed.valido){
      mostrarEstado(status, parsed.error, "error");
      input.focus();
      return;
    }
    if(parsed.normalizado === editor.dataset.previous) return;

    input.disabled = true;
    save.disabled = true;
    save.textContent = "Guardando…";
    mostrarEstado(status, "Guardando en Google Sheets…");

    try{
      const result = await solicitarActualizacion({
        codigo:String(card.dataset.id || "").trim(),
        precioNuevo:parsed.normalizado,
        precioAnterior:editor.dataset.previous
      });
      const guardado = precioComparable(result && result.precioGuardado);
      editor.dataset.previous = guardado;
      input.value = formatoEditable(guardado);
      price.textContent = guardado === "" ? "Consultar precio" : formatoCatalogo(guardado);
      mostrarEstado(status, "Precio guardado", "ok");
      window.dispatchEvent(new CustomEvent("irenismb:precio-guardado", {
        detail:{codigo:String(card.dataset.id || "").trim(), precio:guardado}
      }));
      window.setTimeout(() => {
        if(status.textContent === "Precio guardado") limpiarEstado(status);
      }, 1500);
    }catch(error){
      mostrarEstado(status, error && error.message ? error.message : "No se pudo guardar el precio.", "error");
    }finally{
      input.disabled = false;
      save.textContent = "Guardar";
      save.disabled = precioComparable(input.value) === editor.dataset.previous;
    }
  }

  function solicitarActualizacion(datos){
    return new Promise((resolve, reject) => {
      if(!puerto || !ventanaPuente || ventanaPuente.closed){
        reject(new Error("La conexión con Google se cerró. Pulsa Terminar edición y vuelve a activar Precios."));
        return;
      }

      const solicitudId = "precio-" + Date.now() + "-" + (++secuencia);
      const timer = window.setTimeout(() => {
        solicitudes.delete(solicitudId);
        reject(new Error("Google tardó demasiado en responder. Intenta nuevamente."));
      }, 45000);

      solicitudes.set(solicitudId, {resolve, reject, timer});
      puerto.postMessage({tipo:"actualizar-precio", solicitudId, ...datos});
    });
  }

  function recibirRespuesta(evento){
    const mensaje = evento && evento.data || {};
    const pending = solicitudes.get(mensaje.solicitudId);
    if(!pending) return;
    window.clearTimeout(pending.timer);
    solicitudes.delete(mensaje.solicitudId);

    if(mensaje.tipo === "precio-actualizado") pending.resolve(mensaje.resultado || {});
    else pending.reject(new Error(mensaje.error || "No se pudo guardar el precio."));
  }

  function validarPrecio(value, conMensaje){
    const text = String(value == null ? "" : value).trim();
    if(text === "") return {valido:true, normalizado:""};
    if(!/^(?:\d+|\d{1,3}(?:[.\s]\d{3})+)$/.test(text)){
      return {valido:false, normalizado:"", error:conMensaje ? "Escribe un número entero; puedes usar puntos de miles." : ""};
    }
    const normalized = text.replace(/[.\s]/g, "").replace(/^0+(?=\d)/, "");
    const number = Number(normalized);
    if(!Number.isSafeInteger(number) || number <= 0){
      return {valido:false, normalizado:"", error:conMensaje ? "El precio debe ser mayor que cero o quedar vacío." : ""};
    }
    return {valido:true, normalizado:String(number)};
  }

  function precioComparable(value){
    const text = String(value == null ? "" : value).trim();
    if(!text || /^Consultar precio$/i.test(text)) return "";
    const digits = text.replace(/[^\d]/g, "");
    return digits ? String(Number(digits)) : "";
  }

  function formatoEditable(value){
    return value === "" ? "" : new Intl.NumberFormat("es-CO").format(Number(value));
  }

  function formatoCatalogo(value){
    return "$ " + new Intl.NumberFormat("es-CO").format(Number(value));
  }

  function mostrarEstado(element, message, type){
    element.className = "price-admin-status" + (type ? " is-" + type : "");
    element.textContent = message || "";
  }

  function limpiarEstado(element){
    mostrarEstado(element, "");
  }

  function cerrarConexion(){
    try{ puerto?.close(); }catch(_){}
    try{ if(ventanaPuente && !ventanaPuente.closed) ventanaPuente.close(); }catch(_){}
  }
})();
