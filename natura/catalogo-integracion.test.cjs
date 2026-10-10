// Ejecutar: node --test natura/catalogo-integracion.test.cjs
// CATALOG_PRODUCTS_FIXTURE permite comprobar un rango oficial leído en modo solo lectura.
// No realiza solicitudes de red ni modifica productos, pedidos o precios.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const appSource = fs.readFileSync(path.join(__dirname, 'catalogo-app.js'), 'utf8');
const adminSource = fs.readFileSync(path.join(__dirname, 'precios-admin.js'), 'utf8');
const cartSource = fs.readFileSync(path.join(__dirname, 'catalogo-carrito-pedido.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, 'catalogo.html'), 'utf8');
const toolsSource = fs.readFileSync(path.join(__dirname, 'catalogo-herramientas.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(__dirname, 'catalogo-ui.js'), 'utf8');

const headers = ['Código','Sección','Categoría','Subcategoría','Familia olfativa','Condición','Nombre','Precio','Costo','Stock','Referencia externa','Descripción','Código Natura','Línea','Público','Estado comercial','Marketplace','Nombre anterior','Marca','Tipo de producto','Variante','Característica','Presentación','Contenido','Unidad','Cantidad de unidades'];
const samples = [
  [9997,'Belleza y cuidado','Cabello','','','','Producto ficticio para prueba',194974.5],
  [9998,'Belleza y cuidado','Cabello','','','','Segundo producto ficticio',''],
  [9999,'Otros productos','Medicamentos','','','','Registro ficticio oculto',10]
];
const visibility = {ok:true,reglas:[{tipo:'seccion',identificador:'otros productos',oculto:true,etiqueta:'Otros productos'}]};
function columnId(index){let result="";for(let n=index+1;n>0;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;}
function tableFromValues(values){
  const [labels,...rows]=values;
  return {cols:labels.map((label,i)=>({label,id:columnId(i)})),rows:rows.map(row=>({c:labels.map((label,i)=>{
    const v=row[i]??null;
    return {v:v===''?null:v,f:v===null||v===''?'':label==='Código'?String(v).padStart(4,'0'):['Precio','Costo','Stock'].includes(label)&&typeof v==='number'?new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(v):String(v)};
  })}))};
}
function clone(value){return JSON.parse(JSON.stringify(value));}

const facetHeaders=['Código','Nombre','Precio','Sección','Categoría','Subcategoría','Marca','Línea','Tipo de producto','Variante','Característica','Público','Presentación','Contenido','Unidad','Familia olfativa','Estado comercial','Nombre del componente 1','Nombre del componente 2','Conectividad','Compatibilidad','Edad recomendada','Número de jugadores','Materiales','Perfil aromático','Textura y acabado','Duración del efecto'];
function facetFixture(){
  const product=(code,extra={})=>({'Código':code,'Nombre':'Título comercial independiente','Precio':code,'Sección':'Belleza y cuidado','Categoría':'Perfumería','Subcategoría':'Perfumes','Marca':'Natura','Línea':'Kaiak','Tipo de producto':'Perfume','Público':'Masculinos','Contenido':100,'Unidad':'ml','Familia olfativa':'Floral; Frutal; Floral',...extra});
  const products=[product(9901,{'Variante':'Flor de Cereza y Aguacate','Nombre del componente 1':'Champú','Nombre del componente 2':'Champú'}),
    product(9902,{'Marca':'Avon','Línea':'Far Away','Público':'Femeninos','Familia olfativa':'Floral'}),
    product(9903,{'Contenido':50,'Familia olfativa':'Amaderada'}),
    product(9904,{'Estado comercial':'No a la venta'}),
    product(9905,{'Sección':'Otros productos','Categoría':'Tecnología y hogar','Marca':'Samsung','Conectividad':'Bluetooth; USB; Bluetooth','Compatibilidad':'PlayStation 4','Familia olfativa':''}),
    product(9906,{'Contenido':75,'Familia olfativa':'Frutal','Público':'Femeninos'})];
  return tableFromValues([facetHeaders,...products.map(p=>facetHeaders.map(h=>p[h]??''))]);
}
async function facetEnvironment(){
  const env=environment();await confirmed(env);env.sandbox.products=assess(env,facetFixture()).products;
  env.run('allLoadedProducts=products;all=filterVisibleProducts(products);refreshNavigationAlbums()');
  return env;
}
function facetGroups(env){return clone(env.run('buildSuggestionEntries()'));}
function facetCount(env,group,value){return facetGroups(env).find(g=>g.id===group)?.options.find(o=>o.label===value)?.count;}
function facetIds(env){return clone(env.run('buildFilteredList().map(p=>p.id)')).sort();}
function facetButtons(env){return env.sandbox.document.getElementById('wordChips').children.flatMap(group=>group.children[1]?.children||[]);}

test('Filtrar agrupa campos estructurados en la raíz antes del nivel Producto',async()=>{
  const env=await facetEnvironment(),groups=facetGroups(env);
  assert.equal(env.run('navigationViewMode().mode'),'albums');
  for(const group of ['brand','line','public','content','olfactoryFamily','components'])assert.ok(groups.some(g=>g.id===group));
  assert.equal(facetCount(env,'brand','Natura'),3);assert.equal(facetCount(env,'brand','Avon'),1);
  assert.ok(groups.every(g=>g.options.length&&g.options.every(o=>o.count>0)));
  assert.ok(!groups.some(g=>['section','category','productType'].includes(g.id)));
});
test('Nombre no genera opciones ni impide filtrar atributos ausentes de él',async()=>{
  const env=await facetEnvironment(),names=facetGroups(env).flatMap(g=>g.options.map(o=>o.label));
  assert.ok(!names.some(n=>/Título|comercial|independiente/.test(n)));
  env.run('toggleFacetFilter("brand","Avon")');assert.deepEqual(facetIds(env),['9902']);
  assert.equal(env.run('all.find(p=>p.id==="9901").name'),env.run('all.find(p=>p.id==="9902").name'));
});
test('Familias separadas por punto y coma y componentes repetidos cuentan cada Código una vez',async()=>{
  const env=await facetEnvironment();assert.equal(facetCount(env,'olfactoryFamily','Floral'),2);
  assert.equal(facetCount(env,'olfactoryFamily','Frutal'),2);assert.equal(facetCount(env,'components','Champú'),1);
  env.run('all.push(all[0])');assert.equal(facetCount(env,'components','Champú'),1);
});
test('Contenido y Unidad forman valores completos y las variantes conservan sus palabras',async()=>{
  const env=await facetEnvironment();assert.equal(facetCount(env,'content','100 ml'),2);
  const options=facetGroups(env).flatMap(g=>g.options.map(o=>o.label));
  assert.ok(options.includes('Flor de Cereza y Aguacate'));assert.ok(!options.includes('100'));assert.ok(!options.includes('ml'));
  env.sandbox.row={contentValue:1.14,unit:'g'};
  assert.equal(env.run('buildProductFacetAttributes(row).content[0].label'),'1,14 g');
});
test('Alternativas dentro de un grupo usan OR y grupos diferentes usan AND',async()=>{
  const env=await facetEnvironment();env.run('toggleFacetFilter("brand","Natura");toggleFacetFilter("olfactoryFamily","Floral");toggleFacetFilter("content","100 ml")');
  assert.deepEqual(facetIds(env),['9901']);env.run('toggleFacetFilter("brand","Avon")');assert.deepEqual(facetIds(env),['9901','9902']);
  env.run('toggleFacetFilter("olfactoryFamily","Amaderada")');assert.deepEqual(facetIds(env),['9901','9902']);
  env.run('removeFacetFilter("content","100 ml")');assert.deepEqual(facetIds(env),['9901','9902','9903']);
});
test('Recuentos por opción respetan otros grupos y ofrecen alternativas OR sin depender del orden',async()=>{
  const env=await facetEnvironment();env.run('toggleFacetFilter("brand","Natura");toggleFacetFilter("olfactoryFamily","Floral");toggleFacetFilter("content","100 ml")');
  assert.equal(facetCount(env,'brand','Natura'),1);assert.equal(facetCount(env,'brand','Avon'),1);
  assert.equal(facetCount(env,'olfactoryFamily','Frutal'),1);assert.equal(facetCount(env,'content','100 ml'),1);
  const before=facetGroups(env);env.run('selectedFacetFilters.reverse()');assert.deepEqual(facetGroups(env),before);
});
test('Ruta recorrida se omite y el orden configurable no determina los grupos',async()=>{
  const env=await facetEnvironment();env.run('setSelectedNavigationValue("section","Belleza y cuidado");setSelectedNavigationValue("category","Perfumería");setSelectedNavigationValue("subcategory","Perfumes");setSelectedNavigationValue("public","Masculinos");setSelectedNavigationValue("line","Kaiak")');
  assert.equal(env.run('navigationViewMode().mode'),'products');
  assert.ok(facetGroups(env).every(g=>!['section','category','subcategory','public','line'].includes(g.id)));
  env.run('window.applyCatalogNavigationOrder("line,public,category,section,subcategory,product",{rebuild:false})');
  assert.ok(facetGroups(env).every(g=>!['section','category','subcategory','public','line'].includes(g.id)));
  assert.ok(facetGroups(env).some(g=>g.id==='olfactoryFamily'));
});
test('Niveles omitidos continúan ofreciendo filtros comerciales cuando distinguen productos',async()=>{
  const env=await facetEnvironment();env.run('window.applyCatalogNavigationOrder("!section,category,subcategory,!public,!line,product",{rebuild:false});validateNavigationStateAgainstProducts()');
  for(const id of ['line','public'])assert.ok(facetGroups(env).some(g=>g.id===id));
  env.run('window.applyCatalogNavigationOrder("product,section,category,subcategory,public,line",{rebuild:false})');
  assert.equal(env.run('navigationViewMode().mode'),'products');assert.equal(facetCount(env,'brand','Avon'),1);
});
test('Visibilidad y Estado comercial excluyen productos y cantidades del panel público',async()=>{
  const env=await facetEnvironment();assert.equal(env.run('all.length'),4);
  assert.ok(!facetGroups(env).flatMap(g=>g.options).some(o=>o.label==='Samsung'));
  env.run('toggleFacetFilter("olfactoryFamily","Floral")');assert.deepEqual(facetIds(env),['9901','9902']);
});
test('Abrir, seleccionar, cerrar y reabrir conserva resultados, selección e indicadores',async()=>{
  const env=await facetEnvironment();env.run('setWordSuggestionsVisible(true);renderWordSuggestions();toggleFacetFilter("brand","Natura");toggleFacetFilter("olfactoryFamily","Floral");toggleFacetFilter("content","100 ml");renderWordSuggestions()');
  const filters=clone(env.run('selectedFacetFilters')),before=facetIds(env);assert.equal(filters.length,3);
  env.run('setWordSuggestionsVisible(false);renderWordSuggestions()');
  assert.equal(env.sandbox.document.getElementById('wordPanel').hidden,true);assert.deepEqual(facetIds(env),before);
  assert.equal(env.sandbox.document.getElementById('filterSummary').hidden,false);assert.equal(env.sandbox.document.getElementById('clearTermsBtn').hidden,false);
  env.run('setWordSuggestionsVisible(true);renderWordSuggestions()');assert.deepEqual(clone(env.run('selectedFacetFilters')),filters);
  assert.equal(facetButtons(env).filter(b=>b.attributes['aria-pressed']==='true').length,3);
  env.run('toggleFacetFilter("brand","Avon")');assert.deepEqual(facetIds(env),['9901','9902']);
});
test('Retirada individual conserva las demás selecciones y Limpiar todo las elimina',async()=>{
  const env=await facetEnvironment();env.run('toggleFacetFilter("brand","Natura");toggleFacetFilter("olfactoryFamily","Floral");toggleFacetFilter("content","100 ml")');
  env.run('uxClearOneFilter(uxActiveFilterEntries().find(e=>e.label.startsWith("Contenido:")).key)');
  assert.equal(env.run('selectedFacetFilters.length'),2);env.run('uxClearAllFilters()');assert.equal(env.run('selectedFacetFilters.length'),0);assert.equal(facetIds(env).length,4);
});
test('Recalcular, cambiar niveles y volver con Atrás no borra filtros aunque queden sin resultados',async()=>{
  const env=await facetEnvironment();env.run('toggleFacetFilter("brand","Avon");setWordSuggestionsVisible(true);setSelectedNavigationValue("public","Masculinos");resetDiscoveryFilters();renderWordSuggestions()');
  assert.equal(facetIds(env).length,0);assert.equal(facetCount(env,'brand','Avon'),0);assert.equal(env.run('selectedFacetFilters.length'),1);
  for(let i=0;i<4;i++){env.run('setWordSuggestionsVisible(false);renderWordSuggestions();setWordSuggestionsVisible(true);renderWordSuggestions();buildSuggestionEntries()');assert.equal(env.run('selectedFacetFilters.length'),1);}
  env.sandbox.scrollTo=()=>{};env.run('restoreCatalogStateFromHistory({state:null})');assert.equal(env.run('selectedFacetFilters.length'),1);assert.deepEqual(facetIds(env),['9902']);
  env.run('removeFacetFilter("brand","avon")');assert.equal(env.run('selectedFacetFilters.length'),0);
});
test('URL y estado persistente restauran selecciones aunque el panel esté cerrado',async()=>{
  const env=await facetEnvironment();env.run('toggleFacetFilter("brand","Natura");setWordSuggestionsVisible(false);captureCatalogReloadViewState()');
  const snapshot=JSON.parse(env.sandbox.localStorage.getItem('irenismb_catalog_last_view_v1'));assert.equal(snapshot.facets.length,1);assert.equal(snapshot.wordPanelVisible,false);
  env.sandbox.snapshot=snapshot;env.run('selectedFacetFilters=[];applyCatalogReloadViewState(snapshot)');assert.equal(env.run('selectedFacetFilters.length'),1);
  env.sandbox.location.href+='?facets='+encodeURIComponent(JSON.stringify(snapshot.facets));env.run('selectedFacetFilters=[];readStateFromUrl()');assert.equal(env.run('selectedFacetFilters.length'),1);
});
test('Buscador y ordenación siguen operando junto con filtros estructurados',async()=>{
  const env=await facetEnvironment();env.run('toggleFacetFilter("brand","Natura");qInp.value="independiente";sortSel.value="price_desc"');
  assert.deepEqual(clone(env.run('buildFilteredList().map(p=>p.id)')),['9906','9903','9901']);
  env.run('qInp.value="no existe"');assert.equal(facetIds(env).length,0);assert.equal(env.run('selectedFacetFilters.length'),1);
});
test('Filtros operan sobre tarjetas de navegación sin abrir un nivel Producto implícito',async()=>{
  const env=await facetEnvironment();env.run('toggleFacetFilter("brand","Avon");refreshNavigationAlbums()');
  const albums=clone(env.run('buildFilteredAlbums()'));assert.equal(albums.reduce((sum,a)=>sum+a.count,0),1);
  env.run('window.applyCatalogNavigationOrder("section,category,subcategory,public,line,!product",{rebuild:false});refreshNavigationAlbums()');
  assert.equal(env.run('navigationViewMode().mode'),'albums');assert.equal(env.run('selectedFacetFilters.length'),1);
});
test('Conectividad y compatibilidad se obtienen del campo y conservan expresiones identificativas',()=>{
  const env=environment();env.sandbox.row={connectivity:'Wi-Fi 2,4 GHz; IEEE 802.11b/g/n; Wi-Fi 2,4 GHz',compatibility:'PlayStation 4',variant:'Flor de Cereza y Aguacate',materials:'Cubierta superior de aluminio; base de PC-ABS'};
  const data=clone(env.run('buildProductFacetAttributes(row)'));
  assert.deepEqual(data.connectivity.map(o=>o.label),['Wi-Fi 2,4 GHz','IEEE 802.11b/g/n']);assert.equal(data.compatibility[0].label,'PlayStation 4');
  assert.equal(data.variant[0].label,'Flor de Cereza y Aguacate');assert.equal(data.materials.length,2);
});
test('La consulta pública resuelve IDs por encabezados y excluye costos e identificadores privados',async()=>{
  const env=environment();await confirmed(env);const table=facetFixture();
  for(const label of ['Costo','Número de serie','Dirección MAC','Identificadores técnicos de la unidad','Especificaciones técnicas'])table.cols.push({label,id:columnId(table.cols.length)});
  table.cols.reverse();const pending=env.run('loadGoogleSheetRows()');env.reply({...table,rows:[]});await new Promise(resolve=>setImmediate(resolve));
  const query=new URL(env.requests.at(-1).src).searchParams.get('tq'),ids=query.slice(7).split(',');
  for(const col of table.cols.filter(c=>/Costo|serie|MAC|Identificadores|Especificaciones/.test(c.label)))assert.ok(!ids.includes(col.id));
  for(const label of ['Nombre','Familia olfativa','Nombre del componente 1'])assert.ok(ids.includes(table.cols.find(c=>c.label===label).id));
  env.reply(facetFixture());assert.equal((await pending).length,6);
});
test('Los controles activos quedan fuera del panel ocultable y los grupos son accesibles',async()=>{
  const env=await facetEnvironment();env.run('setWordSuggestionsVisible(true);renderWordSuggestions()');
  assert.ok(htmlSource.indexOf('id="filterSummary"')>htmlSource.indexOf('id="wordChips"'));
  for(const group of env.sandbox.document.getElementById('wordChips').children){assert.equal(group.attributes.role,'group');assert.ok(group.attributes['aria-labelledby']);}
  const button=facetButtons(env).find(b=>b.dataset.facetGroup==='brand');button.focus();env.run('renderWordSuggestions()');
  assert.equal(env.sandbox.document.activeElement.dataset.facetValue,button.dataset.facetValue);
  assert.ok(facetButtons(env).every(b=>b.attributes['aria-pressed']!==undefined&&b.attributes['aria-label']));
});

test('La vista directa conserva la explicación y retirada de filtros sin resultados',async()=>{
  const env=await facetEnvironment();
  const renderer=uiSource.slice(uiSource.indexOf('  function renderDirectProducts(){'),uiSource.indexOf('  let directRenderQueued'));
  env.run('window.CATALOG_INITIAL_LOAD_READY=true; const searchInput=qInp; const count=countEl; function isActive(){return true;} function hasSearch(){return !!qInp.value;} function directProducts(){return buildFilteredList();}');
  env.run(renderer);
  env.run('toggleFacetFilter("brand","Avon");setSelectedNavigationValue("public","Masculinos");setWordSuggestionsVisible(false);renderDirectProducts()');
  const fragment=env.document.getElementById('grid').children[0],empty=fragment.children[0];
  assert.match(empty.children[0].textContent,/filtros activos/);
  assert.match(empty.children[1].textContent,/selecciones siguen activas/);
  assert.equal(empty.children[2].children[0].dataset.clearSearch,'all');
  assert.equal(env.run('selectedFacetFilters.length'),1);
  assert.equal(env.document.getElementById('count').textContent,'0 productos');
});

function environment(){
  const elements=new Map(),timers=new Map(),requests=[],events=new Map(),storage=new Map();
  let timerId=0,context;
  class Node {
    set innerHTML(value){this.children=[];this._html=value;}
    get innerHTML(){return this._html||'';}
    focus(){document.activeElement=this;}
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={setProperty(){}};this.value='';this.textContent='';this.attributes={};this.hidden=false;this.listeners=new Map();this.classList={add(){},remove(){},toggle(){},contains(){return false}};}
    appendChild(node){this.children.push(node);node.parentNode=this;if(node.tagName==='SCRIPT')requests.push(node);return node;}
    append(...nodes){nodes.forEach(node=>this.appendChild(node));}
    removeChild(node){node.remove();return node;}
    replaceChildren(...nodes){this.children=[];this.append(...nodes);}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}
    setAttribute(name,value){this.attributes[name]=value;}
    getAttribute(name){return this.attributes[name]??null;}
    addEventListener(name,fn){this.listeners.set(name,fn);}
    getBoundingClientRect(){return {top:0,width:350,height:350};}
    querySelector(){return null;}
    querySelectorAll(){return [];}
    insertAdjacentElement(_,node){return this.appendChild(node);}
  }
  const document={head:new Node('head'),body:new Node('body'),documentElement:new Node('html'),visibilityState:'visible',
    createDocumentFragment(){return new Node('fragment');},
    getElementById(id){if(!elements.has(id))elements.set(id,new Node());return elements.get(id);},
    createElement(tag){const node=new Node(tag);if(tag==='template')node.content={firstElementChild:new Node()};return node;},
    querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){}};
  const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
  const sandbox={document,localStorage,sessionStorage:localStorage,URL,URLSearchParams,Intl,console:{info(){},warn(){},error(){}},
    setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),
    setInterval(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearInterval:id=>timers.delete(id),
    requestAnimationFrame:fn=>{fn();return 1;},MutationObserver:class {observe(){}disconnect(){}},
    Image:class {set src(value){this._src=value;queueMicrotask(()=>this.onload?.());}},
    CustomEvent:class {constructor(type,options={}){this.type=type;this.detail=options.detail;}},
    location:{href:'https://irenismb.github.io/stock/natura/catalogo.html',origin:'https://irenismb.github.io',protocol:'https:',search:'',hash:''},
    history:{state:null,replaceState(){},pushState(){}},navigator:{},performance:{now:()=>0,getEntriesByType:()=>[]},
    addEventListener:(name,fn)=>events.set(name,fn),dispatchEvent:event=>events.get(event.type)?.(event),
    PRECIOS_ADMIN_CONFIG:{endpoint:'https://script.google.com/macros/s/PRUEBA_SIN_RED/exec'},
    fetch(){throw new Error('Las pruebas no permiten solicitudes de red.');}};
  sandbox.window=sandbox;
  context=vm.createContext(sandbox);
  vm.runInContext(appSource,context,{filename:'catalogo-app.js'});
  vm.runInContext(cartSource,context,{filename:'catalogo-carrito-pedido.js'});
  vm.runInContext(adminSource,context,{filename:'precios-admin.js'});
  return {context,sandbox,document,requests,timers,events,run:source=>vm.runInContext(source,context),
    reply(table,status='ok'){const node=[...requests].reverse().find(n=>n.parentNode);assert.ok(node,'Debe existir una solicitud JSONP');const url=new URL(node.src);const cb=url.searchParams.get('callback')||url.searchParams.get('tqx').split('responseHandler:')[1];sandbox[cb](url.searchParams.has('modo')?table:{status,table});return cb;},
    fail(){const node=[...requests].reverse().find(n=>n.parentNode);assert.ok(node);node.onerror();},
    timeout(ms){const timer=[...timers.values()].find(item=>item.ms===ms);assert.ok(timer);timer.fn();}};
}
function assess(env,table){env.sandbox.inputTable=table;return env.run('buildCompatibleGoogleSheetProducts(readGoogleSheetProductRows(inputTable).map(row=>({row,imageIndex:new Map()})))');}
async function confirmed(env,table=visibility){env.reply(table);await env.sandbox.CATALOG_PUBLIC_VISIBILITY_READY;}
function fixture(){return tableFromValues([headers,...samples]);}

// DOM acotado para ejecutar las funciones publicadas del editor sin guardar precios.
function priceEditorEnvironment(){
  const boundaries=[
    ['  function clearAdminDecorations(){','  function ensureAdminSidebar(){'],
    ['  function syncAdminSectionUI(emit=false){','  function setCatalogAdminSection(section){'],
    ['  function installPrices(){','  function addDescriptionCopy(card){'],
    ['  function removePrice(card){','  async function savePrice('],
    ['  function validPrice(v){','  function sendRequest(data,timeout=45000){']
  ];
  const selected=boundaries.map(([start,end])=>{
    const a=adminSource.indexOf(start),b=adminSource.indexOf(end,a);
    assert.ok(a>=0&&b>a,'Función real del editor disponible');
    return adminSource.slice(a,b);
  }).join('\n')+'\n'+adminSource.split('\n').find(line=>line.includes('function syncUI(){'));
  const classes={add(){},remove(){},toggle(){}};
  let focused=null,editor=null,created=0,removed=0;
  const price={textContent:'Consultar precio',hidden:false,insertAdjacentElement(_,node){editor=node;created++;}};
  const row={classList:classes};
  const card={dataset:{id:'0245'},querySelector(selector){return selector==='.price-admin-editor'?editor:selector==='.price'?price:selector==='.row'?row:null;}};
  const grid={hidden:false,querySelectorAll(selector){return [':scope > .card:not(.album-card)','.card'].includes(selector)?[card]:[];}};
  function node(tag){return {tag,dataset:{},children:[],value:'',disabled:false,append(...children){this.children.push(...children);},remove(){if(this===editor){if(this.children.includes(focused))focused=null;editor=null;removed++;}}};}
  const context={Intl,admin:true,adminSection:'catalogo',capabilities:new Set(),grid,window:{dispatchEvent(){}},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    document:{body:{classList:classes},getElementById(){return null;},createElement:node},
    ensureAdminSidebar:()=>({querySelectorAll:()=>[]}),syncConnectionButton(){},addDescriptionCopy(){},
    visibilityId:(_,code)=>code,productObj:()=>({hasPrice:false,priceText:''}),console};
  vm.createContext(context);vm.runInContext(selected,context);
  return {context,get editor(){return editor;},get focused(){return focused;},focus(input){focused=input;},counts:()=>({created,removed})};
}

test('Actualizar interfaz conserva campo de precio, foco, importe y botón Guardar',()=>{
  const env=priceEditorEnvironment();env.context.syncUI();
  const editor=env.editor,input=editor.children[0],save=editor.children[1];
  input.value='25000';env.focus(input);input.oninput();assert.equal(save.disabled,false);
  for(let i=0;i<4;i++)env.context.syncUI();
  assert.equal(env.editor,editor);assert.equal(env.focused,input);assert.equal(input.value,'25000');
  assert.equal(save.disabled,false);assert.deepEqual(env.counts(),{created:1,removed:0});
  input.disabled=save.disabled=true;save.textContent='Guardando…';
  env.context.syncUI();assert.equal(env.editor,editor);assert.equal(input.disabled,true);
  assert.equal(save.disabled,true);assert.equal(save.textContent,'Guardando…');
});

test('Cambiar de sección o retirar administración conserva la limpieza de editores',()=>{
  const env=priceEditorEnvironment();env.context.syncUI();const first=env.editor;
  env.context.syncAdminSectionUI(true);assert.notEqual(env.editor,first);
  assert.deepEqual(env.counts(),{created:2,removed:1});
  env.context.clearAdminDecorations();assert.equal(env.editor,null);
  assert.deepEqual(env.counts(),{created:2,removed:2});
});

test('Carga el código real completo y bloquea publicación antes de confirmar Visibilidad',()=>{
  const env=environment(),result=assess(env,fixture());env.sandbox.products=result.products;
  assert.equal(result.report.compatible,3);assert.equal(env.run('filterVisibleProducts(products).length'),0);
  assert.equal(env.sandbox.isCatalogProductPublic(result.products[0]),false);
});
test('Confirma visibilidad y conserva ocultación por sección omitida en navegación',async()=>{
  const env=environment();await confirmed(env);env.sandbox.products=assess(env,fixture()).products;
  env.run('window.applyCatalogNavigationOrder("!section,category,subcategory,public,!line,product",{rebuild:false})');
  assert.equal(env.run('filterVisibleProducts(products).length'),2);
  assert.equal(env.sandbox.isCatalogProductPublic(env.sandbox.products[2]),false);
});
test('Reordenar todas las columnas conserva identidad, nombre, valores y atributos',()=>{
  const env=environment(),table=fixture(),expected=assess(env,table).products;
  table.cols.reverse();table.rows.forEach(row=>row.c.reverse());
  assert.deepEqual(clone(assess(env,table).products),clone(expected));
});
test('Conserva decimales reales y separa el texto usado para edición optimista',()=>{
  const env=environment(),product=assess(env,fixture()).products[0];
  assert.equal(product.price,194974.5);assert.equal(product.priceText,'194.975');
  env.sandbox.product=product;
  // Se ejecuta la misma función privada que utiliza addPrice, sin enviar una operación.
  const start=adminSource.indexOf('  function previousPriceForEditor('),end=adminSource.indexOf('  function addPrice(',start);
  const valuesStart=adminSource.indexOf('  function priceValue('),valuesEnd=adminSource.indexOf('  function editable(',valuesStart);
  env.run(adminSource.slice(start,end)+adminSource.slice(valuesStart,valuesEnd));
  assert.equal(env.run('previousPriceForEditor(product,"194.975")'),'194975');
});
test('Precio y stock desconocidos permanecen desconocidos y no excluyen',()=>{
  const env=environment(),product=assess(env,fixture()).products[1];
  assert.equal(product.hasPrice,false);assert.equal(product.stock,null);assert.equal(product.cost,null);
  assert.equal(product.presentation,'');assert.equal(product.hasImage,false);assert.equal(env.run('shouldEnforceStockLimits()'),false);
});
test('Nombre vacío aísla una fila y se reincorpora al corregirla sin cambiar código',()=>{
  const env=environment(),table=fixture();table.rows[0].c[6]={v:null,f:''};
  let result=assess(env,table);assert.equal(result.report.pending,1);assert.equal(result.products.length,2);
  assert.match(result.report.records[0].causes[0].reason,/Nombre/);
  table.rows[0].c[6]={v:'Producto ficticio corregido'};result=assess(env,table);
  assert.equal(result.products.length,3);assert.equal(result.report.pending,0);
});
test('Código duplicado aísla ambas filas y preserva los otros productos',()=>{
  const env=environment(),table=fixture();table.rows.push(clone(table.rows[0]));
  const result=assess(env,table);assert.equal(result.products.length,2);assert.equal(result.report.pending,2);
  assert.equal(result.report.records.filter(row=>row.causes.some(cause=>cause.reason==='Código duplicado')).length,2);
});
test('Código inválido, categoría, sección y precio ambiguo tienen causas específicas',()=>{
  const env=environment();
  for(const [column,value,reason] of [[0,1.5,/Código/],[2,'',/Categoría/],[1,'',/Sección/],[7,'12,5 pesos',/Precio/],[7,-1,/Precio/]]){
    const table=fixture();table.rows[0].c[column]={v:value};const result=assess(env,table);
    assert.equal(result.products.length,2);assert.equal(result.report.pending,1);
    assert.ok(result.report.records[0].causes.some(cause=>reason.test(cause.reason)));
  }
});
test('Una fila malformada y una excepción al construir una ficha no abortan el lote',()=>{
  const env=environment(),table=fixture();table.rows.push(null);let result=assess(env,table);
  assert.equal(result.products.length,3);assert.equal(result.report.pending,1);
  env.sandbox.inputRows=env.run('readGoogleSheetProductRows(inputTable)');
  result=env.run('buildCompatibleGoogleSheetProducts(inputRows.map((row,index)=>({row,imageIndex:index===0?{get(){throw new TypeError("fallo controlado")}}:new Map()})))');
  assert.equal(result.products.length,2);assert.equal(result.report.pending,2);
});
test('Encabezado indispensable ausente o duplicado detiene la lectura ambigua',()=>{
  const env=environment(),table=fixture();table.cols[6].label='Campo sin nombre';assert.throws(()=>assess(env,table),/Nombre/);
  table.cols[6].label='Nombre';table.cols[18].label='NÓMBRE';assert.throws(()=>assess(env,table),/duplicado/);
});
test('No depende de A:Z y acepta un campo indispensable ubicado después de Z',()=>{
  const env=environment(),table=fixture();table.cols.push({label:'Auxiliar'});table.rows.forEach(row=>row.c.push({v:null}));
  table.cols.push(table.cols.splice(6,1)[0]);table.rows.forEach(row=>row.c.push(row.c.splice(6,1)[0]));
  assert.equal(assess(env,table).products.length,3);const query=new URL(env.run('googleSheetQueryUrl("prueba")'));
  assert.equal(query.searchParams.has('range'),false);assert.equal(query.searchParams.get('tq'),'select * limit 0');
});
test('Fallo o timeout de Visibilidad en primera carga deja cero productos públicos',async()=>{
  for(const mode of ['error','timeout']){const env=environment();mode==='error'?env.fail():env.timeout(25000);
    await env.sandbox.CATALOG_PUBLIC_VISIBILITY_READY;env.sandbox.products=assess(env,fixture()).products;
    assert.equal(env.sandbox.CATALOG_PUBLIC_VISIBILITY_CONFIRMED,false);assert.equal(env.run('filterVisibleProducts(products).length'),0);
  }
});
test('Fallo posterior conserva reglas y no publica nuevas filas o clasificaciones inciertas',async()=>{
  const env=environment();await confirmed(env);env.sandbox.products=assess(env,fixture()).products;
  assert.equal(env.run('filterVisibleProducts(products).length'),2);
  const retry=env.sandbox.refreshCatalogVisibility();env.fail();await retry;
  env.sandbox.products.push({...env.sandbox.products[0],id:'0001'});
  env.sandbox.products.push({...env.sandbox.products[0],id:'9997',category:'Nueva categoría'});
  assert.equal(env.run('filterVisibleProducts(products).length'),2);
  assert.ok(env.sandbox.CATALOG_VISIBILITY_RULES.has('seccion::otros productos'));
  const recover=env.sandbox.refreshCatalogVisibility();env.reply(visibility);await recover;
  assert.equal(env.run('filterVisibleProducts(products).length'),4);
});
test('Respuesta tardía tras timeout no altera la confirmación ni publica productos',async()=>{
  const env=environment(),node=env.requests.at(-1),cb=new URL(node.src).searchParams.get('callback');
  env.timeout(25000);await env.sandbox.CATALOG_PUBLIC_VISIBILITY_READY;env.sandbox[cb](visibility);
  assert.equal(env.sandbox.CATALOG_PUBLIC_VISIBILITY_CONFIRMED,false);
});
test('Visibilidad reordenada funciona; estados inválidos y reglas duplicadas cierran publicación',async()=>{
  const env=environment(),payload=clone(visibility);payload.reglas.reverse();
  await confirmed(env,payload);assert.equal(env.sandbox.CATALOG_PUBLIC_VISIBILITY_CONFIRMED,true);
  for(const bad of [()=>{const t=clone(visibility);t.reglas[0].oculto='X';return t;},()=>{const t=clone(visibility);t.reglas.push({...t.reglas[0],oculto:false});return t;}]){
    const another=environment();await confirmed(another,bad());assert.equal(another.sandbox.CATALOG_PUBLIC_VISIBILITY_CONFIRMED,false);
  }
});
test('No a la venta conserva exclusión comercial aunque sea compatible técnicamente',async()=>{
  const env=environment();await confirmed(env);const table=fixture();table.rows[0].c[15]={v:'No a la venta'};
  const result=assess(env,table);assert.equal(result.report.compatible,3);assert.equal(env.sandbox.isCatalogProductPublic(result.products[0]),false);
});
async function replyProductTable(env,table){
  env.reply({...table,rows:[]});
  await new Promise(resolve=>setImmediate(resolve));
  env.reply(table);
}
test('JSONP usa el adaptador real y rechaza schema ambiguo sin dejar promesa pendiente',async()=>{
  const env=environment();await confirmed(env);let pending=env.run('loadGoogleSheetRows()');await replyProductTable(env,fixture());
  assert.equal((await pending).length,3);pending=env.run('loadGoogleSheetRows()');const table=fixture();table.cols[6].label='';env.reply(table);
  await assert.rejects(pending,/Nombre/);
});
test('El diagnóstico no incluye precios, costos, descripciones ni documentos operativos',()=>{
  const env=environment(),result=assess(env,fixture());
  for(const row of result.report.records)assert.deepEqual(Object.keys(row).sort(),['causes','code','sourceRow','status']);
});
test('Carrito usa el precio real con decimales y conserva pendiente de precio',()=>{
  const env=environment();env.run('Object.assign(cart,{"9997":{id:"9997",qty:2,price:194974.5,hasPrice:true},"9998":{id:"9998",qty:1,price:0,hasPrice:false}})');
  assert.equal(env.run('cartTotalValue()'),389949);assert.equal(env.run('cartHasUnpricedItems()'),true);
});
test('Navegación sin Producto o sin niveles no crea fichas implícitas',()=>{
  const env=environment();env.sandbox.products=assess(env,fixture()).products;
  env.run('window.applyCatalogNavigationOrder("!section,category,!subcategory,!public,!line,!product",{rebuild:false});setSelectedNavigationValue("category","Cabello")');
  assert.equal(env.run('navigationViewModeForProducts(products).mode'),'terminal');
  env.run('window.applyCatalogNavigationOrder("!section,!category,!subcategory,!public,!line,!product",{rebuild:false})');
  assert.equal(env.run('navigationViewModeForProducts(products).mode'),'empty');
});
test('loadProducts integra el informe y conserva los compatibles aunque una fila falle',async()=>{
  const env=environment();await confirmed(env);const table=fixture();table.rows[0].c[6]={v:''};
  const pending=env.run('loadProducts({silent:true,refreshImages:false})');
  await new Promise(resolve=>setImmediate(resolve));await replyProductTable(env,table);assert.equal(await pending,true);
  assert.equal(env.sandbox.CATALOG_COMPATIBILITY_REPORT.pending,1);
  assert.equal(env.sandbox.CATALOG_COMPATIBILITY_REPORT.compatible,2);
  assert.equal(env.run('allLoadedProducts.length'),2);assert.equal(env.run('all.length'),1);
});
test('Un lote con todos los productos pendientes se refleja sin conservar fichas anteriores',async()=>{
  const env=environment();await confirmed(env);const table=fixture();table.rows.forEach(row=>row.c[6]={v:''});
  const pending=env.run('loadProducts({silent:true,refreshImages:false})');
  await new Promise(resolve=>setImmediate(resolve));await replyProductTable(env,table);assert.equal(await pending,true);
  assert.equal(env.run('all.length'),0);assert.equal(env.sandbox.CATALOG_COMPATIBILITY_REPORT.pending,3);
});
test('Costo o Stock no interpretable permanecen desconocidos sin excluir la ficha',()=>{
  const env=environment(),table=fixture();table.rows[0].c[8]={v:'Por verificar'};table.rows[0].c[9]={v:-1};
  const result=assess(env,table);assert.equal(result.report.pending,0);assert.equal(result.products[0].cost,null);assert.equal(result.products[0].stock,null);
});
test('Nombre con error de fórmula queda pendiente y no se reconstruye desde atributos',()=>{
  const env=environment(),table=fixture();table.rows[0].c[6]={v:'#REF!'};
  const result=assess(env,table);assert.equal(result.report.pending,1);assert.match(result.report.records[0].causes[0].reason,/Nombre/);
});
test('La entrada conserva canonical, SEO y versiones coherentes de los dos scripts',()=>{
  assert.match(htmlSource,/<link rel="canonical" href="https:\/\/irenismb\.github\.io\/stock\/natura\/catalogo\.html"/);
  assert.match(htmlSource,/id="ld-products"/);
  assert.ok(htmlSource.includes('catalogo-app.js?actualizacion=descripcion-dos-columnas-precios-unificados-2026-10-10-4'));
  assert.ok(htmlSource.includes('precios-admin.js?actualizacion=fichas-precios-unificados-2026-10-10-4'));
  for(const id of ['grid','q','priceAdminBtn','btn-cart'])assert.ok(htmlSource.includes('id="'+id+'"'));
});
test('Rango oficial opcional: todos los registros conservan nombre, código y valores reales',{skip:!process.env.CATALOG_PRODUCTS_FIXTURE},async()=>{
  const values=JSON.parse(fs.readFileSync(process.env.CATALOG_PRODUCTS_FIXTURE,'utf8')),env=environment();await confirmed(env);
  const result=assess(env,tableFromValues(values));assert.equal(result.report.pending,0);assert.equal(result.products.length,values.length-1);
  const index=label=>values[0].indexOf(label);
  if(index('Descripción integral del producto')>=0){
    env.sandbox.compactValues=values;
    const expected=env.run('compactValues.slice(1).map(row=>catalogDescriptionRecord(row[compactValues[0].indexOf("Descripción integral del producto")]))');
    result.products.forEach((product,i)=>{
      const fields=expected[i].byKey,price=env.run('catalogCompactNumber('+JSON.stringify(fields.get('precio')?.value||'')+')');
      assert.equal(product.id,fields.get('codigo').value.padStart(4,'0'));
      assert.equal(product.name,fields.get('nombre').value);
      assert.equal(product.price,price.value??0);assert.equal(product.hasPrice,price.value!==null);
      assert.equal(product.category,fields.get('categoria').value);assert.equal(product.section,fields.get('seccion').value);
    });
    const compact=values.map(row=>[row[index('Descripción integral del producto')],row[index('Orden de la ficha')>=0?index('Orden de la ficha'):index('Campos y orden de la ficha')]||'']);
    const migrated=assess(env,tableFromValues(compact));
    assert.equal(migrated.report.pending,0);
    assert.deepEqual(JSON.parse(JSON.stringify(migrated.products)),JSON.parse(JSON.stringify(result.products)));
  }else result.products.forEach((product,i)=>{const row=values[i+1];assert.equal(product.id,String(row[index('Código')]).padStart(4,'0'));assert.equal(product.name,row[index('Nombre')]);assert.equal(product.price,row[index('Precio')]||0);assert.equal(product.hasPrice,typeof row[index('Precio')]==='number');});
  assert.equal(new Set(result.products.map(p=>p.id)).size,result.products.length);
});

test('La configuración y visibilidad públicas consultan únicamente lector Apps Script de solo lectura',()=>{
  const env=environment();const node=env.requests.at(-1);const url=new URL(node.src);
  assert.equal(url.hostname,'script.google.com');assert.equal(url.searchParams.get('modo'),'visibilidad');
  assert.ok(url.searchParams.get('callback'));
  const config=env.run('loadRemoteCatalogConfiguration("__testControl")');
  const request=new URL(env.requests.at(-1).src);
  assert.equal(request.hostname,'script.google.com');assert.equal(request.searchParams.get('modo'),'config');
  env.reply({ok:true,valores:{REGISTRAR_VISITAS_PROPIAS:'DESACTIVADO',MOSTRAR_CANTIDAD_STOCK:'DESACTIVADO',MOSTRAR_PRECIOS_PRODUCTO:'ACTIVADO',ORDEN_NAVEGACION:'!section,category,subcategory,public,!line,product',ORDEN_PRODUCTOS:'price_asc'},publicadoEn:'2026-10-07T23:00:14.772Z'});
  return config.then(x=>assert.equal(x.valores.ORDEN_PRODUCTOS,'price_asc'));
});

function fichaLayoutEnvironment({width=350,descriptionHeight=48,factsHeight=150,empty=false}={}){
  const classes=()=>{const values=new Set();return {add:x=>values.add(x),remove:x=>values.delete(x),contains:x=>values.has(x),toggle(x,on){on?values.add(x):values.delete(x)}}};
  const properties=new Map();let layouts=0;
  const square={classList:classes(),style:{setProperty(k,v){properties.set(k,v);layouts++;}},getBoundingClientRect:()=>({width})};
  const description={textContent:empty?'':'Descripción ficticia completa',style:{}};
  const details={classList:classes(),open:false,hidden:empty,querySelector:()=>description,
    get scrollHeight(){return this.open?descriptionHeight:40;}};
  const row={textContent:'$ 25.000'};
  const attributes={parentNode:null};
  const facts={clientWidth:150,scrollWidth:150,
    get scrollHeight(){return Math.ceil(factsHeight*(width/350)*Number(properties.get('--ficha-fit')??1));}};
  attributes.parentNode=facts;
  const main={get clientHeight(){return Math.floor(width-width*32/420-(details.hidden?0:details.scrollHeight+width*12/420));}};
  square.querySelector=selector=>({'.product-details':details,'.ficha-facts':facts,'.ficha-main':main}[selector]);
  const card={querySelector:selector=>({'.ficha-square':square,'.ficha-attributes':attributes,'.row':row}[selector]||null)};
  const context=vm.createContext({card,getComputedStyle:()=>({fontSize:'14px',fontFamily:'Calibri'})});
  vm.runInContext(toolsSource,context);
  return {run:()=>vm.runInContext('fitCatalogFicha(card)',context),details,square,description,row,attributes,facts,main,properties,layouts:()=>layouts,setWidth:n=>{width=n;}};
}
test('Ficha corta muestra descripción completa sin desplegable y conserva tamaño cuadrado',()=>{
  const e=fichaLayoutEnvironment();e.run();
  assert.equal(e.details.classList.contains('ficha-description-inline'),true);
  assert.equal(e.details.open,true);assert.equal(e.square.classList.contains('ficha-description-expanded'),false);
  assert.equal(e.description.textContent,'Descripción ficticia completa');
});
test('Ficha extensa contrae sin recortar texto y conserva expansión al cambiar de ancho',()=>{
  const e=fichaLayoutEnvironment({descriptionHeight:850});e.run();
  assert.equal(e.details.classList.contains('ficha-description-inline'),false);assert.equal(e.details.open,false);
  e.details.open=true;e.setWidth(390);e.run();
  assert.equal(e.details.open,true);assert.equal(e.square.classList.contains('ficha-description-expanded'),true);
  assert.equal(e.description.textContent,'Descripción ficticia completa');
});
test('Descripción que cabe en pantalla amplia cambia a desplegable cuando el espacio disminuye',()=>{
  const e=fichaLayoutEnvironment({width:500,descriptionHeight:180,factsHeight:190});e.run();
  assert.equal(e.details.classList.contains('ficha-description-inline'),true);
  e.setWidth(320);e.run();assert.equal(e.details.classList.contains('ficha-description-inline'),false);assert.equal(e.details.open,false);
});
test('Descripción vacía no muestra control y los atributos extensos permanecen dentro del cuadrado',()=>{
  const e=fichaLayoutEnvironment({empty:true,factsHeight:480});e.run();
  assert.equal(e.details.hidden,true);assert.equal(e.attributes.parentNode,e.facts);
  assert.ok(Number(e.properties.get('--ficha-fit'))<1);
  assert.ok(e.facts.scrollHeight<=e.main.clientHeight);
  const layouts=e.layouts();e.run();assert.equal(e.layouts(),layouts,'El observador no reconstruye controles sin cambios');
});
test('Datos extensos y precio se ajustan juntos sin salir del cuadrado en anchos móviles',()=>{
  for(const width of [240,280,320,360,390,420,520]){
    const e=fichaLayoutEnvironment({width,factsHeight:680});e.run();
    assert.equal(e.attributes.parentNode,e.facts);
    assert.ok(e.facts.scrollHeight<=e.main.clientHeight,'Ancho '+width);
    assert.equal(e.properties.get('--ficha-unit'),width/420+'px');
    assert.equal(e.square.classList.contains('ficha-description-expanded'),false);
  }
});
test('El título omite solo los contenidos repetidos y conserva el nombre oficial y multipacks',()=>{
  const context=vm.createContext({});vm.runInContext(toolsSource,context);
  const cases=[
    ['Avon Senses colonia femenino 120 ml','120 ml','Avon Senses colonia femenino'],
    ['Crema 50ml','50 ml','Crema'],
    ['Crema 150 ml','50 ml','Crema 150 ml'],
    ['Perfume 50 mL','50 ml','Perfume'],
    ['Tratamiento 1,5 L','1.5 l','Tratamiento'],
    ['Kit 2 x 50 ml','50 ml','Kit 2 x 50 ml'],
    ['Natura desodorante unisex 80 g','80 g','Natura desodorante unisex'],
    ['Labial tono 50','50 ml','Labial tono 50']
  ];
  for(const [name,presentation,expected] of cases){
    context.product={name,presentation};
    assert.equal(vm.runInContext('catalogFichaName(product)',context),expected);
    assert.equal(context.product.name,name);
  }
});
test('Folleto conserva datos oficiales de la ficha y exportación sin precio',async()=>{
  const env=environment();await confirmed(env);vm.runInContext(toolsSource,env.context);
  env.sandbox.products=assess(env,fixture()).products;
  env.run('allLoadedProducts=products;window.CATALOG_INITIAL_LOAD_READY=true');
  const snapshot=env.run('buildFolletoSnapshot({scope:"selected",selectedIds:["9997"]})');
  assert.equal(snapshot.products.length,1);assert.equal(snapshot.settings.prices,false);
  assert.equal(snapshot.products[0].name,env.sandbox.products[0].name);
  assert.equal(snapshot.products[0].code,'Código 9997');
});
test('Precio de Folleto es opcional, conserva los importes reales y distingue precio desconocido',async()=>{
  const env=environment();await confirmed(env);vm.runInContext(toolsSource,env.context);
  env.sandbox.products=assess(env,fixture()).products;
  env.run('allLoadedProducts=products;window.CATALOG_INITIAL_LOAD_READY=true');
  const original=env.sandbox.products[0].price;
  const withPrice=env.run('buildFolletoSnapshot({scope:"selected",selectedIds:["9997","9998"],prices:true})');
  assert.equal(withPrice.settings.prices,true);
  assert.equal(withPrice.products.find(p=>p.id==='9997').priceText,new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(original));
  assert.equal(withPrice.products.find(p=>p.id==='9998').priceText,'Consultar precio');
  const withoutPrice=env.run('buildFolletoSnapshot({scope:"selected",selectedIds:["9997","9998"],prices:false})');
  assert.equal(withoutPrice.settings.prices,false);assert.ok(withoutPrice.products.every(p=>p.priceText===''));
  env.sandbox.a=withPrice;env.sandbox.b=withoutPrice;
  assert.notEqual(env.run('folletoPreparationKey(a,"marketplace")'),env.run('folletoPreparationKey(b,"marketplace")'));
  assert.equal(env.sandbox.products[0].price,original);
});
test('Ficha exportada ajusta datos y precio juntos, conserva descripción completa y los tres formatos',()=>{
  const rendered=[];
  const ctx={font:'400 32px Arial',measureText(text){return {width:String(text).length*parseFloat(this.font.match(/([\d.]+)px/)[1])*.52};},
    save(){},restore(){},translate(){},scale(){},beginPath(){},roundRect(){},closePath(){},fill(){},clip(){},fillRect(){},moveTo(){},lineTo(){},stroke(){},
    createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};},fillText(text){rendered.push(text);}};
  const p={id:'9997',name:'Producto ficticio con atributos extensos',presentation:'50 ml',code:'Código 9997',priceText:'$ 194.975',description:'Descripción completa. '.repeat(65),attributes:Array.from({length:9},(_,i)=>({label:'Dato '+i,value:'Información ficticia extensa para comprobar ajuste proporcional'}))};
  const context=vm.createContext({ctx,p});vm.runInContext(toolsSource,context);
  const measure=vm.runInContext('measureFicha(ctx,buildFichaModel(p))',context);context.measure=measure;
  assert.ok(measure.scale<1);assert.equal(measure.name.size/46,measure.price.size/44);
  assert.equal(measure.attributes.size/33,measure.price.size/44);
  assert.equal(measure.description.lines.join(' '),p.description.trim());
  vm.runInContext('renderFicha(ctx,{x:0,y:0,width:1080,height:1080,product:buildFichaModel(p),measure},null)',context);
  assert.ok(rendered.includes(p.priceText));assert.ok(rendered.some(t=>t.includes('Información')));
  for(const key of ['instagram','marketplace','document']){
    context.key=key;const plan=vm.runInContext('layoutFolleto({products:[p]},key,ctx)',context);
    assert.equal(plan.pages.length,1);assert.equal(plan.pages[0].cards[0].width,plan.pages[0].cards[0].height);
    assert.equal(plan.pages[0].cards[0].product.priceText,p.priceText);
    const format=vm.runInContext('FOLLETO_FORMATS[key]',context);assert.equal(plan.pages[0].width,format.width);assert.equal(plan.pages[0].height,format.height);
  }
});
test('Información lateral usa los mismos nodos y restaura el orden móvil sin duplicar enlaces',()=>{
  const container=()=>({children:[],append(node){node.parentNode?.children.splice(node.parentNode.children.indexOf(node),1);this.children.push(node);node.parentNode=this;},prepend(node){node.parentNode?.children.splice(node.parentNode.children.indexOf(node),1);this.children.unshift(node);node.parentNode=this;}});
  const social={},visit={},products={},socialHome=container(),visitHome=container(),left=container(),right=container();
  socialHome.append(social);visitHome.append(visit);visitHome.append(products);
  const media={matches:true,addEventListener(_,fn){this.change=fn;}};
  const document={querySelector:selector=>({'.social-contact-card':social,'.footer-visit-card':visit,'.catalog-navigation':left,'.catalog-contact':right}[selector])};
  const context=vm.createContext({document,window:{matchMedia:()=>media}});vm.runInContext(toolsSource,context);vm.runInContext('initCatalogInformationLayout()',context);
  assert.equal(social.parentNode,left);assert.equal(visit.parentNode,right);assert.equal(socialHome.hidden,true);
  for(let i=0;i<3;i++){
    media.matches=false;media.change();assert.equal(social.parentNode,socialHome);assert.equal(visitHome.children[0],visit);assert.equal(visitHome.children[1],products);assert.equal(socialHome.hidden,false);
    media.matches=true;media.change();assert.equal(left.children.length,1);assert.equal(right.children.length,1);
  }
});


const compactHeaders=['Descripción integral del producto','Campos y orden de la ficha'];
const compactDescription='Código interno del producto: 0042\nNombre comercial del producto: Kit de prueba: champú y crema\nSección del catálogo: Belleza y cuidado\nCategoría del producto: Cabello\nMarca: Natura\nLínea comercial: Lumina\nPúblico destinatario: Femeninos\nEstado comercial del producto: A la venta\nPrecio de venta: 25.000\nBeneficios y funciones del producto: Suaviza el cabello.\nDescripción sensorial y uso recomendado: Texto completo de prueba.\nEnlace de referencia del producto: https://example.com/item:42\nCosto de adquisición: 15000\nNúmero de serie: PRIVADO-123';
test('Dos columnas recuperan identidad, precio, navegación y filtros desde títulos',()=>{
  const env=environment(),r=assess(env,tableFromValues([compactHeaders,[compactDescription,'']]));
  assert.equal(r.report.pending,0);assert.equal(r.products[0].id,'0042');assert.equal(r.products[0].price,25000);
  assert.equal(r.products[0].line,'Lumina');assert.equal(r.products[0].public,'Femeninos');
  assert.equal(r.products[0].fichaSelectionExplicit,false);assert.equal(r.products[0].description,'Texto completo de prueba.\nSuaviza el cabello.');
});
test('Títulos cortos con acentos, dos puntos y orden arbitrario seleccionan valores exactos',()=>{
  const env=environment(),r=assess(env,tableFromValues([compactHeaders,[compactDescription,'precio:\nMarca:\nCódigo:\nNombre:\nLÍNEA:\nPrecio de venta:\nNo existe:\nCosto:']]));
  assert.deepEqual(Array.from(r.products[0].fichaFields,f=>f.key),['precio','marca','codigo','nombre','linea']);
  assert.equal(r.products[0].fichaFields[3].value,'Kit de prueba: champú y crema');
});
test('Referencias con dos puntos y valores multilínea se conservan sin inventar campos',()=>{
  const env=environment();env.sandbox.raw=compactDescription+'\nMateriales: Tela\nAlgodón suave';
  const record=env.run('catalogDescriptionRecord(raw)');
  assert.equal(record.byKey.get('referencia externa').value,'https://example.com/item:42');
  assert.equal(record.byKey.get('materiales').value,'Tela\nAlgodón suave');
});
test('Datos privados se excluyen de ficha, búsqueda y texto copiable',()=>{
  const env=environment(),r=assess(env,tableFromValues([compactHeaders,[compactDescription,'Costo:\nNúmero de serie:\nMarca:']]));
  assert.deepEqual(Array.from(r.products[0].fichaFields,f=>f.key),['marca']);
  assert.equal(r.products[0].cost,null);assert.equal(r.products[0].costText,'');
  assert.ok(!JSON.stringify(r.products[0]).includes('PRIVADO-123'));
  assert.ok(!JSON.stringify(r.products[0]).includes('15000'));
});
test('Títulos duplicados y códigos duplicados no eligen una fila arbitraria',()=>{
  const env=environment();
  assert.equal(assess(env,tableFromValues([compactHeaders,[compactDescription+'\nPrecio: 30000','']])).report.pending,1);
  assert.equal(assess(env,tableFromValues([compactHeaders,[compactDescription,''],[compactDescription,'']])).report.pending,2);
});
test('Precio vacío conserva consultar precio y un dato inválido deja la fila pendiente',()=>{
  const env=environment(),make=price=>assess(env,tableFromValues([compactHeaders,[compactDescription.replace('25.000',price),'']]));
  assert.equal(make('').products[0].hasPrice,false);assert.equal(make('').products[0].price,0);
  assert.equal(make('-100').report.pending,1);assert.equal(make('no disponible').report.pending,1);
});
test('La consulta compacta selecciona exclusivamente las dos columnas por sus encabezados',async()=>{
  const env=environment();await confirmed(env);const promise=env.run('loadGoogleSheetRows()');
  env.reply(tableFromValues([['Código interno del producto',...compactHeaders]]));await Promise.resolve();
  const url=new URL(env.requests.at(-1).src);assert.equal(url.searchParams.get('tq'),'select B,C');
  env.reply(tableFromValues([compactHeaders,[compactDescription,'Precio:']]));assert.equal((await promise)[0].code,'0042');
});
function compactPriceBackend(text=compactDescription,{duplicate=false,formula=false,concurrent=false,headers=compactHeaders}={}){
  let content=text,writes=0,reads=0,released=0;
  const cell={getFormula:()=>formula?'=FORMULA()':'',getValue(){reads++;return concurrent&&reads===1?content+'\nCambio ajeno: sí':content;},setValue(value){writes++;content=value;}};
  const sheet={getLastRow:()=>duplicate?3:2,getLastColumn:()=>2,getRange(row,col,count){
    if(row===1)return {getDisplayValues:()=>[headers]};
    if(count!==undefined)return {getDisplayValues:()=>duplicate?[[content],[content]]:[[content]]};
    return cell;
  }};
  const context=vm.createContext({SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){released++;}})},
    INVENTARIO_SPREADSHEET_ID:'prueba',INVENTARIO_SHEET_NAME:'Productos',INVENTARIO_HEADER_ROW:1});
  for(const name of ['admin-contextos.js','admin-precios.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'apps-script','administrar precios natura',name),'utf8'),context);
  return {run:source=>vm.runInContext(source,context),content:()=>content,writes:()=>writes,released:()=>released};
}
test('Administrador compacto actualiza únicamente el valor de precio y conserva todas las otras líneas',()=>{
  const env=compactPriceBackend();assert.equal(env.run('obtenerProductosPrecios().productos[0].codigo'),'0042');
  assert.equal(env.run('actualizarPrecioWeb("0042","30.000","25000").precioGuardado'),'30000');
  assert.equal(env.content(),compactDescription.replace('Precio de venta: 25.000','Precio de venta: 30000'));assert.equal(env.writes(),1);assert.equal(env.released(),1);
});
test('Administrador compacto agrega y vacía precio sin borrar identidad o atributos',()=>{
  const original=compactDescription.replace('\nPrecio de venta: 25.000',''),env=compactPriceBackend(original);
  env.run('actualizarPrecioWeb("0042","12000","")');assert.equal(env.content(),original+'\nPrecio de venta: 12000');
  env.run('actualizarPrecioWeb("0042","","12000")');assert.equal(env.content(),original+'\nPrecio de venta: ');
});
test('Administrador rechaza conflictos, fórmulas, códigos o precios ambiguos sin escribir',()=>{
  for(const options of [{duplicate:true},{formula:true},{concurrent:true}]){
    const env=compactPriceBackend(compactDescription,options);assert.throws(()=>env.run('actualizarPrecioWeb("0042","30000","25000")'));assert.equal(env.writes(),0);assert.equal(env.released(),1);
  }
  for(const text of [compactDescription+'\nPrecio: 1',compactDescription+'\nCódigo: 0042']){
    const env=compactPriceBackend(text);assert.throws(()=>env.run('actualizarPrecioWeb("0042","30000","25000")'));assert.equal(env.writes(),0);
  }
  const env=compactPriceBackend();assert.throws(()=>env.run('actualizarPrecioWeb("0042","30000","20000")'));assert.equal(env.writes(),0);
});
test('Ficha conserva orden explícito de atributos alrededor de nombre y precio y descripción al pie',()=>{
  const nodes={},node=tag=>({tag,children:[],hidden:false,classList:{add(){},toggle(){}},setAttribute(){},addEventListener(){},append(...items){for(const item of items){item.parent?.children.splice(item.parent.children.indexOf(item),1);this.children.push(item);item.parent=this;}},prepend(item){this.children.unshift(item);}});
  for(const selector of ['.name','.img','.pad','.product-details','.description','.meta','.row','.product-line'])nodes[selector]=node(selector);
  nodes['.img'].querySelector=()=>node('img');nodes['.product-details'].querySelector=()=>node('summary');
  const card=node('card');card.append(...Object.values(nodes));
  card.querySelector=selector=>{const find=parent=>parent===nodes[selector]?parent:parent.children.map(find).find(Boolean);return find(card)||null;};
  const context=vm.createContext({document:{createElement:node},stockMetaText:()=>'',folletoPresentation:()=>'',folletoProductAttributes:()=>[],
    buildFichaModel:p=>p,drawCatalogFichaImage(){},queueCatalogFichaLayout(){}});
  const start=toolsSource.indexOf('function renderCatalogFicha('),end=toolsSource.indexOf('const CATALOG_FICHA_LAYOUT_KEYS',start);
  vm.runInContext(toolsSource.slice(start,end),context);
  context.card=card;context.product={name:'Kit',description:'Texto completo',fichaSelectionExplicit:true,fichaFields:[{key:'marca',label:'Marca',value:'Natura'},{key:'precio',label:'Precio',value:'25000'},{key:'nombre',label:'Nombre',value:'Kit'},{key:'codigo',label:'Código',value:'0042'}]};
  vm.runInContext('renderCatalogFicha(card,product)',context);
  const square=card.children[0],main=square.children[0],facts=main.children[1];
  assert.equal(square.children[1],nodes['.product-details']);
  assert.deepEqual(facts.children.filter(n=>!n.hidden).map(n=>n===nodes['.name']?'Nombre':n===nodes['.row']?'Precio':n.children[0]?.children[0]?.textContent),['Marca:','Precio','Nombre','Código:']);
});

test('Orden de la ficha reconoce el nuevo encabezado y rechaza selecciones ambiguas',()=>{
  const env=environment(),headers=['Descripción integral del producto','Orden de la ficha'];
  assert.equal(assess(env,tableFromValues([headers,[compactDescription,'Marca:\nNombre:']])).report.pending,0);
  assert.throws(()=>assess(env,tableFromValues([['Descripción integral del producto','Orden de la ficha','Campos y orden de la ficha'],[compactDescription,'Nombre:','Marca:']])),/ambiguo/);
  assert.throws(()=>assess(env,tableFromValues([['Descripción integral del producto'],[compactDescription]])),/Orden de la ficha/);
});
test('La presentación seleccionada conserva contenido y componentes sin exigir un título vacío',()=>{
  const env=environment(),headers=['Descripción integral del producto','Orden de la ficha'];
  const description=compactDescription+'\nTipo de producto: Esencia capilar\nCantidad de contenido: 60\nUnidad de medida del contenido: ml\nCondición del producto: Nuevo';
  const order='Nombre:\nPresentación:\nCódigo:\nMarca:\nLínea:\nTipo:\nVariante:\nCaracterística:\nCategoría:\nSubcategoría:\nPúblico:\nPrecio:';
  const product=assess(env,tableFromValues([headers,[description,order]])).products[0];
  assert.equal(product.fichaFields.find(f=>f.key==='presentacion').value,'60 ml');
  assert.equal(product.fichaFields.find(f=>f.key==='tipo').value,'Esencia capilar');
  assert.equal(product.condition,'Nuevo');assert.equal(product.fichaFields.some(f=>f.key==='condicion'),false);
  const kit=description.replace('\nCantidad de contenido: 60','')+'\nNombre del componente 1: Champú\nCantidad de contenido del componente 1: 300\nUnidad de medida del contenido del componente 1: ml';
  assert.match(assess(env,tableFromValues([headers,[kit,order]])).products[0].fichaFields.find(f=>f.key==='presentacion').value,/Champú 300 ml/);
});
test('El administrador conserva la edición segura con Orden de la ficha y rechaza encabezados dobles',()=>{
  const env=compactPriceBackend(compactDescription,{headers:['Descripción integral del producto','Orden de la ficha']});
  assert.equal(env.run('actualizarPrecioWeb("0042","30000","25000").precioGuardado'),'30000');
  const conflict=compactPriceBackend(compactDescription,{headers:['Descripción integral del producto','Orden de la ficha','Campos y orden de la ficha']});
  assert.throws(()=>conflict.run('actualizarPrecioWeb("0042","30000","25000")'),/ambiguo/);assert.equal(conflict.writes(),0);
});
test('La consulta descubre Orden de la ficha por encabezado con columnas reordenadas',async()=>{
  const env=environment();await confirmed(env);const promise=env.run('loadGoogleSheetRows()');
  const headers=['Orden de la ficha','Descripción integral del producto'];
  env.reply(tableFromValues([headers]));await Promise.resolve();
  assert.equal(new URL(env.requests.at(-1).src).searchParams.get('tq'),'select B,A');
  env.reply(tableFromValues([headers,['Tipo:\nPresentación:',compactDescription+'\nTipo de producto: Esencia capilar\nCantidad de contenido: 60\nUnidad de medida del contenido: ml']]));
  const row=(await promise)[0];assert.deepEqual(Array.from(row.fichaFields,f=>f.key),['tipo','presentacion']);
});

test('Mostrar precio comparte preferencia entre Folleto y ficha, sin símbolo de moneda',async()=>{
  const env=environment();await confirmed(env);vm.runInContext(toolsSource,env.context);
  env.sandbox.products=assess(env,fixture()).products;env.run('allLoadedProducts=products;window.CATALOG_INITIAL_LOAD_READY=true');
  const price=env.sandbox.products[0].price;
  assert.equal(env.run('shouldShowFichaPrices()'),false);
  env.run('setCatalogFichaPriceVisibility(true)');
  assert.equal(env.run('shouldShowFichaPrices()'),true);
  assert.equal(env.sandbox.localStorage.getItem('natura-ficha-mostrar-precio'),'true');
  const snapshot=env.run('buildFolletoSnapshot({scope:"selected",selectedIds:["9997"]})');
  assert.equal(snapshot.settings.prices,true);assert.ok(!snapshot.products[0].priceText.includes('$'));
  assert.equal(snapshot.products[0].priceText,new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(price));
  assert.equal(env.sandbox.products[0].price,price);
  env.run('setCatalogFichaPriceVisibility(false)');
  assert.equal(env.run('buildFolletoSnapshot({scope:"selected",selectedIds:["9997"]}).products[0].priceText'),'');
  env.run('setCatalogFichaPriceVisibility(true);window.INTERRUPTORES.MOSTRAR_PRECIOS_PRODUCTO=false');
  assert.equal(env.run('shouldShowFichaPrices()'),false);
  assert.equal(env.run('buildFolletoSnapshot({scope:"selected",selectedIds:["9997"],prices:true}).settings.prices'),false);
});
test('Ficha oculta precio y separador, conserva carrito y editor al cambiar Mostrar precio',()=>{
  const env=environment(),classes=new Set(),price={textContent:'',hidden:false};
  const row={hidden:false,classList:{toggle(key,value){value?classes.add(key):classes.delete(key);}}};
  const actions={hidden:false,classList:{toggle(){}}},qty={classList:{toggle(){}}};
  let editing=null;
  const card={dataset:{id:'9997'},querySelector(selector){return ({'.row':row,'.price':price,'.actions':actions,'[data-role="qty"]':qty,'.price-admin-editor':editing})[selector]||null;}};
  env.sandbox.card=card;env.sandbox.product={id:'9997',price:20000,hasPrice:true,fichaSelectionExplicit:true,fichaFields:[{key:'precio'}]};
  env.document.querySelectorAll=selector=>selector==='.catalog-ficha-card'?[card]:[];
  env.run('allLoadedProducts=[product];refreshCardUI(card,product)');
  assert.equal(row.hidden,true);assert.equal(price.hidden,true);assert.equal(classes.has('ficha-price-suppressed'),true);
  env.run('setCatalogFichaPriceVisibility(true)');
  assert.equal(row.hidden,false);assert.equal(price.hidden,false);assert.equal(price.textContent,'20.000');assert.equal(actions.hidden,false);
  env.run('cart["9997"]={qty:2};setCatalogFichaPriceVisibility(false)');
  assert.equal(row.hidden,false);assert.equal(qty.textContent,'2 en carrito');assert.equal(classes.has('ficha-price-suppressed'),true);
  editing={input:{value:'25000',disabled:true},save:{disabled:true}};
  env.run('delete cart["9997"];refreshCardUI(card,product)');
  assert.equal(row.hidden,false);assert.equal(price.hidden,true);assert.equal(editing.input.value,'25000');assert.equal(editing.save.disabled,true);
  editing=null;env.run('refreshCardUI(card,product)');assert.equal(row.hidden,true);
});
test('El Folleto justifica líneas completas sin estirar los finales de párrafo ni agregar espacios verticales',()=>{
  const drawn=[],ctx={measureText:text=>({width:text.length*2}),fillText(text,x,y){drawn.push({text,x,y});}};
  const context=vm.createContext({ctx});vm.runInContext(toolsSource,context);
  context.text='uno dos tres cuatro cinco seis\nsiete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho';
  context.measure=vm.runInContext('({lines:folletoLines(ctx,text,80),size:10,lineHeight:12})',context);
  vm.runInContext('folletoDrawText(ctx,measure,0,0,80,false,true)',context);
  for(const end of context.measure.lines.paragraphEnds){
    const line=drawn.filter(d=>d.y===end*12);assert.equal(line.length,1);assert.equal(line[0].text,context.measure.lines[end]);
  }
  assert.equal(new Set(drawn.map(d=>d.y)).size,context.measure.lines.length);
  assert.equal(drawn.map(d=>d.text).join(' ').replace(/\s+/g,' '),context.text.replace(/\s+/g,' '));
});
