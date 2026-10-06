// Prospectos de Facebook: mini CRM disponible únicamente en modo administrador.
(() => {
  const grid = document.getElementById("grid");
  if (!grid) return;

  const STATES = ["nuevo","contactado","interesado","venta","descartado"];
  const STATE_LABELS = {
    nuevo:"Nuevo",
    contactado:"Contactado",
    interesado:"Interesado",
    venta:"Venta",
    descartado:"Descartado"
  };
  let records = [];
  let loading = false;
  let loaded = false;
  let activeProductCode = "";
  let observer = null;
  let dialog = null;
  let page = null;
  let loadPromise = null;
  let session = 0;

  injectStyles();
  observer = new MutationObserver(() => scheduleSync());
  observer.observe(grid, {childList:true, subtree:true});
  observer.observe(document.body, {attributes:true, attributeFilter:["class"]});

  window.addEventListener("irenismb:admin-mode-change", event => {
    if (event.detail?.active) {
      scheduleSync();
      loadProspects().catch(() => {});
    } else {
      removeCardButtons();
    }
  });
  window.addEventListener("irenismb:admin-bridge-ready", () => {
    if (window.CATALOG_ADMIN_MODE_ACTIVE) loadProspects(true).catch(() => {});
  });
  window.addEventListener("irenismb:admin-section-change", event => {
    syncSection(event.detail?.section || window.CATALOG_ADMIN_SECTION || "catalogo");
  });

  window.ensureCatalogProspectosAdmin = ensurePage;
  window.syncCatalogProspectosAdmin = syncSection;
  window.destroyCatalogProspectosAdmin = destroy;

  if (window.CATALOG_ADMIN_MODE_ACTIVE) {
    scheduleSync();
    loadProspects().catch(() => {});
  }

  function hasCapability(){
    const caps = window.CATALOG_ADMIN_CAPABILITIES;
    return caps instanceof Set ? caps.has("prospectos") : false;
  }

  function request(payload){
    if (typeof window.CATALOG_ADMIN_REQUEST !== "function") {
      return Promise.reject(new Error("La conexión administrativa no está disponible."));
    }
    return window.CATALOG_ADMIN_REQUEST(payload);
  }

  let syncQueued = false;
  function scheduleSync(){
    if(syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      if(!window.CATALOG_ADMIN_MODE_ACTIVE){
        removeCardButtons();
        return;
      }
      if((window.CATALOG_ADMIN_SECTION || "catalogo") === "catalogo") installCardButtons();
      else removeCardButtons();
      if((window.CATALOG_ADMIN_SECTION || "") === "prospectos") syncSection("prospectos");
    });
  }

  function injectStyles(){
    if(document.getElementById("catalogProspectsStyles")) return;
    const style = document.createElement("style");
    style.id = "catalogProspectsStyles";
    style.textContent = `
      .catalog-prospect-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;margin:8px 0 2px;padding:8px 12px;border:1px solid #bdd7c8;border-radius:10px;background:#edf8f1;color:#1d6840;font:850 11px Arial;cursor:pointer}
      .catalog-prospect-btn:hover{background:#e2f3e8;border-color:#9fc8af}.catalog-prospect-btn:disabled{opacity:.55;cursor:wait}
      .catalog-prospect-count{display:inline-flex;min-width:20px;height:20px;align-items:center;justify-content:center;padding:0 6px;border-radius:999px;background:#d6ecde;color:#165936;font:900 10px Arial}
      .catalog-prospects-toolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:0 0 14px}
      .catalog-prospects-toolbar input,.catalog-prospects-toolbar select,.catalog-prospect-dialog input,.catalog-prospect-dialog select,.catalog-prospect-dialog textarea,.catalog-prospect-row textarea,.catalog-prospect-row select{box-sizing:border-box;border:1px solid #d9e1dd;border-radius:10px;background:#fff;color:#243831;font:13px/1.35 Arial;padding:9px 10px}
      .catalog-prospects-toolbar input{flex:1 1 250px;min-width:0}.catalog-prospects-toolbar select{min-width:150px}
      .catalog-prospects-status{min-height:20px;margin:0 0 12px;color:#66736f;font:12px/1.4 Arial}.catalog-prospects-status.ok{color:#176b3a}.catalog-prospects-status.err{color:#a02323}
      .catalog-prospects-list{display:grid;gap:10px}.catalog-prospect-row{display:grid;grid-template-columns:minmax(180px,.75fr) minmax(220px,1.2fr) minmax(150px,.65fr) minmax(220px,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid #dfe5e1;border-radius:14px;background:#fff}
      .catalog-prospect-profile{min-width:0}.catalog-prospect-profile a{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#245d9e;font:750 12px Arial;text-decoration:none}.catalog-prospect-profile small,.catalog-prospect-product small{display:block;margin-top:4px;color:#73807c;font:11px Arial}
      .catalog-prospect-product{min-width:0;color:#213b34;font:800 12px/1.35 Arial}.catalog-prospect-row textarea{width:100%;min-height:56px;resize:vertical}
      .catalog-prospect-save{min-height:38px;padding:8px 12px;border:1px solid #6d45b8;border-radius:10px;background:#6d45b8;color:#fff;font:850 11px Arial;cursor:pointer}.catalog-prospect-save:disabled{opacity:.55;cursor:wait}
      .catalog-prospect-empty{padding:22px;border:1px dashed #ccd7d2;border-radius:14px;background:#fbfcfb;color:#6d7975;text-align:center;font:13px Arial}
      .catalog-prospect-dialog{width:min(560px,94vw);border:0;border-radius:18px;padding:0;box-shadow:0 28px 80px #1118;background:#fff;color:#20362f}.catalog-prospect-dialog::backdrop{background:#10171388}
      .catalog-prospect-dialog-form{padding:20px}.catalog-prospect-dialog h3{margin:0 0 5px;font:950 21px/1.2 Arial}.catalog-prospect-dialog-context{margin:0 0 16px;color:#6c7975;font:12px/1.4 Arial}
      .catalog-prospect-dialog label{display:grid;gap:6px;margin:11px 0;color:#314943;font:800 12px Arial}.catalog-prospect-dialog input,.catalog-prospect-dialog select,.catalog-prospect-dialog textarea{width:100%}.catalog-prospect-dialog textarea{min-height:90px;resize:vertical}
      .catalog-prospect-url-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.catalog-prospect-paste{border:1px solid #c9d4cf;border-radius:10px;background:#f6f8f7;color:#334b44;font:800 11px Arial;padding:8px 11px;cursor:pointer}
      .catalog-prospect-dialog-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:16px}.catalog-prospect-dialog-actions button{min-height:40px;padding:9px 14px;border-radius:10px;font:850 12px Arial;cursor:pointer}.catalog-prospect-cancel{border:1px solid #cdd7d3;background:#fff;color:#435852}.catalog-prospect-submit{border:1px solid #6d45b8;background:#6d45b8;color:#fff}
      @media(max-width:1050px){.catalog-prospect-row{grid-template-columns:1fr 1.3fr .7fr}.catalog-prospect-row textarea{grid-column:1/3}.catalog-prospect-save{grid-column:3}}
      @media(max-width:720px){.catalog-prospect-row{grid-template-columns:1fr}.catalog-prospect-row textarea,.catalog-prospect-save{grid-column:auto}.catalog-prospect-url-line{grid-template-columns:1fr}.catalog-prospect-paste{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function installCardButtons(){
    if(!window.CATALOG_ADMIN_MODE_ACTIVE || (window.CATALOG_ADMIN_SECTION || "catalogo") !== "catalogo") return;
    grid.querySelectorAll(":scope > .card:not(.album-card)").forEach(card => {
      const code = normalizeCode(card.dataset.id || "");
      if(!code) return;
      let button = card.querySelector(".catalog-prospect-btn");
      if(!button){
        button = document.createElement("button");
        button.type = "button";
        button.className = "catalog-prospect-btn";
        button.dataset.prospectCode = code;
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          openDialog(code, true);
        });
        const copy = card.querySelector(".catalog-admin-copy-description");
        if(copy) copy.insertAdjacentElement("afterend", button);
        else card.appendChild(button);
      }
      updateCardButton(button, code);
    });
  }

  function removeCardButtons(){
    grid.querySelectorAll(".catalog-prospect-btn").forEach(el => el.remove());
  }

  function updateAllCardButtons(){
    grid.querySelectorAll(".catalog-prospect-btn").forEach(button => {
      updateCardButton(button, normalizeCode(button.dataset.prospectCode || ""));
    });
  }

  function updateCardButton(button, code){
    const count = records.filter(item => normalizeCode(item.codigo) === code).length;
    const markup = count
      ? `+ Prospecto <span class="catalog-prospect-count">${count}</span>`
      : "+ Prospecto";
    if(button.innerHTML !== markup) button.innerHTML = markup;
    button.title = count ? `${count} prospecto${count === 1 ? "" : "s"} asociado${count === 1 ? "" : "s"} a ${code}` : `Asignar prospecto a ${code}`;
  }

  function ensurePage(){
    page = document.getElementById("catalogAdminProspectos");
    if(page) return page;
    page = document.createElement("section");
    page.id = "catalogAdminProspectos";
    page.className = "catalog-admin-page";
    page.hidden = true;
    page.setAttribute("aria-label", "Prospectos");
    page.innerHTML = `
      <h2 class="catalog-admin-page-heading">Prospectos</h2>
      <section class="catalog-admin-card">
        <h3>Clientes potenciales</h3>
        <p class="catalog-admin-card-copy">Guarda únicamente el enlace del perfil de Facebook y su relación comercial. El producto se toma del inventario cuando se registra desde una tarjeta.</p>
        <div class="catalog-prospects-toolbar">
          <button type="button" class="catalog-admin-primary" id="catalogProspectGeneral">+ Prospecto general</button>
          <input id="catalogProspectSearch" type="search" placeholder="Buscar perfil, código, producto o nota" aria-label="Buscar prospectos">
          <select id="catalogProspectStateFilter" aria-label="Filtrar por estado"><option value="">Todos los estados</option>${STATES.map(s=>`<option value="${s}">${STATE_LABELS[s]}</option>`).join("")}</select>
          <button type="button" class="catalog-admin-secondary" id="catalogProspectReload">Recargar</button>
        </div>
        <p id="catalogProspectStatus" class="catalog-prospects-status" role="status" aria-live="polite"></p>
        <div id="catalogProspectList" class="catalog-prospects-list"></div>
      </section>`;
    grid.insertAdjacentElement("beforebegin", page);
    page.querySelector("#catalogProspectGeneral").addEventListener("click", () => openDialog("", true));
    page.querySelector("#catalogProspectReload").addEventListener("click", () => loadProspects(true));
    page.querySelector("#catalogProspectSearch").addEventListener("input", renderList);
    page.querySelector("#catalogProspectStateFilter").addEventListener("change", renderList);
    return page;
  }

  function ensureDialog(){
    if(dialog?.isConnected) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "catalogProspectDialog";
    dialog.className = "catalog-prospect-dialog";
    dialog.innerHTML = `
      <form class="catalog-prospect-dialog-form" method="dialog">
        <h3>Registrar prospecto</h3>
        <p class="catalog-prospect-dialog-context" id="catalogProspectContext"></p>
        <label>Perfil de Facebook
          <span class="catalog-prospect-url-line"><input id="catalogProspectUrl" type="text" inputmode="url" autocomplete="off" placeholder="https://www.facebook.com/..." required><button type="button" class="catalog-prospect-paste" id="catalogProspectPaste">Pegar enlace</button></span>
        </label>
        <label>Estado
          <select id="catalogProspectState">${STATES.map(s=>`<option value="${s}">${STATE_LABELS[s]}</option>`).join("")}</select>
        </label>
        <label>Nota opcional
          <textarea id="catalogProspectNote" maxlength="800" placeholder="Ej.: preguntó por precio, escribir el viernes…"></textarea>
        </label>
        <p id="catalogProspectDialogStatus" class="catalog-prospects-status" role="status" aria-live="polite"></p>
        <div class="catalog-prospect-dialog-actions">
          <button type="button" class="catalog-prospect-cancel" id="catalogProspectCancel">Cancelar</button>
          <button type="submit" class="catalog-prospect-submit" id="catalogProspectSubmit">Guardar</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    dialog.querySelector("#catalogProspectCancel").addEventListener("click", () => dialog.close());
    dialog.querySelector("#catalogProspectPaste").addEventListener("click", () => pasteFromClipboard(true));
    dialog.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      saveNewProspect();
    });
    return dialog;
  }

  async function openDialog(code, tryClipboard){
    if(!window.CATALOG_ADMIN_MODE_ACTIVE) return;
    ensureDialog();
    activeProductCode = normalizeCode(code || "");
    const context = dialog.querySelector("#catalogProspectContext");
    context.textContent = activeProductCode
      ? `Se asociará al producto ${activeProductCode}. El nombre se verificará contra el inventario al guardar.`
      : "Prospecto general, sin producto asignado.";
    dialog.querySelector("#catalogProspectUrl").value = "";
    dialog.querySelector("#catalogProspectState").value = "nuevo";
    dialog.querySelector("#catalogProspectNote").value = "";
    setDialogStatus("");
    if(typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    dialog.querySelector("#catalogProspectUrl").focus();
    if(tryClipboard) await pasteFromClipboard(false);
  }

  async function pasteFromClipboard(showError){
    const input = dialog?.querySelector("#catalogProspectUrl");
    if(!input) return;
    try{
      if(!navigator.clipboard?.readText) throw new Error("Portapapeles no disponible");
      const text = String(await navigator.clipboard.readText() || "").trim();
      if(/^https?:\/\/(?:[^/]+\.)?(?:facebook\.com|fb\.com)\//i.test(text) || /^(?:www\.)?facebook\.com\//i.test(text)){
        input.value = text;
        setDialogStatus("Enlace pegado desde el portapapeles.","ok");
      }else if(showError){
        setDialogStatus("El portapapeles no contiene un enlace de Facebook.","err");
      }
    }catch(_){
      if(showError) setDialogStatus("No se pudo leer el portapapeles. Pega el enlace manualmente.","err");
    }
  }

  async function saveNewProspect(){
    const currentSession = session;
    const submit = dialog.querySelector("#catalogProspectSubmit");
    const url = dialog.querySelector("#catalogProspectUrl").value.trim();
    const state = dialog.querySelector("#catalogProspectState").value;
    const note = dialog.querySelector("#catalogProspectNote").value.trim();
    if(!url){
      setDialogStatus("Pega el enlace del perfil de Facebook.","err");
      return;
    }
    submit.disabled = true;
    submit.textContent = "Guardando…";
    setDialogStatus("Guardando…");
    try{
      const result = await request({
        tipo:"registrar-prospecto",
        perfilFacebook:url,
        codigo:activeProductCode,
        estado:state,
        nota:note
      });
      if(currentSession !== session || !window.CATALOG_ADMIN_MODE_ACTIVE) return;
      if(result?.prospecto){
        upsertLocal(result.prospecto);
        updateAllCardButtons();
        renderList();
      }
      if(result?.duplicate){
        setDialogStatus("Ese perfil ya estaba asociado a este producto.","ok");
      }else{
        setDialogStatus("Prospecto guardado.","ok");
      }
      setPageStatus(result?.duplicate ? "El prospecto ya existía; no se creó un duplicado." : "Prospecto guardado y verificado.","ok");
      setTimeout(() => { if(currentSession === session){ try{dialog.close()}catch(_){} } }, 450);
    }catch(error){
      if(currentSession !== session) return;
      setDialogStatus(error?.message || "No se pudo guardar el prospecto.","err");
    }finally{
      submit.disabled = false;
      submit.textContent = "Guardar";
    }
  }

  async function loadProspects(force=false){
    if(loading && loadPromise) return loadPromise;
    if(loaded && !force) {
      updateAllCardButtons();
      renderList();
      return records;
    }
    if(!window.CATALOG_ADMIN_MODE_ACTIVE || !hasCapability() || typeof window.CATALOG_ADMIN_REQUEST !== "function"){
      return records;
    }
    loading = true;
    const currentSession = session;
    setPageStatus("Cargando prospectos…");
    loadPromise = request({tipo:"obtener-prospectos"})
      .then(result => {
        if(currentSession !== session || !window.CATALOG_ADMIN_MODE_ACTIVE) return [];
        records = Array.isArray(result?.prospectos) ? result.prospectos : [];
        loaded = true;
        updateAllCardButtons();
        renderList();
        const suffix = result?.truncado ? " Se muestran los registros más recientes." : "";
        setPageStatus(`${records.length} prospecto${records.length === 1 ? "" : "s"} disponible${records.length === 1 ? "" : "s"}.${suffix}`,"ok");
        return records;
      })
      .catch(error => {
        if(currentSession !== session) return [];
        setPageStatus(error?.message || "No se pudieron cargar los prospectos.","err");
        throw error;
      })
      .finally(() => {
        if(currentSession !== session) return;
        loading = false;
        loadPromise = null;
      });
    return loadPromise;
  }

  function syncSection(section){
    if(!window.CATALOG_ADMIN_MODE_ACTIVE) return;
    ensurePage();
    if(page) page.hidden = section !== "prospectos";
    if(section === "catalogo"){
      installCardButtons();
      if(!loaded) loadProspects().catch(() => {});
    }else{
      removeCardButtons();
    }
    if(section === "prospectos"){
      if(!hasCapability()){
        setPageStatus("El servicio de prospectos todavía no está disponible en esta implementación.","err");
        renderList();
        return;
      }
      loadProspects().catch(() => {});
    }
  }

  function renderList(){
    const host = document.getElementById("catalogProspectList");
    if(!host) return;
    const search = normalize(document.getElementById("catalogProspectSearch")?.value || "");
    const state = document.getElementById("catalogProspectStateFilter")?.value || "";
    const list = records.filter(item => {
      if(state && item.estado !== state) return false;
      if(!search) return true;
      return normalize([item.perfil_facebook,item.codigo,item.producto,item.nota,item.estado].join(" ")).includes(search);
    });
    host.textContent = "";
    if(!list.length){
      const empty = document.createElement("div");
      empty.className = "catalog-prospect-empty";
      empty.textContent = loaded ? "No hay prospectos que coincidan con el filtro." : "Aún no se han cargado prospectos.";
      host.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    list.forEach(item => fragment.appendChild(renderRow(item)));
    host.appendChild(fragment);
  }

  function renderRow(item){
    const row = document.createElement("article");
    row.className = "catalog-prospect-row";
    row.dataset.prospectId = item.id;

    const profile = document.createElement("div");
    profile.className = "catalog-prospect-profile";
    const link = document.createElement("a");
    link.href = item.perfil_facebook;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.perfil_facebook;
    const date = document.createElement("small");
    date.textContent = item.fecha ? `Registrado: ${item.fecha}` : "";
    profile.append(link, date);

    const product = document.createElement("div");
    product.className = "catalog-prospect-product";
    product.textContent = item.producto || "Prospecto general";
    const code = document.createElement("small");
    code.textContent = item.codigo ? `Código ${item.codigo}` : "Sin producto asignado";
    product.appendChild(code);

    const state = document.createElement("select");
    state.setAttribute("aria-label", `Estado de ${item.id}`);
    STATES.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = STATE_LABELS[value];
      option.selected = value === item.estado;
      state.appendChild(option);
    });

    const note = document.createElement("textarea");
    note.maxLength = 800;
    note.value = item.nota || "";
    note.setAttribute("aria-label", `Nota de ${item.id}`);

    const save = document.createElement("button");
    save.type = "button";
    save.className = "catalog-prospect-save";
    save.textContent = "Guardar";
    save.addEventListener("click", () => saveExisting(item, state, note, save));

    row.append(profile, product, state, note, save);
    return row;
  }

  async function saveExisting(item, state, note, button){
    const currentSession = session;
    button.disabled = true;
    button.textContent = "Guardando…";
    setPageStatus(`Actualizando ${item.id}…`);
    try{
      const result = await request({
        tipo:"actualizar-prospecto",
        id:item.id,
        estado:state.value,
        nota:note.value.trim()
      });
      if(currentSession !== session || !window.CATALOG_ADMIN_MODE_ACTIVE) return;
      if(result?.prospecto) upsertLocal(result.prospecto);
      renderList();
      updateAllCardButtons();
      setPageStatus("Prospecto actualizado.","ok");
    }catch(error){
      if(currentSession !== session) return;
      setPageStatus(error?.message || "No se pudo actualizar el prospecto.","err");
    }finally{
      button.disabled = false;
      button.textContent = "Guardar";
    }
  }

  function upsertLocal(item){
    const index = records.findIndex(record => record.id === item.id);
    if(index >= 0) records[index] = item;
    else records.unshift(item);
  }

  function setPageStatus(text, kind=""){
    ensurePage();
    const el = document.getElementById("catalogProspectStatus");
    if(!el) return;
    el.textContent = text || "";
    el.className = "catalog-prospects-status " + kind;
  }

  function setDialogStatus(text, kind=""){
    const el = dialog?.querySelector("#catalogProspectDialogStatus");
    if(!el) return;
    el.textContent = text || "";
    el.className = "catalog-prospects-status " + kind;
  }

  function normalize(value){
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ");
  }

  function normalizeCode(value){
    const raw = String(value || "").trim();
    return /^\d{1,4}$/.test(raw) ? raw.padStart(4,"0") : "";
  }

  function destroy(){
    session++;
    records = [];
    loaded = false;
    loading = false;
    loadPromise = null;
    removeCardButtons();
    try{dialog?.close()}catch(_){}
    dialog?.remove();
    dialog = null;
    page?.remove();
    page = null;
  }
})();
