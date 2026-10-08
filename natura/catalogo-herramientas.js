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
    price:settings.prices?(p.hasPrice===false?"Consultar precio":fmtCOP.format(Number(p.price)||0)):"",
    code:settings.codes?`Código ${p.id}`:"",
    line:String(p.line||"").trim(),
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
function folletoTextBlocks(ctx,p,width,hero){
  const blocks=[];
  const add=(text,size,bold=false,gap=8)=>{
    if(!text)return;
    folletoFont(ctx,size,bold);
    const lines=folletoLines(ctx,text,width);
    blocks.push({lines,size,bold,lineHeight:size*1.22,gap});
  };
  add(p.line,22);add(p.name,hero?34:26,true,12);
  add(p.code,20);add(p.price,hero?36:30,true,12);add(p.description,24);
  return blocks;
}

function layoutFolleto(snapshot,formatKey="instagram",ctx){
  const format=FOLLETO_FORMATS[formatKey];if(!format)throw new Error("Formato no válido.");
  if(!snapshot.products.length)throw new Error("No hay productos para incluir con estas opciones.");
  const {width,height}=format,margin=60,gap=24,header=172,footer=66;
  const hero=snapshot.products.length===1,columns=hero?1:2;
  const bodyWidth=width-margin*2,cardWidth=(bodyWidth-gap*(columns-1))/columns;
  const available=height-margin*2-header-footer;
  const pages=[];let page=null,y=0,row=[];
  const newPage=()=>{page={width,height,margin,header,footer,cards:[],title:snapshot.title};pages.push(page);y=margin+header;};
  const placeRow=()=>{
    if(!row.length)return;
    const rowHeight=Math.max(...row.map(c=>c.height));
    if(!page||y+rowHeight>height-margin-footer)newPage();
    row.forEach((c,i)=>page.cards.push({...c,x:margin+i*(cardWidth+gap),y}));
    y+=rowHeight+gap;row=[];
  };
  for(const p of snapshot.products){
    const blocks=folletoTextBlocks(ctx,p,cardWidth-40,hero);
    let imageHeight=snapshot.settings.images?(hero?450:snapshot.products.length<=4?260:180):0;
    const textHeight=blocks.reduce((n,b)=>n+b.lines.length*b.lineHeight+b.gap,0);
    const base=40+(imageHeight?imageHeight+20:0);
    if(base+textHeight<=available){row.push({product:p,blocks,imageHeight,width:cardWidth,height:base+textHeight});if(row.length===columns)placeRow();continue;}
    // Split exceptionally long names/descriptions into measured continuation cards.
    placeRow();imageHeight=Math.min(imageHeight,150);
    let current=[],used=40+(imageHeight?imageHeight+20:0),continued=false;
    const flush=()=>{
      if(!current.length)return;
      row=[{product:p,blocks:current,imageHeight:continued?0:imageHeight,width:cardWidth,height:used,continued}];placeRow();
      current=[];used=40;continued=true;
    };
    for(const b of blocks){
      let chunk=[];
      for(const line of b.lines){
        if(used+b.lineHeight+b.gap>available){
          if(chunk.length){current.push({...b,lines:chunk});chunk=[];used+=b.gap;}
          flush();
        }
        chunk.push(line);used+=b.lineHeight;
      }
      if(chunk.length){current.push({...b,lines:chunk});used+=b.gap;}
    }
    flush();
  }
  placeRow();
  if(hero&&pages.length===1){
    const c=pages[0].cards[0];const growth=Math.max(0,available-c.height);
    if(snapshot.settings.images){c.imageHeight+=growth;c.height+=growth;}
    else c.y+=growth/2;
  }
  return {formatKey,pages,productCount:snapshot.products.length};
}

function folletoRoundRect(ctx,x,y,w,h,r=18){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.closePath();
}
function renderFolletoCard(ctx,card,image){
  const {x,y,width,height}=card;
  ctx.fillStyle="#ffffff";folletoRoundRect(ctx,x,y,width,height);ctx.fill();
  ctx.strokeStyle="#eadbd5";ctx.lineWidth=1;ctx.stroke();
  let top=y+20;
  if(card.imageHeight){
    if(image){
      const ratio=Math.min((width-40)/image.naturalWidth,card.imageHeight/image.naturalHeight);
      const w=image.naturalWidth*ratio,h=image.naturalHeight*ratio;
      ctx.drawImage(image,x+(width-w)/2,top+(card.imageHeight-h)/2,w,h);
    }else{
      ctx.fillStyle="#fbf6f2";folletoRoundRect(ctx,x+20,top,width-40,card.imageHeight,12);ctx.fill();
      folletoFont(ctx,22);ctx.fillStyle="#000";ctx.textAlign="center";
      ctx.fillText("Imagen no disponible",x+width/2,top+card.imageHeight/2);ctx.textAlign="left";
    }
    top+=card.imageHeight+20;
  }
  ctx.fillStyle="#000";
  for(const block of card.blocks){
    folletoFont(ctx,block.size,block.bold);
    for(const line of block.lines){ctx.fillText(line,x+20,top);top+=block.lineHeight;}
    top+=block.gap;
  }
}
function renderFolleto(snapshot,plan,pageIndex,assets){
  const page=plan.pages[pageIndex],canvas=document.createElement("canvas");
  canvas.width=page.width;canvas.height=page.height;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("No se pudo preparar el folleto.");
  ctx.textBaseline="top";ctx.fillStyle="#faf5f0";ctx.fillRect(0,0,page.width,page.height);
  ctx.fillStyle="#f0dbdf";folletoRoundRect(ctx,page.margin,page.margin,page.width-page.margin*2,130);ctx.fill();
  const logo=assets.logo;
  if(logo)ctx.drawImage(logo,page.margin+18,page.margin+18,80,80);
  const headX=page.margin+(logo?118:20),headWidth=page.width-page.margin-headX-20;
  ctx.fillStyle="#000";folletoFont(ctx,29,true);ctx.fillText("IRENISMB STOCK NATURA",headX,page.margin+20,headWidth);
  folletoFont(ctx,20);ctx.fillText("Consultores independientes de Natura y AVON",headX,page.margin+59,headWidth);
  ctx.fillText("Asesoría y pedidos · +57 304 208 8961",headX,page.margin+91,headWidth);
  for(const card of page.cards)renderFolletoCard(ctx,card,assets.images.get(card.product.id));
  const footY=page.height-page.margin-page.footer+22;
  ctx.strokeStyle="#dec9c6";ctx.beginPath();ctx.moveTo(page.margin,footY-12);ctx.lineTo(page.width-page.margin,footY-12);ctx.stroke();
  folletoFont(ctx,18);ctx.fillStyle="#000";
  const title=folletoLines(ctx,snapshot.title,page.width-page.margin*2-170);
  ctx.fillText(title[0]||"Productos",page.margin,footY);
  ctx.textAlign="right";ctx.fillText(`${pageIndex+1} / ${plan.pages.length}`,page.width-page.margin,footY);ctx.textAlign="left";
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
async function prepareFolleto(snapshot,formatKey,progress=()=>{},signal){
  folletoAssertSession(snapshot,signal);await document.fonts?.ready;
  const ctx=document.createElement("canvas").getContext("2d");
  const plan=layoutFolleto(snapshot,formatKey,ctx),assets={logo:await folletoLoadImage(COMPANY_LOGO,signal),images:new Map()};
  const urls=new Map(snapshot.products.map(p=>[p.id,p.imageUrl]));let missing=0;
  const pages=[];
  for(let i=0;i<plan.pages.length;i++){
    folletoAssertSession(snapshot,signal);progress(`Preparando página ${i+1} de ${plan.pages.length}…`);
    const ids=[...new Set(plan.pages[i].cards.map(c=>c.product.id))];
    await Promise.all(ids.filter(id=>!assets.images.has(id)).map(async id=>{
      const image=await folletoLoadImage(urls.get(id),signal);assets.images.set(id,image);
      if(snapshot.settings.images&&!image)missing++;
    }));
    const canvas=renderFolleto(snapshot,plan,i,assets);
    const blob=await folletoCanvasBlob(canvas,formatKey==="document"?"image/jpeg":"image/png");
    pages.push({blob,width:canvas.width,height:canvas.height});canvas.width=canvas.height=1;
    folletoAssertSession(snapshot,signal);await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {snapshot,plan,pages,missing};
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
  const button=document.getElementById("folletoBtn");if(!button||document.getElementById("folletoDialog"))return;
  const dialog=document.createElement("dialog");dialog.id="folletoDialog";dialog.className="folleto-dialog";
  dialog.setAttribute("aria-labelledby","folletoTitle");
  dialog.innerHTML=`<div class="folleto-heading"><div><h2 id="folletoTitle">Folleto</h2><p>Tu selección, lista para compartir.</p></div><button type="button" class="btn-ghost" id="folletoClose" aria-label="Cerrar Folleto">✕</button></div>
    <div class="folleto-body"><form id="folletoOptions"><fieldset><legend>Productos a incluir</legend>
      <label><input name="scope" type="radio" value="branch" checked> Todos desde este nivel</label>
      <label><input name="scope" type="radio" value="filtered"> Solo filtrados</label>
      <label><input name="scope" type="radio" value="selected"> Productos seleccionados</label>
      <small>Selecciona productos en las tarjetas. Si no seleccionas ninguno, se usan los productos del carrito.</small></fieldset>
      <fieldset><legend>Contenido</legend><label><input name="prices" type="checkbox" checked> Mostrar precio</label><label><input name="descriptions" type="checkbox" checked> Mostrar descripción</label><label><input name="codes" type="checkbox" checked> Mostrar código</label><label><input name="images" type="checkbox" checked> Mostrar imágenes</label></fieldset>
      <fieldset id="folletoAdminOptions" hidden><legend>Opciones administrativas</legend><label><input name="includeHidden" type="checkbox"> Incluir ocultos</label><label><input name="includeNotForSale" type="checkbox"> Incluir productos no a la venta</label></fieldset>
    </form><div class="folleto-preview"><p id="folletoSummary"></p><img id="folletoPreviewImage" alt="Vista previa del folleto" hidden><p class="folleto-preview-hint">El diseño se adapta automáticamente a la cantidad de productos.</p></div></div>
    <p id="folletoStatus" role="status" aria-live="polite"></p><div class="folleto-exports"><button type="button" class="btn-acc" data-folleto-export="instagram">Instagram <small>1080 × 1350 · PNG</small></button><button type="button" class="btn-acc" data-folleto-export="marketplace">Marketplace <small>1200 × 1200 · PNG</small></button><button type="button" class="btn-ghost" data-folleto-export="document">Documento <small>Multipágina · PDF</small></button></div>`;
  document.body.appendChild(dialog);
  const form=dialog.querySelector("form"),status=dialog.querySelector("#folletoStatus"),summary=dialog.querySelector("#folletoSummary"),preview=dialog.querySelector("#folletoPreviewImage"),exports=[...dialog.querySelectorAll("[data-folleto-export]")];
  let controller=null,previewUrl="",busy=false,lastFocus=null;
  const options=()=>Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,key==="scope"?value:true]));
  function readOptions(){
    const value=options();for(const key of ["prices","descriptions","codes","images","includeHidden","includeNotForSale"])value[key]=form.elements[key].checked;return value;
  }
  function syncAdmin(){
    const admin=window.CATALOG_ADMIN_MODE_ACTIVE===true;dialog.querySelector("#folletoAdminOptions").hidden=!admin;
    for(const key of ["includeHidden","includeNotForSale"]){form.elements[key].disabled=!admin;if(!admin)form.elements[key].checked=false;}
    form.elements.prices.disabled=!shouldShowProductPrices();if(form.elements.prices.disabled)form.elements.prices.checked=false;
  }
  function clearPreview(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl="";preview.hidden=true;preview.removeAttribute("src");}
  function refresh(){
    syncAdmin();clearPreview();
    try{const s=buildFolletoSnapshot(readOptions());summary.textContent=`${s.products.length} ${s.products.length===1?"producto":"productos"} · ${s.title}`;for(const b of exports)b.disabled=!s.products.length||busy;status.textContent=s.products.length?"Elige una salida para generar, copiar y descargar.":"No hay productos que cumplan esta selección.";}
    catch(e){summary.textContent="";status.textContent=e.message;for(const b of exports)b.disabled=true;}
  }
  button.addEventListener("click",()=>{lastFocus=document.activeElement;refresh();dialog.showModal();});
  dialog.querySelector("#folletoClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{controller?.abort();clearPreview();lastFocus?.focus?.({preventScroll:true});});
  form.addEventListener("change",refresh);form.addEventListener("submit",e=>e.preventDefault());
  document.addEventListener("change",e=>{const id=e.target.dataset?.folletoSelect;if(id){e.target.checked?FOLLETO_SELECTION.add(id):FOLLETO_SELECTION.delete(id);}});
  window.addEventListener("irenismb:admin-mode-change",()=>{controller?.abort();if(dialog.open)refresh();});
  for(const output of exports)output.addEventListener("click",async()=>{
    if(busy)return;busy=true;controller=new AbortController();const signal=controller.signal;
    const formatKey=output.dataset.folletoExport;
    try{
      const snapshot=buildFolletoSnapshot(readOptions());
      for(const b of exports)b.disabled=true;for(const field of form.elements)field.disabled=true;
      const prepared=prepareFolleto(snapshot,formatKey,message=>status.textContent=message,signal);
      let clipboard=Promise.resolve(false);
      if(formatKey!=="document"&&navigator.clipboard?.write&&typeof ClipboardItem!=="undefined"){
        // Start the clipboard operation within the click gesture; image bytes may resolve later.
        const imageBlob=prepared.then(r=>{folletoAssertSession(r.snapshot,signal);return r.pages[0].blob;});
        try{clipboard=Promise.resolve(navigator.clipboard.write([new ClipboardItem({"image/png":imageBlob})])).then(()=>true,()=>false);}catch(_){clipboard=Promise.resolve(false);}
      }
      const result=await exportFolleto(prepared,formatKey,signal,clipboard);
      clearPreview();
      previewUrl=URL.createObjectURL(result.pages[0].blob);preview.src=previewUrl;preview.hidden=false;
      status.textContent=`${result.snapshot.products.length} ${result.snapshot.products.length===1?"producto":"productos"} · ${result.pages.length} ${result.pages.length===1?"página descargada":"páginas descargadas"}.${formatKey!=="document"?(result.copied?" Primera imagen copiada al portapapeles.":" El navegador no permitió copiar; los PNG se descargaron."):""}${result.missing?` ${result.missing} productos con imagen no disponible.`:""}`;
    }catch(e){status.textContent=e.name==="AbortError"?"Generación cancelada.":e.message||"No se pudo generar el folleto.";}
    finally{busy=false;for(const field of form.elements)field.disabled=false;syncAdmin();for(const b of exports)b.disabled=false;}
  });
  document.getElementById("bulkAddBtn")?.addEventListener("click",()=>{
    const products=buildFilteredList().filter(p=>!p.isGiftGalleryImage);let added=0,existing=0,unavailable=0;
    for(const p of products){const id=String(p.id);if(cart[id]?.qty>0){existing++;continue;}if(shouldEnforceStockLimits()&&(!Number.isFinite(p.stock)||p.stock<1)){unavailable++;continue;}cart[id]={id:p.id,name:p.name,price:p.price,hasPrice:p.hasPrice!==false,qty:1,stock:p.stock,imgFilename:p.imgFilename||null};added++;}
    saveCart();render();renderCartModal();document.getElementById("bulkAddStatus").textContent=`Se agregaron ${added} productos; ${existing} ya estaban en el carrito; ${unavailable} sin stock disponible.`;
  });
}
