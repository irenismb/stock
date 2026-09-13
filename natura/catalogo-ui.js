// Ajustes del pie del catálogo: texto comercial/SEO y retiro del listado completo de productos.
(() => {
  document.querySelector(".beauty-products-details")?.remove();

  const footerText = document.querySelector(".footer-card p");
  if(!footerText) return;

  footerText.innerHTML = `
    Irenismb Stock Natura es una tienda en línea con punto físico en Santa Marta, especializada en productos Natura y AVON. Encuentra perfumes, maquillaje y productos para el cuidado facial, corporal y capilar, con líneas como Natura Tododia, Ekos, Lumina, Chronos, Kaiak, Essencial, Homem, Una y Faces, además de AVON Care y Far Away.
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
    button.disabled = false;
    button.setAttribute("aria-checked", enabled ? "true" : "false");
    button.textContent = enabled ? "ACTIVADO" : "DESACTIVADO";
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

  const observer = new MutationObserver(() => installAdminToggle());
  observer.observe(document.body, {childList:true, subtree:true});
  installAdminToggle();
  syncView();
})();
