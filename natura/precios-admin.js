// Administración del catálogo: precios, visibilidad y configuración.
(() => {
  const btn=document.getElementById("priceAdminBtn"), grid=document.getElementById("grid");
  if(!btn||!grid) return;
  const endpoint=String(window.PRECIOS_ADMIN_CONFIG?.endpoint||"").trim();
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)) return;
  const SHEET_ID=(()=>{try{return String(GOOGLE_SHEET_SOURCE?.spreadsheetId||"").trim()}catch(_){return "1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs"}})();
  const ADMIN_MODE_STORAGE_KEY="irenismb_admin_mode_active_v1";
  const rules=new Set();
  let admin=false, adminMissingPriceOnly=false, adminHideHidden=false, connecting=false, bridgeFrame=null, port=null, pendingChannel="", openAfterConnect=false, seq=0, configLoading=false, connectTimer=0;
  let adminSection="catalogo", navigationOrderDraft=[], navigationDragLevel="";
  let capabilities=new Set(["precio"]);
  const requests=new Map();
  const CONFIG_ITEMS=[
    {key:"REGISTRAR_VISITAS_PROPIAS",label:"Registrar mis propias visitas",help:"Incluye o excluye tus navegadores conocidos del registro de visitas y avisos."},
    {key:"MOSTRAR_CANTIDAD_STOCK",label:"Mostrar cantidad de stock",help:"Muestra al público la cantidad exacta cuando el stock es conocido."},
    {key:"MOSTRAR_PRECIOS_PRODUCTO",label:"Mostrar precios",help:"Muestra u oculta los precios de los productos en el catálogo."}
  ];
  const ADMIN_FILTER_ITEMS=[
    {key:"ADMIN_VER_PRODUCTOS_SIN_PRECIO",id:"sin-precio",label:"Ver productos sin precio",help:"Muestra únicamente productos del inventario cuyo Precio está vacío."},
    {key:"ADMIN_NO_MOSTRAR_OCULTOS",id:"no-ocultos",label:"No mostrar ocultos",help:"No muestra secciones, categorías, subcategorías, públicos, líneas ni productos marcados como ocultos. No cambia ni elimina su estado de visibilidad."}
  ];
  const adminFilterScopes=new Map();
  const adminLocalStates=new Map();
  const adminGlobalStates=new Map();
  const ADMIN_SCOPE_LOCAL="local", ADMIN_SCOPE_GLOBAL="global";
  const NAVIGATION_ORDER_KEY="ORDEN_NAVEGACION";
  const NAVIGATION_ORDER_DEFAULT=["category","subcategory","public","line"];
  const NAVIGATION_LABELS={category:"Categoría",subcategory:"Subcategoría",public:"Público",line:"Línea"};
  const ADMIN_SECTIONS=[
    {id:"catalogo",label:"Catálogo",icon:"⌂"},
    {id:"visibilidad",label:"Visibilidad",icon:"◉"},
    {id:"folleto",label:"Folleto",icon:"▤"},
    {id:"configuracion",label:"Configuración",icon:"⚙"}
  ];

  const css=document.createElement("style");
  css.textContent=`
  .card,.album-card{position:relative}.catalog-admin-vis{position:absolute;z-index:20;top:8px;right:8px}
  .album-card.catalog-admin-has-vis .album-card-top{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;grid-template-areas:"icon count" "icon vis";align-items:start!important;column-gap:14px!important;row-gap:7px!important}
  .album-card.catalog-admin-has-vis .album-icon{grid-area:icon}
  .album-card.catalog-admin-has-vis .album-count-badge{grid-area:count;justify-self:end}
  .album-card.catalog-admin-has-vis .catalog-admin-vis{grid-area:vis;position:static;z-index:auto;justify-self:end;max-width:100%}
  .album-card.catalog-admin-has-vis .catalog-admin-vis button{max-width:100%;padding:6px 9px;line-height:1.15;white-space:normal;text-align:center}
  .catalog-admin-vis button{border:1px solid #cdbdc0;border-radius:999px;padding:7px 10px;background:#fff;color:#4c3b3e;font:800 11px Arial;box-shadow:0 2px 10px #33222720;cursor:pointer}
  .catalog-admin-vis button.hidden{background:#ffe8ec;border-color:#d996a5;color:#8f263c}.catalog-admin-vis button.inherited{background:#f3f0f1;color:#71676a;cursor:not-allowed}.catalog-admin-vis button.mixed{background:#fff4d6;border-color:#d6b56a;color:#765719}
  .catalog-admin-hidden{outline:2px dashed #c75b72!important;outline-offset:-2px;opacity:.72}.catalog-admin-inherited{outline:2px dashed #9d9698!important;outline-offset:-2px;opacity:.72}
  .price-admin-editor{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:10px;row-gap:7px;flex:1 1 220px;min-width:0;width:100%}.price-admin-input{box-sizing:border-box;min-width:0;width:100%;height:40px;padding:8px;border:1px solid #d8c9c6;border-radius:10px;text-align:right;font:750 15px Arial}.price-admin-save{box-sizing:border-box;min-width:88px}.price-admin-status{grid-column:1/-1;font-size:11px;font-weight:750}.price-admin-status.ok{color:#176b3a}.price-admin-status.err{color:#a02323}
  .card .row.price-admin-active{align-items:flex-start;flex-wrap:wrap;gap:8px}#priceAdminBtn[aria-pressed="true"]{color:#8d5360!important;border-color:#cfa8b0!important;background:#f5e5e8!important}
  .catalog-admin-config{margin:14px 0 20px;padding:10px 12px;border:1px solid #e3d5d2;border-radius:18px;background:#fffaf9;box-shadow:0 8px 24px #5d35400d}
  .catalog-admin-config-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0}.catalog-admin-config-collapse{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;background:transparent;color:#352b2c;font:900 14px/1.2 Arial;cursor:pointer;padding:2px 0;text-align:left}.catalog-admin-config-collapse-state{color:#8d5360;font:800 11px Arial}.catalog-admin-config-body{padding-top:12px}.catalog-admin-config-body[hidden]{display:none!important}.catalog-admin-config-note{margin:0 0 12px;color:#78696b;font:13px/1.35 Arial}
  .catalog-admin-config-list{display:grid;gap:9px}.catalog-admin-config-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;padding:11px 12px;border:1px solid #eadfdd;border-radius:13px;background:#fff}
  .catalog-admin-config-label{display:block;color:#352b2c;font:850 14px/1.25 Arial}.catalog-admin-config-help{display:block;margin-top:3px;color:#827477;font:12px/1.3 Arial}
  .catalog-admin-switch{min-width:112px;border:1px solid #d8c9c6;border-radius:999px;padding:8px 12px;background:#fdebec;color:#9a2e43;font:900 11px Arial;cursor:pointer}.catalog-admin-switch[aria-checked="true"]{background:#e7f7ed;border-color:#a9d6b8;color:#176b3a}.catalog-admin-switch:disabled{opacity:.62;cursor:wait}
  .catalog-admin-filter-controls{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap}.catalog-admin-scope{display:inline-flex;gap:4px;padding:4px;border:1px solid #d9c2c7;border-radius:999px;background:#f8f0f2;box-shadow:inset 0 1px 0 #ffffffb8}.catalog-admin-scope-btn{border:1px solid transparent;border-radius:999px;padding:8px 12px;background:transparent;color:#6f6164;font:800 10px Arial;cursor:pointer;white-space:nowrap;transition:background .18s ease,border-color .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease}.catalog-admin-scope-btn .catalog-admin-scope-check{display:inline-block;width:1.05em;margin-right:4px;text-align:center;opacity:.42}.catalog-admin-scope-btn .catalog-admin-scope-text{display:inline-block}.catalog-admin-scope-btn[aria-pressed="true"]{background:#7f3e50;border-color:#7f3e50;color:#fff;box-shadow:0 2px 8px #4b2f3533;transform:translateY(-1px)}.catalog-admin-scope-btn[aria-pressed="true"] .catalog-admin-scope-check{opacity:1}.catalog-admin-scope-btn[aria-pressed="false"]{background:#fff;color:#6f6164;border-color:#e6d7d4}.catalog-admin-scope-btn[aria-pressed="false"] .catalog-admin-scope-check{opacity:0}.catalog-admin-scope-btn:disabled{opacity:.55;cursor:wait}
  .catalog-admin-config-status{margin:9px 1px 0;color:#78696b;font:12px/1.3 Arial}.catalog-admin-config-status.ok{color:#176b3a}.catalog-admin-config-status.err{color:#a02323}
  body.catalog-admin-hide-hidden-active #grid > .catalog-admin-hidden,body.catalog-admin-hide-hidden-active #grid > .catalog-admin-inherited{display:none!important}
  body.catalog-admin-mode{--admin-panel-bg:#f7f5f1;--admin-panel-card:#ffffff;--admin-panel-ink:#17312b;--admin-panel-muted:#6e7875;--admin-panel-line:#dfe5e1;--admin-panel-accent:#6d45b8;--admin-panel-green:#eaf2ed}
  body.catalog-admin-mode main.wrap{max-width:1320px;padding-left:236px;transition:padding .18s ease}
  .catalog-admin-sidebar{position:fixed;z-index:1450;left:16px;top:90px;width:204px;padding:14px;border:1px solid #dfe5e1;border-radius:22px;background:rgba(255,255,255,.96);box-shadow:0 14px 36px rgba(25,45,39,.12);backdrop-filter:blur(10px)}
  .catalog-admin-sidebar-title{margin:0 0 11px;padding:4px 7px;color:#65716e;font:800 11px/1.2 Arial;text-transform:uppercase;letter-spacing:.08em}
  .catalog-admin-nav{display:grid;gap:7px}.catalog-admin-nav-btn{display:grid;grid-template-columns:28px 1fr;align-items:center;gap:9px;width:100%;min-height:45px;padding:9px 11px;border:1px solid transparent;border-radius:13px;background:transparent;color:#24433b;font:850 13px/1.2 Arial;text-align:left;cursor:pointer}
  .catalog-admin-nav-btn:hover{background:#f4f5f1;border-color:#e5e8e3}.catalog-admin-nav-btn[aria-current="page"]{background:#f1ecfb;border-color:#ddd0f4;color:#633eaa}.catalog-admin-nav-icon{font-size:18px;text-align:center}.catalog-admin-sidebar-note{margin:12px 6px 2px;padding-top:11px;border-top:1px solid #e9ece8;color:#7b8582;font:11px/1.4 Arial}
  .catalog-admin-page{margin:14px 0 22px}.catalog-admin-page[hidden]{display:none!important}.catalog-admin-page-heading{margin:0 0 14px;color:#eef2f8;font:950 clamp(24px,3vw,34px)/1.08 var(--font-display,Arial)}
  .catalog-admin-config{margin:0;padding:0;border:0;background:transparent;box-shadow:none}.catalog-admin-config-head{display:none!important}.catalog-admin-config-body{padding:0}.catalog-admin-config-note{margin:0 0 14px;color:#6f7876;font:13px/1.45 Arial}
  .catalog-admin-card{margin:0 0 16px;padding:20px;border:1px solid var(--admin-panel-line);border-radius:20px;background:var(--admin-panel-card);box-shadow:0 12px 30px rgba(28,45,40,.08);color:var(--admin-panel-ink)}
  .catalog-admin-card h3{margin:0 0 6px;color:#182f2a;font:950 21px/1.2 Arial}.catalog-admin-card-copy{margin:0 0 16px;color:#6c7774;font:13px/1.5 Arial}
  .catalog-admin-config-list{display:grid;gap:9px}.catalog-admin-config-row{background:#fff;border-color:#e2e6e3}.catalog-admin-config-label{color:#213b34}.catalog-admin-config-help{color:#72807b}
  .catalog-admin-order-list{display:grid;gap:8px}.catalog-admin-order-row{display:grid;grid-template-columns:34px 38px minmax(0,1fr) auto;align-items:center;gap:8px;min-height:50px;padding:8px 12px;border:1px solid #dfe5e1;border-radius:12px;background:#fff;color:#203934;font:850 14px Arial}.catalog-admin-order-row.is-fixed{background:var(--admin-panel-green);color:#466158}.catalog-admin-order-handle{cursor:grab;color:#52645f;font-size:19px;line-height:1;user-select:none}.catalog-admin-order-row.dragging{opacity:.55}.catalog-admin-order-lock{color:#6c7d77;font-size:15px}.catalog-admin-order-actions{display:flex;gap:5px}.catalog-admin-order-move{width:31px;height:31px;padding:0;border:1px solid #d9dfdc;border-radius:9px;background:#fff;color:#4e5f5a;font:900 14px Arial}.catalog-admin-order-move:disabled{opacity:.3;cursor:not-allowed}
  .catalog-admin-order-help{display:flex;align-items:center;gap:7px;margin:10px 2px 0;color:#707a77;font:12px/1.35 Arial}.catalog-admin-order-preview-title{margin:18px 0 9px;padding-top:16px;border-top:1px solid #e8ece9;color:#1d3530;font:900 15px Arial}.catalog-admin-order-preview{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.catalog-admin-order-pill{padding:9px 12px;border-radius:11px;background:#f0ecfa;color:#403b53;font:800 12px Arial}.catalog-admin-order-pill.is-fixed{background:#eaf2ed;color:#304b43}.catalog-admin-order-arrow{color:#7f8986;font-weight:900}.catalog-admin-order-buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.catalog-admin-primary,.catalog-admin-secondary{min-height:42px;padding:9px 15px;border-radius:11px;font:900 12px Arial;cursor:pointer}.catalog-admin-primary{border:1px solid #6d45b8;background:#6d45b8;color:#fff}.catalog-admin-secondary{border:1px solid #ccd4d0;background:#fff;color:#334740}.catalog-admin-primary:disabled,.catalog-admin-secondary:disabled{opacity:.55;cursor:wait}
  .catalog-admin-folleto-host{margin:0 0 22px}.catalog-admin-folleto-intro{margin:0 0 14px;padding:14px 16px;border:1px solid #dfe5e1;border-radius:16px;background:#fff;color:#5f6d69;font:13px/1.45 Arial;box-shadow:0 8px 24px rgba(28,45,40,.06)}
  @media(max-width:900px){body.catalog-admin-mode main.wrap{padding-left:0}.catalog-admin-sidebar{position:sticky;top:8px;left:auto;width:auto;margin:8px 10px 12px;z-index:1450}.catalog-admin-nav{grid-template-columns:repeat(4,minmax(0,1fr))}.catalog-admin-nav-btn{grid-template-columns:1fr;text-align:center;gap:3px;padding:8px 4px}.catalog-admin-sidebar-title,.catalog-admin-sidebar-note{display:none}}
  @media(max-width:760px){.catalog-admin-config-row{grid-template-columns:1fr}.catalog-admin-filter-controls{justify-content:stretch}.catalog-admin-scope{display:grid;grid-template-columns:1fr 1fr;flex:1 1 220px}.catalog-admin-switch{width:100%}.catalog-admin-card{padding:15px}.catalog-admin-order-row{grid-template-columns:28px 30px minmax(0,1fr) auto;padding:7px 9px}.catalog-admin-page-heading{font-size:25px}}
  @media(max-width:380px){.price-admin-editor{grid-template-columns:1fr}.price-admin-save{width:100%}}
  `;
  document.head.appendChild(css);

  initializeAdminFilterPreferences();
  window.CATALOG_ADMIN_MODE_ACTIVE=false;
  window.CATALOG_ADMIN_MISSING_PRICE_ONLY=false;
  window.CATALOG_ADMIN_HIDE_HIDDEN=false;
  window.CATALOG_VISIBILITY_RULES=rules;
  window.filterVisibleProducts=list=>{
    const a=Array.isArray(list)?list:[];
    if(window.CATALOG_ADMIN_MODE_ACTIVE){
      let out=adminMissingPriceOnly?a.filter(p=>p&&!p.isGiftGalleryImage&&p.hasPrice===false):a.slice();
      if(adminHideHidden) out=out.filter(p=>!isHidden(p));
      return out;
    }
    return a.filter(p=>norm(p?.commercialStatus)!=="no a la venta"&&!isHidden(p));
  };

  btn.hidden=false; btn.textContent="Administrar"; btn.setAttribute("aria-pressed","false"); btn.setAttribute("aria-label","Administrar catálogo");
  btn.addEventListener("click",toggleAdmin);
  new MutationObserver(()=>requestAnimationFrame(syncUI)).observe(grid,{childList:true,subtree:true});
  window.addEventListener("message",onBridgeReady); window.addEventListener("beforeunload",closeBridge);

  loadRules().finally(()=>{
    rebuild();
    if(storageGet(ADMIN_MODE_STORAGE_KEY)==="1") connect();
  });

  function norm(v){return String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ")}
  function visibilityId(t,id){const type=norm(t),raw=String(id??"").trim();if(type==="producto"&&/^\d{1,4}$/.test(raw))return raw.padStart(4,"0");return norm(raw)}
  function key(t,id){return `${norm(t)}::${visibilityId(t,id)}`}
  function visibilityPathAtDepth(depth,...parts){return parts.slice(0,depth).map(norm).join("|")}
  function ids(p){
    const sec=norm(p?.section),c=norm(p?.category),s=norm(p?.subcategory),pub=norm(p?.public),line=norm(p?.line);
    return{
      sec,
      c:c?visibilityPathAtDepth(2,sec,c):"",
      s:s?visibilityPathAtDepth(3,sec,c,s):"",
      pub:pub?visibilityPathAtDepth(4,sec,c,s,pub):"",
      line:line?visibilityPathAtDepth(5,sec,c,s,pub,line):"",
      legacyCategory:c?norm(p?.category):"",
      legacySubcategory:sec&&c?visibilityPathAtDepth(2,sec,norm(p?.category)):"",
      legacyFamily:c&&s&&line?[norm(p?.category),s,line].join("|"):""
    }
  }
  function hasRule(type,id){return Boolean(id)&&rules.has(key(type,id))}
  function isHidden(p){
    if(!p)return false;
    const i=ids(p),code=visibilityId("producto",p.id||p.code||"");
    return (code&&hasRule("producto",code))||
      hasRule("seccion",i.sec)||
      hasRule("categoria",i.c)||
      hasRule("subcategoria",i.s)||
      hasRule("publico",i.pub)||
      hasRule("linea",i.line)||
      hasRule("categoria",i.sec)||
      hasRule("categoria",i.legacyCategory)||
      hasRule("subcategoria",i.legacySubcategory)||
      hasRule("familia",i.legacyFamily);
  }
  function isDirectProduct(p){return rules.has(key("producto",p?.id||p?.code||""))}
  function cell(c){return !c?"":c.f!=null?String(c.f):c.v!=null?String(c.v):""}
  function stateBool(v){return ["activado","activo","true","verdadero","si","1","on"].includes(norm(v))}

  function storageGet(key){try{return localStorage.getItem(key)}catch(_){return null}}
  function storageSet(key,value){try{localStorage.setItem(key,value)}catch(_){}}
  function storageRemove(key){try{localStorage.removeItem(key)}catch(_){}}
  function adminScopeKey(item){return `irenismb_admin_scope_${item.key.toLowerCase()}_v1`}
  function adminLocalKey(item){return `irenismb_admin_local_${item.key.toLowerCase()}_v1`}
  function initializeAdminFilterPreferences(){
    for(const item of ADMIN_FILTER_ITEMS){
      let scope=storageGet(adminScopeKey(item));
      let localRaw=storageGet(adminLocalKey(item));
      if(item.key==="ADMIN_NO_MOSTRAR_OCULTOS"&&scope===null){
        const legacy=storageGet("irenismb_admin_no_mostrar_ocultos_v1");
        if(legacy!==null){scope=ADMIN_SCOPE_LOCAL;localRaw=legacy;storageSet(adminScopeKey(item),scope);storageSet(adminLocalKey(item),legacy==="1"?"1":"0")}
      }
      adminFilterScopes.set(item.key,scope===ADMIN_SCOPE_LOCAL?ADMIN_SCOPE_LOCAL:ADMIN_SCOPE_GLOBAL);
      adminLocalStates.set(item.key,localRaw==="1");
      adminGlobalStates.set(item.key,false);
    }
  }
  function filterItem(key){return ADMIN_FILTER_ITEMS.find(item=>item.key===key)||null}
  function filterScope(item){return adminFilterScopes.get(item.key)===ADMIN_SCOPE_LOCAL?ADMIN_SCOPE_LOCAL:ADMIN_SCOPE_GLOBAL}
  function filterStateForScope(item){return filterScope(item)===ADMIN_SCOPE_LOCAL?!!adminLocalStates.get(item.key):!!adminGlobalStates.get(item.key)}
  function syncEffectiveAdminFilters(){
    const missing=filterItem("ADMIN_VER_PRODUCTOS_SIN_PRECIO"),hidden=filterItem("ADMIN_NO_MOSTRAR_OCULTOS");
    adminMissingPriceOnly=missing?filterStateForScope(missing):false;
    adminHideHidden=hidden?filterStateForScope(hidden):false;
    window.CATALOG_ADMIN_MISSING_PRICE_ONLY=adminMissingPriceOnly;
    window.CATALOG_ADMIN_HIDE_HIDDEN=adminHideHidden;
    document.body?.classList.toggle("catalog-admin-hide-hidden-active",!!admin&&adminHideHidden);
  }

  function loadRules(){return new Promise(resolve=>{
    if(!SHEET_ID){resolve();return} const cb="__vis_"+Date.now()+Math.random().toString(36).slice(2),s=document.createElement("script");let done=false;
    const finish=rows=>{if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch(_){window[cb]=undefined}s.remove();rules.clear();for(const r of rows||[]){if(!r[0]||!r[1])continue;const k=key(r[0],r[1]);["x","si","true","1","oculto"].includes(norm(r[2]))?rules.add(k):rules.delete(k)}resolve()};
    const timer=setTimeout(()=>finish([]),6000); window[cb]=p=>finish(p?.status==="ok"&&Array.isArray(p?.table?.rows)?p.table.rows.map(r=>(r.c||[]).map(cell)):[]); s.onerror=()=>finish([]);
    const q=new URLSearchParams({sheet:"Visibilidad",headers:"1",range:"A:E",tq:"select A,B,C,D,E",tqx:`out:json;responseHandler:${cb}`,_:String(Date.now())});
    s.src=`https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_ID)}/gviz/tq?${q}`;s.async=true;document.head.appendChild(s);
  })}
  function rebuild(){try{if(typeof rebuildCatalogVisibility==="function")rebuildCatalogVisibility();if(typeof refreshFilterOptionsForScope==="function")refreshFilterOptionsForScope();if(typeof render==="function")render()}catch(e){console.info(e)}requestAnimationFrame(syncUI)}

  function clearAdminDecorations(){
    grid.querySelectorAll(".catalog-admin-vis").forEach(x=>x.remove());
    grid.querySelectorAll(".catalog-admin-has-vis").forEach(x=>x.classList.remove("catalog-admin-has-vis"));
    grid.querySelectorAll(".catalog-admin-hidden,.catalog-admin-inherited").forEach(x=>x.classList.remove("catalog-admin-hidden","catalog-admin-inherited"));
    grid.querySelectorAll(".card").forEach(removePrice);
  }
  function ensureAdminSidebar(){
    let aside=document.getElementById("catalogAdminSidebar");
    if(aside) return aside;
    aside=document.createElement("aside");
    aside.id="catalogAdminSidebar";aside.className="catalog-admin-sidebar";aside.setAttribute("aria-label","Administración del catálogo");
    aside.innerHTML=`<div class="catalog-admin-sidebar-title">Administración</div><nav class="catalog-admin-nav">${ADMIN_SECTIONS.map(item=>`<button type="button" class="catalog-admin-nav-btn" data-admin-section="${item.id}"><span class="catalog-admin-nav-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span></button>`).join("")}</nav><p class="catalog-admin-sidebar-note">Los cambios de Configuración se guardan en Google y se aplican al catálogo administrativo y público.</p>`;
    aside.addEventListener("click",event=>{const b=event.target.closest("[data-admin-section]");if(b)setCatalogAdminSection(b.dataset.adminSection)});
    document.body.appendChild(aside);
    return aside;
  }
  function ensureFolletoPage(){
    let page=document.getElementById("catalogAdminFolletoPage");
    if(page) return page;
    page=document.createElement("section");page.id="catalogAdminFolletoPage";page.className="catalog-admin-page";page.hidden=true;
    page.innerHTML=`<h2 class="catalog-admin-page-heading">Folleto</h2><p class="catalog-admin-folleto-intro">Crea material comercial a partir de la vista actual del catálogo. El folleto respeta el mismo orden de navegación configurado y permite elegir tipo, formato, productos y opciones para compartir.</p><div class="catalog-admin-folleto-host" id="catalogAdminFolletoHost"></div>`;
    grid.insertAdjacentElement("beforebegin",page);
    return page;
  }
  function syncAdminSectionUI(emit=false){
    if(!admin) return;
    document.body.classList.add("catalog-admin-mode");
    const aside=ensureAdminSidebar();
    const config=capabilities.has("configuracion")?ensureConfigPanel():null;
    const folleto=ensureFolletoPage();
    aside.querySelectorAll("[data-admin-section]").forEach(b=>b.setAttribute("aria-current",b.dataset.adminSection===adminSection?"page":"false"));
    const showGrid=adminSection==="catalogo"||adminSection==="visibilidad";
    grid.hidden=!showGrid;
    const topline=document.getElementById("topline");if(topline)topline.hidden=!showGrid;
    const albumHost=document.getElementById("albumNavHost");if(albumHost)albumHost.hidden=!showGrid;
    if(config) config.hidden=adminSection!=="configuracion";
    folleto.hidden=adminSection!=="folleto";
    clearAdminDecorations();
    if(adminSection==="catalogo") installPrices();
    else if(adminSection==="visibilidad") installVisibility();
    if(emit) window.dispatchEvent(new CustomEvent("irenismb:admin-section-change",{detail:{section:adminSection}}));
  }
  function setCatalogAdminSection(section){
    const next=ADMIN_SECTIONS.some(item=>item.id===section)?section:"catalogo";
    const changed=next!==adminSection;
    adminSection=next;window.CATALOG_ADMIN_SECTION=adminSection;
    syncAdminSectionUI(changed||next==="folleto");
    if(next==="configuracion"&&capabilities.has("configuracion")) loadAdminConfig();
  }
  window.setCatalogAdminSection=setCatalogAdminSection;
  window.CATALOG_ADMIN_SECTION=adminSection;
  function syncUI(){btn.hidden=false;btn.disabled=connecting;btn.title=admin?"Salir del modo administrador":"Administrar catálogo";if(!admin)return;syncAdminSectionUI(false)}

  function toggleAdmin(){if(admin){stopAdmin();return} if(port&&bridgeFrame?.isConnected){startAdmin();return} connect()}
  function connect(){
    if(connecting)return;
    const catalogOrigin=String(window.location.origin||"").trim();
    if(window.location.protocol==="file:"||!catalogOrigin||catalogOrigin==="null"){
      alert("La administración no funciona abriendo catalogo.html directamente como archivo. Inicia el catálogo con un servidor local (localhost o 127.0.0.1) o usa la versión publicada.");
      return;
    }
    const allowedCatalogOrigin=catalogOrigin==="https://irenismb.github.io"||/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(catalogOrigin);
    if(!allowedCatalogOrigin){
      alert("Este origen no está autorizado para administrar el catálogo. Usa la versión publicada o un servidor local en localhost/127.0.0.1.");
      return;
    }
    connecting=true;openAfterConnect=true;btn.textContent="Conectando…";pendingChannel=randomChannel();
    closeBridge({keepButton:true,keepConnecting:true,keepPending:true});
    const u=new URL(endpoint);u.searchParams.set("modo","puente");u.searchParams.set("canal",pendingChannel);u.searchParams.set("origen",catalogOrigin);
    bridgeFrame=document.createElement("iframe");
    bridgeFrame.title="Conexión segura con Google";
    bridgeFrame.tabIndex=-1;
    bridgeFrame.setAttribute("aria-hidden","true");
    bridgeFrame.style.cssText="position:fixed!important;left:-10000px!important;top:-10000px!important;width:1px!important;height:1px!important;border:0!important;opacity:0!important;pointer-events:none!important;";
    bridgeFrame.src=u.toString();
    document.body.appendChild(bridgeFrame);
    clearTimeout(connectTimer);
    connectTimer=setTimeout(()=>{
      if(!connecting)return;
      connecting=false;openAfterConnect=false;pendingChannel="";btn.textContent="Administrar";closeBridge({keepButton:true});
      alert("No fue posible validar la administración con Google en segundo plano. Si estás en local, verifica que abriste el catálogo desde localhost o 127.0.0.1 (no como file://). También comprueba que tienes la sesión de Google iniciada y que esta aplicación ya está autorizada.");
    },15000);
  }
  function randomChannel(){const b=new Uint8Array(24);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,"0")).join("")}
  function trusted(o){return o==="https://script.google.com"||/^https:\/\/[a-z0-9.-]*googleusercontent\.com$/i.test(o)}
  function onBridgeReady(e){const m=e.data||{};if(m.tipo!=="irenismb-precios-puente-listo"||!trusted(e.origin)||m.canal!==pendingChannel||!e.ports?.[0])return;clearTimeout(connectTimer);connectTimer=0;try{port?.close()}catch(_){}port=e.ports[0];port.onmessage=onReply;port.start();capabilities=new Set(Array.isArray(m.capacidades)?m.capacidades.map(norm):["precio"]);pendingChannel="";connecting=false;btn.textContent="Administrar";if(openAfterConnect)startAdmin();openAfterConnect=false}
  function startAdmin(){admin=true;storageSet(ADMIN_MODE_STORAGE_KEY,"1");window.CATALOG_ADMIN_MODE_ACTIVE=true;adminSection=String(window.CATALOG_ADMIN_SECTION||"catalogo");syncEffectiveAdminFilters();btn.textContent="Salir de administración";btn.setAttribute("aria-pressed","true");ensureAdminSidebar();syncAdminTools();rebuild();if(capabilities.has("configuracion"))loadAdminConfig();setCatalogAdminSection(adminSection)}
  function stopAdmin(){admin=false;storageRemove(ADMIN_MODE_STORAGE_KEY);window.CATALOG_ADMIN_MODE_ACTIVE=false;syncEffectiveAdminFilters();btn.textContent="Administrar";btn.setAttribute("aria-pressed","false");window.dispatchEvent(new CustomEvent("irenismb:admin-section-change",{detail:{section:"catalogo"}}));syncAdminTools();removeAdminUI();rebuild()}
  function syncAdminTools(){try{if(typeof syncAdministrativeToolVisibility==="function")syncAdministrativeToolVisibility()}catch(e){console.info(e)}}
  function removeAdminUI(){clearAdminDecorations();document.getElementById("catalogAdminConfig")?.remove();document.getElementById("catalogAdminFolletoPage")?.remove();document.getElementById("catalogAdminSidebar")?.remove();document.body.classList.remove("catalog-admin-mode");grid.hidden=false;const topline=document.getElementById("topline");if(topline)topline.hidden=false;const albumHost=document.getElementById("albumNavHost");if(albumHost)albumHost.hidden=false}

  function normalizeNavigationOrder(value){
    const alias={category:"category",categoria:"category",subcategory:"subcategory",subcategoria:"subcategory",public:"public",publico:"public",line:"line",linea:"line"};
    const source=Array.isArray(value)?value:String(value||"").split(",");
    const normalized=source.map(item=>alias[norm(item).replace(/\s+/g,"")]||"").filter(Boolean);
    if(normalized.length!==NAVIGATION_ORDER_DEFAULT.length||new Set(normalized).size!==NAVIGATION_ORDER_DEFAULT.length)return NAVIGATION_ORDER_DEFAULT.slice();
    if(!NAVIGATION_ORDER_DEFAULT.every(level=>normalized.includes(level)))return NAVIGATION_ORDER_DEFAULT.slice();
    return normalized;
  }
  function effectiveNavigationOrder(values=null){
    const raw=values&&typeof values==="object"?values[NAVIGATION_ORDER_KEY]:null;
    if(raw)return normalizeNavigationOrder(raw);
    if(typeof window.getCatalogNavigationOrder==="function")return normalizeNavigationOrder(window.getCatalogNavigationOrder());
    return normalizeNavigationOrder(window.REMOTE_CONTROL_VALUES?.[NAVIGATION_ORDER_KEY]||NAVIGATION_ORDER_DEFAULT);
  }
  function renderNavigationOrderEditor(){
    const list=document.getElementById("catalogAdminOrderList"),preview=document.getElementById("catalogAdminOrderPreview");
    if(!list||!preview)return;
    const order=normalizeNavigationOrder(navigationOrderDraft.length?navigationOrderDraft:effectiveNavigationOrder());
    navigationOrderDraft=order.slice();
    const rows=[
      `<div class="catalog-admin-order-row is-fixed"><span class="catalog-admin-order-lock" aria-hidden="true">🔒</span><span>1.</span><span>Sección</span><span></span></div>`,
      ...order.map((level,index)=>`<div class="catalog-admin-order-row" draggable="true" data-nav-order-item="${level}"><span class="catalog-admin-order-handle" aria-hidden="true">⋮⋮</span><span>${index+2}.</span><span>${NAVIGATION_LABELS[level]}</span><span class="catalog-admin-order-actions"><button type="button" class="catalog-admin-order-move" data-nav-order-move="up" data-nav-order-level="${level}" aria-label="Subir ${NAVIGATION_LABELS[level]}" ${index===0?"disabled":""}>↑</button><button type="button" class="catalog-admin-order-move" data-nav-order-move="down" data-nav-order-level="${level}" aria-label="Bajar ${NAVIGATION_LABELS[level]}" ${index===order.length-1?"disabled":""}>↓</button></span></div>`),
      `<div class="catalog-admin-order-row is-fixed"><span class="catalog-admin-order-lock" aria-hidden="true">🔒</span><span>6.</span><span>Producto</span><span></span></div>`
    ];
    list.innerHTML=rows.join("");
    const previewItems=["Sección",...order.map(level=>NAVIGATION_LABELS[level]),"Producto"];
    preview.innerHTML=previewItems.map((label,index)=>`${index?'<span class="catalog-admin-order-arrow" aria-hidden="true">→</span>':''}<span class="catalog-admin-order-pill ${index===0||index===previewItems.length-1?'is-fixed':''}">${label}</span>`).join("");
  }
  function moveNavigationOrder(level,direction){
    const order=normalizeNavigationOrder(navigationOrderDraft);
    const index=order.indexOf(level),next=index+(direction==="up"?-1:1);
    if(index<0||next<0||next>=order.length)return;
    [order[index],order[next]]=[order[next],order[index]];
    navigationOrderDraft=order;renderNavigationOrderEditor();setConfigStatus("Orden modificado. Pulsa Guardar orden para aplicarlo.");
  }
  async function saveNavigationOrder(){
    const save=document.getElementById("catalogAdminOrderSave"),reset=document.getElementById("catalogAdminOrderReset");
    if(save)save.disabled=true;if(reset)reset.disabled=true;setConfigStatus("Guardando orden de navegación…");
    try{
      const order=normalizeNavigationOrder(navigationOrderDraft);
      const r=await request({tipo:"actualizar-orden-navegacion",orden:order.join(",")});
      applyConfigValues(r?.valores||{[NAVIGATION_ORDER_KEY]:r?.orden||order.join(",")},true);
      setConfigStatus("Orden de navegación guardado en Google y aplicado al catálogo.","ok");
    }catch(e){setConfigStatus(e.message||"No se pudo guardar el orden de navegación.","err")}
    finally{if(save)save.disabled=false;if(reset)reset.disabled=false}
  }
  function resetNavigationOrderDraft(){navigationOrderDraft=NAVIGATION_ORDER_DEFAULT.slice();renderNavigationOrderEditor();setConfigStatus("Orden predeterminado preparado. Pulsa Guardar orden para aplicarlo.")}

  function ensureConfigPanel(){
    let panel=document.getElementById("catalogAdminConfig");
    if(panel){renderAdminFilterRows();renderNavigationOrderEditor();return panel}
    panel=document.createElement("section");panel.id="catalogAdminConfig";panel.className="catalog-admin-config catalog-admin-page";panel.hidden=true;panel.setAttribute("aria-label","Configuración del catálogo");
    const rows=CONFIG_ITEMS.map(item=>`<div class="catalog-admin-config-row" data-config-key="${item.key}"><div><span class="catalog-admin-config-label">${item.label}</span><span class="catalog-admin-config-help">${item.help}</span></div><button type="button" class="catalog-admin-switch" role="switch" aria-checked="false" data-config-toggle="${item.key}">Cargando…</button></div>`).join("");
    const adminRows=ADMIN_FILTER_ITEMS.map(item=>`<div class="catalog-admin-config-row" data-admin-filter-key="${item.key}"><div><span class="catalog-admin-config-label">${item.label}</span><span class="catalog-admin-config-help">${item.help}</span></div><div class="catalog-admin-filter-controls"><div class="catalog-admin-scope" role="group" aria-label="Alcance de ${item.label}"><button type="button" class="catalog-admin-scope-btn" data-admin-filter-scope="local" data-admin-filter-scope-label="Solo este dispositivo" data-admin-filter-key="${item.key}" aria-pressed="false"><span class="catalog-admin-scope-check" aria-hidden="true">✓</span><span class="catalog-admin-scope-text">Solo este dispositivo</span></button><button type="button" class="catalog-admin-scope-btn" data-admin-filter-scope="global" data-admin-filter-scope-label="Todos los administradores" data-admin-filter-key="${item.key}" aria-pressed="false"><span class="catalog-admin-scope-check" aria-hidden="true">✓</span><span class="catalog-admin-scope-text">Todos los administradores</span></button></div><button type="button" class="catalog-admin-switch" role="switch" aria-checked="false" data-admin-filter-toggle="${item.key}">DESACTIVADO</button></div></div>`).join("");
    panel.innerHTML=`<button type="button" data-admin-config-collapse aria-expanded="true" hidden></button><h2 class="catalog-admin-page-heading">Configuración</h2><div class="catalog-admin-config-body" id="catalogAdminConfigBody"><section class="catalog-admin-card"><h3>Orden de navegación</h3><p class="catalog-admin-card-copy">Define el orden de los niveles del catálogo. Sección permanece fija al inicio y Producto al final. Arrastra las filas intermedias o usa las flechas para cambiar su posición.</p><div class="catalog-admin-order-list" id="catalogAdminOrderList"></div><p class="catalog-admin-order-help"><span aria-hidden="true">ⓘ</span><span>El mismo orden se aplica al catálogo, Visibilidad y Folleto.</span></p><div class="catalog-admin-order-preview-title">Vista previa del árbol</div><div class="catalog-admin-order-preview" id="catalogAdminOrderPreview"></div><div class="catalog-admin-order-buttons"><button type="button" class="catalog-admin-primary" id="catalogAdminOrderSave">Guardar orden</button><button type="button" class="catalog-admin-secondary" id="catalogAdminOrderReset">Restablecer orden predeterminado</button></div></section><section class="catalog-admin-card"><h3>Preferencias del catálogo</h3><p class="catalog-admin-card-copy">Los controles públicos se guardan en Google. Los filtros administrativos pueden ser locales para este dispositivo o globales para todos los administradores.</p><div class="catalog-admin-config-list">${rows}${adminRows}</div></section><p class="catalog-admin-config-status" id="catalogAdminConfigStatus" role="status" aria-live="polite"></p></div>`;
    panel.addEventListener("click",e=>{
      const move=e.target.closest("[data-nav-order-move]");if(move&&!move.disabled){moveNavigationOrder(move.dataset.navOrderLevel,move.dataset.navOrderMove);return}
      if(e.target.closest("#catalogAdminOrderSave")){saveNavigationOrder();return}
      if(e.target.closest("#catalogAdminOrderReset")){resetNavigationOrderDraft();return}
      const scope=e.target.closest("[data-admin-filter-scope]");if(scope&&!scope.disabled){setAdminFilterScope(scope);return}
      const filterToggle=e.target.closest("[data-admin-filter-toggle]");if(filterToggle&&!filterToggle.disabled){toggleAdminFilter(filterToggle);return}
      const b=e.target.closest("[data-config-toggle]");if(b&&!b.disabled)saveConfigToggle(b)
    });
    panel.addEventListener("dragstart",e=>{const row=e.target.closest("[data-nav-order-item]");if(!row)return;navigationDragLevel=row.dataset.navOrderItem||"";row.classList.add("dragging");if(e.dataTransfer)e.dataTransfer.effectAllowed="move"});
    panel.addEventListener("dragend",e=>{e.target.closest("[data-nav-order-item]")?.classList.remove("dragging");navigationDragLevel=""});
    panel.addEventListener("dragover",e=>{if(navigationDragLevel&&e.target.closest("[data-nav-order-item]")){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect="move"}});
    panel.addEventListener("drop",e=>{const row=e.target.closest("[data-nav-order-item]");if(!row||!navigationDragLevel)return;e.preventDefault();const target=row.dataset.navOrderItem;if(!target||target===navigationDragLevel)return;const order=normalizeNavigationOrder(navigationOrderDraft),from=order.indexOf(navigationDragLevel),to=order.indexOf(target);if(from<0||to<0)return;order.splice(to,0,order.splice(from,1)[0]);navigationOrderDraft=order;renderNavigationOrderEditor();setConfigStatus("Orden modificado. Pulsa Guardar orden para aplicarlo.")});
    grid.insertAdjacentElement("beforebegin",panel);navigationOrderDraft=effectiveNavigationOrder();renderNavigationOrderEditor();renderAdminFilterRows();return panel;
  }
  function renderAdminFilterRows(){
    for(const item of ADMIN_FILTER_ITEMS){
      const row=document.querySelector(`[data-admin-filter-key="${item.key}"]`);if(!row)continue;
      const scope=filterScope(item),toggle=row.querySelector(`[data-admin-filter-toggle="${item.key}"]`);
      row.querySelectorAll(`[data-admin-filter-scope][data-admin-filter-key="${item.key}"]`).forEach(b=>{const active=b.dataset.adminFilterScope===scope;const label=String(b.dataset.adminFilterScopeLabel||b.textContent||"").trim();b.setAttribute("aria-pressed",active?"true":"false");b.setAttribute("aria-label",active?`${label} (seleccionado)`:label);b.title=active?`${label} · seleccionado`:label;const text=b.querySelector(".catalog-admin-scope-text");if(text)text.textContent=label;b.disabled=false});
      if(toggle){const active=filterStateForScope(item);toggle.disabled=scope===ADMIN_SCOPE_GLOBAL&&configLoading;toggle.setAttribute("aria-checked",active?"true":"false");toggle.textContent=toggle.disabled?"Cargando…":(active?"ACTIVADO":"DESACTIVADO")}
    }
  }
  function setAdminFilterScope(button){
    const item=filterItem(String(button.dataset.adminFilterKey||"").trim().toUpperCase());if(!item)return;
    const scope=button.dataset.adminFilterScope===ADMIN_SCOPE_LOCAL?ADMIN_SCOPE_LOCAL:ADMIN_SCOPE_GLOBAL;adminFilterScopes.set(item.key,scope);storageSet(adminScopeKey(item),scope);syncEffectiveAdminFilters();renderAdminFilterRows();rebuild();
  }
  async function toggleAdminFilter(button){
    const item=filterItem(String(button.dataset.adminFilterToggle||"").trim().toUpperCase());if(!item)return;
    const scope=filterScope(item),next=!filterStateForScope(item);
    if(scope===ADMIN_SCOPE_LOCAL){adminLocalStates.set(item.key,next);storageSet(adminLocalKey(item),next?"1":"0");syncEffectiveAdminFilters();renderAdminFilterRows();rebuild();return}
    button.disabled=true;const old=button.textContent;button.textContent="Guardando…";setConfigStatus("");
    try{const r=await request({tipo:"actualizar-configuracion",clave:item.key,activado:next});applyConfigValues(r?.valores||{[item.key]:r?.estado||(next?"ACTIVADO":"DESACTIVADO")},true);setConfigStatus("Preferencia compartida guardada.","ok")}catch(e){button.disabled=false;button.textContent=old;setConfigStatus(e.message||"No se pudo guardar la preferencia compartida.","err")}
  }
  function setConfigStatus(text,cls=""){const el=document.getElementById("catalogAdminConfigStatus");if(!el)return;el.textContent=text||"";el.className="catalog-admin-config-status"+(cls?" "+cls:"")}
  function renderConfigValues(values){
    const source=values&&typeof values==="object"?values:{};
    for(const item of CONFIG_ITEMS){const button=document.querySelector(`[data-config-toggle="${item.key}"]`);if(!button)continue;const raw=String(source[item.key]??window.REMOTE_CONTROL_VALUES?.[item.key]??"");const active=stateBool(raw);button.disabled=false;button.setAttribute("aria-checked",active?"true":"false");button.textContent=active?"ACTIVADO":"DESACTIVADO"}
    navigationOrderDraft=effectiveNavigationOrder(source);renderNavigationOrderEditor();
  }
  function applyConfigValues(values,shouldRebuild=true){
    if(!values||typeof values!=="object")return;
    window.REMOTE_CONTROL_VALUES=window.REMOTE_CONTROL_VALUES||{};
    for(const [rawKey,rawState] of Object.entries(values)){const k=String(rawKey||"").trim().toUpperCase();if(!k)continue;window.REMOTE_CONTROL_VALUES[k]=String(rawState??"");if(k===NAVIGATION_ORDER_KEY){navigationOrderDraft=normalizeNavigationOrder(rawState);try{window.applyCatalogNavigationOrder?.(navigationOrderDraft,{rebuild:false})}catch(e){console.info(e)}continue}if(["MOSTRAR_CANTIDAD_STOCK","MOSTRAR_PRECIOS_PRODUCTO"].includes(k)&&window.INTERRUPTORES)window.INTERRUPTORES[k]=stateBool(rawState);if(ADMIN_FILTER_ITEMS.some(item=>item.key===k))adminGlobalStates.set(k,stateBool(rawState))}
    syncEffectiveAdminFilters();renderConfigValues(values);renderAdminFilterRows();
    try{if(typeof syncAdministrativeToolVisibility==="function")syncAdministrativeToolVisibility()}catch(e){console.info(e)}
    if(shouldRebuild){try{if(typeof rebuildCatalogVisibility==="function")rebuildCatalogVisibility();else if(typeof render==="function")render();if(typeof renderCartModal==="function"&&document.getElementById("cartModal")?.classList.contains("open"))renderCartModal();requestAnimationFrame(()=>syncAdminSectionUI(false))}catch(e){console.info(e)}}
  }
  async function loadAdminConfig(){
    if(configLoading||!admin||!capabilities.has("configuracion"))return;configLoading=true;ensureConfigPanel();setConfigStatus("Cargando configuración…");document.querySelectorAll("[data-config-toggle]").forEach(b=>b.disabled=true);renderAdminFilterRows();
    try{const r=await request({tipo:"obtener-configuracion"});applyConfigValues(r?.valores||{},false);setConfigStatus("Configuración actualizada desde Google.","ok")}catch(e){renderConfigValues(window.REMOTE_CONTROL_VALUES||{});setConfigStatus(e.message||"No se pudo cargar la configuración.","err")}finally{configLoading=false;renderAdminFilterRows()}
  }
  async function saveConfigToggle(button){
    const k=String(button.dataset.configToggle||"").trim().toUpperCase(),current=button.getAttribute("aria-checked")==="true",next=!current;button.disabled=true;const old=button.textContent;button.textContent="Guardando…";setConfigStatus("");
    try{const r=await request({tipo:"actualizar-configuracion",clave:k,activado:next});applyConfigValues(r?.valores||{[k]:r?.estado|| (next?"ACTIVADO":"DESACTIVADO")},true);setConfigStatus("Cambio guardado.","ok")}catch(e){button.disabled=false;button.textContent=old;setConfigStatus(e.message||"No se pudo guardar el cambio.","err")}
  }

  function installVisibility(){if(!capabilities.has("visibilidad"))return;grid.querySelectorAll(":scope > .card:not(.album-card)").forEach(productVis);grid.querySelectorAll(":scope > .album-card").forEach(albumVis)}
  function productObj(code){try{return productById?.get?.(code)||allLoadedProducts?.find?.(p=>String(p?.id||"")===code)||null}catch(_){return null}}
  function mark(card,direct,inherited){card.classList.toggle("catalog-admin-hidden",!!direct);card.classList.toggle("catalog-admin-inherited",!!inherited)}
  function productVis(card){if(card.querySelector(".catalog-admin-vis"))return;const code=visibilityId("producto",card.dataset.id||""),p=productObj(code);if(!/^\d{4}$/.test(code)||!p)return;const direct=isDirectProduct(p),inherited=isHidden(p)&&!direct;mark(card,direct,inherited);addVisButton(card,inherited?null:{tipo:"producto",id:code,label:String(p.name||code),hidden:direct},inherited)}
  function albumInfo(card){
    const opener=card.querySelector("[data-album-open]");if(!opener)return null;
    const albumKey=String(opener.dataset.albumOpen||"").trim();
    const label=String(card.querySelector(".album-label")?.textContent||"").trim();
    let album=null;
    try{album=window.getCatalogAlbumByKey?.(albumKey)||null}catch(_){album=null}
    if(!album)return null;
    const navType=norm(album.navType||"");
    const typeMap={section:"seccion",category:"categoria",subcategory:"subcategoria",public:"publico",line:"linea"};
    const tipo=typeMap[navType];if(!tipo)return null;
    const products=Array.isArray(album.products)?album.products.filter(Boolean):[];
    const targets=[];const seen=new Set();
    for(const product of products){
      const i=ids(product);let id="";
      if(navType==="section")id=i.sec;
      else if(navType==="category")id=i.c;
      else if(navType==="subcategory")id=i.s;
      else if(navType==="public")id=i.pub;
      else if(navType==="line")id=i.line;
      if(!id)continue;
      const k=key(tipo,id);if(seen.has(k))continue;seen.add(k);targets.push({tipo,id,label:label||String(album.navValue||id)});
    }
    return{tipo,label:label||String(album.navValue||""),targets,products};
  }
  function albumVis(card){
    if(card.querySelector(".catalog-admin-vis"))return;
    const info=albumInfo(card);if(!info||!info.targets.length)return;
    const directCount=info.targets.reduce((n,t)=>n+(rules.has(key(t.tipo,t.id))?1:0),0);
    const allDirect=directCount===info.targets.length;
    const mixed=directCount>0&&!allDirect;
    const inherited=!directCount&&info.products.length>0&&info.products.every(p=>isHidden(p));
    mark(card,allDirect,inherited||mixed);
    if(inherited){addVisButton(card,null,true);return}
    addVisButton(card,{...info,hidden:allDirect,mixed},false);
  }
  function addVisButton(card,info,inherited){
    const w=document.createElement("div"),b=document.createElement("button");w.className="catalog-admin-vis";b.type="button";
    if(inherited){b.textContent="Oculto por otra regla";b.className="inherited";b.disabled=true}
    else{
      b.textContent=info.mixed?"Visibilidad mixta":(info.hidden?"Oculto":"Visible");
      b.className=info.hidden?"hidden":(info.mixed?"mixed":"");
      b.title=info.hidden?`Mostrar ${info.label}`:`Ocultar ${info.label}`;
      b.onclick=e=>{e.preventDefault();e.stopPropagation();saveVisibility(info,b)};
    }
    w.appendChild(b);if(card.classList.contains("album-card")){card.classList.add("catalog-admin-has-vis");const top=card.querySelector(".album-card-top");(top||card).appendChild(w)}else{card.appendChild(w)}
  }
  async function saveVisibility(info,b){
    b.disabled=true;const old=b.textContent;b.textContent="Guardando…";
    const targets=Array.isArray(info.targets)&&info.targets.length?info.targets:[{tipo:info.tipo,id:info.id,label:info.label}];
    const ocultoNuevo=info.hidden?false:true;
    try{
      for(const target of targets){
        const r=await request({tipo:"actualizar-visibilidad",tipoRegla:target.tipo,identificador:target.id,etiqueta:target.label||info.label,ocultoNuevo});
        const k=key(target.tipo,r?.identificador||target.id);r?.oculto?rules.add(k):rules.delete(k);
      }
      rebuild();
    }catch(e){b.disabled=false;b.textContent=old;alert(e.message||"No se pudo guardar la visibilidad.")}
  }

  function installPrices(){grid.querySelectorAll(":scope > .card:not(.album-card)").forEach(addPrice)}
  function addPrice(card){if(card.querySelector(".price-admin-editor"))return;const price=card.querySelector(".price"),row=card.querySelector(".row"),code=visibilityId("producto",card.dataset.id||"");if(!price||!row||!/^\d{4}$/.test(code))return;const p=productObj(code),prev=p&&p.hasPrice!==false?String(Number(p.price)||""):priceValue(price.textContent),ed=document.createElement("div"),inp=document.createElement("input"),save=document.createElement("button"),st=document.createElement("span");ed.className="price-admin-editor";ed.dataset.prev=prev;inp.className="price-admin-input";inp.inputMode="numeric";inp.value=editable(prev);save.className="btn-acc price-admin-save";save.textContent="Guardar";save.disabled=true;st.className="price-admin-status";inp.oninput=()=>save.disabled=!validPrice(inp.value)||priceValue(inp.value)===ed.dataset.prev;inp.onkeydown=e=>{if(e.key!=="Enter"||e.isComposing)return;e.preventDefault();if(inp.disabled)return;if(!validPrice(inp.value)){status(st,"Precio inválido","err");return}if(priceValue(inp.value)===ed.dataset.prev)return;savePrice(card,price,ed,inp,save,st)};save.onclick=()=>savePrice(card,price,ed,inp,save,st);ed.append(inp,save,st);price.hidden=true;row.classList.add("price-admin-active");price.insertAdjacentElement("afterend",ed)}
  function removePrice(card){const p=card.querySelector(".price"),r=card.querySelector(".row");card.querySelector(".price-admin-editor")?.remove();if(p)p.hidden=false;r?.classList.remove("price-admin-active")}
  async function savePrice(card,price,ed,inp,save,st){const v=priceValue(inp.value);if(inp.value.trim()&&!validPrice(inp.value)){status(st,"Precio inválido","err");return}inp.disabled=save.disabled=true;save.textContent="Guardando…";try{const code=visibilityId("producto",card.dataset.id||""),r=await request({tipo:"actualizar-precio",codigo:code,precioNuevo:v,precioAnterior:ed.dataset.prev});const g=priceValue(r?.precioGuardado);ed.dataset.prev=g;inp.value=editable(g);const p=productObj(code);if(p){p.price=g?Number(g):0;p.hasPrice=!!g}price.textContent=window.INTERRUPTORES?.MOSTRAR_PRECIOS_PRODUCTO!==false?(g?"$ "+new Intl.NumberFormat("es-CO").format(Number(g)):"Consultar precio"):"";status(st,"Precio guardado","ok");if(adminMissingPriceOnly&&p?.hasPrice)setTimeout(rebuild,0)}catch(e){status(st,e.message||"No se pudo guardar","err")}finally{inp.disabled=false;save.textContent="Guardar";save.disabled=priceValue(inp.value)===ed.dataset.prev}}
  function validPrice(v){const t=String(v??"").trim();if(!t)return true;if(!/^(?:\d+|\d{1,3}(?:[.\s]\d{3})+)$/.test(t))return false;const n=Number(t.replace(/[.\s]/g,""));return Number.isSafeInteger(n)&&n>0}
  function priceValue(v){const t=String(v??"").trim();if(!t||/^Consultar precio$/i.test(t))return"";const d=t.replace(/[^\d]/g,"");return d?String(Number(d)):""}
  function editable(v){return v?new Intl.NumberFormat("es-CO").format(Number(v)):""} function status(el,t,c){el.textContent=t;el.className="price-admin-status "+(c||"")}

  function request(data){return new Promise((resolve,reject)=>{if(!port||!bridgeFrame?.isConnected){reject(new Error("La conexión con Google se cerró."));return}const prefix=data.tipo==="actualizar-visibilidad"?"vis":(data.tipo?.includes("configuracion")||data.tipo?.includes("orden-navegacion"))?"cfg":"price",id=prefix+"-"+Date.now()+"-"+(++seq),timer=setTimeout(()=>{requests.delete(id);reject(new Error("Google tardó demasiado en responder."))},45000);requests.set(id,{resolve,reject,timer});port.postMessage({...data,solicitudId:id})})}
  function onReply(e){const m=e.data||{},p=requests.get(m.solicitudId);if(!p)return;clearTimeout(p.timer);requests.delete(m.solicitudId);if(m.tipo==="precio-actualizado"||m.tipo==="visibilidad-actualizada"||m.tipo==="configuracion-obtenida"||m.tipo==="configuracion-actualizada"||m.tipo==="orden-navegacion-actualizado")p.resolve(m.resultado||{});else p.reject(new Error(m.error||"No se pudo completar la operación."))}
  function closeBridge(options={}){clearTimeout(connectTimer);connectTimer=0;try{port?.close()}catch(_){}port=null;try{bridgeFrame?.remove()}catch(_){}bridgeFrame=null;if(!options.keepPending)pendingChannel="";if(!options.keepConnecting)connecting=false;if(!options.keepButton&&!admin)btn.textContent="Administrar"}
})();