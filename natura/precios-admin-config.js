// Generado automáticamente por GitHub Actions después de publicar Apps Script.
window.PRECIOS_ADMIN_CONFIG = Object.freeze({
  endpoint: "https://script.google.com/macros/s/AKfycbwAUk8ysr-3k_T5iRxFpbp8KxmvPpYeGRNbL156lp9CsVjNFjQQgg5v7ySaxO7dcP_X/exec"
});

// Filtro local del modo administrador: permite trabajar viendo únicamente lo visible.
(() => {
  const STORAGE_KEY = "irenismb_admin_no_mostrar_ocultos_v1";
  let enabled = false;
  try{ enabled = localStorage.getItem(STORAGE_KEY) === "1"; }catch(_){ }

  window.CATALOG_ADMIN_HIDE_HIDDEN = enabled;

  const style = document.createElement("style");
  style.id = "catalog-admin-hide-hidden-style";
  style.textContent = `
    body.catalog-admin-hide-hidden-active #grid > .catalog-admin-hidden,
    body.catalog-admin-hide-hidden-active #grid > .catalog-admin-inherited{
      display:none!important;
    }
  `;
  document.head.appendChild(style);

  function norm(value){
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function visibilityId(type, id){
    const t = norm(type);
    const raw = String(id ?? "").trim();
    if(t === "producto" && /^\d{1,4}$/.test(raw)) return raw.padStart(4, "0");
    return norm(raw);
  }

  function ruleKey(type, id){
    return `${norm(type)}::${visibilityId(type, id)}`;
  }

  function productIsHidden(product){
    if(!product) return false;
    const rules = window.CATALOG_VISIBILITY_RULES;
    if(!(rules instanceof Set)) return false;

    const category = norm(product.category);
    const subcategory = norm(product.subcategory);
    const family = norm(product.line || product.fragranceFamily);
    const section = norm(product.section);
    const code = visibilityId("producto", product.id || product.code || "");
    const subcategoryId = category && subcategory ? `${category}|${subcategory}` : "";
    const familyId = category && subcategory && family ? `${category}|${subcategory}|${family}` : "";

    return (code && rules.has(ruleKey("producto", code))) ||
      (section && rules.has(ruleKey("seccion", section))) ||
      (category && rules.has(ruleKey("categoria", category))) ||
      (subcategoryId && rules.has(ruleKey("subcategoria", subcategoryId))) ||
      (familyId && rules.has(ruleKey("familia", familyId)));
  }

  function installFilterHook(){
    const current = window.filterVisibleProducts;
    if(typeof current !== "function") return false;
    if(current.__adminNoMostrarOcultosWrapped) return true;

    const baseFilter = current;
    const wrapped = list => {
      const result = baseFilter(list);
      if(!enabled || !window.CATALOG_ADMIN_MODE_ACTIVE) return result;
      const products = Array.isArray(result) ? result : [];
      return products.filter(product => !productIsHidden(product));
    };
    wrapped.__adminNoMostrarOcultosWrapped = true;
    wrapped.__adminNoMostrarOcultosBase = baseFilter;
    window.filterVisibleProducts = wrapped;
    return true;
  }

  function syncBodyState(){
    document.body?.classList.toggle(
      "catalog-admin-hide-hidden-active",
      !!enabled && !!window.CATALOG_ADMIN_MODE_ACTIVE
    );
  }

  function syncButton(){
    const button = document.querySelector("[data-admin-hide-hidden-toggle]");
    if(!button) return;
    button.disabled = false;
    button.setAttribute("aria-checked", enabled ? "true" : "false");
    button.textContent = enabled ? "ACTIVADO" : "DESACTIVADO";
  }

  function rebuildCatalog(){
    try{
      if(typeof rebuildCatalogVisibility === "function") rebuildCatalogVisibility();
      if(typeof refreshFilterOptionsForScope === "function") refreshFilterOptionsForScope();
      if(typeof render === "function") render();
    }catch(error){
      console.info(error);
    }
  }

  function setEnabled(next){
    enabled = !!next;
    window.CATALOG_ADMIN_HIDE_HIDDEN = enabled;
    try{ localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0"); }catch(_){ }
    installFilterHook();
    syncBodyState();
    syncButton();
    rebuildCatalog();
  }

  function installOption(){
    const list = document.querySelector("#catalogAdminConfig .catalog-admin-config-list");
    if(!list) return;

    let row = list.querySelector("[data-admin-hide-hidden-row]");
    if(!row){
      row = document.createElement("div");
      row.className = "catalog-admin-config-row";
      row.dataset.adminHideHiddenRow = "";
      row.innerHTML = `
        <div>
          <span class="catalog-admin-config-label">No mostrar ocultos</span>
          <span class="catalog-admin-config-help">Filtro exclusivo del modo administrador. Al activarlo no muestra secciones, categorías, subcategorías, líneas ni productos marcados como ocultos. No cambia ni elimina su estado de visibilidad.</span>
        </div>
        <button type="button" class="catalog-admin-switch" role="switch" aria-checked="false" data-admin-hide-hidden-toggle>DESACTIVADO</button>
      `;
      list.appendChild(row);

      row.querySelector("[data-admin-hide-hidden-toggle]")?.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        setEnabled(!enabled);
      });
    }

    syncButton();
  }

  let queued = false;
  function syncAll(){
    installFilterHook();
    syncBodyState();
    installOption();
  }

  const observer = new MutationObserver(() => {
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      syncAll();
    });
  });
  observer.observe(document.documentElement, {childList:true, subtree:true});

  window.setCatalogAdminHideHiddenEnabled = setEnabled;
  window.isCatalogAdminHideHiddenEnabled = () => enabled;

  setTimeout(syncAll, 0);
  window.addEventListener("load", syncAll, {once:true});
})();