// Folleto: una fuente, un snapshot, un layout y un renderer para todas las salidas.
const FOLLETO_SELECTION=new Set();
const FOLLETO_FORMATS=Object.freeze({
  instagram:{width:1080,height:1350,label:"Instagram",extension:"png"},
  marketplace:{width:1200,height:1200,label:"Marketplace",extension:"png"},
  document:{width:1191,height:1684,label:"Documento",extension:"pdf"}
});
const FOLLETO_FONT="Calibri, Carlito, Arial, sans-serif";
















function buildFolletoSnapshot(options={}){
  if(window.CATALOG_INITIAL_LOAD_READY!==true) throw new Error("Espera a que termine de cargar el catálogo.");
  if(window.CATALOG_PUBLIC_VISIBILITY_CONFIRMED!==true) throw new Error("No se pudo comprobar la visibilidad. Recarga el catálogo.");
  const admin=window.CATALOG_ADMIN_MODE_ACTIVE===true;
  const includeHidden=admin&&options.includeHidden===true;
  const includeNotForSale=admin&&options.includeNotForSale===true;
  const scope=["branch","filtered","selected"].includes(options.scope)?options.scope:"branch";
  const explicit=FOLLETO_SELECTION.size?FOLLETO_SELECTION:new Set(cartItemsArray().map(p=>String(p.id)));
  const selected=new Set(options.selectedIds||explicit);
  const eligible=p=>p&&!p.isGiftGalleryImage&&/^\d{4}$/.test(String(p.id))
    &&(includeHidden||!window.isCatalogProductHidden(p))
    &&(includeNotForSale||normalizeText(p.commercialStatus)!=="no a la venta");
  let source=allLoadedProducts.filter(eligible);
  if(scope==="selected") source=source.filter(p=>selected.has(String(p.id)));
  else source=scopedProductsForCurrentNavigation(source);
  if(scope==="filtered"){
    const terms=getCombinedWordTerms();
    if(terms.length) source=filterSearchExcludedProducts(source).filter(p=>terms.every(t=>p.searchKey.includes(t)));
    if(admin&&window.CATALOG_ADMIN_MISSING_PRICE_ONLY===true)source=source.filter(p=>p.hasPrice===false);
    if(admin&&window.CATALOG_ADMIN_HIDE_HIDDEN===true&&!includeHidden)source=source.filter(p=>!window.isCatalogProductHidden(p));
  }
  source.sort(compareCatalogProductOrder);
  const settings=Object.freeze({
    prices:options.prices===true,
    descriptions:options.descriptions!==false,codes:options.codes!==false,
    images:options.images!==false&&shouldShowProductImages()
  });
  const seen=new Set();
  const products=source.filter(p=>{const id=String(p.id);if(seen.has(id))return false;seen.add(id);return true;}).map(p=>Object.freeze({
    id:String(p.id),name:settings.prices?catalogFichaName(p):String(p.name||"").trim(),
    priceText:settings.prices?(p.hasPrice===false?"Consultar precio":fmtCOP.format(p.price)):"",
    description:settings.descriptions?String(p.description||"").trim():"",
    code:settings.codes?`Código ${p.id}`:"",
    line:String(p.line||"").trim(),
    presentation:folletoPresentation(p),
    attributes:Object.freeze(folletoProductAttributes(p)),
    imageUrl:settings.images?String(p.docsImageUrl||"").trim():"",
    route:navigationOrderedLevels().filter(l=>l!=="product").map(l=>String(navigationValueForProduct(p,l)||"").trim()).filter(Boolean).join(" · ")
  }));
  const title=scope==="selected"?"Selección de productos":navigationOrderedLevels().filter(l=>l!=="product").map(l=>String(selectedNavigationValue(l)||"").trim()).filter(Boolean).join(" › ")||"Productos";
  return Object.freeze({scope,title,settings,adminExtras:includeHidden||includeNotForSale,products:Object.freeze(products)});
}
















function folletoFont(ctx,size,bold=false){ctx.font=`${bold?700:400} ${size}px ${FOLLETO_FONT}`;}
function folletoLines(ctx,text,width){
  const result=[];
  for(const paragraph of String(text||"").replace(/\r/g,"").split("\n")){
    let line="";
    for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){
      if(line&&ctx.measureText(line+" "+word).width>width){result.push(line);line="";}
      if(ctx.measureText(word).width>width){
        if(line){result.push(line);line="";}
        for(const char of word){if(line&&ctx.measureText(line+char).width>width){result.push(line);line="";}line+=char;}
      }else line=line?line+" "+word:word;
    }
    if(line)result.push(line);
  }
  return result;
}
// Una sola ficha cuadrada, con precio opcional, para todas las salidas.
const FICHA_SIZE=Object.freeze({width:1080,height:1080});
// Shared palette and image blending for exported and interactive fichas.
const FICHA_THEME=Object.freeze({paper:"#fffaf5",center:"#fff1ed",wash:"#f6d5d7",line:"#bb9151",blend:"multiply"});
const FOLLETO_COMPANY=Object.freeze({
  name:"IRENISMB STOCK NATURA",subtitle:"Consultores independientes de Natura y AVON",
  phone:"304 208 8961",location:"Los Almendros, Santa Marta",
  catalog:"irenismb.github.io/stock/natura/catalogo.html"
});
const FOLLETO_WHATSAPP_PATH="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";
















function folletoPresentation(p){
  // Tomar únicamente datos literales disponibles; nunca inventar contenidos o tamaños.
  const explicit=[p.presentation||p.presentacion,[p.content,p.unit].filter(Boolean).join(" "),p.units?`${p.units} unidades`:""].filter(Boolean).join(" · ").trim();
  if(explicit)return explicit;
  const text=String(p.name||"")+" "+String(p.description||"");
  const units=[...text.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:ml|mL|l|L|g|kg|und\.?|unidades)\b/gi)];
  return [...new Set(units.map(m=>m[0].trim()))].slice(0,3).join(" · ");
}
function folletoProductAttributes(p){
  if(p.fichaSelectionExplicit)return (p.fichaFields||[]).filter(f=>!["nombre","precio","codigo"].includes(f.key)).map(({label,value})=>Object.freeze({label,value:String(value)}));
  return [["Marca",p.brand],["Línea",p.line],["Tipo",p.productType],
    ["Variante",p.variant],["Característica",p.characteristic],
    ["Categoría",p.category],["Subcategoría",p.subcategory],["Público",p.public],
    ["Condición",p.condition]]
    .filter(([,value])=>String(value||"").trim())
    .map(([label,value])=>Object.freeze({label,value:String(value).trim()}));
}
function buildFichaModel(product){
  return {
    id:String(product.id),name:String(product.name||""),
    line:String(product.line||""),presentation:String(product.presentation||""),
    code:String(product.code||""),description:String(product.description||""),priceText:String(product.priceText||""),
    attributes:Array.isArray(product.attributes)?product.attributes:[],imageUrl:String(product.imageUrl||"")
  };
}
function catalogFichaName(product){
  const quantity=/\b\d+(?:[.,]\d+)?\s*(?:ml|kg|g|l|und\.?|unidades)\b/gi;
  const token=value=>value.toLowerCase().replace(/\s/g,"").replace(",",".");
  const contents=new Set((folletoPresentation(product).match(quantity)||[]).map(token));
  const name=String(product.name||"");
  return name.replace(quantity,(value,offset)=>{
    // Preserve multipack expressions unless their entire presentation is repeated.
    if(/\b\d+\s*[x×]\s*$/i.test(name.slice(0,offset)))return value;
    return contents.has(token(value))?"":value;
  }).replace(/\(\s*\)/g,"").replace(/\s+/g," ").replace(/[\s·,;:+–—-]+$/g,"").trim()||name;
}
// Interactive renderer: same ficha model and visual identity, with native text and controls.
function renderCatalogFicha(card,p){
  const model=buildFichaModel({...p,code:stockMetaText(p),
    presentation:folletoPresentation(p),attributes:folletoProductAttributes(p),imageUrl:p.docsImageUrl});
  card.classList.add("catalog-ficha-card");
  const square=document.createElement("div");square.className="ficha-square";
  const main=document.createElement("div");main.className="ficha-main";
  const facts=document.createElement("div");facts.className="ficha-facts";
  const image=card.querySelector(".img"),pad=card.querySelector(".pad");
  const details=card.querySelector(".product-details"),description=card.querySelector(".description");
  const summary=details.querySelector("summary");
  details.hidden=!model.description;
  summary.setAttribute("aria-label","Descripción de "+model.name);
  // Reuse the existing nodes and handlers for image zoom, cart and price editing.
  facts.append(card.querySelector(".name"));
  const presentation=document.createElement("p");presentation.className="ficha-presentation";
  presentation.textContent=model.presentation;presentation.hidden=!model.presentation;facts.append(presentation);
  const meta=card.querySelector(".meta");facts.append(meta);
  const attributes=document.createElement("dl");attributes.className="ficha-attributes";
  for(const {label,value} of model.attributes){
    const item=document.createElement("div"),term=document.createElement("dt"),definition=document.createElement("dd");
    term.textContent=label+":";definition.textContent=value;item.append(term,definition);attributes.append(item);
  }
  attributes.hidden=!model.attributes.length;facts.append(attributes,card.querySelector(".row"));
  if(p.fichaSelectionExplicit){
    const name=card.querySelector(".name");
    name.hidden=true;presentation.hidden=true;meta.hidden=true;attributes.hidden=true;
    for(const field of p.fichaFields||[]){
      if(field.key==="nombre"){name.hidden=false;facts.append(name);continue;}
      if(field.key==="precio"){facts.append(card.querySelector(".row"));continue;}
      const list=document.createElement("dl");list.className="ficha-attributes";
      const item=document.createElement("div"),term=document.createElement("dt"),value=document.createElement("dd");
      term.textContent=field.label+":";value.textContent=field.value;item.append(term,value);list.append(item);facts.append(list);
    }
  }
  card.querySelector(".product-line").hidden=true;
  details.append(description);
  main.append(image,facts);square.append(main,details);
  card.prepend(square);
  image.querySelector("img").addEventListener("load",()=>drawCatalogFichaImage(card));
  details.addEventListener("toggle",()=>{
    if(details.classList.contains("ficha-description-inline"))return;
    square.classList.toggle("ficha-description-expanded",details.open);
  });
  queueCatalogFichaLayout();
}

const CATALOG_FICHA_LAYOUT_KEYS=new WeakMap();
let catalogFichaLayoutQueued=false,catalogFichasInitialized=false;
function queueCatalogFichaLayout(){
  if(catalogFichaLayoutQueued)return;
  catalogFichaLayoutQueued=true;
  requestAnimationFrame(()=>{
    catalogFichaLayoutQueued=false;
    for(const card of document.querySelectorAll("#grid .catalog-ficha-card"))fitCatalogFicha(card);
  });
}
function fitCatalogFicha(card){
  const square=card.querySelector(".ficha-square"),width=square.getBoundingClientRect().width;
  if(!width)return;
  const details=square.querySelector(".product-details"),description=details.querySelector(".description");
  const facts=square.querySelector(".ficha-facts"),main=square.querySelector(".ficha-main");
  const attributes=card.querySelector(".ficha-attributes");
  const editor=card.querySelector(".price-admin-editor"),row=card.querySelector(".row");
  const key=[Math.round(width*10),Boolean(editor),row.textContent,description.textContent,
    getComputedStyle(description).fontSize,getComputedStyle(facts).fontFamily].join("|");
  if(CATALOG_FICHA_LAYOUT_KEYS.get(card)===key)return;
  const expanded=details.open&&!details.classList.contains("ficha-description-inline");
  square.style.setProperty("--ficha-side",width+"px");
  square.style.setProperty("--ficha-unit",width/420+"px");
  square.classList.remove("ficha-description-expanded");
  details.classList.remove("ficha-description-inline");details.open=false;
  // Administration keeps its usable editor and original handlers in the controls footer.
  if(editor){
    const pad=card.querySelector(".pad");
    if(editor.parentNode!==pad)pad.append(editor);
  }
  if(!details.hidden){
    details.classList.add("ficha-description-inline");details.open=true;
    const fits=main.clientHeight>=width*.52&&details.scrollHeight<=width*.38;
    if(!fits){
      details.classList.remove("ficha-description-inline");details.open=false;
      square.style.setProperty("--ficha-main-height",main.clientHeight+"px");
    }
  }
  // Fit every fact together. Never move attributes below the square or clip their text.
  fitCatalogFichaFacts(square,facts,main);
  if(!details.hidden&&!details.classList.contains("ficha-description-inline")){
    square.style.setProperty("--ficha-main-height",main.clientHeight+"px");
    details.open=expanded;
    square.classList.toggle("ficha-description-expanded",expanded);
  }
  CATALOG_FICHA_LAYOUT_KEYS.set(card,key);
  drawCatalogFichaImage(card);
}
function fitCatalogFichaFacts(square,facts,main){
  const fits=()=>facts.scrollHeight<=main.clientHeight&&facts.scrollWidth<=facts.clientWidth;
  square.style.setProperty("--ficha-fit",1);
  if(fits())return;
  let low=0,high=1;
  // Binary search follows real line wrapping rather than counting characters or fields.
  for(let i=0;i<12;i++){
    const scale=(low+high)/2;square.style.setProperty("--ficha-fit",scale);
    if(fits())low=scale;else high=scale;
  }
  square.style.setProperty("--ficha-fit",low*.995);
}
function drawCatalogFichaImage(card){
  const box=card.querySelector(".img"),image=box?.querySelector("img");
  if(!image?.complete||!image.naturalWidth||image.dataset.fallbackTried==="1")return;
  const rect=box.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const scale=Math.min(window.devicePixelRatio||1,2),width=Math.round(rect.width*scale),height=Math.round(rect.height*scale);
  const key=image.currentSrc+"|"+width+"|"+height;
  if(box.dataset.fichaImageKey===key)return;
  let canvas=box.querySelector(".ficha-product-image");
  if(!canvas){canvas=document.createElement("canvas");canvas.className="ficha-product-image";canvas.setAttribute("aria-hidden","true");box.append(canvas);}
  canvas.width=width;canvas.height=height;
  // Reuse Folleto's white-margin detection and proportional renderer; the original image keeps zoom and alt text.
  folletoDrawImage(canvas.getContext("2d"),image,0,0,width,height,true);
  box.classList.add("ficha-image-ready");box.dataset.fichaImageKey=key;
}
function initCatalogFichas(){
  if(catalogFichasInitialized)return;catalogFichasInitialized=true;
  initCatalogInformationLayout();
  for(const [key,value] of Object.entries(FICHA_THEME))document.documentElement.style.setProperty("--ficha-"+key,value);
  const grid=document.getElementById("grid");if(!grid)return;
  if(typeof ResizeObserver!=="undefined")new ResizeObserver(queueCatalogFichaLayout).observe(grid);
  new MutationObserver(records=>{
    if(records.some(r=>r.target===grid||r.target.parentElement?.closest(".row")||
      [...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&n.matches?.(".price-admin-editor"))))queueCatalogFichaLayout();
  }).observe(grid,{childList:true,subtree:true,characterData:true});
  window.addEventListener("resize",queueCatalogFichaLayout);
  window.addEventListener("irenismb:precio-guardado",queueCatalogFichaLayout);
  window.addEventListener("irenismb:admin-section-change",queueCatalogFichaLayout);
  document.fonts?.ready.then(()=>{document.querySelectorAll(".catalog-ficha-card").forEach(c=>CATALOG_FICHA_LAYOUT_KEYS.delete(c));queueCatalogFichaLayout();});
  queueCatalogFichaLayout();
}
function initCatalogInformationLayout(){
  const social=document.querySelector(".social-contact-card"),visit=document.querySelector(".footer-visit-card");
  const left=document.querySelector(".catalog-navigation"),right=document.querySelector(".catalog-contact");
  if(!social||!visit||!left||!right)return;
  const socialHome=social.parentNode,visitHome=visit.parentNode;
  const desktop=window.matchMedia("(min-width:761px)");
  function arrange(){
    socialHome.hidden=desktop.matches;
    if(desktop.matches){left.append(social);right.append(visit);}
    else{socialHome.append(social);visitHome.prepend(visit);}
  }
  desktop.addEventListener("change",arrange);arrange();
}

function folletoFitText(ctx,text,width,height,ideal,minSize,bold=false,truncate=false){
  const content=String(text||"").trim();
  if(!content)return {lines:[],size:ideal,lineHeight:ideal*1.24};
  for(let size=ideal;size>=minSize;size-=1){
    folletoFont(ctx,size,bold);
    const lines=folletoLines(ctx,content,width),lineHeight=size*1.24;
    if(lines.length*lineHeight<=height)return {lines,size,lineHeight};
  }
  folletoFont(ctx,minSize,bold);
  const lines=folletoLines(ctx,content,width),lineHeight=minSize*1.24;
  if(!truncate)throw new Error("La ficha del producto "+(text||"").slice(0,65)+" necesita menos texto para caber completa.");
  const maxLines=Math.max(1,Math.floor(height/lineHeight));
  if(lines.length>maxLines){
    const visible=lines.slice(0,maxLines);let last=visible[maxLines-1];
    while(last.length>1&&ctx.measureText(last+"…").width>width)last=last.slice(0,-1);
    visible[maxLines-1]=last+"…";
    return {lines:visible,size:minSize,lineHeight,abbreviated:true};
  }
  return {lines,size:minSize,lineHeight};
}
function measureFicha(ctx,ficha){
  if(ficha.priceText)return measureFichaPriced(ctx,ficha);
  const hasImage=Boolean(ficha.imageUrl),textX=hasImage?562:54,textWidth=1080-textX-54;
  let lastError;
  // Ajustar la distribución completa antes de reducir o recortar información.
  for(let descriptionSize=32;descriptionSize>=18;descriptionSize--){
    try{
      const description=folletoFitText(ctx,ficha.description,972,470,descriptionSize,descriptionSize);
      const descriptionHeight=description.lines.length?description.lines.length*description.lineHeight+54:0;
      const mainHeight=972-descriptionHeight;
      const name=folletoFitText(ctx,ficha.name,textWidth,Math.min(260,mainHeight*.4),46,24,true);
      const presentation=folletoFitText(ctx,ficha.presentation,textWidth,95,29,22);
      const code=folletoFitText(ctx,ficha.code,textWidth,50,32,24,true);
      const used=name.lines.length*name.lineHeight+presentation.lines.length*presentation.lineHeight
        +code.lines.length*code.lineHeight+68;
      const attributes=folletoFitAttributes(ctx,ficha.attributes,textWidth,Math.max(30,mainHeight-used),29,18);
      return {name,presentation,description,code,attributes,mainHeight,textX,textWidth};
    }catch(error){lastError=error;}
  }
  throw lastError;
}
function measureFichaPriced(ctx,ficha){
  const textX=ficha.imageUrl?562:54,textWidth=1026-textX;
  // The exported image cannot expand: preserve the complete description and scale all facts together.
  for(let descriptionSize=32;descriptionSize>=1;descriptionSize--){
    let description;
    try{description=folletoFitText(ctx,ficha.description,972,470,descriptionSize,descriptionSize);}catch(_){continue;}
    const mainHeight=972-(description.lines.length?description.lines.length*description.lineHeight+54:0);
    function atScale(scale){
      const fit=(text,size,bold=false)=>folletoFitText(ctx,text,textWidth,mainHeight,size*scale,size*scale,bold);
      const name=fit(ficha.name,46,true),presentation=fit(ficha.presentation,36),code=fit(ficha.code,33);
      const attributes=folletoFitAttributes(ctx,ficha.attributes,textWidth,mainHeight,33*scale,33*scale);
      const price=fit(ficha.priceText,44,true);
      const used=[name,presentation,code,attributes,price].reduce((total,m)=>total+m.lines.length*m.lineHeight,0)+88*scale+4;
      if(used>mainHeight)throw new Error("Ajustando datos de la ficha.");
      return {name,presentation,code,attributes,price,description,mainHeight,textX,textWidth,scale,priced:true};
    }
    try{return atScale(1);}catch(_){}
    let low=0,high=1,result=null;
    for(let i=0;i<12;i++){
      const scale=(low+high)/2;
      try{result=atScale(scale);low=scale;}catch(_){high=scale;}
    }
    if(result)return result;
  }
  throw new Error("No se pudo acomodar la descripción completa en la ficha.");
}
function folletoAttributeLines(ctx,attributes,width,size){
  const lines=[];
  for(const attribute of attributes){
    const tokens=[...String(attribute.label+":").split(/\s+/).map(text=>({text,bold:true})),
      ...String(attribute.value).split(/\s+/).map(text=>({text,bold:false}))].filter(token=>token.text);
    let segments=[],lineWidth=0;
    const flush=()=>{if(segments.length)lines.push({segments,text:segments.map(s=>s.text).join(""),width:lineWidth});segments=[];lineWidth=0;};
    for(const token of tokens){
      folletoFont(ctx,size,token.bold);
      const pieces=folletoLines(ctx,token.text,width);
      for(let i=0;i<pieces.length;i++){
        if(pieces.length>1)flush();
        let text=(segments.length?" ":"")+pieces[i];
        if(segments.length&&lineWidth+ctx.measureText(text).width>width){flush();text=pieces[i];}
        segments.push({text,bold:token.bold});lineWidth+=ctx.measureText(text).width;
        if(i<pieces.length-1)flush();
      }
    }
    flush();
  }
  return lines;
}
function folletoFitAttributes(ctx,attributes,width,height,ideal,minSize){
  for(let size=ideal;size>=minSize;size--){
    const richLines=folletoAttributeLines(ctx,attributes,width,size),lineHeight=size*1.24;
    if(richLines.length*lineHeight<=height)return {lines:richLines.map(line=>line.text),richLines,size,lineHeight};
  }
  throw new Error("Las características del producto necesitan más espacio para caber completas.");
}
















function folletoRoundRect(ctx,x,y,w,h,r=18){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.closePath();
}
const FOLLETO_IMAGE_FRAMES=new WeakMap();
function folletoImageFrame(image){
  if(FOLLETO_IMAGE_FRAMES.has(image))return FOLLETO_IMAGE_FRAMES.get(image);
  const width=image.naturalWidth,height=image.naturalHeight;
  let frame={x:0,y:0,width,height};
  try{
    const canvas=document.createElement("canvas");canvas.width=canvas.height=96;
    const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0,96,96);
    const pixels=ctx.getImageData(0,0,96,96).data;
    const blank=(x,y)=>{const i=(y*96+x)*4;return pixels[i+3]<12||(pixels[i]>245&&pixels[i+1]>245&&pixels[i+2]>245);};
    // Quitar únicamente márgenes blancos o transparentes; conservar el producto y su sombra completos.
    if([[0,0],[95,0],[0,95],[95,95]].every(([x,y])=>blank(x,y))){
      let left=96,top=96,right=-1,bottom=-1;
      for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(!blank(x,y)){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      if(right>=left&&bottom>=top){
        left=Math.max(0,left-4);top=Math.max(0,top-4);right=Math.min(95,right+4);bottom=Math.min(95,bottom+4);
        frame={x:left/96*width,y:top/96*height,width:(right-left+1)/96*width,height:(bottom-top+1)/96*height};
      }
    }
  }catch(_){}
  FOLLETO_IMAGE_FRAMES.set(image,frame);return frame;
}
function folletoDrawImage(ctx,image,x,y,w,h,trimMargins=false){
  if(image){
    const frame=trimMargins?folletoImageFrame(image):{x:0,y:0,width:image.naturalWidth,height:image.naturalHeight};
    const ratio=Math.min(w/frame.width,h/frame.height);
    const iw=frame.width*ratio,ih=frame.height*ratio;
    ctx.drawImage(image,frame.x,frame.y,frame.width,frame.height,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
  }else{
    ctx.fillStyle="#f5e9e3";folletoRoundRect(ctx,x,y,w,h,14);ctx.fill();
    folletoFont(ctx,21);ctx.fillStyle="#000";ctx.textAlign="center";
    ctx.fillText("Imagen no disponible",x+w/2,y+h/2,w-20);ctx.textAlign="left";
  }
}
function renderFicha(ctx,card,image){
  const {x,y,width,height,product,measure}=card;
  const sx=width/FICHA_SIZE.width,sy=height/FICHA_SIZE.height;
  ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);
  const bg=ctx.createLinearGradient(0,0,1080,1080);
  bg.addColorStop(0,FICHA_THEME.paper);bg.addColorStop(.5,FICHA_THEME.center);bg.addColorStop(1,FICHA_THEME.paper);
  ctx.fillStyle=bg;folletoRoundRect(ctx,0,0,1080,1080,28);ctx.fill();
  ctx.save();ctx.clip();
  const wash=ctx.createRadialGradient(280,440,20,280,440,580);
  wash.addColorStop(0,FICHA_THEME.wash);wash.addColorStop(1,"#fff4ee00");
  ctx.fillStyle=wash;ctx.fillRect(0,0,1080,1080);
  ctx.restore();
  // La foto conserva su proporción y el producto completo. No se usan logos como suplentes.
  if(product.imageUrl){
    ctx.save();ctx.globalCompositeOperation=FICHA_THEME.blend;
    folletoDrawImage(ctx,image,32,40,498,measure.mainHeight+28,true);ctx.restore();
  }
  let textY=54;
  const spacing=measure.scale||1;
  textY=folletoDrawText(ctx,measure.name,measure.textX,textY,measure.textWidth,true,Boolean(measure.priced))+16*spacing;
  if(measure.presentation.lines.length)textY=folletoDrawText(ctx,measure.presentation,measure.textX,textY,measure.textWidth)+18*spacing;
  if(measure.code.lines.length){
    ctx.strokeStyle=FICHA_THEME.line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(measure.textX,textY);ctx.lineTo(1026,textY);ctx.stroke();
    textY=folletoDrawText(ctx,measure.code,measure.textX,textY+18*spacing,measure.textWidth,!measure.priced)+14*spacing;
  }
  folletoDrawText(ctx,measure.attributes,measure.textX,textY,measure.textWidth);
  if(measure.price?.lines.length){
    const priceY=54+measure.mainHeight-measure.price.lines.length*measure.price.lineHeight;
    ctx.strokeStyle=FICHA_THEME.line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(measure.textX,priceY-18*spacing);ctx.lineTo(1026,priceY-18*spacing);ctx.stroke();
    folletoDrawText(ctx,measure.price,measure.textX,priceY,measure.textWidth,true);
  }
  if(measure.description.lines.length){
    const descriptionY=54+measure.mainHeight+20;
    ctx.strokeStyle=FICHA_THEME.line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(54,descriptionY);ctx.lineTo(1026,descriptionY);ctx.stroke();
    folletoDrawText(ctx,measure.description,54,descriptionY+18,972,false,true);
  }
  ctx.restore();
}
function folletoDrawText(ctx,measure,x,y,width,bold=false,justify=false){
  folletoFont(ctx,measure.size,bold);ctx.fillStyle="#000";ctx.textAlign="left";
  if(measure.richLines){
    for(const line of measure.richLines){
      let left=x;
      for(const segment of line.segments){
        folletoFont(ctx,measure.size,segment.bold);ctx.fillText(segment.text,left,y);left+=ctx.measureText(segment.text).width;
      }
      y+=measure.lineHeight;
    }
    return y;
  }
  measure.lines.forEach((line,index)=>{
    const words=line.split(" ");
    if(justify&&index<measure.lines.length-1&&words.length>1){
      const wordWidth=words.reduce((n,word)=>n+ctx.measureText(word).width,0);
      const spacing=(width-wordWidth)/(words.length-1);
      // Evitar espacios excesivos en párrafos cortos.
      if(spacing<measure.size*.8){let left=x;for(const word of words){ctx.fillText(word,left,y);left+=ctx.measureText(word).width+spacing;}}
      else ctx.fillText(line,x,y);
    }else ctx.fillText(line,x,y);
    y+=measure.lineHeight;
  });
  return y;
}
function renderFolletoPDFHeader(ctx,width,assets){
  const x=85,y=85,w=width-170,h=192;
  ctx.save();ctx.textBaseline="top";ctx.textAlign="left";
  const bg=ctx.createLinearGradient(x,y,x+w,y+h);bg.addColorStop(0,"#f8e5e3");bg.addColorStop(.5,"#fffaf5");bg.addColorStop(1,"#f8e5e3");
  ctx.fillStyle=bg;folletoRoundRect(ctx,x,y,w,h,16);ctx.fill();
  ctx.save();ctx.globalCompositeOperation=FICHA_THEME.blend;folletoDrawImage(ctx,assets.logo,x+14,y+23,132,132);ctx.restore();
  const companyX=x+164,companyWidth=490,contactX=x+668,contactWidth=w-688;
  const company=folletoFitText(ctx,FOLLETO_COMPANY.name,companyWidth,72,29,25,true);
  const nameBottom=folletoDrawText(ctx,company,companyX,y+34,companyWidth,true);
  const subtitle=folletoFitText(ctx,FOLLETO_COMPANY.subtitle,companyWidth,62,21,18);
  folletoDrawText(ctx,subtitle,companyX,nameBottom+10,companyWidth);
  ctx.save();ctx.translate(contactX,y+34);ctx.scale(40/24,40/24);ctx.fillStyle="#18A957";
  ctx.fill(new Path2D(FOLLETO_WHATSAPP_PATH));ctx.restore();
  const phone=folletoFitText(ctx,FOLLETO_COMPANY.phone,contactWidth-50,44,30,25,true);
  folletoDrawText(ctx,phone,contactX+50,y+37,contactWidth-50,true);
  const location=folletoFitText(ctx,FOLLETO_COMPANY.location,contactWidth,55,21,18);
  folletoDrawText(ctx,location,contactX,y+89,contactWidth);
  const url=folletoFitText(ctx,FOLLETO_COMPANY.catalog,w-190,35,20,18);
  folletoDrawText(ctx,url,companyX,y+153,w-190);
  ctx.strokeStyle=FICHA_THEME.line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x+w,y+h);ctx.stroke();
  ctx.restore();
}
function folletoCardPositions(width,height,count,formatKey){
  // Máximo cuatro fichas completas por lienzo o página A4.
  const pdf=formatKey==="document",margin=pdf?85:46,gap=pdf?34:22;
  const footer=pdf?50:0,top=margin+(pdf?220:0);
  const columns=count===1?1:2,rows=Math.ceil(count/columns);
  const areaHeight=height-margin-top-footer;
  const cardWidth=Math.min((width-2*margin-(columns-1)*gap)/columns,
    (areaHeight-(rows-1)*gap)/rows);
  const cardHeight=cardWidth;
  const gridHeight=rows*cardHeight+(rows-1)*gap;
  const baseY=top+(pdf?0:(areaHeight-gridHeight)/2);
  return Array.from({length:count},(_,i)=>{
    const row=Math.floor(i/columns),itemsHere=Math.min(columns,count-row*columns);
    const rowWidth=itemsHere*cardWidth+(itemsHere-1)*gap;
    const startX=(width-rowWidth)/2;
    return {x:startX+(i%columns)*(cardWidth+gap),y:baseY+row*(cardHeight+gap),width:cardWidth,height:cardHeight};
  });
}
function layoutCollage(snapshot,formatKey,ctx){
  const format=FOLLETO_FORMATS[formatKey];
  if(!format)throw new Error("Formato no válido.");
  if(!snapshot.products.length)throw new Error("No hay productos para incluir con estas opciones.");
  const pages=[];
  for(let start=0;start<snapshot.products.length;start+=4){
    const group=snapshot.products.slice(start,start+4),positions=folletoCardPositions(format.width,format.height,group.length,formatKey);
    pages.push({width:format.width,height:format.height,cards:group.map((p,i)=>{
      const product=buildFichaModel(p);
      return {...positions[i],product,measure:measureFicha(ctx,product)};
    })});
  }
  return {formatKey,pages,productCount:snapshot.products.length};
}
function paginateFichasPDF(snapshot,ctx){return layoutCollage(snapshot,"document",ctx);}
function layoutFolleto(snapshot,formatKey="instagram",ctx){
  return formatKey==="document"?paginateFichasPDF(snapshot,ctx):layoutCollage(snapshot,formatKey,ctx);
}
// Solo en series de dos o más PNG: indicar la continuación excepto en la última.
function folletoShowNextIndicator(plan,pageIndex){
  return plan.formatKey!=="document"&&plan.pages.length>=2&&pageIndex<plan.pages.length-1;
}
function folletoDrawNextIndicator(ctx,page){
  // El tamaño y la posición de las fichas no se modifican: esta etiqueta cabe
  // en el margen exterior inferior de 46 px ya existente incluso con cuatro fichas.
  const margin=46,width=146,height=28;
  const x=page.width-margin-width,y=page.height-height-8;
  ctx.save();
  ctx.fillStyle="#f9e2e7";
  folletoRoundRect(ctx,x,y,width,height,14);
  ctx.fill();
  ctx.fillStyle="#933c55";
  ctx.textAlign="left";
  ctx.textBaseline="middle";
  folletoFont(ctx,18,true);
  ctx.fillText("Siguiente",x+13,y+height/2);
  ctx.strokeStyle="#933c55";
  ctx.lineWidth=2.3;
  ctx.lineJoin="round";
  ctx.lineCap="round";
  ctx.beginPath();
  ctx.moveTo(x+119,y+14);ctx.lineTo(x+132,y+14);
  ctx.moveTo(x+126,y+8);ctx.lineTo(x+132,y+14);ctx.lineTo(x+126,y+20);
  ctx.stroke();
  ctx.restore();
}
function renderFolleto(snapshot,plan,pageIndex,assets){
  const page=plan.pages[pageIndex],canvas=document.createElement("canvas");
  canvas.width=page.width;canvas.height=page.height;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("No se pudo preparar el folleto.");
  const background=ctx.createLinearGradient(0,0,page.width,page.height);
  background.addColorStop(0,"#fff8f1");background.addColorStop(.6,"#fbefe6");background.addColorStop(1,"#f9eae7");
  ctx.textBaseline="top";ctx.fillStyle=background;ctx.fillRect(0,0,page.width,page.height);
  if(plan.formatKey==="document")renderFolletoPDFHeader(ctx,page.width,assets);
  for(const card of page.cards)renderFicha(ctx,card,assets.images.get(card.product.id));
  if(folletoShowNextIndicator(plan,pageIndex))folletoDrawNextIndicator(ctx,page);
  if(plan.formatKey==="document"){
    ctx.fillStyle="#000";folletoFont(ctx,16);
    ctx.textAlign="right";
    ctx.fillText("Página "+(pageIndex+1)+" de "+plan.pages.length,page.width-85,page.height-45);
    ctx.textAlign="left";
  }
  return canvas;
}
function folletoAssertSession(snapshot,signal){
  if(signal?.aborted)throw new DOMException("Generación cancelada.","AbortError");
  if(snapshot.adminExtras&&window.CATALOG_ADMIN_MODE_ACTIVE!==true)throw new Error("La sesión administrativa terminó. Abre de nuevo Folleto.");
  if(window.CATALOG_PUBLIC_VISIBILITY_CONFIRMED!==true)throw new Error("La visibilidad del catálogo dejó de estar confirmada.");
}
function folletoLoadImage(url,signal){
  if(!url)return Promise.resolve(null);
  return new Promise((resolve,reject)=>{
    const img=new Image();let done=false;
    const finish=(value,error)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener("abort",abort);img.onload=img.onerror=null;error?reject(error):resolve(value);};
    const abort=()=>{img.src="";finish(null,new DOMException("Generación cancelada.","AbortError"));};
    const timer=setTimeout(()=>finish(null),8000);
    if(signal?.aborted){abort();return;}signal?.addEventListener("abort",abort,{once:true});
    img.crossOrigin="anonymous";img.onerror=()=>finish(null);
    img.onload=()=>{
      try{const c=document.createElement("canvas");c.width=c.height=1;const x=c.getContext("2d");x.drawImage(img,0,0,1,1);x.getImageData(0,0,1,1);finish(img);}catch(_){finish(null);}
    };img.src=url;
  });
}
function folletoCanvasBlob(canvas,mime="image/png"){
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("No se pudo preparar el archivo.")),mime,.94));
}
const FOLLETO_ASSET_CACHE=new Map();
async function folletoCachedImage(url,signal){
  if(!url)return null;
  if(FOLLETO_ASSET_CACHE.has(url)){
    const image=FOLLETO_ASSET_CACHE.get(url);
    FOLLETO_ASSET_CACHE.delete(url);FOLLETO_ASSET_CACHE.set(url,image);return image;
  }
  const image=await folletoLoadImage(url,signal);
  if(image){
    FOLLETO_ASSET_CACHE.set(url,image);
    while(FOLLETO_ASSET_CACHE.size>60)FOLLETO_ASSET_CACHE.delete(FOLLETO_ASSET_CACHE.keys().next().value);
  }
  return image;
}
function folletoPreparationKey(snapshot,formatKey){return formatKey+":"+JSON.stringify(snapshot);}
async function prepareFolletoPage(snapshot,plan,index,signal){
  folletoAssertSession(snapshot,signal);await document.fonts?.ready;
  const page=plan.pages[index],images=new Map(),missing=new Set();
  const products=new Map(page.cards.map(c=>[c.product.id,c.product]));
  const [logo]=await Promise.all([
    plan.formatKey==="document"?folletoCachedImage("logos/logo_empresa.png",signal):null,
    ...[...products.values()].map(async p=>{
    const image=await folletoCachedImage(p.imageUrl,signal);
    images.set(p.id,image);if(snapshot.settings.images&&!image)missing.add(p.id);
    })
  ]);
  folletoAssertSession(snapshot,signal);
  if(plan.formatKey==="document"&&!logo)throw new Error("No se pudo cargar el logo del encabezado. Intenta generar el PDF de nuevo.");
  const canvas=renderFolleto(snapshot,plan,index,{images,logo});
  const blob=await folletoCanvasBlob(canvas,plan.formatKey==="document"?"image/jpeg":"image/png");
  const result={blob,width:canvas.width,height:canvas.height,missing};
  canvas.width=canvas.height=1;folletoAssertSession(snapshot,signal);return result;
}
async function prepareFolleto(snapshot,formatKey,progress=()=>{},signal,reuse=null){
  folletoAssertSession(snapshot,signal);await document.fonts?.ready;
  const key=folletoPreparationKey(snapshot,formatKey);
  const cached=reuse?.key===key?reuse:null;
  const plan=cached?.plan||layoutFolleto(snapshot,formatKey,document.createElement("canvas").getContext("2d"));
  const pages=[],missing=new Set();
  for(let i=0;i<plan.pages.length;i++){
    folletoAssertSession(snapshot,signal);progress("Preparando página "+(i+1)+" de "+plan.pages.length+"…");
    const page=cached?.pages.get(i)||await prepareFolletoPage(snapshot,plan,i,signal);
    pages.push(page);for(const id of page.missing)missing.add(id);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {snapshot,plan,pages,missing:missing.size};
}
































async function folletoDocumentBlob(result){
  const encoder=new TextEncoder(),parts=[],offsets=[0];let length=0;
  const add=v=>{const b=typeof v==="string"?encoder.encode(v):v;parts.push(b);length+=b.length;};
  const obj=(id,body)=>{offsets[id]=length;add(`${id} 0 obj\n${body}\nendobj\n`);};
  const pages=result.pages;
  add("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
  obj(1,"<< /Type /Catalog /Pages 2 0 R >>");obj(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(" ")}] >>`);
  for(let i=0;i<pages.length;i++){
    const page=pages[i],id=3+i*3,bytes=new Uint8Array(await page.blob.arrayBuffer());
    obj(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);
    offsets[id+1]=length;add(`${id+1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);add(bytes);add("\nendstream\nendobj\n");
    const stream="q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n";obj(id+2,`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);
  }
  const xref=length,count=3+pages.length*3;add(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for(let i=1;i<count;i++)add(`${String(offsets[i]).padStart(10,"0")} 00000 n \n`);
  add(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);return new Blob(parts,{type:"application/pdf"});
}
function downloadFolletoBlob(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=name;
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function exportFolleto(preparation,formatKey,signal){
  const result=await preparation;folletoAssertSession(result.snapshot,signal);
  const stem="irenismb-folleto-"+new Date().toLocaleDateString("sv-SE",{timeZone:"America/Bogota"});
  if(formatKey==="document"){
    const blob=await folletoDocumentBlob(result);folletoAssertSession(result.snapshot,signal);
    downloadFolletoBlob(blob,stem+".pdf");
  }else{
    for(let i=0;i<result.pages.length;i++){
      folletoAssertSession(result.snapshot,signal);
      downloadFolletoBlob(result.pages[i].blob,`${stem}-${formatKey}-${String(i+1).padStart(2,"0")}.png`);
      if(i<result.pages.length-1)await new Promise(resolve=>setTimeout(resolve,100));
    }
  }
  return result;
}
















function syncAdministrativeToolVisibility(){
  const invoice=document.getElementById("cartInvoiceBtn");if(invoice)invoice.hidden=window.CATALOG_ADMIN_MODE_ACTIVE!==true;
}
function initFolleto(){
  const button=document.getElementById("folletoBtn");
  if(!button||document.getElementById("folletoDialog"))return;
  const icon=paths=>'<svg viewBox="0 0 24 24" aria-hidden="true" class="ui-icon"><path d="'+paths+'"/></svg>';
  const booklet=icon("M4 3h13l3 3v15H4zM8 8h8M8 12h3M8 16h8M15 3v4h5");
  const dialog=document.createElement("dialog");dialog.id="folletoDialog";dialog.className="folleto-dialog";
  dialog.setAttribute("aria-labelledby","folletoTitle");
  dialog.innerHTML=`<header class="folleto-heading"><div class="folleto-title-group"><span class="folleto-title-icon">${booklet}</span><div><h2 id="folletoTitle">Generar folleto</h2><p>Crea imágenes o un documento con tus productos, listos para compartir.</p></div></div><button type="button" class="folleto-close" id="folletoClose" aria-label="Cerrar Folleto">×</button></header>
    <div class="folleto-body">
      <form id="folletoOptions" class="folleto-options">
        <fieldset class="folleto-scope"><legend><span>1</span> Productos a incluir</legend>
          <label class="folleto-choice"><input name="scope" type="radio" value="branch" checked><span><strong>Todos desde este nivel</strong><small>Incluye los productos del nivel actual y sus descendientes.</small></span></label>
          <label class="folleto-choice"><input name="scope" type="radio" value="filtered"><span><strong>Solo filtrados</strong><small>Incluye los productos que coinciden con los filtros actuales.</small></span></label>
          <label class="folleto-choice"><input name="scope" type="radio" value="selected"><span><strong>Productos seleccionados <span id="folletoSelectedCount"></span></strong><small>Usa tu selección de tarjetas o, si está vacía, los productos del carrito.</small></span></label>
        </fieldset>
        <fieldset class="folleto-content"><legend><span>2</span> Opciones de contenido</legend>
          <div class="folleto-checkboxes"><label><input name="descriptions" type="checkbox" checked><span>Mostrar descripción</span></label><label><input name="codes" type="checkbox" checked><span>Mostrar código</span></label><label><input name="images" type="checkbox" checked><span>Mostrar imágenes</span></label><label><input name="prices" type="checkbox"><span>Mostrar precio</span></label></div>
        </fieldset>
        <fieldset id="folletoAdminOptions" hidden><legend>Opciones avanzadas <small>Solo administrador</small></legend>
          <div class="folleto-checkboxes"><label><input name="includeHidden" type="checkbox"><span>Incluir productos ocultos</span></label><label><input name="includeNotForSale" type="checkbox"><span>Incluir productos no a la venta</span></label></div>
        </fieldset>
      </form>
      <section class="folleto-design" aria-label="Diseño y vista previa">
        <fieldset class="folleto-formats"><legend><span>3</span> Formato de salida</legend><div class="folleto-format-grid">
          <label class="folleto-format"><input type="radio" name="format" value="instagram" checked><span class="folleto-format-icon">${icon("M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0M17 7h.01")}</span><strong>Instagram</strong><small>1080 × 1350</small><span class="folleto-format-note">Publicaciones en PNG</span></label>
          <label class="folleto-format"><input type="radio" name="format" value="marketplace"><span class="folleto-format-icon">${icon("M3 9l2-6h14l2 6M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v9h14v-9M9 21v-7h6v7")}</span><strong>Marketplace</strong><small>1200 × 1200</small><span class="folleto-format-note">Imágenes para ventas</span></label>
          <label class="folleto-format"><input type="radio" name="format" value="document"><span class="folleto-format-icon">${booklet}</span><strong>Documento</strong><small>Varias páginas</small><span class="folleto-format-note">Catálogo en PDF</span></label>
        </div></fieldset>
        <div class="folleto-preview-heading"><h3><span>4</span> Vista previa</h3><span id="folletoSummary" class="folleto-page-count" aria-live="polite"></span></div>
        <div class="folleto-preview" id="folletoPreviewStage" aria-busy="false"><div id="folletoPreviewPlaceholder" class="folleto-placeholder">${booklet}<p>Preparando tu diseño…</p></div><img id="folletoPreviewImage" alt="Vista previa del folleto" hidden></div>
        <nav class="folleto-preview-nav" aria-label="Páginas de la vista previa" hidden><button id="folletoPrevPage" class="btn-ghost" type="button" aria-label="Página anterior">←</button><span id="folletoPageLabel" aria-live="polite"></span><button id="folletoNextPage" class="btn-ghost" type="button" aria-label="Página siguiente">→</button></nav>
        <div id="folletoDownloadCurrentWrap" class="folleto-preview-hint" hidden><a id="folletoDownloadCurrent" class="btn-ghost" style="display:inline-flex;align-items:center;justify-content:center" download>Descargar esta imagen</a></div>
        <p class="folleto-preview-hint" id="folletoDesignHint">Un producto destacado, varios en una composición o un catálogo de varias páginas.</p>
      </section>
      <aside class="folleto-summary" aria-label="Resumen del folleto"><h3>Resumen</h3><dl id="folletoSummaryDetails"></dl><div class="folleto-summary-bottom"><p id="folletoStatus" role="status" aria-live="polite"></p><button type="button" id="folletoGenerate" class="folleto-generate">${icon("m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3M20 15v6M17 18h6")}<span>Generar folleto</span></button><p class="folleto-output-hint">PNG: descarga completa o individual.<br>Documento: descargar PDF.</p><div class="folleto-quick-actions" aria-label="Descarga directa"><button type="button" data-folleto-export="instagram">Instagram</button><button type="button" data-folleto-export="marketplace">Marketplace</button></div></div></aside>
    </div>`;
  document.body.appendChild(dialog);
  const form=dialog.querySelector("#folletoOptions"),status=dialog.querySelector("#folletoStatus"),
    summary=dialog.querySelector("#folletoSummary"),details=dialog.querySelector("#folletoSummaryDetails"),
    preview=dialog.querySelector("#folletoPreviewImage"),placeholder=dialog.querySelector("#folletoPreviewPlaceholder"),
    stage=dialog.querySelector("#folletoPreviewStage"),nav=dialog.querySelector(".folleto-preview-nav"),
    pageLabel=dialog.querySelector("#folletoPageLabel"),generate=dialog.querySelector("#folletoGenerate"),
    downloadCurrentWrap=dialog.querySelector("#folletoDownloadCurrentWrap"),downloadCurrent=dialog.querySelector("#folletoDownloadCurrent"),
    outputs=[generate,...dialog.querySelectorAll("[data-folleto-export]")],
    fields=[...form.elements,...dialog.querySelectorAll('input[name="format"]')],
    previous=dialog.querySelector("#folletoPrevPage"),next=dialog.querySelector("#folletoNextPage");
  let previewController=null,exportController=null,previewUrl="",busy=false,lastFocus=null,version=0,
    state=null,pageIndex=0,timer=null,valid=false;
  const format=()=>dialog.querySelector('input[name="format"]:checked').value;
  function readOptions(){
    const value={scope:form.elements.scope.value};
    for(const key of ["descriptions","codes","images","prices","includeHidden","includeNotForSale"])value[key]=form.elements[key].checked;
    return value;
  }
  function syncAdmin(){
    const admin=window.CATALOG_ADMIN_MODE_ACTIVE===true;
    dialog.querySelector("#folletoAdminOptions").hidden=!admin;
    for(const key of ["includeHidden","includeNotForSale"]){form.elements[key].disabled=busy||!admin;if(!admin)form.elements[key].checked=false;}
    for(const [key,allowed]of [["images",shouldShowProductImages()]]){
      form.elements[key].disabled=busy||!allowed;if(!allowed)form.elements[key].checked=false;
    }
  }
  function updateActions(){for(const b of outputs)b.disabled=busy||!valid;}
  function clearPreview(){
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    previewUrl="";preview.hidden=true;preview.removeAttribute("src");
    downloadCurrent.removeAttribute("href");downloadCurrentWrap.hidden=true;
  }
  function showPlaceholder(message){
    clearPreview();placeholder.hidden=false;placeholder.querySelector("p").textContent=message;
  }
  function summaryRow(label,value){
    const dt=document.createElement("dt"),dd=document.createElement("dd");
    dt.textContent=label;dd.textContent=value;details.append(dt,dd);
  }
  function updateSummary(snapshot,plan){
    details.replaceChildren();
    const count=snapshot.products.length,pages=plan?.pages.length||0,key=format(),selected=FOLLETO_SELECTION.size||cartItemsArray().length;
    dialog.querySelector("#folletoSelectedCount").textContent="("+selected+")";
    summary.textContent=count+" "+(count===1?"producto":"productos")+" · "+pages+" "+(pages===1?"página":"páginas");
    summaryRow("Productos",count);summaryRow("Formato",FOLLETO_FORMATS[key].label);
    summaryRow("Tamaño",key==="document"?"A4 · PDF":FOLLETO_FORMATS[key].width+" × "+FOLLETO_FORMATS[key].height);
    summaryRow("Páginas",pages);
    for(const [label,key]of [["Descripción","descriptions"],["Código","codes"],["Imágenes","images"],["Precio","prices"]])summaryRow(label,snapshot.settings[key]?"Sí":"No");
    const priceHint=snapshot.settings.prices?"con precio":"sin precio";
    dialog.querySelector("#folletoDesignHint").textContent=key==="document"?"Fichas cuadradas "+priceHint+", con encabezado de la empresa en cada página del PDF.":"Fichas cuadradas "+priceHint+" e información del producto, sin datos de la empresa. Hasta cuatro por imagen.";
  }
  async function showPage(index,token){
    if(!state||!dialog.open)return;
    pageIndex=index;stage.setAttribute("aria-busy","true");
    nav.hidden=state.plan.pages.length<2;
    previous.disabled=index===0;next.disabled=index===state.plan.pages.length-1;
    pageLabel.textContent="Página "+(index+1)+" de "+state.plan.pages.length;
    showPlaceholder("Preparando página "+(index+1)+"…");
    previewController?.abort();previewController=new AbortController();
    const current=state,signal=previewController.signal;
    try{
      const page=current.pages.get(index)||await prepareFolletoPage(current.snapshot,current.plan,index,signal);
      if(signal.aborted||token!==version||state!==current||!dialog.open)return;
      current.pages.set(index,page);
      while(current.pages.size>6)current.pages.delete(current.pages.keys().next().value);
      clearPreview();previewUrl=URL.createObjectURL(page.blob);preview.src=previewUrl;preview.hidden=false;placeholder.hidden=true;
      if(current.plan.formatKey!=="document"){
        downloadCurrent.href=previewUrl;
        const date=new Date().toLocaleDateString("sv-SE",{timeZone:"America/Bogota"});
        downloadCurrent.download="irenismb-folleto-"+date+"-"+current.plan.formatKey+"-"+String(index+1).padStart(2,"0")+".png";
        downloadCurrentWrap.hidden=false;
      }
      preview.alt="Vista previa: "+current.snapshot.title+", página "+(index+1)+" de "+current.plan.pages.length;
      status.textContent=page.missing.size?"En esta página hay "+page.missing.size+" "+(page.missing.size===1?"imagen no disponible.":"imágenes no disponibles."):"Tu vista previa está lista.";
    }catch(e){
      if(signal.aborted||token!==version)return;
      showPlaceholder(e.message||"No se pudo preparar la vista previa.");status.textContent=e.message;
    }finally{if(token===version&&!signal.aborted)stage.setAttribute("aria-busy","false");}
  }
  async function refresh(immediate=false){
    if(busy)return;
    clearTimeout(timer);previewController?.abort();version++;state=null;valid=false;nav.hidden=true;
    syncAdmin();updateActions();showPlaceholder("Preparando tu diseño…");stage.setAttribute("aria-busy","false");
    const token=version;
    try{
      const snapshot=buildFolletoSnapshot(readOptions()),key=format();
      if(!snapshot.products.length){updateSummary(snapshot,null);showPlaceholder("No hay productos que cumplan esta selección.");status.textContent="Selecciona otros productos o ajusta las opciones.";return;}
      await document.fonts?.ready;
      if(token!==version||!dialog.open)return;
      const plan=layoutFolleto(snapshot,key,document.createElement("canvas").getContext("2d"));
      state={key:folletoPreparationKey(snapshot,key),snapshot,plan,pages:new Map()};valid=true;
      updateSummary(snapshot,plan);updateActions();status.textContent="Preparando la vista previa…";
      if(immediate)showPage(0,token);else timer=setTimeout(()=>showPage(0,token),160);
    }catch(e){
      if(token!==version)return;
      details.replaceChildren();summary.textContent="";showPlaceholder(e.message);status.textContent=e.message;updateActions();
    }
  }
  button.addEventListener("click",()=>{lastFocus=document.activeElement;dialog.showModal();refresh(true);});
  dialog.querySelector("#folletoClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{
    clearTimeout(timer);version++;previewController?.abort();exportController?.abort();state=null;clearPreview();
    lastFocus?.focus?.({preventScroll:true});
  });
  dialog.addEventListener("change",e=>{if(e.target.matches("input"))refresh();});
  form.addEventListener("submit",e=>e.preventDefault());
  document.addEventListener("change",e=>{
    const id=e.target.dataset?.folletoSelect;
    if(id){e.target.checked?FOLLETO_SELECTION.add(id):FOLLETO_SELECTION.delete(id);if(dialog.open)refresh();}
  });
  previous.addEventListener("click",()=>{if(!busy&&state&&pageIndex>0)showPage(pageIndex-1,version);});
  next.addEventListener("click",()=>{if(!busy&&state&&pageIndex<state.plan.pages.length-1)showPage(pageIndex+1,version);});
  window.addEventListener("irenismb:admin-mode-change",()=>{
    previewController?.abort();exportController?.abort();
    if(dialog.open&&!busy)refresh(true);
  });
  async function generateFolleto(formatKey){
    if(busy||!valid)return;
    busy=true;clearTimeout(timer);previewController?.abort();exportController=new AbortController();
    const signal=exportController.signal,oldState=state;
    fields.forEach(f=>f.disabled=true);previous.disabled=next.disabled=true;updateActions();
    try{
      const snapshot=buildFolletoSnapshot(readOptions());
      const prepared=prepareFolleto(snapshot,formatKey,message=>{if(dialog.open&&!signal.aborted)status.textContent=message;},signal,oldState);
      // Restaurar la copia automática de la primera imagen, sin cambiar las descargas.
      let clipboard=Promise.resolve(false);
      if(formatKey!=="document"&&navigator.clipboard?.write&&typeof ClipboardItem!=="undefined"){
        const imageBlob=prepared.then(r=>{folletoAssertSession(r.snapshot,signal);return r.pages[0].blob;});
        try{clipboard=Promise.resolve(navigator.clipboard.write([new ClipboardItem({"image/png":imageBlob})])).then(()=>true,()=>false);}catch(_){clipboard=Promise.resolve(false);}
      }
      const result=await exportFolleto(prepared,formatKey,signal);
      const copied=await clipboard;
      if(!dialog.open||signal.aborted)return;
      dialog.querySelector('input[name="format"][value="'+formatKey+'"]').checked=true;
      state={key:folletoPreparationKey(result.snapshot,formatKey),snapshot:result.snapshot,plan:result.plan,
        pages:new Map(result.pages.slice(0,6).map((p,i)=>[i,p]))};
      updateSummary(result.snapshot,result.plan);await showPage(0,version);
      status.textContent=result.snapshot.products.length+" productos · "+result.pages.length+
        (formatKey==="document"?" · Descarga del PDF iniciada.":" · Descarga de "+result.pages.length+" "+(result.pages.length===1?"imagen":"imágenes")+" iniciada. Si falta alguna, usa «Descargar esta imagen» en su vista previa.")+
        (formatKey!=="document"&&copied?" Primera imagen copiada al portapapeles.":"")+
        (result.missing?" "+result.missing+" productos con imagen no disponible.":"");
    }catch(e){
      if(dialog.open)status.textContent=e.name==="AbortError"?"Generación cancelada.":e.message||"No se pudo generar el folleto.";
    }finally{
      busy=false;fields.forEach(f=>f.disabled=false);syncAdmin();updateActions();
      if(state){previous.disabled=pageIndex===0;next.disabled=pageIndex===state.plan.pages.length-1;}
      if(dialog.open&&(!state||(oldState?.snapshot.adminExtras&&window.CATALOG_ADMIN_MODE_ACTIVE!==true)))refresh(true);
    }
  }
  generate.addEventListener("click",()=>generateFolleto(format()));
  for(const output of dialog.querySelectorAll("[data-folleto-export]"))output.addEventListener("click",()=>generateFolleto(output.dataset.folletoExport));
















  document.getElementById("bulkAddBtn")?.addEventListener("click",()=>{
    const products=buildFilteredList().filter(p=>!p.isGiftGalleryImage);let added=0,existing=0,unavailable=0;
    for(const p of products){const id=String(p.id);if(cart[id]?.qty>0){existing++;continue;}if(shouldEnforceStockLimits()&&(!Number.isFinite(p.stock)||p.stock<1)){unavailable++;continue;}cart[id]={id:p.id,name:p.name,price:p.price,hasPrice:p.hasPrice!==false,qty:1,stock:p.stock,imgFilename:p.imgFilename||null};added++;}
    saveCart();render();renderCartModal();document.getElementById("bulkAddStatus").textContent=`Se agregaron ${added} productos; ${existing} ya estaban en el carrito; ${unavailable} sin stock disponible.`;
  });
}
