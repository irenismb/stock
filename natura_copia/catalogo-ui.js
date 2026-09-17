// Ajustes del pie del catálogo: texto comercial/SEO sin retirar contenido existente.
(() => {
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

// Vistas directas de productos. Las dos opciones de administrador son independientes:
// 1) mostrar tarjetas completas al buscar; 2) mostrar todo el catálogo cuando el buscador está vacío.
(() => {
  const SEARCH_DIRECT_STORAGE_KEY = "irenismb_quick_image_search_v1";
  const SHOW_ALL_STORAGE_KEY = "irenismb_show_all_products_direct_v1";
  const searchInput = document.getElementById("q");
  const grid = document.getElementById("grid");
  const count = document.getElementById("count");
  if(!searchInput || !grid) return;

  let searchDirectEnabled = false;
  let showAllEnabled = false;
  try{
    searchDirectEnabled = localStorage.getItem(SEARCH_DIRECT_STORAGE_KEY) === "1";
    showAllEnabled = localStorage.getItem(SHOW_ALL_STORAGE_KEY) === "1";
  }catch(_){ }

  function hasSearch(){
    return String(searchInput.value || "").trim().length > 0;
  }

  function isSearchDirectActive(){
    return searchDirectEnabled && hasSearch();
  }

  function isShowAllDirectActive(){
    return showAllEnabled && !hasSearch();
  }

  function isActive(){
    return isSearchDirectActive() || isShowAllDirectActive();
  }

  function allCatalogProducts(){
    try{
      if(typeof all !== "undefined" && Array.isArray(all)){
        return all.filter(product => product && !product.isGiftGalleryImage);
      }
    }catch(error){
      console.warn("No se pudo leer el catálogo completo para la vista directa.", error);
    }
    return [];
  }

  function directProducts(){
    if(isShowAllDirectActive()){
      const products = allCatalogProducts();
      if(!products.length && /cargando productos/i.test(String(count?.textContent || ""))){
        return null;
      }
      return products;
    }

    if(isSearchDirectActive()){
      try{
        return typeof buildFilteredList === "function" ? buildFilteredList() : [];
      }catch(error){
        console.error("No se pudieron preparar los productos de la búsqueda directa.", error);
        return [];
      }
    }

    return [];
  }

  function renderDirectProducts(){
    const active = isActive();
    document.body.classList.toggle("direct-product-search-active", active);
    grid.classList.remove("quick-image-search");
    if(!active) return;

    const products = directProducts();
    if(products === null) return;

    grid.classList.remove("album-grid-mode", "root-nav-mode", "album-three-column-layout");
    const fragment = document.createDocumentFragment();

    if(!products.length){
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const title = document.createElement("strong");
      title.className = "empty-state-title";
      title.textContent = hasSearch()
        ? "No se encontraron productos con ese nombre."
        : "No hay productos disponibles.";
      empty.appendChild(title);
      fragment.appendChild(empty);
    }else{
      for(const product of products){
        try{
          fragment.appendChild(makeCard(product));
        }catch(error){
          console.warn("No se pudo crear una tarjeta de producto en la vista directa.", error);
        }
      }
    }

    grid.replaceChildren(fragment);

    if(typeof refreshCardUI === "function" && typeof productById !== "undefined"){
      for(const card of grid.querySelectorAll(".card:not(.album-card)")){
        const product = productById.get(String(card.dataset.id || ""));
        if(product) refreshCardUI(card, product);
      }
    }

    if(count){
      count.hidden = false;
      count.textContent = `${products.length} ${products.length === 1 ? "producto" : "productos"}`;
    }
  }

  let directRenderQueued = false;
  function syncView(){
    if(directRenderQueued) return;
    directRenderQueued = true;
    requestAnimationFrame(() => {
      directRenderQueued = false;
      renderDirectProducts();
    });
  }

  // El render principal puede volver a mostrar álbumes. Cuando cualquiera de las
  // dos vistas directas corresponde al estado actual, las tarjetas completas se reaplican.
  try{
    if(typeof render === "function" && !render.__directProductSearchWrapped){
      const baseRender = render;
      const wrappedRender = function(...args){
        const result = baseRender.apply(this, args);
        if(isActive()) syncView();
        return result;
      };
      wrappedRender.__directProductSearchWrapped = true;
      render = wrappedRender;
    }
  }catch(error){
    console.warn("No se pudo enlazar la vista directa con el render principal.", error);
  }

  function setSearchDirectEnabled(next){
    searchDirectEnabled = !!next;
    try{ localStorage.setItem(SEARCH_DIRECT_STORAGE_KEY, searchDirectEnabled ? "1" : "0"); }catch(_){ }
    if(typeof render === "function") render();
    if(isActive()) syncView();
    syncAdminToggles();
  }

  function setShowAllEnabled(next){
    showAllEnabled = !!next;
    try{ localStorage.setItem(SHOW_ALL_STORAGE_KEY, showAllEnabled ? "1" : "0"); }catch(_){ }
    if(typeof render === "function") render();
    if(isActive()) syncView();
    syncAdminToggles();
  }

  // Se conservan los nombres públicos anteriores para no romper integraciones existentes.
  window.setCatalogQuickImageSearchEnabled = setSearchDirectEnabled;
  window.isCatalogQuickImageSearchEnabled = () => searchDirectEnabled;
  window.setCatalogShowAllProductsDirectEnabled = setShowAllEnabled;
  window.isCatalogShowAllProductsDirectEnabled = () => showAllEnabled;

  searchInput.addEventListener("input", syncView);
  searchInput.addEventListener("search", syncView);

  function syncSwitch(button, state){
    if(!button) return;
    const checked = state ? "true" : "false";
    const text = state ? "ACTIVADO" : "DESACTIVADO";
    if(button.disabled) button.disabled = false;
    if(button.getAttribute("aria-checked") !== checked) button.setAttribute("aria-checked", checked);
    if(button.textContent !== text) button.textContent = text;
  }

  function syncAdminToggles(){
    syncSwitch(document.querySelector("[data-admin-quick-images-toggle]"), searchDirectEnabled);
    syncSwitch(document.querySelector("[data-admin-show-all-products-toggle]"), showAllEnabled);
  }

  function installAdminToggles(){
    const list = document.querySelector("#catalogAdminConfig .catalog-admin-config-list");
    if(!list) return;

    if(!list.querySelector("[data-admin-quick-images-row]")){
      const searchRow = document.createElement("div");
      searchRow.className = "catalog-admin-config-row";
      searchRow.dataset.adminQuickImagesRow = "";
      searchRow.innerHTML = `
        <div>
          <span class="catalog-admin-config-label">Mostrar productos directamente al buscar</span>
          <span class="catalog-admin-config-help">Mientras escribes en el buscador muestra las tarjetas completas de los productos encontrados, con imagen, descripción, precio y botones para agregar o quitar, sin tener que llegar al nivel más profundo de la categoría. Esta preferencia queda guardada en este navegador.</span>
        </div>
        <button type="button" class="catalog-admin-switch" role="switch" aria-checked="false" data-admin-quick-images-toggle>DESACTIVADO</button>
      `;
      list.appendChild(searchRow);

      searchRow.querySelector("[data-admin-quick-images-toggle]")?.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        setSearchDirectEnabled(!searchDirectEnabled);
      });
    }

    if(!list.querySelector("[data-admin-show-all-products-row]")){
      const allRow = document.createElement("div");
      allRow.className = "catalog-admin-config-row";
      allRow.dataset.adminShowAllProductsRow = "";
      allRow.innerHTML = `
        <div>
          <span class="catalog-admin-config-label">Mostrar todos los productos directamente</span>
          <span class="catalog-admin-config-help">Muestra todas las tarjetas completas del catálogo sin tener que entrar a las categorías. Permite ver precios y agregar o quitar productos directamente. Al escribir en el buscador, esta opción deja actuar a la búsqueda normal o a la opción de búsqueda directa si también está activada. Esta preferencia queda guardada en este navegador.</span>
        </div>
        <button type="button" class="catalog-admin-switch" role="switch" aria-checked="false" data-admin-show-all-products-toggle>DESACTIVADO</button>
      `;
      list.appendChild(allRow);

      allRow.querySelector("[data-admin-show-all-products-toggle]")?.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        setShowAllEnabled(!showAllEnabled);
      });
    }

    syncAdminToggles();
  }

  let adminObserverQueued = false;
  const observer = new MutationObserver(() => {
    if(adminObserverQueued) return;
    adminObserverQueued = true;
    requestAnimationFrame(() => {
      adminObserverQueued = false;
      installAdminToggles();
    });
  });
  const adminHost = grid.parentElement || document.body;
  observer.observe(adminHost, {childList:true});
  installAdminToggles();
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

  function waitUntilReady(token, timeoutMs = 45000){
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const check = () => {
        if(token !== actionToken){ reject(new Error("Operación reemplazada.")); return; }
        if(!modal.classList.contains("open")){ reject(new Error("El folleto se cerró.")); return; }
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

      const copyAndDownload = window.catalogoCopyAndDownloadCollageForChannel;
      if(typeof copyAndDownload !== "function"){
        throw new Error("La acción de salida del folleto no está disponible.");
      }
      const result = await copyAndDownload(outputButton);

      if(token !== actionToken) return;
      if(result?.pending || (!result?.copied && !result?.downloaded)){
        throw new Error("No se pudo copiar ni descargar la imagen.");
      }
      button.textContent = result.copied && result.downloaded
        ? "✓ Copiada y descargada"
        : result.downloaded
          ? "✓ Descargada"
          : "✓ Copiada";
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

  const observer = new MutationObserver(() => {
    syncHiddenActions();
    if(!modal.classList.contains("open")) actionToken++;
  });
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
