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
// 1) mostrar tarjetas completas al buscar; 2) mostrar los productos del nivel actual y sus descendientes, conservando los filtros.
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
    return showAllEnabled;
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
})();


// Inicio usa la misma navegación y filtros del catálogo.
document.getElementById("catalogHomeBtn")?.addEventListener("click",()=>{
  clearSelectedNavigationValues();resetDiscoveryFilters();
  window.setCatalogShowAllProductsDirectEnabled(false);
  refreshNavigationAlbums();refreshFilterOptionsForScope();writeStateToUrl();render();
});
