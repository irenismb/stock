// Ajustes del pie del catálogo: texto comercial/SEO y retiro del listado completo de productos.
(() => {
  document.querySelector(".beauty-products-details")?.remove();

  const footerText = document.querySelector(".footer-card p");
  if(!footerText) return;

  footerText.innerHTML = `
    Irenismb Stock Natura es una tienda en línea con punto físico en Santa Marta, especializada en productos Natura y AVON. Encuentra perfumes, maquillaje y productos para el cuidado facial, corporal y capilar, con líneas como <strong>Natura Tododia, Ekos, Lumina, Chronos, Kaiak, Essencial, Homem, Una y Faces, además de AVON Care y Far Away</strong>.
    Te asesoramos por <a href="https://wa.me/573042088961" target="_blank" rel="noopener noreferrer">WhatsApp</a>, vía telefónica o de manera presencial en el barrio Almendros.
    <strong>Dirección:</strong> Calle 10A #20A-06.
    <strong>Teléfono:</strong> <a href="tel:+573042088961" rel="nofollow">+57 304 208 8961</a>.
    Realizamos envíos nacionales e internacionales.
  `;
})();

// Compartir catálogo: módulo aislado que no altera la lógica principal.
(() => {
  const shareBtn = document.getElementById("shareCatalogBtn");

  shareBtn?.addEventListener("click", async () => {
    const url = window.location.href.split("#")[0];
    const datos = {
      title:document.title,
      text:"Catálogo Irenismb Stock Natura",
      url
    };

    try{
      if(typeof navigator.share === "function"){
        await navigator.share(datos);
        return;
      }
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(url);
        const tituloAnterior = shareBtn.title;
        shareBtn.title = "Enlace copiado";
        shareBtn.setAttribute("aria-label", "Enlace del catálogo copiado");
        setTimeout(() => {
          shareBtn.title = tituloAnterior || "Compartir catálogo";
          shareBtn.setAttribute("aria-label", "Compartir catálogo");
        }, 1800);
        return;
      }
      window.prompt("Copia el enlace del catálogo:", url);
    }catch(error){
      if(error?.name !== "AbortError") console.error("No fue posible compartir el catálogo.", error);
    }
  });
})();

// Vista rápida por imágenes durante la búsqueda.
(() => {
  const STORAGE_KEY = "irenismb_quick_image_search_v1";
  const searchInput = document.getElementById("q");
  const grid = document.getElementById("grid");
  if(!searchInput || !grid) return;

  let enabled = false;
  try{
    enabled = localStorage.getItem(STORAGE_KEY) === "1";
  }catch(_){ }

  const style = document.createElement("style");
  style.id = "quick-image-search-style";
  style.textContent = `
    #grid.quick-image-search{
      display:grid!important;
      grid-template-columns:repeat(auto-fill,minmax(118px,1fr))!important;
      gap:10px!important;
      align-items:start!important;
    }
    #grid.quick-image-search > .album-card{display:none!important}
    #grid.quick-image-search > .card:not(.album-card){
      min-width:0!important;
      min-height:0!important;
      margin:0!important;
      padding:0!important;
      overflow:hidden!important;
      border-radius:14px!important;
      cursor:pointer!important;
    }
    #grid.quick-image-search > .card:not(.album-card) > :not(.img){display:none!important}
    #grid.quick-image-search > .card:not(.album-card) > .img{
      width:100%!important;
      aspect-ratio:1 / 1!important;
      min-height:0!important;
      height:auto!important;
      margin:0!important;
      padding:0!important;
      border:0!important;
      border-radius:0!important;
      background:#fff!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
    }
    #grid.quick-image-search > .card:not(.album-card) > .img img{
      width:100%!important;
      height:100%!important;
      max-width:none!important;
      max-height:none!important;
      object-fit:contain!important;
      display:block!important;
      cursor:pointer!important;
    }
    body.quick-image-search-active #catalogEntryIntro,
    body.quick-image-search-active #topline,
    body.quick-image-search-active #albumNavHost{display:none!important}
    #grid.quick-image-search > .card.quick-image-added{transform:scale(.965);transition:transform .12s ease}
    @media(max-width:640px){
      #grid.quick-image-search{grid-template-columns:repeat(auto-fill,minmax(92px,1fr))!important;gap:8px!important}
    }
  `;
  document.head.appendChild(style);

  function isActive(){
    return enabled && String(searchInput.value || "").trim().length > 0;
  }

  function syncView(){
    const active = isActive();
    grid.classList.toggle("quick-image-search", active);
    document.body.classList.toggle("quick-image-search-active", active);
  }

  function setEnabled(next){
    enabled = !!next;
    try{ localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0"); }catch(_){ }
    syncView();
    syncAdminToggle();
  }

  window.setCatalogQuickImageSearchEnabled = setEnabled;
  window.isCatalogQuickImageSearchEnabled = () => enabled;

  searchInput.addEventListener("input", () => requestAnimationFrame(syncView));
  searchInput.addEventListener("search", () => requestAnimationFrame(syncView));

  grid.addEventListener("click", event => {
    if(!isActive()) return;
    const imageBox = event.target.closest(".card:not(.album-card) > .img");
    if(!imageBox || !grid.contains(imageBox)) return;
    const card = imageBox.closest(".card:not(.album-card)");
    const addButton = card?.querySelector('button[data-act="inc"]');
    if(!card || !addButton || addButton.disabled) return;

    event.preventDefault();
    event.stopPropagation();
    addButton.click();
    card.classList.add("quick-image-added");
    window.setTimeout(() => card.classList.remove("quick-image-added"), 160);
  }, true);

  function syncAdminToggle(){
    const button = document.querySelector("[data-admin-quick-images-toggle]");
    if(!button) return;
    const checked = enabled ? "true" : "false";
    const text = enabled ? "ACTIVADO" : "DESACTIVADO";
    if(button.disabled) button.disabled = false;
    if(button.getAttribute("aria-checked") !== checked) button.setAttribute("aria-checked", checked);
    if(button.textContent !== text) button.textContent = text;
  }

  function installAdminToggle(){
    const list = document.querySelector("#catalogAdminConfig .catalog-admin-config-list");
    if(!list || list.querySelector("[data-admin-quick-images-row]")){
      syncAdminToggle();
      return;
    }

    const row = document.createElement("div");
    row.className = "catalog-admin-config-row";
    row.dataset.adminQuickImagesRow = "";
    row.innerHTML = `
      <div>
        <span class="catalog-admin-config-label">Vista rápida de imágenes al buscar</span>
        <span class="catalog-admin-config-help">Mientras escribes en el buscador muestra únicamente las imágenes de los productos. Al pulsar una imagen se agrega una unidad al carrito. Esta preferencia queda guardada en este navegador.</span>
      </div>
      <button type="button" class="catalog-admin-switch" role="switch" aria-checked="false" data-admin-quick-images-toggle>DESACTIVADO</button>
    `;
    list.appendChild(row);

    row.querySelector("[data-admin-quick-images-toggle]")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setEnabled(!enabled);
    });
    syncAdminToggle();
  }

  let adminObserverQueued = false;
  const observer = new MutationObserver(() => {
    if(adminObserverQueued) return;
    adminObserverQueued = true;
    requestAnimationFrame(() => {
      adminObserverQueued = false;
      installAdminToggle();
    });
  });
  observer.observe(document.body, {childList:true, subtree:true});
  installAdminToggle();
  syncView();
})();

// Formatos del folleto: cada botón genera, copia y descarga la imagen.
(() => {
  const modal = document.getElementById("collageModal");
  if(!modal) return;

  const sizeControl = modal.querySelector("#collageSizeControl");
  const formatChoices = sizeControl?.querySelector(".collage-format-choices");
  const formatButtons = [...modal.querySelectorAll("[data-collage-format]")];
  const genericActions = modal.querySelector("#collageGenericActions");
  const socialActions = modal.querySelector("#collageSocialActions");
  const messengerBtn = modal.querySelector("#collageMessengerBtn");
  const facebookBtn = modal.querySelector("#collageFacebookBtn");
  const outputButton = messengerBtn || facebookBtn;
  if(!sizeControl || formatButtons.length < 2 || !outputButton) return;

  const labels = {
    instagram: "Vertical · 1080 × 1350",
    marketplace: "Cuadrado · 1200 × 1200"
  };

  const style = document.createElement("style");
  style.id = "collage-two-format-actions-style";
  style.textContent = `
    #collageModal:not(.is-ficha-mode) #collageGenericActions,
    #collageModal:not(.is-ficha-mode) #collageSocialActions{display:none!important}
    #collageModal .collage-format-helper{
      margin:2px 0 8px;
      color:#c3cede;
      font:600 12px/1.35 Arial,sans-serif;
    }
    #collageModal .collage-format-option.is-copying{cursor:wait;opacity:.82}
  `;
  document.head.appendChild(style);

  const labelEl = sizeControl.querySelector(".collage-control-label");
  if(labelEl) labelEl.textContent = "Formato";
  if(formatChoices) formatChoices.setAttribute("aria-label", "Formato de la imagen");

  let helper = sizeControl.querySelector(".collage-format-helper");
  if(!helper){
    helper = document.createElement("div");
    helper.className = "collage-format-helper";
    helper.textContent = "Selecciona un formato para generar, copiar y descargar la imagen.";
    labelEl?.insertAdjacentElement("afterend", helper);
  }else{
    helper.textContent = "Selecciona un formato para generar, copiar y descargar la imagen.";
  }

  function restoreLabels(){
    for(const button of formatButtons){
      const key = String(button.dataset.collageFormat || "");
      button.textContent = labels[key] || button.textContent;
      button.classList.remove("is-copying");
      button.disabled = false;
      button.setAttribute("aria-label", `Generar, copiar y descargar ${labels[key] || "imagen"}`);
    }
  }

  function syncHiddenActions(){
    if(socialActions){
      socialActions.hidden = true;
      socialActions.setAttribute("aria-hidden", "true");
    }
    if(genericActions){
      const ficha = modal.classList.contains("is-ficha-mode");
      genericActions.hidden = !ficha;
      genericActions.toggleAttribute("aria-hidden", !ficha);
    }
  }

  function waitUntilReady(token, timeoutMs = 25000){
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const check = () => {
        if(token !== actionToken){ reject(new Error("Operación reemplazada.")); return; }
        if(!outputButton.disabled){ resolve(); return; }
        if(Date.now() - started >= timeoutMs){ reject(new Error("La imagen tardó demasiado en generarse.")); return; }
        window.setTimeout(check, 50);
      };
      check();
    });
  }

  let actionToken = 0;
  async function generateCopyAndDownload(button){
    if(modal.classList.contains("is-ficha-mode")) return;

    const token = ++actionToken;
    for(const current of formatButtons){
      current.disabled = true;
      current.classList.toggle("is-copying", current === button);
    }
    button.textContent = "Generando, copiando y descargando…";

    try{
      await waitUntilReady(token);
      if(token !== actionToken) return;

      // El botón social original ya tiene la lógica robusta para copiar al
      // portapapeles y descargar el PNG preparado en el formato seleccionado.
      outputButton.click();

      if(token !== actionToken) return;
      button.textContent = "✓ Copiada y descargada";
      await new Promise(resolve => window.setTimeout(resolve, 1100));
    }catch(error){
      console.error("No se pudo generar, copiar y descargar la imagen del folleto.", error);
      if(token === actionToken){
        button.textContent = "No se pudo completar";
        alert("No se pudo completar la generación de la imagen. Inténtalo nuevamente.");
        await new Promise(resolve => window.setTimeout(resolve, 1100));
      }
    }finally{
      if(token === actionToken) restoreLabels();
    }
  }

  restoreLabels();
  syncHiddenActions();

  for(const button of formatButtons){
    button.addEventListener("click", () => { void generateCopyAndDownload(button); });
  }

  const observer = new MutationObserver(() => syncHiddenActions());
  observer.observe(modal, {attributes:true, attributeFilter:["class"]});
})();

// Inicio compacto y estado de carga sin mensajes contradictorios.
(() => {
  document.getElementById("catalogEntryIntro")?.remove();

  const count = document.getElementById("count");
  const grid = document.getElementById("grid");
  if(!count || !grid) return;

  let initialLoading = true;
  let queued = false;

  function isHardError(text){
    return /error|no se pudieron cargar|no se pudo cargar|reintenta más tarde/i.test(String(text || ""));
  }

  function ensureLoadingState(){
    const existing = grid.querySelector(".empty-state");
    if(existing){
      const title = existing.querySelector(".empty-state-title");
      if(title && title.textContent !== "Cargando productos…") title.textContent = "Cargando productos…";
      existing.querySelector(".empty-state-text")?.remove();
      existing.querySelector(".empty-state-actions")?.remove();
      return;
    }

    if(grid.querySelector(".card,.album-card")) return;
    const state = document.createElement("div");
    state.className = "empty-state catalog-loading-state";
    const title = document.createElement("strong");
    title.className = "empty-state-title";
    title.textContent = "Cargando productos…";
    state.appendChild(title);
    grid.replaceChildren(state);
  }

  function syncLoadingUi(){
    const text = String(count.textContent || "").trim();
    const hasCatalogCards = !!grid.querySelector(".card,.album-card");

    if(initialLoading && (hasCatalogCards || isHardError(text))) initialLoading = false;

    if(initialLoading){
      count.hidden = true;
      ensureLoadingState();
    }else if(count.hidden){
      count.hidden = false;
    }
  }

  function queueSync(){
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      syncLoadingUi();
    });
  }

  const observer = new MutationObserver(queueSync);
  observer.observe(count, {childList:true, characterData:true,subtree:true});
  observer.observe(grid, {childList:true, subtree:true});
  syncLoadingUi();
})();

// En móvil el carrito ocupa una fila completa de la barra.
(() => {
  const style = document.createElement("style");
  style.id = "mobile-cart-full-row-style";
  style.textContent = `
    @media (max-width:760px){
      .bar #btn-cart{
        grid-column:1 / -1!important;
        width:100%!important;
        max-width:none!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
