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

const headers = ['Código','Sección','Categoría','Subcategoría','Familia olfativa','Condición','Nombre','Precio','Costo','Stock','Referencia externa','Descripción','Código Natura','Línea','Público','Estado comercial','Marketplace','Nombre anterior','Marca','Tipo de producto','Variante','Característica','Presentación','Contenido','Unidad','Cantidad de unidades'];
const samples = [
  [9997,'Belleza y cuidado','Cabello','','','','Producto ficticio para prueba',194974.5],
  [9998,'Belleza y cuidado','Cabello','','','','Segundo producto ficticio',''],
  [9999,'Otros productos','Medicamentos','','','','Registro ficticio oculto',10]
];
const visibility = {ok:true,reglas:[{tipo:'seccion',identificador:'otros productos',oculto:true,etiqueta:'Otros productos'}]};
function tableFromValues(values){
  const [labels,...rows]=values;
  return {cols:labels.map(label=>({label})),rows:rows.map(row=>({c:labels.map((label,i)=>{
    const v=row[i]??null;
    return {v:v===''?null:v,f:v===null||v===''?'':label==='Código'?String(v).padStart(4,'0'):['Precio','Costo','Stock'].includes(label)&&typeof v==='number'?new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(v):String(v)};
  })}))};
}
function clone(value){return JSON.parse(JSON.stringify(value));}

function environment(){
  const elements=new Map(),timers=new Map(),requests=[],events=new Map(),storage=new Map();
  let timerId=0,context;
  class Node {
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={setProperty(){}};this.value='';this.textContent='';this.attributes={};this.hidden=false;this.listeners=new Map();this.classList={add(){},remove(){},toggle(){},contains(){return false}};}
    appendChild(node){this.children.push(node);node.parentNode=this;if(node.tagName==='SCRIPT')requests.push(node);return node;}
    append(...nodes){nodes.forEach(node=>this.appendChild(node));}
    removeChild(node){node.remove();return node;}
    replaceChildren(...nodes){this.children=[];this.append(...nodes);}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}
    setAttribute(name,value){this.attributes[name]=value;}
    getAttribute(name){return this.attributes[name]??null;}
    addEventListener(name,fn){this.listeners.set(name,fn);}
    querySelector(){return null;}
    querySelectorAll(){return [];}
    insertAdjacentElement(_,node){return this.appendChild(node);}
  }
  const document={head:new Node('head'),body:new Node('body'),documentElement:new Node('html'),visibilityState:'visible',
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
  assert.equal(query.searchParams.has('range'),false);assert.equal(query.searchParams.get('tq'),'select *');
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
test('JSONP usa el adaptador real y rechaza schema ambiguo sin dejar promesa pendiente',async()=>{
  const env=environment();await confirmed(env);let pending=env.run('loadGoogleSheetRows()');env.reply(fixture());
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
  await new Promise(resolve=>setImmediate(resolve));env.reply(table);assert.equal(await pending,true);
  assert.equal(env.sandbox.CATALOG_COMPATIBILITY_REPORT.pending,1);
  assert.equal(env.sandbox.CATALOG_COMPATIBILITY_REPORT.compatible,2);
  assert.equal(env.run('allLoadedProducts.length'),2);assert.equal(env.run('all.length'),1);
});
test('Un lote con todos los productos pendientes se refleja sin conservar fichas anteriores',async()=>{
  const env=environment();await confirmed(env);const table=fixture();table.rows.forEach(row=>row.c[6]={v:''});
  const pending=env.run('loadProducts({silent:true,refreshImages:false})');
  await new Promise(resolve=>setImmediate(resolve));env.reply(table);assert.equal(await pending,true);
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
  assert.ok(htmlSource.includes('catalogo-app.js?actualizacion=lector-publico-control-2026-10-08-1'));
  assert.ok(htmlSource.includes('precios-admin.js?actualizacion=lector-publico-control-2026-10-08-1'));
  for(const id of ['grid','q','priceAdminBtn','btn-cart'])assert.ok(htmlSource.includes('id="'+id+'"'));
});
test('Rango oficial opcional: todos los registros conservan nombre, código y valores reales',{skip:!process.env.CATALOG_PRODUCTS_FIXTURE},async()=>{
  const values=JSON.parse(fs.readFileSync(process.env.CATALOG_PRODUCTS_FIXTURE,'utf8')),env=environment();await confirmed(env);
  const result=assess(env,tableFromValues(values));assert.equal(result.report.pending,0);assert.equal(result.products.length,values.length-1);
  const index=label=>values[0].indexOf(label);
  result.products.forEach((product,i)=>{const row=values[i+1];assert.equal(product.id,String(row[index('Código')]).padStart(4,'0'));assert.equal(product.name,row[index('Nombre')]);assert.equal(product.price,row[index('Precio')]||0);assert.equal(product.hasPrice,typeof row[index('Precio')]==='number');});
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
