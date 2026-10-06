// Simplifica la barra de búsqueda en PC y móvil: sin Ordenar, sin botón Filtros y sin panel de filtros.
(() => {
  const style = document.createElement("style");
  style.id = "catalog-search-controls-cleanup";
  style.textContent = `
    #sort{display:none!important}
  `;
  document.head.appendChild(style);

  const sort = document.getElementById("sort");
  if(sort){
    sort.value = "";
    sort.disabled = true;
    sort.hidden = true;
  }

  const filterButton = document.getElementById("toggleWordPanelBtn");
  if(filterButton){
    filterButton.hidden = false;
    filterButton.disabled = false;
  }

  const panel = document.getElementById("wordPanel");
  if(panel){
    panel.hidden = true;
  }

  try{
    const url = new URL(window.location.href);
    if(url.searchParams.has("sort")){
      url.searchParams.delete("sort");
      history.replaceState(null, "", url.toString());
    }
  }catch(_){ }
})();

// Ajustes del pie del catálogo: texto comercial/SEO.
(() => {
  const footerText = document.querySelector(".footer-card p");
  if(!footerText) return;

  footerText.innerHTML = `
    Irenismb Stock Natura es una tienda en línea con punto físico en Santa Marta, especializada en productos Natura y AVON. Encuentra perfumes, maquillaje y productos para el cuidado facial, corporal y capilar, con líneas como <strong>Natura Tododia, Ekos, Lumina, Chronos, Kaiak, Essencial, Homem, Una y Faces, además de AVON Care y Far Away</strong>.
    Te asesoramos por <a href="https://wa.me/573042088961" target="_blank" rel="noopener noreferrer">WhatsApp</a>, vía telefónica o de manera presencial en el barrio Los Almendros.
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
// 1) mostrar tarjetas completas al buscar; 2) mostrar los productos del nivel actual y sus descendientes cuando el buscador está vacío.
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
      if(typeof currentProductSourceList === "function"){
        const products = typeof buildFilteredList === "function" ? buildFilteredList() : currentProductSourceList();
        return Array.isArray(products)
          ? products.filter(product => product && !product.isGiftGalleryImage)
          : [];
      }
    }catch(error){
      console.warn("No se pudieron leer los productos del nivel actual para la vista directa.", error);
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

    if(window.CATALOG_INITIAL_LOAD_READY !== true){
      count.hidden = true;
      return;
    }

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
      count.textContent = `${products.length} ${products.length === 1 ? "producto" : "productos"}`;
      if(window.CATALOG_INITIAL_LOAD_READY === true) count.hidden = false;
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

  document.getElementById("showProductsBtn")?.addEventListener("click", () => {
    setShowAllEnabled(!showAllEnabled);
  });
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
    const button = document.getElementById("showProductsBtn");
    if(button){
      const label = showAllEnabled ? "Ver paletas" : "Ver productos";
      if(button.textContent !== label) button.textContent = label;
      button.setAttribute("aria-pressed", showAllEnabled ? "true" : "false");
      button.setAttribute("aria-label", showAllEnabled
        ? "Volver a las paletas del nivel actual"
        : "Ver todos los productos del nivel actual y sus niveles inferiores");
    }
  }

  function installAdminToggles(){
    const list = document.getElementById("catalogAdminSharedConfigList") || document.querySelector("#catalogAdminConfig .catalog-admin-config-list");
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
  observer.observe(document.body, {childList:true, subtree:true});
  installAdminToggles();
  syncAdminToggles();
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
  const count = document.getElementById("count");
  const grid = document.getElementById("grid");
  if(!count || !grid) return;

  let initialLoading = true;
  let queued = false;

  function isHardError(text){
    return /error|no se pudieron cargar|no se pudo cargar|reintenta más tarde/i.test(String(text || ""));
  }

  function ensureLoadingState(message="Cargando productos…"){
    const loadingText = String(message || "Cargando productos…").trim() || "Cargando productos…";
    const existing = grid.querySelector(".empty-state");
    if(existing){
      const title = existing.querySelector(".empty-state-title");
      if(title && title.textContent !== loadingText) title.textContent = loadingText;
      existing.querySelector(".empty-state-text")?.remove();
      existing.querySelector(".empty-state-actions")?.remove();
      return;
    }

    if(grid.querySelector(".card,.album-card")) return;
    const state = document.createElement("div");
    state.className = "empty-state catalog-loading-state";
    const title = document.createElement("strong");
    title.className = "empty-state-title";
    title.textContent = loadingText;
    state.appendChild(title);
    grid.replaceChildren(state);
  }

  function syncLoadingUi(){
    const text = String(count.textContent || "").trim();
    const catalogReady = window.CATALOG_INITIAL_LOAD_READY === true;

    if(initialLoading && (catalogReady || isHardError(text))) initialLoading = false;

    if(initialLoading){
      count.hidden = true;
      ensureLoadingState(text);
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
  window.addEventListener("catalog-initial-load-ready", queueSync, {once:true});
  syncLoadingUi();
})();

// En móvil, Administrar queda a la izquierda y WhatsApp/carrito a la derecha.
// Este refuerzo se inyecta al final para neutralizar reglas antiguas de ancho completo.
(() => {
  const style = document.createElement("style");
  style.id = "mobile-admin-cart-pair-style";
  style.textContent = `
    @media (max-width:760px){
      .bar[role="search"]{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
      }
      .bar[role="search"] > #priceAdminBtn{
        grid-column:1 / 2!important;
        width:100%!important;
        min-width:0!important;
        max-width:none!important;
        margin:0!important;
        justify-self:stretch!important;
      }
      .bar[role="search"] > #btn-cart{
        grid-column:2 / 3!important;
        width:100%!important;
        min-width:0!important;
        max-width:none!important;
        margin:0!important;
        padding-inline:14px!important;
        justify-self:stretch!important;
      }
    }
  `;
  document.head.appendChild(style);
})();

// Controles públicos: Administrar, WhatsApp, Folleto y Ver productos.
(() => {
  const style = document.createElement("style");
  style.id = "public-catalog-toolbar-style";
  style.textContent = `
    .bar[role="search"] > #priceAdminBtn{order:10!important}
    .bar[role="search"] > #btn-cart{order:20!important}
    .bar[role="search"] > #collageBtn{order:30!important}
    .bar[role="search"] > #showProductsBtn{order:40!important}
    .bar[role="search"] > .count-slot{order:50!important}
    #showProductsBtn[aria-pressed="true"]{background:#f5e5e8;border-color:#cfa8b0;color:#8d5360}
    @media(min-width:761px){
      .bar[role="search"] > #showProductsBtn{flex:1 1 105px!important;width:auto!important;min-width:100px!important;max-width:170px!important;margin:0!important}
    }
    @media(max-width:760px){
      .bar[role="search"] > .search-wrap{grid-column:1 / -1!important;grid-row:1!important}
      .bar[role="search"] > #priceAdminBtn{grid-column:1!important;grid-row:2!important}
      .bar[role="search"] > #btn-cart{grid-column:2!important;grid-row:2!important}
      .bar[role="search"]:has(> #priceAdminBtn[hidden]) > #btn-cart{grid-column:1 / -1!important}
      .bar[role="search"] > #collageBtn{grid-column:1!important;grid-row:3!important}
      .bar[role="search"] > #showProductsBtn{grid-column:2!important;grid-row:3!important}
      .bar[role="search"] > #collageBtn,.bar[role="search"] > #showProductsBtn{width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;justify-self:stretch!important}
      .bar[role="search"] > .count-slot{grid-column:1 / -1!important;grid-row:6!important}
    }
  `;
  document.head.appendChild(style);
})();

// Orden público de las tarjetas de producto.
(() => {
  const button = document.getElementById("productOrderBtn");
  const menu = document.getElementById("productOrderMenu");
  const sort = document.getElementById("sort");
  if(!button || !menu || !sort) return;
  const choices = [...menu.querySelectorAll("[data-product-sort]")];
  function syncOrder(){
    for(const choice of choices){
      const selected = choice.dataset.productSort === (sort.value || "name_asc");
      choice.setAttribute("aria-pressed", selected ? "true" : "false");
      if(selected){
        const labels={name_asc:"Nombre A–Z",name_desc:"Nombre Z–A",price_asc:"Precio ↑",price_desc:"Precio ↓"};
        button.textContent=labels[choice.dataset.productSort] || "Nombre A–Z";
        button.title="Ordenar: " + choice.textContent.trim();
        button.setAttribute("aria-label",button.title);
      }
    }
  }
  for(const choice of choices){
    choice.addEventListener("click", () => {
      sort.value = choice.dataset.productSort;
      sort.dispatchEvent(new Event("change", {bubbles:true}));
      syncOrder();
      menu.hidePopover();
      button.focus({preventScroll:true});
    });
  }
  sort.addEventListener("change", syncOrder);
  window.addEventListener("irenismb:product-order-change",syncOrder);
  menu.addEventListener("toggle", syncOrder);
  syncOrder();
  const style = document.createElement("style");
  style.textContent = `
    .bar[role="search"] > #productOrderBtn{order:45!important;white-space:nowrap}
    #productOrderMenu{width:min(300px,calc(100vw - 32px));padding:12px;border:1px solid #d9c9c1;border-radius:16px;background:#fffdfb;color:#352b2c;box-shadow:0 12px 35px rgba(60,40,40,.2)}
    #productOrderMenu::backdrop{background:rgba(0,0,0,.12)}
    #productOrderMenu button{display:block;width:100%;margin:4px 0;padding:12px;text-align:left;border:1px solid #d9c9c1;border-radius:10px;background:#fff;color:#352b2c;cursor:pointer;font:inherit}
    #productOrderMenu button[aria-pressed="true"]{background:#f5e5e8;border-color:#a55f70;font-weight:700}
    #productOrderMenu button[aria-pressed="true"]::before{content:"✓ ";color:#8d5360}
    @media(min-width:761px){.bar[role="search"] > #productOrderBtn{flex:0 1 95px!important;width:auto!important;min-width:80px!important;margin:0!important}}
    @media(max-width:760px){
      .bar[role="search"] > #productOrderBtn{grid-column:1 / -1!important;grid-row:4!important;width:100%!important;margin:0!important}
      .bar[role="search"] > .count-slot{grid-row:6!important}
    }
  `;
  document.head.appendChild(style);
})();

// Filtrar está disponible para todos, después de Ordenar.
(() => {
  const style = document.createElement("style");
  style.textContent = `
    .bar[role="search"] > #toggleWordPanelBtn{order:46!important}
    .bar[role="search"] > #catalogPdfBtn{order:47!important}
    @media(min-width:761px){
      .bar[role="search"]{flex-wrap:wrap!important}
      .bar[role="search"] > #toggleWordPanelBtn{flex:0 1 95px!important;min-width:80px!important;margin:0!important}
    }
    @media(max-width:760px){
      .bar[role="search"] > #productOrderBtn{grid-column:1!important;grid-row:4!important}
      .bar[role="search"] > #toggleWordPanelBtn{grid-column:2!important;grid-row:4!important;width:100%!important;margin:0!important}
      .bar[role="search"] > #catalogPdfBtn{grid-column:1 / -1!important;grid-row:5!important;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important}
      .bar[role="search"] > .count-slot{grid-column:1 / -1!important;grid-row:6!important}
    }
  `;
  document.head.appendChild(style);
})();
