// Administración del catálogo: precios, visibilidad y configuración.
(() => {
  const btn=document.getElementById("priceAdminBtn"), grid=document.getElementById("grid");
  if(!btn||!grid) return;
  const endpoint=String(window.PRECIOS_ADMIN_CONFIG?.endpoint||"").trim();
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)) return;
  const SHEET_ID=(()=>{try{return String(GOOGLE_SHEET_SOURCE?.spreadsheetId||"").trim()}catch(_){return "1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs"}})();
  const rules=new Set();
  let admin=false, adminMissingPriceOnly=false, connecting=false, bridgeFrame=null, port=null, pendingChannel="", openAfterConnect=false, seq=0, configLoading=false, connectTimer=0;
  let capabilities=new Set(["precio"]);
  const requests=new Map();
  const CONFIG_ITEMS=[
    {key:"REGISTRAR_VISITAS_PROPIAS",label:"Registrar mis propias visitas",help:"Incluye o excluye tus navegadores conocidos del registro de visitas y avisos."},
    {key:"MOSTRAR_CANTIDAD_STOCK",label:"Mostrar cantidad de stock",help:"Muestra al público la cantidad exacta cuando el stock es conocido."},
    {key:"MOSTRAR_PRECIOS_PRODUCTO",label:"Mostrar precios",help:"Muestra u oculta los precios de los productos en el catálogo."},
    {key:"MOSTRAR_SPRE",label:"Mostrar SPRE",help:"Muestra u oculta la herramienta administrativa SPRE."},
    {key:"MOSTRAR_FOLLETO",label:"Mostrar Folleto",help:"Muestra u oculta la herramienta administrativa Folleto."}
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
  .catalog-admin-vis button.hidden{background:#ffe8ec;border-color:#d996a5;color:#8f263c}.catalog-admin-vis button.inherited{background:#f3f0f1;color:#71676a;cursor:not-allowed}
  .catalog-admin-hidden{outline:2px dashed #c75b72!important;outline-offset:-2px;opacity:.72}.catalog-admin-inherited{outline:2px dashed #9d9698!important;outline-offset:-2px;opacity:.72}
  .price-admin-editor{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:10px;row-gap:7px;flex:1 1 220px;min-width:0;width:100%}.price-admin-input{box-sizing:border-box;min-width:0;width:100%;height:40px;padding:8px;border:1px solid #d8c9c6;border-radius:10px;text-align:right;font:750 15px Arial}.price-admin-save{box-sizing:border-box;min-width:88px}.price-admin-status{grid-column:1/-1;font-size:11px;font-weight:750}.price-admin-status.ok{color:#176b3a}.price-admin-status.err{color:#a02323}
  .card .row.price-admin-active{align-items:flex-start;flex-wrap:wrap;gap:8px}#priceAdminBtn[aria-pressed="true"]{color:#8d5360!important;border-color:#cfa8b0!important;background:#f5e5e8!important}
  .catalog-admin-config{margin:14px 0 20px;padding:10px 12px;border:1px solid #e3d5d2;border-radius:18px;background:#fffaf9;box-shadow:0 8px 24px #5d35400d}
  .catalog-admin-config-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0}.catalog-admin-config-collapse{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;background:transparent;color:#352b2c;font:900 14px/1.2 Arial;cursor:pointer;padding:2px 0;text-align:left}.catalog-admin-config-collapse-state{color:#8d5360;font:800 11px Arial}.catalog-admin-config-body{padding-top:12px}.catalog-admin-config-body[hidden]{display:none!important}.catalog-admin-config-note{margin:0 0 12px;color:#78696b;font:13px/1.35 Arial}
  .catalog-admin-config-list{display:grid;gap:9px}.catalog-admin-config-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;padding:11px 12px;border:1px solid #eadfdd;border-radius:13px;background:#fff}
  .catalog-admin-config-label{display:block;color:#352b2c;font:850 14px/1.25 Arial}.catalog-admin-config-help{display:block;margin-top:3px;color:#827477;font:12px/1.3 Arial}
  .catalog-admin-switch{min-width:112px;border:1px solid #d8c9c6;border-radius:999px;padding:8px 12px;background:#fdebec;color:#9a2e43;font:900 11px Arial;cursor:pointer}.catalog-admin-switch[aria-checked="true"]{background:#e7f7ed;border-color:#a9d6b8;color:#176b3a}.catalog-admin-switch:disabled{opacity:.62;cursor:wait}
  .catalog-admin-config-status{margin:9px 1px 0;color:#78696b;font:12px/1.3 Arial}.catalog-admin-config-status.ok{color:#176b3a}.catalog-admin-config-status.err{color:#a02323}
  @media(max-width:640px){.catalog-admin-config-row{grid-template-columns:1fr}.catalog-admin-switch{width:100%}}
  @media(max-width:380px){.price-admin-editor{grid-template-columns:1fr}.price-admin-save{width:100%}}
  `;
  document.head.appendChild(css);

  window.CATALOG_ADMIN_MODE_ACTIVE=false;
  window.CATALOG_ADMIN_MISSING_PRICE_ONLY=false;
  window.CATALOG_VISIBILITY_RULES=rules;
  window.filterVisibleProducts=list=>{
    const a=Array.isArray(list)?list:[];
    if(window.CATALOG_ADMIN_MODE_ACTIVE){
      return adminMissingPriceOnly?a.filter(p=>p&&!p.isGiftGalleryImage&&p.hasPrice===false):a.slice();
    }
    return a.filter(p=>!isHidden(p));
  };

  btn.hidden=false; btn.textContent="Administrar"; btn.setAttribute("aria-pressed","false"); btn.setAttribute("aria-label","Administrar catálogo");
  btn.addEventListener("click",toggleAdmin);
  new MutationObserver(()=>requestAnimationFrame(syncUI)).observe(grid,{childList:true,subtree:true});
  window.addEventListener("message",onBridgeReady); window.addEventListener("beforeunload",closeBridge);

  loadRules().finally(rebuild);

  function norm(v){return String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ")}
  function visibilityId(t,id){const type=norm(t),raw=String(id??"").trim();if(type==="producto"&&/^\d{1,4}$/.test(raw))return raw.padStart(4,"0");return norm(raw)}
  function key(t,id){return `${norm(t)}::${visibilityId(t,id)}`}
  function ids(p){const c=norm(p?.category),s=norm(p?.subcategory),f=norm(p?.line||p?.fragranceFamily),sec=norm(p?.section);return{sec,c,s:c&&s?`${c}|${s}`:"",f:c&&s&&f?`${c}|${s}|${f}`:""}}
  function isHidden(p){if(!p)return false;const i=ids(p),code=visibilityId("producto",p.id||p.code||"");return (code&&rules.has(key("producto",code)))||(i.sec&&rules.has(key("seccion",i.sec)))||(i.c&&rules.has(key("categoria",i.c)))||(i.s&&rules.has(key("subcategoria",i.s)))||(i.f&&rules.has(key("familia",i.f)))}
  function isDirectProduct(p){return rules.has(key("producto",p?.id||p?.code||""))}
  function cell(c){return !c?"":c.f!=null?String(c.f):c.v!=null?String(c.v):""}
  function stateBool(v){return ["activado","activo","true","verdadero","si","1","on"].includes(norm(v))}

  function loadRules(){return new Promise(resolve=>{
    if(!SHEET_ID){resolve();return} const cb="__vis_"+Date.now()+Math.random().toString(36).slice(2),s=document.createElement("script");let done=false;
    const finish=rows=>{if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch(_){window[cb]=undefined}s.remove();rules.clear();for(const r of rows||[]){if(!r[0]||!r[1])continue;const k=key(r[0],r[1]);["x","si","true","1","oculto"].includes(norm(r[2]))?rules.add(k):rules.delete(k)}resolve()};
    const timer=setTimeout(()=>finish([]),6000); window[cb]=p=>finish(p?.status==="ok"&&Array.isArray(p?.table?.rows)?p.table.rows.map(r=>(r.c||[]).map(cell)):[]); s.onerror=()=>finish([]);
    const q=new URLSearchParams({sheet:"Visibilidad",headers:"1",range:"A:E",tq:"select A,B,C,D,E",tqx:`out:json;responseHandler:${cb}`,_:String(Date.now())});
    s.src=`https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_ID)}/gviz/tq?${q}`;s.async=true;document.head.appendChild(s);
  })}
  function rebuild(){try{if(typeof rebuildCatalogVisibility==="function")rebuildCatalogVisibility();if(typeof refreshFilterOptionsForScope==="function")refreshFilterOptionsForScope();if(typeof render==="function")render()}catch(e){console.info(e)}requestAnimationFrame(syncUI)}
  function syncUI(){btn.hidden=false;btn.disabled=connecting;btn.title=admin?"Salir del modo administrador":"Administrar catálogo";if(!admin)return;installVisibility();installPrices();if(capabilities.has("configuracion"))ensureConfigPanel()}

  function toggleAdmin(){if(admin){stopAdmin();return} if(port&&bridgeFrame?.isConnected){startAdmin();return} connect()}
  function connect(){
    if(connecting)return;
    connecting=true;openAfterConnect=true;btn.textContent="Conectando…";pendingChannel=randomChannel();
    closeBridge({keepButton:true,keepConnecting:true,keepPending:true});
    const u=new URL(endpoint);u.searchParams.set("modo","puente");u.searchParams.set("canal",pendingChannel);
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
      alert("No fue posible validar la administración con Google en segundo plano. Comprueba que tienes la sesión de Google iniciada y que esta aplicación ya está autorizada.");
    },15000);
  }
  function randomChannel(){const b=new Uint8Array(24);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,"0")).join("")}
  function trusted(o){return o==="https://script.google.com"||/^https:\/\/[a-z0-9.-]*googleusercontent\.com$/i.test(o)}
  function onBridgeReady(e){const m=e.data||{};if(m.tipo!=="irenismb-precios-puente-listo"||!trusted(e.origin)||m.canal!==pendingChannel||!e.ports?.[0])return;clearTimeout(connectTimer);connectTimer=0;try{port?.close()}catch(_){}port=e.ports[0];port.onmessage=onReply;port.start();capabilities=new Set(Array.isArray(m.capacidades)?m.capacidades.map(norm):["precio"]);pendingChannel="";connecting=false;btn.textContent="Administrar";if(openAfterConnect)startAdmin();openAfterConnect=false}
  function startAdmin(){admin=true;adminMissingPriceOnly=false;window.CATALOG_ADMIN_MODE_ACTIVE=true;window.CATALOG_ADMIN_MISSING_PRICE_ONLY=false;btn.textContent="Salir de administración";btn.setAttribute("aria-pressed","true");rebuild();if(capabilities.has("configuracion"))loadAdminConfig()}
  function stopAdmin(){admin=false;adminMissingPriceOnly=false;window.CATALOG_ADMIN_MODE_ACTIVE=false;window.CATALOG_ADMIN_MISSING_PRICE_ONLY=false;btn.textContent="Administrar";btn.setAttribute("aria-pressed","false");removeAdminUI();rebuild()}
  function removeAdminUI(){document.getElementById("catalogAdminConfig")?.remove();grid.querySelectorAll(".catalog-admin-vis").forEach(x=>x.remove());grid.querySelectorAll(".catalog-admin-has-vis").forEach(x=>x.classList.remove("catalog-admin-has-vis"));grid.querySelectorAll(".catalog-admin-hidden,.catalog-admin-inherited").forEach(x=>x.classList.remove("catalog-admin-hidden","catalog-admin-inherited"));grid.querySelectorAll(".card").forEach(removePrice)}

  function ensureConfigPanel(){
    let panel=document.getElementById("catalogAdminConfig");
    if(panel){renderAdminMissingPriceToggle();return panel}
    panel=document.createElement("section");panel.id="catalogAdminConfig";panel.className="catalog-admin-config";panel.setAttribute("aria-label","Configuración del catálogo");
    const rows=CONFIG_ITEMS.map(item=>`<div class="catalog-admin-config-row" data-config-key="${item.key}"><div><span class="catalog-admin-config-label">${item.label}</span><span class="catalog-admin-config-help">${item.help}</span></div><button type="button" class="catalog-admin-switch" role="switch" aria-checked="false" data-config-toggle="${item.key}">Cargando…</button></div>`).join("");
    const adminFilter=`<div class="catalog-admin-config-row" data-admin-filter="sin-precio"><div><span class="catalog-admin-config-label">Ver productos sin precio</span><span class="catalog-admin-config-help">Filtro exclusivo del modo administrador. Muestra únicamente productos del inventario cuyo Precio está vacío.</span></div><button type="button" class="catalog-admin-switch" role="switch" aria-checked="false" data-admin-missing-price-toggle>DESACTIVADO</button></div>`;
    panel.innerHTML=`<div class="catalog-admin-config-head"><button type="button" class="catalog-admin-config-collapse" data-admin-config-collapse aria-expanded="false" aria-controls="catalogAdminConfigBody"><span>⚙ Configuración del catálogo</span><span class="catalog-admin-config-collapse-state">Mostrar</span></button></div><div class="catalog-admin-config-body" id="catalogAdminConfigBody" hidden><p class="catalog-admin-config-note">Los controles públicos se guardan en el administrador de Google y no dependen de una pestaña Configuracion. Los filtros locales solo afectan este navegador.</p><div class="catalog-admin-config-list">${rows}${adminFilter}</div><p class="catalog-admin-config-status" id="catalogAdminConfigStatus" role="status" aria-live="polite"></p></div>`;
    panel.addEventListener("click",e=>{const collapse=e.target.closest("[data-admin-config-collapse]");if(collapse){const body=panel.querySelector("#catalogAdminConfigBody"),expanded=collapse.getAttribute("aria-expanded")==="true";collapse.setAttribute("aria-expanded",expanded?"false":"true");if(body)body.hidden=expanded;const state=collapse.querySelector(".catalog-admin-config-collapse-state");if(state)state.textContent=expanded?"Mostrar":"Ocultar";return}const local=e.target.closest("[data-admin-missing-price-toggle]");if(local&&!local.disabled){toggleAdminMissingPrice(local);return}const b=e.target.closest("[data-config-toggle]");if(b&&!b.disabled)saveConfigToggle(b)});
    grid.insertAdjacentElement("beforebegin",panel);renderAdminMissingPriceToggle();return panel;
  }
  function renderAdminMissingPriceToggle(){const b=document.querySelector("[data-admin-missing-price-toggle]");if(!b)return;b.disabled=false;b.setAttribute("aria-checked",adminMissingPriceOnly?"true":"false");b.textContent=adminMissingPriceOnly?"ACTIVADO":"DESACTIVADO"}
  function toggleAdminMissingPrice(button){adminMissingPriceOnly=!adminMissingPriceOnly;window.CATALOG_ADMIN_MISSING_PRICE_ONLY=adminMissingPriceOnly;renderAdminMissingPriceToggle();rebuild()}
  function setConfigStatus(text,cls=""){const el=document.getElementById("catalogAdminConfigStatus");if(!el)return;el.textContent=text||"";el.className="catalog-admin-config-status"+(cls?" "+cls:"")}
  function renderConfigValues(values){
    const source=values&&typeof values==="object"?values:{};
    for(const item of CONFIG_ITEMS){const button=document.querySelector(`[data-config-toggle="${item.key}"]`);if(!button)continue;const raw=String(source[item.key]??window.REMOTE_CONTROL_VALUES?.[item.key]??"");const active=stateBool(raw);button.disabled=false;button.setAttribute("aria-checked",active?"true":"false");button.textContent=active?"ACTIVADO":"DESACTIVADO"}
  }
  function applyConfigValues(values,shouldRebuild=true){
    if(!values||typeof values!=="object")return;
    window.REMOTE_CONTROL_VALUES=window.REMOTE_CONTROL_VALUES||{};
    for(const [rawKey,rawState] of Object.entries(values)){const k=String(rawKey||"").trim().toUpperCase();if(!k)continue;window.REMOTE_CONTROL_VALUES[k]=String(rawState??"");if(["MOSTRAR_CANTIDAD_STOCK","MOSTRAR_PRECIOS_PRODUCTO","MOSTRAR_SPRE","MOSTRAR_FOLLETO"].includes(k)&&window.INTERRUPTORES)window.INTERRUPTORES[k]=stateBool(rawState)}
    renderConfigValues(values);
    try{if(typeof syncAdministrativeToolVisibility==="function")syncAdministrativeToolVisibility()}catch(e){console.info(e)}
    if(shouldRebuild){try{if(typeof rebuildCatalogVisibility==="function")rebuildCatalogVisibility();else if(typeof render==="function")render();if(typeof renderCartModal==="function"&&document.getElementById("cartModal")?.classList.contains("open"))renderCartModal()}catch(e){console.info(e)}}
  }
  async function loadAdminConfig(){
    if(configLoading||!admin||!capabilities.has("configuracion"))return;configLoading=true;ensureConfigPanel();setConfigStatus("Cargando configuración…");document.querySelectorAll("[data-config-toggle]").forEach(b=>b.disabled=true);
    try{const r=await request({tipo:"obtener-configuracion"});applyConfigValues(r?.valores||{},false);setConfigStatus("Configuración actualizada desde Google.","ok")}catch(e){renderConfigValues(window.REMOTE_CONTROL_VALUES||{});setConfigStatus(e.message||"No se pudo cargar la configuración.","err")}finally{configLoading=false}
  }
  async function saveConfigToggle(button){
    const k=String(button.dataset.configToggle||"").trim().toUpperCase(),current=button.getAttribute("aria-checked")==="true",next=!current;button.disabled=true;const old=button.textContent;button.textContent="Guardando…";setConfigStatus("");
    try{const r=await request({tipo:"actualizar-configuracion",clave:k,activado:next});applyConfigValues(r?.valores||{[k]:r?.estado|| (next?"ACTIVADO":"DESACTIVADO")},true);setConfigStatus("Cambio guardado.","ok")}catch(e){button.disabled=false;button.textContent=old;setConfigStatus(e.message||"No se pudo guardar el cambio.","err")}
  }

  function installVisibility(){if(!capabilities.has("visibilidad"))return;grid.querySelectorAll(":scope > .card:not(.album-card)").forEach(productVis);grid.querySelectorAll(":scope > .album-card").forEach(albumVis)}
  function productObj(code){try{return productById?.get?.(code)||allLoadedProducts?.find?.(p=>String(p?.id||"")===code)||null}catch(_){return null}}
  function mark(card,direct,inherited){card.classList.toggle("catalog-admin-hidden",!!direct);card.classList.toggle("catalog-admin-inherited",!!inherited)}
  function productVis(card){if(card.querySelector(".catalog-admin-vis"))return;const code=visibilityId("producto",card.dataset.id||""),p=productObj(code);if(!/^\d{4}$/.test(code)||!p)return;const direct=isDirectProduct(p),inherited=isHidden(p)&&!direct;mark(card,direct,inherited);addVisButton(card,inherited?null:{tipo:"producto",id:code,label:String(p.name||code),hidden:direct},inherited)}
  function albumInfo(card){const b=card.querySelector("[data-album-open]");if(!b)return null;const p=String(b.dataset.albumOpen||"").split("::").map(norm),label=String(card.querySelector(".album-label")?.textContent||"").trim();if(p[0]==="audience"&&p[1])return{tipo:"categoria",id:p[1],label:label||p[1],parents:[]};if(p[0]==="category"&&p[1]&&p[2])return{tipo:"subcategoria",id:`${p[1]}|${p[2]}`,label:label||p[2],parents:[key("categoria",p[1])]};if(p[0]==="family"&&p[1]&&p[2]&&p[3])return{tipo:"familia",id:`${p[1]}|${p[2]}|${p[3]}`,label:label||p[3],parents:[key("categoria",p[1]),key("subcategoria",`${p[1]}|${p[2]}`)]};return null}
  function albumVis(card){if(card.querySelector(".catalog-admin-vis"))return;const i=albumInfo(card);if(!i)return;const direct=rules.has(key(i.tipo,i.id)),inherited=!direct&&i.parents.some(x=>rules.has(x));mark(card,direct,inherited);addVisButton(card,inherited?null:{...i,hidden:direct},inherited)}
  function addVisButton(card,info,inherited){const w=document.createElement("div"),b=document.createElement("button");w.className="catalog-admin-vis";b.type="button";if(inherited){b.textContent="Oculto por nivel superior";b.className="inherited";b.disabled=true}else{b.textContent=info.hidden?"Oculto":"Visible";b.className=info.hidden?"hidden":"";b.title=info.hidden?`Mostrar ${info.label}`:`Ocultar ${info.label}`;b.onclick=e=>{e.preventDefault();e.stopPropagation();saveVisibility(info,b)}}w.appendChild(b);if(card.classList.contains("album-card")){card.classList.add("catalog-admin-has-vis");const top=card.querySelector(".album-card-top");(top||card).appendChild(w)}else{card.appendChild(w)}}
  async function saveVisibility(info,b){b.disabled=true;const old=b.textContent;b.textContent="Guardando…";try{const r=await request({tipo:"actualizar-visibilidad",tipoRegla:info.tipo,identificador:info.id,etiqueta:info.label,ocultoNuevo:!info.hidden});const k=key(info.tipo,r?.identificador||info.id);r?.oculto?rules.add(k):rules.delete(k);rebuild()}catch(e){b.disabled=false;b.textContent=old;alert(e.message||"No se pudo guardar la visibilidad.")}}

  function installPrices(){grid.querySelectorAll(":scope > .card:not(.album-card)").forEach(addPrice)}
  function addPrice(card){if(card.querySelector(".price-admin-editor"))return;const price=card.querySelector(".price"),row=card.querySelector(".row"),code=visibilityId("producto",card.dataset.id||"");if(!price||!row||!/^\d{4}$/.test(code))return;const p=productObj(code),prev=p&&p.hasPrice!==false?String(Number(p.price)||""):priceValue(price.textContent),ed=document.createElement("div"),inp=document.createElement("input"),save=document.createElement("button"),st=document.createElement("span");ed.className="price-admin-editor";ed.dataset.prev=prev;inp.className="price-admin-input";inp.inputMode="numeric";inp.value=editable(prev);save.className="btn-acc price-admin-save";save.textContent="Guardar";save.disabled=true;st.className="price-admin-status";inp.oninput=()=>save.disabled=!validPrice(inp.value)||priceValue(inp.value)===ed.dataset.prev;inp.onkeydown=e=>{if(e.key!=="Enter"||e.isComposing)return;e.preventDefault();if(inp.disabled)return;if(!validPrice(inp.value)){status(st,"Precio inválido","err");return}if(priceValue(inp.value)===ed.dataset.prev)return;savePrice(card,price,ed,inp,save,st)};save.onclick=()=>savePrice(card,price,ed,inp,save,st);ed.append(inp,save,st);price.hidden=true;row.classList.add("price-admin-active");price.insertAdjacentElement("afterend",ed)}
  function removePrice(card){const p=card.querySelector(".price"),r=card.querySelector(".row");card.querySelector(".price-admin-editor")?.remove();if(p)p.hidden=false;r?.classList.remove("price-admin-active")}
  async function savePrice(card,price,ed,inp,save,st){const v=priceValue(inp.value);if(inp.value.trim()&&!validPrice(inp.value)){status(st,"Precio inválido","err");return}inp.disabled=save.disabled=true;save.textContent="Guardando…";try{const code=visibilityId("producto",card.dataset.id||""),r=await request({tipo:"actualizar-precio",codigo:code,precioNuevo:v,precioAnterior:ed.dataset.prev});const g=priceValue(r?.precioGuardado);ed.dataset.prev=g;inp.value=editable(g);const p=productObj(code);if(p){p.price=g?Number(g):0;p.hasPrice=!!g}price.textContent=window.INTERRUPTORES?.MOSTRAR_PRECIOS_PRODUCTO!==false?(g?"$ "+new Intl.NumberFormat("es-CO").format(Number(g)):"Consultar precio"):"";status(st,"Precio guardado","ok");if(adminMissingPriceOnly&&p?.hasPrice)setTimeout(rebuild,0)}catch(e){status(st,e.message||"No se pudo guardar","err")}finally{inp.disabled=false;save.textContent="Guardar";save.disabled=priceValue(inp.value)===ed.dataset.prev}}
  function validPrice(v){const t=String(v??"").trim();if(!t)return true;if(!/^(?:\d+|\d{1,3}(?:[.\s]\d{3})+)$/.test(t))return false;const n=Number(t.replace(/[.\s]/g,""));return Number.isSafeInteger(n)&&n>0}
  function priceValue(v){const t=String(v??"").trim();if(!t||/^Consultar precio$/i.test(t))return"";const d=t.replace(/[^\d]/g,"");return d?String(Number(d)):""}
  function editable(v){return v?new Intl.NumberFormat("es-CO").format(Number(v)):""} function status(el,t,c){el.textContent=t;el.className="price-admin-status "+(c||"")}

  function request(data){return new Promise((resolve,reject)=>{if(!port||!bridgeFrame?.isConnected){reject(new Error("La conexión con Google se cerró."));return}const prefix=data.tipo==="actualizar-visibilidad"?"vis":data.tipo?.includes("configuracion")?"cfg":"price",id=prefix+"-"+Date.now()+"-"+(++seq),timer=setTimeout(()=>{requests.delete(id);reject(new Error("Google tardó demasiado en responder."))},45000);requests.set(id,{resolve,reject,timer});port.postMessage({...data,solicitudId:id})})}
  function onReply(e){const m=e.data||{},p=requests.get(m.solicitudId);if(!p)return;clearTimeout(p.timer);requests.delete(m.solicitudId);if(m.tipo==="precio-actualizado"||m.tipo==="visibilidad-actualizada"||m.tipo==="configuracion-obtenida"||m.tipo==="configuracion-actualizada")p.resolve(m.resultado||{});else p.reject(new Error(m.error||"No se pudo completar la operación."))}
  function closeBridge(options={}){clearTimeout(connectTimer);connectTimer=0;try{port?.close()}catch(_){}port=null;try{bridgeFrame?.remove()}catch(_){}bridgeFrame=null;if(!options.keepPending)pendingChannel="";if(!options.keepConnecting)connecting=false;if(!options.keepButton&&!admin)btn.textContent="Administrar"}
})();