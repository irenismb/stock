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
    prices:options.prices!==false&&shouldShowProductPrices(),
    descriptions:options.descriptions!==false,codes:options.codes!==false,
    images:options.images!==false&&shouldShowProductImages()
  });
  const seen=new Set();
  const products=source.filter(p=>{const id=String(p.id);if(seen.has(id))return false;seen.add(id);return true;}).map(p=>Object.freeze({
    id:String(p.id),name:String(p.name||"").trim(),
    description:settings.descriptions?String(p.description||"").trim():"",
    price:settings.prices&&p.hasPrice!==false?fmtCOP.format(Number(p.price)||0):"",
    code:settings.codes?`Código ${p.id}`:"",
    line:String(p.line||"").trim(),
    presentation:folletoPresentation(p),
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
// Una sola ficha vertical de 4:5 se dibuja en Instagram, Marketplace y A4.
const FICHA_SIZE=Object.freeze({width:1080,height:1350});

function folletoPresentation(p){
  // Tomar únicamente datos literales disponibles; nunca inventar contenidos o tamaños.
  const explicit=String(p.presentation||p.presentacion||"" ).trim();
  if(explicit)return explicit;
  const text=String(p.description||"");
  const units=[...text.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:ml|mL|l|L|g|kg|und\.?|unidades)\b/gi)];
  return [...new Set(units.map(m=>m[0].trim()))].slice(0,3).join(" · ");
}
function buildFichaModel(product){
  return {
    id:String(product.id),name:String(product.name||""),
    line:String(product.line||""),presentation:String(product.presentation||""),
    code:String(product.code||""),description:String(product.description||""),
    price:String(product.price||""),imageUrl:String(product.imageUrl||"")
  };
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
  // Todas las medidas se calculan sobre la misma ficha maestra de 1080x1350.
  const textWidth=972;
  const name=folletoFitText(ctx,ficha.name,textWidth,166,52,25,true);
  const line=folletoFitText(ctx,ficha.line,textWidth,50,29,19,true);
  const presentation=folletoFitText(ctx,ficha.presentation,textWidth,68,30,19);
  const description=folletoFitText(ctx,ficha.description,textWidth,220,32,18,false,true);
  const code=folletoFitText(ctx,ficha.code,425,44,30,20,true);
  const price=folletoFitText(ctx,ficha.price,428,44,33,19,true);
  return {name,line,presentation,description,code,price};
}
function folletoRoundRect(ctx,x,y,w,h,r=18){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.closePath();
}
function folletoBotanical(ctx,x,y,scale=1,flip=false){
  ctx.save();ctx.translate(x,y);ctx.scale(flip?-scale:scale,scale);
  ctx.strokeStyle="#c8bca6";ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(0,160);ctx.bezierCurveTo(24,98,47,38,94,-20);ctx.stroke();
  const leaves=[[14,125,-.9,42,"#d2d9bc"],[31,96,.4,52,"#eac9c6"],[47,66,-.7,43,"#d3dabb"],
    [64,33,.3,45,"#e2b8c5"],[81,5,-.6,35,"#e5cea5"]];
  for(const [lx,ly,angle,size,color]of leaves){
    ctx.save();ctx.translate(lx,ly);ctx.rotate(angle);ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-size*.8,-size*.2,-size*.7,-size*.9,0,-size);
    ctx.bezierCurveTo(size*.55,-size*.8,size*.4,-size*.25,0,0);ctx.fill();
    ctx.strokeStyle="#fffaf1";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-size*.8);ctx.stroke();ctx.restore();
  }
  ctx.restore();
}
function folletoDrawImage(ctx,image,x,y,w,h){
  if(image){
    const ratio=Math.min(w/image.naturalWidth,h/image.naturalHeight);
    const iw=image.naturalWidth*ratio,ih=image.naturalHeight*ratio;
    ctx.drawImage(image,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
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
  const bg=ctx.createLinearGradient(0,0,1080,1350);
  bg.addColorStop(0,"#fffdfb");bg.addColorStop(1,"#fff8f4");
  ctx.fillStyle=bg;folletoRoundRect(ctx,0,0,1080,1350,32);ctx.fill();
  ctx.strokeStyle="#e5d4cf";ctx.lineWidth=2;ctx.stroke();

  // Fotografía principal con encuadre completo; no se deforma ni se recorta.
  const photo=ctx.createLinearGradient(48,46,1032,624);
  photo.addColorStop(0,"#f6e4eb");photo.addColorStop(.6,"#fbf1e7");photo.addColorStop(1,"#eee9df");
  ctx.fillStyle=photo;folletoRoundRect(ctx,46,46,988,576,24);ctx.fill();
  if(image)folletoDrawImage(ctx,image,72,64,936,536);
  else if(product.imageUrl)folletoDrawImage(ctx,null,72,64,936,536);
  else{
    ctx.fillStyle="#f7e9e3";folletoRoundRect(ctx,286,220,508,202,22);ctx.fill();
    folletoFont(ctx,26);ctx.fillStyle="#000";ctx.textAlign="center";
    ctx.fillText("Imagen no incluida",540,305);ctx.textAlign="left";
  }
  const drawLines=(measure,x,y)=>{
    if(!measure.lines.length)return;
    folletoFont(ctx,measure.size,measure.bold||false);
    for(const text of measure.lines){ctx.fillText(text,x,y);y+=measure.lineHeight;}
  };
  ctx.fillStyle="#000";
  drawLines({...measure.name,bold:true},54,660);
  drawLines({...measure.line,bold:true},54,833);
  drawLines(measure.presentation,54,889);
  // Código y precio son opciones independientes; no ocupar espacio vacío si no existen.
  const code=measure.code.lines.length>0,price=measure.price.lines.length>0;
  if(code){
    ctx.fillStyle="#f2dbe2";folletoRoundRect(ctx,50,966,price?461:520,72,30);ctx.fill();
    ctx.fillStyle="#000";drawLines({...measure.code,bold:true},75,984);
  }
  if(price){
    const priceX=code?554:50;
    ctx.fillStyle="#f5eae4";folletoRoundRect(ctx,priceX,966,code?474:620,72,30);ctx.fill();
    ctx.fillStyle="#000";drawLines({...measure.price,bold:true},priceX+23,984);
  }
  if(measure.description.lines.length){
    ctx.strokeStyle="#dac3b2";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(54,1059);ctx.lineTo(1026,1059);ctx.stroke();
    ctx.fillStyle="#000";drawLines(measure.description,54,1081);
  }
  ctx.restore();
}
function folletoCardPositions(width,height,count,formatKey){
  // Máximo cuatro fichas completas por lienzo o página A4.
  const pdf=formatKey==="document",margin=pdf?85:46,gap=pdf?34:22;
  const footer=pdf?60:0;
  const columns=count===1?1:2,rows=Math.ceil(count/columns);
  const areaHeight=height-2*margin-footer;
  const cardWidth=Math.min((width-2*margin-(columns-1)*gap)/columns,
    (areaHeight-(rows-1)*gap)/rows*(4/5));
  const cardHeight=cardWidth*5/4;
  const gridWidth=columns*cardWidth+(columns-1)*gap;
  const gridHeight=rows*cardHeight+(rows-1)*gap;
  const baseX=(width-gridWidth)/2,baseY=margin+(areaHeight-gridHeight)/2;
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
function renderFolleto(snapshot,plan,pageIndex,assets){
  const page=plan.pages[pageIndex],canvas=document.createElement("canvas");
  canvas.width=page.width;canvas.height=page.height;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("No se pudo preparar el folleto.");
  const background=ctx.createLinearGradient(0,0,page.width,page.height);
  background.addColorStop(0,"#fff8f1");background.addColorStop(.6,"#fbefe6");background.addColorStop(1,"#f9eae7");
  ctx.textBaseline="top";ctx.fillStyle=background;ctx.fillRect(0,0,page.width,page.height);
  for(const card of page.cards)renderFicha(ctx,card,assets.images.get(card.product.id));
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
  await Promise.all([...products.values()].map(async p=>{
    const image=await folletoCachedImage(p.imageUrl,signal);
    images.set(p.id,image);if(snapshot.settings.images&&!image)missing.add(p.id);
  }));
  folletoAssertSession(snapshot,signal);
  const canvas=renderFolleto(snapshot,plan,index,{images});
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
async function exportFolleto(preparation,formatKey,signal,clipboardResult=Promise.resolve(false)){
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
  return {...result,copied:await clipboardResult};
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
          <div class="folleto-checkboxes"><label><input name="prices" type="checkbox" checked><span>Mostrar precio</span></label><label><input name="descriptions" type="checkbox" checked><span>Mostrar descripción</span></label><label><input name="codes" type="checkbox" checked><span>Mostrar código</span></label><label><input name="images" type="checkbox" checked><span>Mostrar imágenes</span></label></div>
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
        <p class="folleto-preview-hint" id="folletoDesignHint">Un producto destacado, varios en una composición o un catálogo de varias páginas.</p>
      </section>
      <aside class="folleto-summary" aria-label="Resumen del folleto"><h3>Resumen</h3><dl id="folletoSummaryDetails"></dl><div class="folleto-summary-bottom"><p id="folletoStatus" role="status" aria-live="polite"></p><button type="button" id="folletoGenerate" class="folleto-generate">${icon("m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3M20 15v6M17 18h6")}<span>Generar folleto</span></button><p class="folleto-output-hint">PNG: copiar y descargar.<br>Documento: descargar PDF.</p><div class="folleto-quick-actions" aria-label="Descarga directa"><button type="button" data-folleto-export="instagram">Instagram</button><button type="button" data-folleto-export="marketplace">Marketplace</button></div></div></aside>
    </div>`;
  document.body.appendChild(dialog);
  const form=dialog.querySelector("#folletoOptions"),status=dialog.querySelector("#folletoStatus"),
    summary=dialog.querySelector("#folletoSummary"),details=dialog.querySelector("#folletoSummaryDetails"),
    preview=dialog.querySelector("#folletoPreviewImage"),placeholder=dialog.querySelector("#folletoPreviewPlaceholder"),
    stage=dialog.querySelector("#folletoPreviewStage"),nav=dialog.querySelector(".folleto-preview-nav"),
    pageLabel=dialog.querySelector("#folletoPageLabel"),generate=dialog.querySelector("#folletoGenerate"),
    outputs=[generate,...dialog.querySelectorAll("[data-folleto-export]")],
    fields=[...form.elements,...dialog.querySelectorAll('input[name="format"]')],
    previous=dialog.querySelector("#folletoPrevPage"),next=dialog.querySelector("#folletoNextPage");
  let previewController=null,exportController=null,previewUrl="",busy=false,lastFocus=null,version=0,
    state=null,pageIndex=0,timer=null,valid=false;
  const format=()=>dialog.querySelector('input[name="format"]:checked').value;
  function readOptions(){
    const value={scope:form.elements.scope.value};
    for(const key of ["prices","descriptions","codes","images","includeHidden","includeNotForSale"])value[key]=form.elements[key].checked;
    return value;
  }
  function syncAdmin(){
    const admin=window.CATALOG_ADMIN_MODE_ACTIVE===true;
    dialog.querySelector("#folletoAdminOptions").hidden=!admin;
    for(const key of ["includeHidden","includeNotForSale"]){form.elements[key].disabled=busy||!admin;if(!admin)form.elements[key].checked=false;}
    for(const [key,allowed]of [["prices",shouldShowProductPrices()],["images",shouldShowProductImages()]]){
      form.elements[key].disabled=busy||!allowed;if(!allowed)form.elements[key].checked=false;
    }
  }
  function updateActions(){for(const b of outputs)b.disabled=busy||!valid;}
  function clearPreview(){
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    previewUrl="";preview.hidden=true;preview.removeAttribute("src");
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
    for(const [label,key]of [["Precio","prices"],["Descripción","descriptions"],["Código","codes"],["Imágenes","images"]])summaryRow(label,snapshot.settings[key]?"Sí":"No");
    dialog.querySelector("#folletoDesignHint").textContent=count===1?"Ficha individual 4:5: fotografía y datos del producto, sin encabezado.":"Cada collage o página reúne hasta cuatro fichas de producto completas.";
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
      let clipboard=Promise.resolve(false);
      if(formatKey!=="document"&&navigator.clipboard?.write&&typeof ClipboardItem!=="undefined"){
        const imageBlob=prepared.then(r=>{folletoAssertSession(r.snapshot,signal);return r.pages[0].blob;});
        try{clipboard=Promise.resolve(navigator.clipboard.write([new ClipboardItem({"image/png":imageBlob})])).then(()=>true,()=>false);}catch(_){clipboard=Promise.resolve(false);}
      }
      const result=await exportFolleto(prepared,formatKey,signal,clipboard);
      if(!dialog.open||signal.aborted)return;
      dialog.querySelector('input[name="format"][value="'+formatKey+'"]').checked=true;
      state={key:folletoPreparationKey(result.snapshot,formatKey),snapshot:result.snapshot,plan:result.plan,
        pages:new Map(result.pages.slice(0,6).map((p,i)=>[i,p]))};
      updateSummary(result.snapshot,result.plan);await showPage(0,version);
      status.textContent=result.snapshot.products.length+" productos · "+result.pages.length+" "+(result.pages.length===1?"página descargada.":"páginas descargadas.")+
        (formatKey!=="document"?(result.copied?" Primera imagen copiada al portapapeles.":" Los PNG se descargaron; el navegador no permitió copiar."):"")+
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
