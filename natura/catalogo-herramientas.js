// Herramienta pública Folleto/collage.

// Descarga comercial del catálogo. No modifica inventario, carrito ni navegación.
const CATALOG_PDF = Object.freeze({
  width:595.28,height:841.89,margin:42.52,scale:2,
  font:"Calibri, Carlito, Arial, sans-serif",
  gold:"#b8781f",rose:"#c54e73",mauve:"#8f4963",purple:"#6f3aa0",ink:"#282326"
});

// El PDF usa la clasificación completa del inventario, aunque la navegación
// pública omita, reordene o desactive niveles (incluido Producto).
const CATALOG_PDF_LEVELS=Object.freeze(["section","category","subcategory","public","line","product"]);

function catalogPdfSnapshot(options={}){
  if(window.CATALOG_INITIAL_LOAD_READY!==true) throw new Error("Espera a que termine de cargar el catálogo.");
  if(typeof window.isCatalogProductPublic!=="function"||typeof window.isCatalogProductHidden!=="function") throw new Error("Todavía se está preparando la visibilidad del catálogo.");
  if(window.CATALOG_PUBLIC_VISIBILITY_CONFIRMED!==true) throw new Error("No fue posible comprobar la visibilidad del catálogo. Recarga antes de descargar.");
  const admin=window.CATALOG_ADMIN_MODE_ACTIVE===true;
  const includeHidden=admin&&options.includeHidden===true,includeNotForSale=admin&&options.includeNotForSale===true;
  const normalize=value=>String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ");
  const eligible=p=>p&&!p.isGiftGalleryImage&&/^\d{4}$/.test(String(p.id||""))
    &&(includeHidden||!window.isCatalogProductHidden(p))
    &&(includeNotForSale||normalize(p.commercialStatus)!=="no a la venta");
  const products=scopedProductsForCurrentNavigation(allLoadedProducts.filter(eligible));
  products.sort(compareCatalogProductOrder);
  const activeOrder=navigationOrderedLevels(),productIndex=activeOrder.indexOf("product");
  const contextLevels=productIndex<0?activeOrder:activeOrder.slice(0,productIndex);
  const titleSlots=contextLevels.map(level=>({level,label:String(selectedNavigationValue(level)||"").trim()})).filter(slot=>slot.label);
  return {
    scope:"branch",title:titleSlots.map(slot=>slot.label).join(" › ")||"Catálogo",
    titleSlots,order:CATALOG_PDF_LEVELS.slice(),adminExtras:includeHidden||includeNotForSale,
    products:collageUniqueProducts(products).map(p=>({...p}))
  };
}

function catalogPdfGroups(snapshot){
  const groups=new Map();
  const order=snapshot.order||CATALOG_PDF_LEVELS;
  const levels=order.slice(0,order.indexOf("product"));
  for(const p of snapshot.products){
    const slots=levels.map(level=>({level,label:String(navigationValueForProduct(p,level)||"").trim()})).filter(slot=>slot.label);
    const key=JSON.stringify(slots.map(slot=>[slot.level,cleanNavKey(slot.label)]));
    if(!groups.has(key))groups.set(key,{title:slots.map(slot=>slot.label).join(" › ")||snapshot.title,slots,products:[]});
    groups.get(key).products.push(p);
  }
  return [...groups.values()];
}

function catalogPdfFont(ctx,size,bold=false){
  ctx.font=`${bold?700:400} ${size}px ${CATALOG_PDF.font}`;
}

function catalogPdfWrap(ctx,text,width){
  const lines=[];
  for(const paragraph of String(text||"").replace(/\r/g,"").split("\n")){
    const words=paragraph.trim().split(/\s+/).filter(Boolean);
    let line="";
    for(const word of words){
      const next=line?`${line} ${word}`:word;
      if(line&&ctx.measureText(next).width>width){lines.push({text:line,justify:true});line="";}
      // Divide palabras o referencias excepcionalmente largas, sin perder caracteres.
      if(ctx.measureText(word).width>width){
        if(line){lines.push({text:line,justify:true});line="";}
        for(const character of word){
          if(line&&ctx.measureText(line+character).width>width){lines.push({text:line,justify:false});line="";}
          line+=character;
        }
      }else line=line?`${line} ${word}`:word;
    }
    if(line) lines.push({text:line,justify:false});
  }
  return lines;
}

function catalogPdfDrawLines(ctx,lines,x,y,width,lineHeight,justify=false){
  for(const line of lines){
    const words=line.text.split(" ");
    if(justify&&line.justify&&words.length>1){
      const gap=(width-words.reduce((sum,word)=>sum+ctx.measureText(word).width,0))/(words.length-1);
      // Evita espacios extremos en líneas cortas o referencias partidas.
      if(gap<=ctx.measureText(" ").width*2.8){
        let xx=x;
        for(const word of words){ctx.fillText(word,xx,y);xx+=ctx.measureText(word).width+gap;}
      }else ctx.fillText(line.text,x,y);
    }else ctx.fillText(line.text,x,y);
    y+=lineHeight;
  }
  return y;
}

function catalogPdfHeader(){
  const c=CATALOG_PDF,x=c.margin,bodyX=x+86,width=c.width-x*2;
  // Solo identidad y contacto: la ruta pertenece al grupo, no a cada página.
  return {x,bodyX,width,bodyTop:x+98};
}

function catalogPdfGroupHeading(ctx,slots,width){
  const labels=slots.map(slot=>slot.label),route=labels.join(" › ")||"Catálogo";
  const size=11,lineHeight=13.2,maxWidth=width-16;
  catalogPdfFont(ctx,size,true);
  let lines=catalogPdfWrap(ctx,route,maxWidth);
  if(lines.length>2){
    // Mantiene todos los nombres en dos renglones, sin truncar la ruta.
    // Prefiere separar entre niveles; un nombre excepcionalmente largo
    // se reparte entre palabras. El dibujo ajusta el ancho si hace falta.
    const parts=labels.length>1?labels:route.split(/\s+/),separator=labels.length>1?" › ":" ";
    let best=null;
    for(let index=1;index<parts.length;index++){
      const first=parts.slice(0,index).join(separator),second=parts.slice(index).join(separator);
      const score=Math.max(ctx.measureText(first).width,ctx.measureText(second).width);
      if(!best||score<best.score)best={score,first,second};
    }
    lines=best?[{text:best.first,justify:false},{text:best.second,justify:false}]:[{text:route,justify:false}];
  }
  const boxHeight=lines.length*lineHeight+12;
  return {height:boxHeight+10,blocks:[{route,lines,size,lineHeight,maxWidth,boxHeight}]};
}

function catalogPdfMeasureCard(ctx,product,options,width,imageHeight=70){
  catalogPdfFont(ctx,11,true);
  const nameLines=catalogPdfWrap(ctx,product.name,width);
  catalogPdfFont(ctx,11);
  const descriptionLines=options.descriptions&&product.description
    ?catalogPdfWrap(ctx,`Descripción: ${product.description}`,width):[];
  const price=options.prices?product.hasPrice===false?"Consultar precio":`${fmtCOP.format(Number(product.price)||0)} COP`:"";
  const baseHeight=imageHeight+8+18+nameLines.length*13.2+5+(price?21:0)+5;
  return {product,width,imageHeight,nameLines,descriptionLines,price,baseHeight,height:baseHeight+descriptionLines.length*13.2+8};
}

function catalogPdfPlanPages(ctx,snapshot,options){
  const c=CATALOG_PDF,gap=20,inner=c.width-c.margin*2,column=(inner-gap)/2,pages=[];
  const header=catalogPdfHeader(),available=c.height-c.margin-22-header.bodyTop;
  let page=null;
  const startPage=title=>{page={title,header,rows:[],height:0};pages.push(page);};
  for(const group of catalogPdfGroups(snapshot)){
    const heading=catalogPdfGroupHeading(ctx,group.slots,inner);
    let groupStarted=false;
    for(let index=0;index<group.products.length;){
      let rowHeading=groupStarted?{blocks:[],height:0}:heading;
      let cards=group.products.slice(index,index+2).map(p=>catalogPdfMeasureCard(ctx,p,options,column));
      if(cards.length===1)cards=[catalogPdfMeasureCard(ctx,cards[0].product,options,inner)];
      let cardHeight=Math.max(...cards.map(card=>card.height));
      if(cardHeight+rowHeading.height>available){
        cards=[catalogPdfMeasureCard(ctx,group.products[index],options,inner)];cardHeight=cards[0].height;
      }
      if(cardHeight+rowHeading.height>available){
        const card=cards[0];let offset=0;
        while(offset<card.descriptionLines.length){
          rowHeading=groupStarted?{blocks:[],height:0}:heading;
          const capacity=Math.floor((available-rowHeading.height-card.baseHeight-8)/13.2);
          if(capacity<1)throw new Error("El nombre de este producto es demasiado extenso para una página. Revísalo antes de descargar.");
          startPage(group.title);
          const chunk={...card,descriptionLines:card.descriptionLines.slice(offset,offset+capacity)};
          chunk.height=chunk.baseHeight+chunk.descriptionLines.length*13.2+8;
          const height=rowHeading.height+chunk.height;
          page.rows.push({cards:[chunk],heading:rowHeading,groupTitle:group.title,height});page.height=height;
          offset+=capacity;groupStarted=true;page=null;
        }
        index++;continue;
      }
      const rowHeight=cardHeight+rowHeading.height;
      if(!page||page.rows.length===2||page.height+(page.rows.length?16:0)+rowHeight>available)startPage(group.title);
      page.rows.push({cards,heading:rowHeading,groupTitle:group.title,height:rowHeight});
      page.height+=(page.rows.length>1?16:0)+rowHeight;index+=cards.length;groupStarted=true;
    }
  }
  for(const page of pages){
    const growth=Math.min(150,Math.max(0,(available-page.height)/page.rows.length));
    for(const row of page.rows){
      for(const card of row.cards){card.imageHeight+=growth;card.baseHeight+=growth;card.height+=growth;}
      row.height+=growth;page.height+=growth;
    }
  }
  return pages;
}

function catalogPdfLoadImage(url,signal){
  if(!url) return Promise.resolve(null);
  return new Promise((resolve,reject)=>{
    const img=new Image();let done=false;
    const finish=(image,error)=>{
      if(done)return;done=true;clearTimeout(timer);
      signal?.removeEventListener("abort",abort);img.onload=img.onerror=null;
      if(error){img.src="";reject(error);}else resolve(image);
    };
    const abort=()=>finish(null,new DOMException("Descarga cancelada.","AbortError"));
    const timer=setTimeout(()=>finish(null),10000);
    if(signal?.aborted){abort();return;}
    signal?.addEventListener("abort",abort,{once:true});
    img.crossOrigin="anonymous";
    img.onload=()=>finish(img);img.onerror=()=>finish(null);img.src=url;
  });
}

function catalogPdfRoundRect(ctx,x,y,w,h,r=5){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

function catalogPdfDrawCard(ctx,card,image,x,y){
  const c=CATALOG_PDF;
  if(image){
    const ratio=Math.min(card.width/image.naturalWidth,card.imageHeight/image.naturalHeight);
    const w=image.naturalWidth*ratio,h=image.naturalHeight*ratio;
    ctx.drawImage(image,x+(card.width-w)/2,y+(card.imageHeight-h)/2,w,h);
  }else{
    catalogPdfFont(ctx,10);ctx.fillStyle="#735f65";ctx.textAlign="center";
    ctx.fillText("Imagen no disponible",x+card.width/2,y+card.imageHeight/2);ctx.textAlign="left";
  }
  y+=card.imageHeight+8;
  catalogPdfFont(ctx,11);
  const code=`Código ${card.product.id}`,codeWidth=ctx.measureText(code).width+12;
  ctx.fillStyle="#fbe8ee";catalogPdfRoundRect(ctx,x,y,codeWidth,16,4);ctx.fill();
  ctx.fillStyle=c.ink;ctx.fillText(code,x+6,y+3);y+=18;
  catalogPdfFont(ctx,11,true);
  y=catalogPdfDrawLines(ctx,card.nameLines,x,y,card.width,13.2,true)+5;
  if(card.price){catalogPdfFont(ctx,14,true);ctx.fillStyle=c.mauve;ctx.fillText(card.price,x,y);y+=21;}
  y+=5;catalogPdfFont(ctx,11);ctx.fillStyle=c.ink;
  catalogPdfDrawLines(ctx,card.descriptionLines,x,y,card.width,13.2,true);
}

async function catalogPdfDrawPage(plan,pageNumber,logo,signal,contactIcon){
  const c=CATALOG_PDF,canvas=document.createElement("canvas");
  canvas.width=Math.ceil(c.width*c.scale);canvas.height=Math.ceil(c.height*c.scale);
  const ctx=canvas.getContext("2d");
  if(!ctx) throw new Error("No fue posible preparar las páginas del PDF.");
  ctx.scale(c.scale,c.scale);ctx.textBaseline="top";ctx.fillStyle="#fffdfc";ctx.fillRect(0,0,c.width,c.height);
  const gradient=ctx.createLinearGradient(c.margin,0,c.width-c.margin,0);
  gradient.addColorStop(0,"#c98a31");gradient.addColorStop(.45,"#f0d58e");gradient.addColorStop(1,"#b8701e");
  ctx.fillStyle=gradient;ctx.fillRect(c.margin,c.margin,c.width-c.margin*2,5);
  ctx.drawImage(logo,c.margin,c.margin+14,72,72);
  const head=plan.header;
  catalogPdfFont(ctx,18,true);ctx.fillStyle=c.gold;ctx.fillText("IRENISMB STOCK NATURA",head.bodyX,c.margin+16);
  catalogPdfFont(ctx,10);ctx.fillStyle=c.mauve;
  ctx.fillText("Natura & AVON · Santa Marta · Envíos a toda Colombia",head.bodyX,c.margin+39);
  // El recurso existente tiene esquinas negras; se presenta como icono circular.
  ctx.save();ctx.beginPath();ctx.arc(head.bodyX+8,c.margin+68,8,0,Math.PI*2);ctx.clip();
  ctx.drawImage(contactIcon,head.bodyX,c.margin+60,16,16);ctx.restore();
  catalogPdfFont(ctx,11);ctx.fillStyle=c.mauve;ctx.fillText("304 208 8961",head.bodyX+23,c.margin+62);
  let y=head.bodyTop,missing=0;
  for(let rowIndex=0;rowIndex<plan.rows.length;rowIndex++){
    if(signal?.aborted) throw new DOMException("Descarga cancelada.","AbortError");
    const row=plan.rows[rowIndex];
    for(const block of row.heading.blocks){
      ctx.strokeStyle="#cf982c";ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(c.margin,y);ctx.lineTo(c.width-c.margin,y);ctx.stroke();
      ctx.fillStyle="#fbe8ee";ctx.fillRect(c.margin,y+3,c.width-c.margin*2,block.boxHeight);
      catalogPdfFont(ctx,block.size,true);ctx.fillStyle=c.purple;
      let textY=y+9;
      for(const line of block.lines){ctx.fillText(line.text,c.margin+8,textY,block.maxWidth);textY+=block.lineHeight;}
      y+=row.heading.height;
    }
    const images=await Promise.all(row.cards.map(card=>catalogPdfLoadImage(shouldShowProductImages()?String(card.product.docsImageUrl||""):"",signal)));
    for(let index=0;index<row.cards.length;index++){
      if(!images[index])missing++;
      catalogPdfDrawCard(ctx,row.cards[index],images[index],c.margin+index*(row.cards[index].width+20),y);
    }
    ctx.strokeStyle="#cf982c";ctx.lineWidth=.7;
    if(row.cards.length===2){const xx=c.width/2;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+row.height-row.heading.height);ctx.stroke();}
    y+=row.height-row.heading.height;
    if(rowIndex<plan.rows.length-1){ctx.beginPath();ctx.moveTo(c.margin,y+8);ctx.lineTo(c.width-c.margin,y+8);ctx.stroke();y+=16;}
  }
  ctx.strokeStyle="#cf982c";ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(c.margin,c.height-c.margin-18);ctx.lineTo(c.width-c.margin,c.height-c.margin-18);ctx.stroke();
  catalogPdfFont(ctx,9);ctx.fillStyle=c.ink;
  ctx.textAlign="right";ctx.fillText(`Página ${pageNumber}`,c.width-c.margin,c.height-c.margin-11);ctx.textAlign="left";
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.94));
  if(!blob)throw new Error("No fue posible preparar una página del PDF.");
  const result={bytes:new Uint8Array(await blob.arrayBuffer()),width:canvas.width,height:canvas.height,missing};
  canvas.width=canvas.height=1;
  return result;
}

// PDF estándar con una imagen por página: descarga directa, sin ventanas de impresión
// ni bibliotecas externas. Los textos se dibujan completos con tamaño de 11 puntos.
function catalogPdfDocument(pages){
  const encoder=new TextEncoder(),parts=[],offsets=[0];let length=0;
  const add=value=>{const bytes=typeof value==="string"?encoder.encode(value):value;parts.push(bytes);length+=bytes.length;};
  const object=(id,body)=>{offsets[id]=length;add(`${id} 0 obj\n`);add(body);add("\nendobj\n");};
  add("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
  object(1,"<< /Type /Catalog /Pages 2 0 R >>");
  object(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(" ")}] >>`);
  for(let i=0;i<pages.length;i++){
    const page=pages[i],id=3+i*3;
    object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${CATALOG_PDF.width} ${CATALOG_PDF.height}] /Resources << /XObject << /Im0 ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);
    offsets[id+1]=length;
    add(`${id+1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`);
    add(page.bytes);add("\nendstream\nendobj\n");
    const stream=`q\n${CATALOG_PDF.width} 0 0 ${CATALOG_PDF.height} 0 0 cm\n/Im0 Do\nQ\n`;
    object(id+2,`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);
  }
  const xref=length,count=3+pages.length*3;
  add(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for(let i=1;i<count;i++)add(`${String(offsets[i]).padStart(10,"0")} 00000 n \n`);
  add(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts,{type:"application/pdf"});
}

async function catalogPdfBuild(snapshot,options={},progress=()=>{},signal){
  if(!snapshot.products.length)throw new Error("No hay productos para descargar en este nivel.");
  await document.fonts?.ready;
  const logo=await catalogPdfLoadImage(COMPANY_LOGO,signal)||await catalogPdfLoadImage(COMPANY_LOGOS[1],signal);
  if(!logo)throw new Error("No fue posible cargar el logo oficial. Intenta descargar nuevamente.");
  const contactIcon=await catalogPdfLoadImage("logos/whatsapp.webp",signal);
  if(!contactIcon)throw new Error("No fue posible cargar el icono de contacto. Intenta descargar nuevamente.");
  const measure=document.createElement("canvas").getContext("2d");
  const plans=catalogPdfPlanPages(measure,snapshot,options),pages=[];
  let missing=0;
  for(let i=0;i<plans.length;i++){
    if(signal?.aborted)throw new DOMException("Descarga cancelada.","AbortError");
    if(snapshot.adminExtras&&window.CATALOG_ADMIN_MODE_ACTIVE!==true)throw new Error("La sesión de administrador terminó. Vuelve a abrir la descarga.");
    progress(`Preparando página ${i+1} de ${plans.length}…`);
    const page=await catalogPdfDrawPage(plans[i],i+1,logo,signal,contactIcon);
    if(snapshot.adminExtras&&window.CATALOG_ADMIN_MODE_ACTIVE!==true)throw new Error("La sesión de administrador terminó. Vuelve a abrir la descarga.");
    missing+=page.missing;pages.push(page);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(snapshot.adminExtras&&window.CATALOG_ADMIN_MODE_ACTIVE!==true)throw new Error("La sesión de administrador terminó. Vuelve a abrir la descarga.");
  return {blob:catalogPdfDocument(pages),pageCount:pages.length,missing};
}

function initCatalogPdfFeature(){
  const button=document.getElementById("catalogPdfBtn");
  if(!button||document.getElementById("catalogPdfDialog"))return;
  const style=document.createElement("style");style.id="catalog-pdf-controls-style";
  style.textContent=`
    .bar[role="search"]>#catalogPdfBtn{order:47!important;min-width:0}
    #catalogPdfDialog{width:min(460px,calc(100vw - 40px));max-height:calc(100dvh - 40px);overflow:auto;border:1px solid #eadcda;border-radius:18px;padding:24px;background:#fffdfc;color:#282326;font:16px Calibri,Arial,sans-serif;box-sizing:border-box}
    #catalogPdfDialog::backdrop{background:rgba(20,15,20,.65)}
    #catalogPdfDialog h2{margin:0 0 14px;padding-right:36px;color:#8f4963;font-size:24px}
    #catalogPdfDialog label{display:flex;gap:10px;align-items:flex-start;margin:14px 0;cursor:pointer}
    #catalogPdfDialog input{flex:0 0 auto;width:18px;height:18px;margin:2px 0;accent-color:#8f4963}
    #catalogPdfDialog small{display:block;margin-top:4px;color:#735f65;font-size:14px}
    #catalogPdfDialog fieldset{border:0;padding:0;margin:0}
    #catalogPdfAdminOptions[hidden]{display:none}
    #catalogPdfSelection span{display:block;margin:4px 0}
    #catalogPdfSelection span:first-child{font-weight:700}
    #catalogPdfSelection{padding:12px;background:#fff6f8;border-radius:8px;overflow-wrap:anywhere}
    #catalogPdfStatus{min-height:20px;overflow-wrap:anywhere}
    .catalog-pdf-actions{display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap}
    #catalogPdfDialog button{font:700 16px Calibri,Arial,sans-serif;min-height:44px;padding:10px 16px;border:1px solid #e7a7ba;border-radius:8px;background:#fff6f8;color:#8f4963;cursor:pointer}
    #catalogPdfDialog #catalogPdfDismiss{position:absolute;right:12px;top:12px;min-height:36px;width:36px;padding:0;border:0;background:transparent;font-size:26px;color:#735f65}
    #catalogPdfDialog button[type="submit"]{background:#8f4963;color:white}
    #catalogPdfDialog button:disabled{opacity:.5;cursor:wait}
    #catalogPdfDialog :focus-visible{outline:3px solid #b8781f;outline-offset:3px}
    @media(max-width:760px){.bar[role="search"]>#catalogPdfBtn{grid-column:1 / -1!important;grid-row:5!important;width:100%!important;max-width:none!important;margin:0!important;justify-self:stretch!important}.bar[role="search"]:has(>#catalogPdfBtn)>.count-slot{grid-row:6!important}}
  `;
  document.head.appendChild(style);
  const dialog=document.createElement("dialog");dialog.id="catalogPdfDialog";dialog.setAttribute("aria-labelledby","catalogPdfTitle");
  dialog.innerHTML=`<form id="catalogPdfForm"><button type="button" id="catalogPdfDismiss" aria-label="Cerrar ventana">×</button><h2 id="catalogPdfTitle">Descargar catálogo</h2>
    <p id="catalogPdfContext"></p>
    <small>Incluye todos los productos y subniveles desde tu ubicación actual, también los niveles omitidos en la navegación.</small>
    <p id="catalogPdfSelection"></p>
    <fieldset id="catalogPdfOptions"><legend>Opciones del PDF</legend>
    <label><input id="catalogPdfPrices" type="checkbox" checked><span>Mostrar precios</span></label>
    <label><input id="catalogPdfDescriptions" type="checkbox" checked><span>Mostrar descripciones completas</span></label>
    <div id="catalogPdfAdminOptions" hidden>
      <label><input id="catalogPdfHidden" type="checkbox"><span>Incluir productos ocultos</span></label>
      <label><input id="catalogPdfNotForSale" type="checkbox"><span>Incluir productos “No a la venta”</span></label>
    </div></fieldset>
    <p id="catalogPdfStatus" role="status" aria-live="polite"></p>
    <div class="catalog-pdf-actions"><button type="button" id="catalogPdfClose">Cancelar</button><button type="submit" id="catalogPdfDownload">Descargar PDF</button></div></form>`;
  document.body.appendChild(dialog);
  const form=dialog.querySelector("form"),fieldset=dialog.querySelector("fieldset"),status=dialog.querySelector("#catalogPdfStatus"),selection=dialog.querySelector("#catalogPdfSelection"),submit=dialog.querySelector("#catalogPdfDownload"),prices=dialog.querySelector("#catalogPdfPrices"),close=dialog.querySelector("#catalogPdfClose");
  const context=dialog.querySelector("#catalogPdfContext"),adminOptions=dialog.querySelector("#catalogPdfAdminOptions"),hidden=dialog.querySelector("#catalogPdfHidden"),notForSale=dialog.querySelector("#catalogPdfNotForSale");
  let controller=null;
  const options=()=>({includeHidden:hidden.checked,includeNotForSale:notForSale.checked,prices:prices.checked&&shouldShowProductPrices(),descriptions:dialog.querySelector("#catalogPdfDescriptions").checked});
  function syncAdminOptions(){
    const admin=window.CATALOG_ADMIN_MODE_ACTIVE===true;
    adminOptions.hidden=!admin;hidden.disabled=notForSale.disabled=!admin;
    if(!admin)hidden.checked=notForSale.checked=false;
  }
  function refresh(){
    syncAdminOptions();
    prices.disabled=!shouldShowProductPrices();if(prices.disabled)prices.checked=false;
    try{
      const snapshot=catalogPdfSnapshot(options());
      context.textContent=snapshot.titleSlots.length?`Desde ${snapshot.titleSlots.at(-1).label}`:"Desde Inicio: todo el catálogo";
      selection.replaceChildren();
      for(const slot of snapshot.titleSlots){const line=document.createElement("span");line.textContent=slot.label;selection.appendChild(line);}
      const count=document.createElement("small");count.textContent=`${snapshot.products.length} ${snapshot.products.length===1?"producto":"productos"}`;selection.appendChild(count);
      submit.disabled=!snapshot.products.length;status.textContent=snapshot.products.length?"":"No hay productos que coincidan con estas opciones en el nivel actual.";
    }catch(error){context.textContent="";selection.textContent="";submit.disabled=true;status.textContent=error.message;}
  }
  button.addEventListener("click",async()=>{
    button.disabled=true;
    try{await window.CATALOG_PUBLIC_VISIBILITY_READY;hidden.checked=notForSale.checked=false;refresh();dialog.showModal();}finally{button.disabled=false;}
  });
  window.addEventListener("irenismb:admin-section-change",()=>{
    if(window.CATALOG_ADMIN_MODE_ACTIVE!==true){hidden.checked=notForSale.checked=false;controller?.abort();}
    if(dialog.open&&!controller)refresh();
  });
  form.addEventListener("change",refresh);
  close.addEventListener("click",()=>{controller?.abort();dialog.close();});
  dialog.querySelector("#catalogPdfDismiss").addEventListener("click",()=>{controller?.abort();dialog.close();});
  dialog.addEventListener("cancel",()=>controller?.abort());
  dialog.addEventListener("close",()=>button.focus());
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(controller)return;
    const selectedOptions=options();
    controller=new AbortController();fieldset.disabled=true;submit.disabled=true;close.textContent="Cancelar";
    try{
      await window.CATALOG_PUBLIC_VISIBILITY_READY;
      const snapshot=catalogPdfSnapshot(selectedOptions);
      const result=await catalogPdfBuild(snapshot,selectedOptions,text=>status.textContent=text,controller.signal);
      if(controller.signal.aborted)return;
      if(snapshot.adminExtras&&window.CATALOG_ADMIN_MODE_ACTIVE!==true)throw new Error("La sesión de administrador terminó. Vuelve a abrir la descarga.");
      const url=URL.createObjectURL(result.blob),link=document.createElement("a");
      const slug=snapshot.title.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
      link.href=url;link.download=`catalogo_${slug||"productos"}.pdf`;document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent=`PDF preparado: ${snapshot.products.length} productos, ${result.pageCount} ${result.pageCount===1?"página":"páginas"}.${result.missing?` ${result.missing} imágenes no pudieron cargarse.`:""}`;
    }catch(error){status.textContent=error.name==="AbortError"?"Descarga cancelada.":error.message||"No fue posible generar el PDF. Intenta nuevamente.";}
    finally{controller=null;fieldset.disabled=false;submit.disabled=false;close.textContent="Cancelar";prices.disabled=!shouldShowProductPrices();syncAdminOptions();}
  });
}

initCatalogPdfFeature();

// ==========================================
// VISTA DE COLLAGE SEGÚN LA VISTA Y FILTROS ACTUALES
// ==========================================
function collageUniqueProducts(products){
  const seen=new Set();
  const out=[];
  for(const p of (Array.isArray(products)?products:[])){
    if(!p) continue;
    const key=String(p.id||p.code||p.name||"").trim();
    if(!key||seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function collageRouteSlotsForProduct(p){
  return navigationOrderedLevels().map(level=>({
    level,
    depth:navigationDepthForType(level),
    label:navigationValueForProduct(p,level)
  })).map(slot=>({ ...slot, label:String(slot.label||"").trim() }));
}

function collageProductRoute(p){
  return collageRouteSlotsForProduct(p).filter(slot=>slot.label);
}

function collageCurrentTitleSlots(){
  return navigationOrderedLevels().map(level=>({
    level,
    depth:navigationDepthForType(level),
    label:selectedNavigationValue(level)
  }))
    .map(slot=>({ ...slot, label:String(slot.label||"").trim() }))
    .filter(slot=>slot.label);
}

function collageCurrentTitleParts(){
  return collageCurrentTitleSlots().map(slot=>slot.label);
}

function collageRemainingRoute(p,titleSlots){
  const fullRoute=collageProductRoute(p);
  const current=Array.isArray(titleSlots)?titleSlots:[];
  const maxDepth=current.reduce((max,slot)=>Math.max(max,Number(slot?.depth)||0),0);
  return fullRoute.filter(slot=>slot.depth>maxDepth);
}

function collageBuildRouteTree(products,titleSlots){
  const root={ label:"", depth:0, level:"root", products:[], children:new Map() };

  for(const p of (Array.isArray(products)?products:[])){
    const route=collageRemainingRoute(p,titleSlots);
    let node=root;

    for(const segment of route){
      const key=`${segment.depth}:${cleanNavKey(segment.label)||segment.label}`;
      if(!node.children.has(key)){
        node.children.set(key,{
          label:segment.label,
          depth:segment.depth,
          level:segment.level,
          products:[],
          children:new Map()
        });
      }
      node=node.children.get(key);
    }

    node.products.push(p);
  }

  return root;
}

function collageCurrentSnapshot(){
  const products=collageUniqueProducts(cartItemsArray().map(item=>productById.get(String(item.id))).filter(product=>product && !product.isGiftGalleryImage));
  products.sort(compareCatalogProductOrder);
  const titleSlots=[];
  for(const level of navigationOrderedLevels()){
    if(level==="product") break;
    const values=[...new Set(products.map(product=>String(navigationValueForProduct(product,level)||"").trim()))];
    if(values.length!==1) break;
    if(values[0]) titleSlots.push({label:values[0],depth:navigationDepthForType(level),level});
  }
  const titleParts=titleSlots.length ? titleSlots.map(slot=>slot.label) : ["Productos del carrito"];

  return {
    title:titleParts.length?titleParts.join(" › "):"Catálogo",
    titleParts,
    titleSlots,
    products,
    tree:collageBuildRouteTree(products,titleSlots)
  };
}

function renderCollageRouteHeading(routeEl,titleSlots){
  if(!routeEl) return;
  routeEl.innerHTML="";
  routeEl.classList.add("fixed-route");
  const slots=Array.isArray(titleSlots)?titleSlots:[];
  if(!slots.length){
    routeEl.textContent="Catálogo";
    routeEl.classList.remove("fixed-route");
    return;
  }
  for(const slotData of slots){
    const slot=document.createElement("span");
    slot.className="collage-route-slot";
    slot.dataset.navLevel=slotData.level;
    slot.dataset.navDepth=String(slotData.depth);
    slot.style.setProperty("--route-column",String(slotData.depth));
    if(slotData.depth>1){
      const sep=document.createElement("span");
      sep.className="collage-route-separator";
      sep.textContent="›";
      sep.setAttribute("aria-hidden","true");
      slot.appendChild(sep);
    }
    const label=document.createElement("span");
    label.textContent=slotData.label;
    slot.appendChild(label);
    routeEl.appendChild(slot);
  }
}

function collagePriceText(p){
  if(!shouldShowProductPrices()) return "";
  return p&&p.hasPrice===false ? "Consultar precio" : fmtCOP.format(Number(p?.price)||0);
}

function syncFolletoButtonVisibility(){
  const btn=document.getElementById("collageBtn");
  if(!btn) return;
  btn.hidden=false;
  btn.disabled=false;
}

function syncAdministrativeToolVisibility(){
  syncFolletoButtonVisibility();
  const invoiceButton=document.getElementById("cartInvoiceBtn");
  if(invoiceButton) invoiceButton.hidden=window.CATALOG_ADMIN_MODE_ACTIVE!==true;
}

function initCollageFeature(){
  const toolbar=document.querySelector(".bar");
  const cartButton=document.getElementById("btn-cart");
  if(!toolbar) return;

  let btn=document.getElementById("collageBtn");

  const style=document.createElement("style");
  style.id="collageFeatureStyles";
  style.textContent=`
    .collage-modal{position:fixed;inset:0;z-index:2200;display:none;align-items:center;justify-content:center;padding:18px}
    .collage-modal.open{display:flex}
    .collage-modal.admin-embedded{position:static;inset:auto;z-index:auto;display:block;padding:0;width:100%;background:transparent}
    .collage-modal.admin-embedded .collage-backdrop,.collage-modal.admin-embedded .collage-close{display:none!important}
    .collage-modal.admin-embedded .collage-shell{width:100%;max-width:none;max-height:none;aspect-ratio:auto;overflow:visible;border-radius:20px;box-shadow:0 12px 34px rgba(30,42,58,.10);background:#fff;border-color:#dfe5e1;color:#17312b}
    .collage-modal.admin-embedded .collage-route,.collage-modal.admin-embedded .collage-control-label{color:#182f2a}
    .collage-modal.admin-embedded .collage-route-separator{color:#7b8582}
    .collage-modal.admin-embedded .collage-selection-hint{background:#fff7e8;border-color:#ead4a2;color:#765719}
    .collage-modal.admin-embedded .collage-tree{color:#17312b}
    .collage-modal.admin-embedded .collage-subtitle{color:#6f7d78}
    .collage-modal.admin-embedded .collage-depth-4>.collage-subtitle,.collage-modal.admin-embedded .collage-depth-5>.collage-subtitle{color:#7a8682}
    .collage-backdrop{position:absolute;inset:0;background:rgba(3,8,18,.78);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
    .collage-shell{position:relative;z-index:1;width:min(1080px,92vw,92vh);aspect-ratio:1/1;max-width:92vw;max-height:92vh;overflow:auto;background:#0f1726;border:1px solid #29354a;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.48);padding:22px}
    .collage-close{position:sticky;top:0;float:right;z-index:3;width:42px;height:42px;border-radius:999px;border:1px solid #334155;background:#172033;color:#fff;font-size:22px;line-height:1;cursor:pointer}
    .collage-heading{padding:4px 56px 14px 2px;text-align:center}
    .collage-route{margin:0;color:#f8fafc;font-size:clamp(23px,3vw,38px);line-height:1.1;font-weight:950;letter-spacing:-.025em}
    .collage-route.fixed-route{display:grid;grid-template-columns:repeat(5,max-content);align-items:center;justify-content:center;gap:6px 14px;overflow-x:auto;max-width:100%;padding-bottom:2px}
    .collage-route-slot{grid-column:var(--route-column);display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
    .collage-route-separator{opacity:.55;font-weight:700}
    .collage-actions{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;margin:0 0 18px}
    .collage-output-actions{display:flex;justify-content:center;align-items:center;width:min(590px,100%)}
    .collage-output-actions[hidden],.collage-social-actions[hidden]{display:none!important}
    .collage-social-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:min(590px,100%)}
    .collage-social-btn{min-height:48px;padding:11px 20px;border-radius:13px;border:1px solid #b9954f;background:#fff7ea;color:#8d5360;font-weight:950;cursor:pointer;box-shadow:0 8px 22px rgba(185,149,79,.14)}
    .collage-social-btn:hover:not(:disabled){background:#fff0cf;border-color:#b9954f;transform:translateY(-1px)}
    .collage-social-btn:disabled{opacity:.6;cursor:wait}
    .collage-selector-block{width:min(590px,100%)}
    .collage-control-label{margin:0 0 7px;color:#f8fafc;font-size:14px;line-height:1.2;font-weight:900;text-align:left}
    .collage-type-choices,.collage-format-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%}
    .collage-type-option,.collage-format-option{min-height:48px;padding:10px 14px;border-radius:14px;border:1px solid #d9c9c1;background:#fffdfb;color:#352b2c;font-weight:900;cursor:pointer;box-shadow:0 4px 14px rgba(141,83,96,.08);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,background .16s ease}
    .collage-type-option:hover:not(:disabled),.collage-format-option:hover{transform:translateY(-1px);border-color:#b9954f;box-shadow:0 7px 18px rgba(141,83,96,.14)}
    .collage-type-option.is-active,.collage-format-option.is-active{background:#a55f70;border-color:#a55f70;color:#fff;box-shadow:0 8px 22px rgba(165,95,112,.28)}
    .collage-type-option:focus-visible,.collage-format-option:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(185,149,79,.24)}
    .collage-type-option:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
    .collage-size-control[hidden],.collage-selection-hint[hidden]{display:none!important}
    .collage-download,.collage-share{min-height:48px;min-width:220px;padding:11px 20px;border-radius:13px;font-weight:950;cursor:pointer}
    .collage-output-actions .collage-share{min-width:0;width:min(320px,100%)}
    .collage-download{border:1px solid #a55f70;background:#a55f70;color:#fff;box-shadow:0 8px 22px rgba(165,95,112,.22)}
    .collage-download:hover{background:#8f4f60;border-color:#8f4f60}
    .collage-share{border:1px solid #b9954f;background:#fff7ea;color:#8d5360;box-shadow:0 8px 22px rgba(185,149,79,.14)}
    .collage-share:hover{background:#fff0cf;border-color:#b9954f}
    .collage-download:disabled,.collage-share:disabled{opacity:.6;cursor:wait}
    .collage-selection-hint{width:min(590px,100%);margin:0;padding:13px 14px;border-radius:14px;background:rgba(185,149,79,.10);border:1px solid rgba(185,149,79,.28);color:#f3dfab;font-size:13px;line-height:1.4;font-weight:800;text-align:center}
    .card .description{text-align:justify!important;text-align-last:left!important;text-justify:inter-word!important;hyphens:auto!important;-webkit-hyphens:auto!important}
    .collage-tree{clear:both}
    .collage-branch{margin-top:20px;border-left:2px solid rgba(125,211,252,.28);padding-left:14px}
    .collage-branch .collage-branch{margin-left:26px;margin-top:18px;border-left-color:rgba(34,211,168,.28)}
    .collage-branch .collage-branch .collage-branch{border-left-color:rgba(246,196,83,.28)}
    .collage-subtitle{margin:0 0 12px;color:#eaf0f8;font-weight:900;letter-spacing:.005em;line-height:1.25}
    .collage-depth-1>.collage-subtitle{font-size:clamp(18px,2.1vw,24px)}
    .collage-depth-2>.collage-subtitle{font-size:clamp(16px,1.8vw,20px);color:#dce7f4}
    .collage-depth-3>.collage-subtitle{font-size:15px;color:#c8d4e4}
    .collage-depth-4>.collage-subtitle{font-size:14px;color:#bcc9da}
    .collage-depth-5>.collage-subtitle{font-size:13px;color:#b0bfd2}
    .collage-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;align-items:stretch}
    .collage-root-grid{margin-top:4px}
    .collage-item{min-width:0;background:#151e2e;border:1px solid #28354a;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.16);position:relative}
    .collage-item[data-ficha-selectable="true"]{cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
    .collage-item[data-ficha-selectable="true"]:hover{transform:translateY(-1px);border-color:#b9954f}
    .collage-item[data-ficha-selectable="true"]:focus-visible{outline:none;border-color:#b9954f;box-shadow:0 0 0 3px rgba(185,149,79,.28)}
    .collage-item.is-selected{border:3px solid #b9954f;box-shadow:0 0 0 3px rgba(185,149,79,.26),0 12px 30px rgba(0,0,0,.25)}
    .collage-item.is-selected::after{content:"✓ Seleccionado";position:absolute;top:9px;right:9px;z-index:2;padding:6px 9px;border-radius:999px;background:#b9954f;color:#fff;font-size:11px;line-height:1;font-weight:950;box-shadow:0 4px 14px rgba(0,0,0,.20)}
    .collage-item.is-selected .collage-caption{background:rgba(185,149,79,.13)}
    .collage-image{height:190px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:10px}
    .collage-image img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain}
    .collage-caption{padding:12px 12px 14px;text-align:center}
    .collage-name{margin:0;color:#f8fafc;font-size:14px;line-height:1.35;font-weight:850;display:block;white-space:normal;overflow:visible;overflow-wrap:anywhere;min-height:0}
    .collage-price{margin:7px 0 0;color:#dce6f5;font-size:15px;line-height:1.2;font-weight:950}
    .collage-empty{padding:38px 18px;text-align:center;color:#b7c2d3;border:1px dashed #344158;border-radius:18px;background:rgba(255,255,255,.025)}
    body.collage-open{overflow:hidden}
    @media(max-width:640px){
      .collage-modal{padding:8px}
      .collage-shell{width:min(96vw,96vh);aspect-ratio:1/1;max-width:96vw;max-height:96vh;border-radius:18px;padding:14px}
      .collage-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .collage-image{height:145px;padding:6px}
      .collage-caption{padding:9px 8px 11px}
      .collage-name{font-size:12.5px}
      .collage-price{font-size:14px}
      .collage-heading{padding-right:44px;padding-bottom:14px}
      .collage-selector-block{width:100%;max-width:320px}
      .collage-type-choices{grid-template-columns:repeat(2,minmax(0,1fr))}
      .collage-format-choices{grid-template-columns:1fr}
      .collage-type-option,.collage-format-option,.collage-download,.collage-share,.collage-social-btn{width:100%;max-width:320px}
      .collage-social-actions{grid-template-columns:1fr;max-width:320px}
      .collage-branch{padding-left:10px;margin-top:16px}
      .collage-branch .collage-branch{margin-left:14px;margin-top:14px}
      #collageBtn{padding-inline:12px}
    }
  `;
  if(!document.getElementById("collageFeatureStyles")) document.head.appendChild(style);

  if(!btn){
    btn=document.createElement("button");
    btn.className="btn-ghost";
    btn.id="collageBtn";
    btn.type="button";
    if(cartButton) cartButton.insertAdjacentElement("afterend",btn);
    else toolbar.appendChild(btn);
  }
  btn.textContent="Agregar todos";
  btn.setAttribute("aria-label","Agregar todos los productos de la vista actual al carrito");
  syncFolletoButtonVisibility();

  if(document.getElementById("collageModal")) return;

  const modal=document.createElement("div");
  modal.className="collage-modal";
  modal.id="collageModal";
  modal.setAttribute("aria-hidden","true");
  modal.setAttribute("aria-modal","true");
  modal.setAttribute("role","dialog");
  modal.innerHTML=`
    <div class="collage-backdrop" data-collage-close></div>
    <section class="collage-shell" role="document" aria-labelledby="collageRoute">
      <button class="collage-close" type="button" aria-label="Cerrar" data-collage-close>✕</button>
      <header class="collage-heading">
        <h2 class="collage-route" id="collageRoute"></h2>
      </header>
      <div class="collage-actions">
        <div class="collage-selector-block">
          <div class="collage-control-label">Tipo</div>
          <div class="collage-type-choices" role="group" aria-label="Tipo de imagen">
            <button class="collage-type-option is-active" id="collageTypeCollageBtn" type="button" data-collage-type="collage" aria-pressed="true">Collage</button>
            <button class="collage-type-option" id="collageFichaBtn" type="button" data-collage-type="ficha" aria-pressed="false" disabled>Ficha</button>
          </div>
        </div>
        <div class="collage-selector-block collage-size-control" id="collageSizeControl">
          <div class="collage-control-label">Tamaño</div>
          <div class="collage-format-choices" role="group" aria-label="Tamaño del collage">
            <button class="collage-format-option is-active" type="button" data-collage-format="instagram" aria-pressed="true">Instagram · 1080 × 1350</button>
            <button class="collage-format-option" type="button" data-collage-format="marketplace" aria-pressed="false">Marketplace · 1200 × 1200</button>
          </div>
        </div>
        <p class="collage-selection-hint" id="collageSelectionHint" hidden></p>
        <div class="collage-output-actions" id="collageGenericActions">
          <button class="collage-share" id="collageShareBtn" type="button" disabled>Preparando imagen…</button>
        </div>
      </div>
      <div class="collage-tree" id="collageTree" role="listbox" aria-label="Productos del collage; selecciona uno para crear su ficha"></div>
    </section>
  `;
  document.body.appendChild(modal);

  const routeEl=modal.querySelector("#collageRoute");
  const collageTree=modal.querySelector("#collageTree");
  const closeBtn=modal.querySelector(".collage-close");
  const collageTypeBtn=modal.querySelector("#collageTypeCollageBtn");
  const fichaBtn=modal.querySelector("#collageFichaBtn");
  const sizeControl=modal.querySelector("#collageSizeControl");
  const selectionHint=modal.querySelector("#collageSelectionHint");
  const downloadBtn=null;
  const shareBtn=modal.querySelector("#collageShareBtn");
  const genericActions=modal.querySelector("#collageGenericActions");
  const formatButtons=[...modal.querySelectorAll("[data-collage-format]")];
  let collageSelectedProduct=null;
  let collageExportMode="collage";
  const collagePreparedShareFiles=new Map();
  const collagePreparingShareKeys=new Set();
  let collagePrepareSequence=0;
  let fichaPreparedFile=null;
  let fichaPreparedKey="";
  let fichaPrepareSequence=0;

  const COLLAGE_EXPORT_FORMATS={
    instagram:{
      key:"instagram",
      label:"Instagram",
      pageW:1080,
      pageH:1350,
      margin:48,
      accentText:"Selección del catálogo",
      downloadName:"collage-instagram-1080x1350.png"
    },
    marketplace:{
      key:"marketplace",
      label:"Marketplace",
      pageW:1200,
      pageH:1200,
      margin:52,
      accentText:"Ideal para Facebook Marketplace",
      downloadName:"collage-marketplace-1200x1200.png"
    }
  };

  function getCollageExportFormat(){
    const active=formatButtons.find(button=>button.classList.contains("is-active"));
    const selected=String(active?.dataset?.collageFormat||"instagram").trim().toLowerCase();
    return COLLAGE_EXPORT_FORMATS[selected]||COLLAGE_EXPORT_FORMATS.instagram;
  }

  function collageFormatButtonLabel(format){
    return `${format.label} · ${format.pageW} × ${format.pageH}`;
  }

  function collageShareCacheKey(snapshot,format){
    const productKey=(snapshot?.products||[])
      .map(product=>String(product?.id||product?.code||product?.name||""))
      .join("|");
    return `${format?.key||"instagram"}::${String(snapshot?.title||"")}::${productKey}`;
  }

  function canClipboardPng(){
    return !!(navigator?.clipboard && typeof navigator.clipboard.write==="function" && typeof window.ClipboardItem==="function");
  }

  function copyPreparedPngFile(file){
    if(!file || file.type!=="image/png") throw new Error("No hay una imagen PNG lista para copiar.");
    if(!canClipboardPng()) throw new Error("Este navegador no permite copiar imágenes PNG al portapapeles.");
    return navigator.clipboard.write([new ClipboardItem({"image/png":file})]);
  }

  function downloadPreparedPngFile(file,fileName){
    if(!file) throw new Error("No hay una imagen PNG lista para descargar.");
    const url=URL.createObjectURL(file);
    const a=document.createElement("a");
    a.href=url;
    a.download=fileName||file.name||"imagen.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function setActionPreparing(){
    if(collageExportMode==="collage"){
      const snapshot=collageCurrentSnapshot();
      for(const button of formatButtons){
        const format=COLLAGE_EXPORT_FORMATS[button.dataset.collageFormat]||COLLAGE_EXPORT_FORMATS.instagram;
        const key=collageShareCacheKey(snapshot,format);
        const ready=!!collagePreparedShareFiles.get(key);
        button.disabled=!ready;
        button.textContent=ready?collageFormatButtonLabel(format):`${format.label} · preparando…`;
        button.title=ready
          ? (canClipboardPng()?`${format.label}: copiar imagen al portapapeles y descargar PNG`:`${format.label}: descargar PNG; el navegador podría impedir copiar al portapapeles`)
          : "Preparando imagen…";
      }
    }else if(shareBtn){
      shareBtn.disabled=true;
      shareBtn.textContent="Preparando imagen…";
      shareBtn.title="";
    }
    if(downloadBtn){
      downloadBtn.disabled=true;
      downloadBtn.textContent="Preparando PNG…";
    }
  }

  function setActionReady(){
    if(collageExportMode==="collage"){
      const snapshot=collageCurrentSnapshot();
      for(const button of formatButtons){
        const format=COLLAGE_EXPORT_FORMATS[button.dataset.collageFormat]||COLLAGE_EXPORT_FORMATS.instagram;
        const key=collageShareCacheKey(snapshot,format);
        const ready=!!collagePreparedShareFiles.get(key);
        const preparing=collagePreparingShareKeys.has(key);
        button.disabled=!ready;
        button.textContent=ready?collageFormatButtonLabel(format):`${format.label} · ${preparing?"preparando…":"no disponible"}`;
        button.title=ready
          ? (canClipboardPng()?`${format.label}: copiar imagen al portapapeles y descargar PNG`:`${format.label}: descargar PNG; el navegador podría impedir copiar al portapapeles`)
          : (preparing?"Preparando imagen…":"No se pudo preparar la imagen.");
      }
    }else if(shareBtn){
      const ready=!!fichaPreparedFile;
      shareBtn.disabled=!ready;
      shareBtn.textContent="Copiar y descargar";
      shareBtn.title=canClipboardPng()?"":"Tu navegador podría no permitir copiar imágenes al portapapeles.";
    }
    if(downloadBtn){
      downloadBtn.disabled=false;
      downloadBtn.textContent="Descargar PNG";
    }
  }

  function invalidateCollageSharePreparation(){
    collagePreparedShareFiles.clear();
    collagePreparingShareKeys.clear();
    collagePrepareSequence++;
    if(collageExportMode==="collage") setActionPreparing();
  }

  function queueCollageSharePreparation(formatKey=null){
    const snapshot=collageCurrentSnapshot();
    if(!snapshot.products.length){
      collagePreparedShareFiles.clear();
      collagePreparingShareKeys.clear();
      if(collageExportMode==="collage") setActionReady();
      return;
    }

    const formats=formatKey
      ? [COLLAGE_EXPORT_FORMATS[formatKey]||COLLAGE_EXPORT_FORMATS.instagram]
      : Object.values(COLLAGE_EXPORT_FORMATS);
    const token=collagePrepareSequence;

    for(const format of formats){
      const key=collageShareCacheKey(snapshot,format);
      if(collagePreparedShareFiles.has(key) || collagePreparingShareKeys.has(key)) continue;
      collagePreparingShareKeys.add(key);
      if(collageExportMode==="collage") setActionPreparing();
      window.setTimeout(()=>{
        downloadCollageImage("prepare",{token,key,formatKey:format.key}).catch(error=>{
          console.info(`No se pudo preparar el PNG del collage para ${format.label}.`,error);
        });
      },0);
    }
  }

  function fichaPreparationKey(product){
    return String(product?.id||product?.code||product?.name||"").trim();
  }

  function invalidateFichaPreparation(){
    fichaPreparedFile=null;
    fichaPreparedKey="";
    fichaPrepareSequence++;
    if(collageExportMode==="ficha") setActionPreparing();
  }

  function queueFichaPreparation(){
    const product=collageSelectedProduct;
    const key=fichaPreparationKey(product);
    const token=++fichaPrepareSequence;
    fichaPreparedFile=null;
    fichaPreparedKey="";
    if(collageExportMode==="ficha") setActionPreparing();

    if(!product || !key){
      if(collageExportMode==="ficha"){
        if(shareBtn){
          shareBtn.disabled=true;
          shareBtn.textContent="Copiar y descargar";
        }
        if(downloadBtn){
          downloadBtn.disabled=true;
          downloadBtn.textContent="Descargar PNG";
        }
      }
      return;
    }

    window.setTimeout(async()=>{
      try{
        const {canvas,fileName}=await buildMarketplacePresentationCanvas(product);
        const prepared=await prepareCanvasPngFile(canvas,fileName);
        const file=prepared.file || (window.File ? new File([prepared.blob],fileName||"ficha.png",{type:"image/png"}) : null);
        const stillCurrent=token===fichaPrepareSequence && key===fichaPreparationKey(collageSelectedProduct);
        if(!stillCurrent) return;
        fichaPreparedFile=file;
        fichaPreparedKey=key;
        if(collageExportMode==="ficha") setActionReady();
      }catch(error){
        const stillCurrent=token===fichaPrepareSequence;
        if(stillCurrent){
          fichaPreparedFile=null;
          fichaPreparedKey="";
          if(collageExportMode==="ficha"){
            if(shareBtn){
              shareBtn.disabled=true;
              shareBtn.textContent="Copiar y descargar";
            }
            if(downloadBtn){
              downloadBtn.disabled=true;
              downloadBtn.textContent="Descargar PNG";
            }
          }
        }
        console.error("No se pudo preparar la ficha del producto.",error);
      }
    },0);
  }

  function setCollageExportFormat(key){
    const selected=COLLAGE_EXPORT_FORMATS[key]?key:"instagram";
    for(const button of formatButtons){
      const active=button.dataset.collageFormat===selected;
      button.classList.toggle("is-active",active);
      button.setAttribute("aria-pressed",active?"true":"false");
    }
  }

  function setCollageExportMode(mode){
    collageExportMode=mode==="ficha"?"ficha":"collage";
    const isFicha=collageExportMode==="ficha";
    if(genericActions) genericActions.hidden=!isFicha;
    modal.classList.toggle("is-ficha-mode",isFicha);
    collageTypeBtn?.classList.toggle("is-active",!isFicha);
    collageTypeBtn?.setAttribute("aria-pressed",isFicha?"false":"true");
    fichaBtn?.classList.toggle("is-active",isFicha);
    fichaBtn?.setAttribute("aria-pressed",isFicha?"true":"false");
    if(sizeControl) sizeControl.hidden=isFicha;
    if(selectionHint) selectionHint.hidden=!isFicha;

    if(isFicha){
      if(fichaPreparedFile && fichaPreparedKey===fichaPreparationKey(collageSelectedProduct)) setActionReady();
      else queueFichaPreparation();
    }else{
      queueCollageSharePreparation();
      setActionReady();
    }
  }

  function setCollageSelectedProduct(product,item){
    collageSelectedProduct=product||null;
    for(const card of collageTree.querySelectorAll('.collage-item.is-selected')){
      card.classList.remove('is-selected');
      card.setAttribute('aria-selected','false');
    }
    if(collageSelectedProduct && item){
      item.classList.add('is-selected');
      item.setAttribute('aria-selected','true');
    }
    if(fichaBtn) fichaBtn.disabled=!collageSelectedProduct;
    if(selectionHint){
      selectionHint.textContent=collageSelectedProduct
        ? `Producto para Ficha: ${String(collageSelectedProduct.name||'Producto').trim()}`
        : 'No hay un producto disponible para preparar Ficha.';
    }
    invalidateFichaPreparation();
    if(collageExportMode==="ficha" && modal.classList.contains("open")) queueFichaPreparation();
  }

  function closeCollage(){
    if(!modal.classList.contains("open")) return;
    if(modal.classList.contains("admin-embedded")){
      if(typeof window.setCatalogAdminSection==="function") window.setCatalogAdminSection("catalogo");
      return;
    }
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden","true");
    document.body.classList.remove("collage-open");
    btn.focus({preventScroll:true});
  }

  function makeCollageGrid(products,isRoot=false){
    const gridEl=document.createElement("div");
    gridEl.className="collage-grid"+(isRoot?" collage-root-grid":"");
    const frag=document.createDocumentFragment();

    for(const p of products){
      const item=document.createElement("article");
      item.className="collage-item";
      item._collageProduct=p;
      const fichaSelectable=!(p && p.isGiftGalleryImage);
      item.dataset.fichaSelectable=fichaSelectable?"true":"false";
      if(fichaSelectable){
        item.tabIndex=0;
        item.setAttribute("role","option");
        item.setAttribute("aria-selected","false");
        item.setAttribute("aria-label",`Seleccionar ${String(p?.name||"producto").trim()||"producto"} para crear ficha`);
        const selectThis=()=>setCollageSelectedProduct(p,item);
        item.addEventListener("click",selectThis);
        item.addEventListener("keydown",event=>{
          if(event.key==="Enter"||event.key===" "){
            event.preventDefault();
            selectThis();
          }
        });
      }

      const imageBox=document.createElement("div");
      imageBox.className="collage-image";
      imageBox.appendChild(makeImgFromFilename(p.imgFilename,p.name,p.docsImageUrl));

      const caption=document.createElement("div");
      caption.className="collage-caption";

      const name=document.createElement("p");
      name.className="collage-name";
      name.textContent=String(p.name||"").trim()||"Producto";
      name.title=name.textContent;
      caption.appendChild(name);

      const priceText=collagePriceText(p);
      if(priceText){
        const price=document.createElement("p");
        price.className="collage-price";
        price.textContent=priceText;
        caption.appendChild(price);
      }

      item.append(imageBox,caption);
      frag.appendChild(item);
    }

    gridEl.appendChild(frag);
    return gridEl;
  }

  function appendTreeChildren(parentEl,node,depth){
    for(const child of node.children.values()){
      const branch=document.createElement("section");
      const absoluteDepth=Number(child.depth)||depth;
      const safeDepth=Math.min(Math.max(absoluteDepth,1),5);
      branch.className=`collage-branch collage-depth-${safeDepth}`;

      const heading=document.createElement(absoluteDepth===1?"h3":"h4");
      heading.className="collage-subtitle";
      heading.textContent=child.label;
      branch.appendChild(heading);

      if(child.products.length){
        branch.appendChild(makeCollageGrid(child.products));
      }

      appendTreeChildren(branch,child,absoluteDepth+1);
      parentEl.appendChild(branch);
    }
  }

  function collageExportBlocks(tree){
    const blocks=[];
    if(tree.products.length) blocks.push({type:"grid",depth:0,products:tree.products});

    function walk(node,depth){
      for(const child of node.children.values()){
        const absoluteDepth=Number(child.depth)||depth;
        blocks.push({type:"heading",depth:absoluteDepth,label:child.label});
        if(child.products.length) blocks.push({type:"grid",depth:absoluteDepth,products:child.products});
        walk(child,absoluteDepth+1);
      }
    }

    walk(tree,1);
    return blocks;
  }

  function collageCanvasRoundRect(ctx,x,y,w,h,r){
    const rr=Math.max(0,Math.min(r,Math.min(w,h)/2));
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }

  function collageCanvasWrapLines(ctx,text,maxWidth){
    const words=String(text||"").trim().split(/\s+/).filter(Boolean);
    if(!words.length) return ["Producto"];
    const lines=[];
    let line="";
    for(const word of words){
      const test=line?`${line} ${word}`:word;
      if(line&&ctx.measureText(test).width>maxWidth){
        lines.push(line);
        line=word;
      }else{
        line=test;
      }
    }
    if(line) lines.push(line);
    return lines;
  }

  function collageExportImageUrl(p){
    const preferred=String(p?.docsImageUrl||"").trim();
    if(shouldShowProductImages()&&preferred) return preferred;
    return productPlaceholderAbsoluteUrl();
  }

  function collageLoadCanvasImage(p){
    const candidates=[
      collageExportImageUrl(p),
      productPlaceholderAbsoluteUrl(),
      COMPANY_LOGO
    ].map(v=>String(v||"").trim()).filter(Boolean);

    return new Promise(resolve=>{
      let index=0;
      const tryNext=()=>{
        if(index>=candidates.length){ resolve(null); return; }
        const img=new Image();
        const url=candidates[index++];
        let settled=false;
        let timer=0;
        const finish=(value)=>{
          if(settled) return;
          settled=true;
          window.clearTimeout(timer);
          img.onload=null;
          img.onerror=null;
          if(value) resolve(value);
          else tryNext();
        };
        try{
          const parsed=new URL(url,location.href);
          if(parsed.origin!==location.origin) img.crossOrigin="anonymous";
        }catch(_){}
        timer=window.setTimeout(()=>finish(null),7000);
        img.onload=()=>finish(img);
        img.onerror=()=>finish(null);
        img.src=url;
      };
      tryNext();
    });
  }

  function marketplacePresentationSanitizeFilename(value){
    const base=String(value||"")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .toLowerCase();
    return base.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"") || "producto";
  }

  function marketplacePresentationTrimLine(ctx,text,maxWidth){
    let value=String(text||"").trim();
    if(!value) return "";
    if(ctx.measureText(value).width<=maxWidth) return value;
    while(value && ctx.measureText(`${value}…`).width>maxWidth){
      value=value.slice(0,-1).trimEnd();
    }
    return `${value}…`;
  }

  function marketplacePresentationWrapLines(ctx,text,maxWidth,maxLines=999){
    const words=String(text||"").trim().split(/\s+/).filter(Boolean);
    if(!words.length) return [];
    const lines=[];
    let line="";
    for(const word of words){
      const test=line?`${line} ${word}`:word;
      if(line && ctx.measureText(test).width>maxWidth){
        lines.push(line);
        line=word;
      }else{
        line=test;
      }
    }
    if(line) lines.push(line);
    if(lines.length<=maxLines) return lines;
    const clipped=lines.slice(0,maxLines);
    clipped[maxLines-1]=marketplacePresentationTrimLine(ctx,clipped[maxLines-1],maxWidth);
    return clipped;
  }

  function marketplacePresentationDrawJustified(ctx,lines,x,y,maxWidth,lineHeight){
    let currentY=y;
    for(let i=0;i<lines.length;i++){
      const line=String(lines[i]||"").trim();
      const words=line.split(/\s+/).filter(Boolean);
      const isLast=i===lines.length-1;
      if(!line){
        currentY+=lineHeight;
        continue;
      }
      if(isLast || words.length<3){
        ctx.fillText(line,x,currentY);
        currentY+=lineHeight;
        continue;
      }
      const widths=words.map(word=>ctx.measureText(word).width);
      const wordsWidth=widths.reduce((sum,width)=>sum+width,0);
      const gap=(maxWidth-wordsWidth)/(words.length-1);
      let currentX=x;
      for(let j=0;j<words.length;j++){
        ctx.fillText(words[j],currentX,currentY);
        currentX+=widths[j]+(j<words.length-1?gap:0);
      }
      currentY+=lineHeight;
    }
    return currentY;
  }

  function marketplacePresentationDrawContainedImage(ctx,img,x,y,w,h,padding=0){
    if(!img || !img.naturalWidth || !img.naturalHeight) return;
    const aw=Math.max(1,w-padding*2);
    const ah=Math.max(1,h-padding*2);
    const scale=Math.min(aw/img.naturalWidth,ah/img.naturalHeight);
    const dw=img.naturalWidth*scale;
    const dh=img.naturalHeight*scale;
    ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
  }

  function marketplacePresentationCanvasSafeImage(img,label="imagen"){
    if(!img || !img.naturalWidth || !img.naturalHeight) return null;
    try{
      const probe=document.createElement("canvas");
      probe.width=2;
      probe.height=2;
      const pctx=probe.getContext("2d");
      pctx.drawImage(img,0,0,2,2);
      // Esta lectura falla inmediatamente si la imagen contaminaría el canvas.
      pctx.getImageData(0,0,1,1);
      return img;
    }catch(error){
      console.warn(`La ${label} no es segura para exportar en canvas; se omite en la ficha.`,error);
      return null;
    }
  }

  function canvasToPngBlob(canvas){
    if(!canvas) return Promise.reject(new Error("No hay contenido listo para exportar."));
    return new Promise((resolve,reject)=>{
      try{
        canvas.toBlob(value=>value?resolve(value):reject(new Error("No se pudo crear el archivo PNG.")),"image/png",1);
      }catch(error){ reject(error); }
    });
  }

  async function prepareCanvasPngFile(canvas,fileName){
    const blob=await canvasToPngBlob(canvas);
    const file=window.File ? new File([blob],fileName||"imagen.png",{type:"image/png"}) : null;
    return {blob,file};
  }

  function presentationDrawBotanicalAccent(ctx,x,y,scale=1,direction=1,color="rgba(194,143,129,.20)"){
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(direction*scale,scale);
    ctx.strokeStyle=color;
    ctx.fillStyle=color;
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(0,150);
    ctx.bezierCurveTo(14,105,34,57,72,0);
    ctx.stroke();
    const leaves=[
      {x:13,y:117,rx:25,ry:9,r:-.72},
      {x:26,y:91,rx:27,ry:10,r:.54},
      {x:38,y:65,rx:25,ry:9,r:-.66},
      {x:53,y:38,rx:23,ry:8,r:.56},
      {x:67,y:14,rx:19,ry:7,r:-.55}
    ];
    for(const leaf of leaves){
      ctx.beginPath();
      ctx.ellipse(leaf.x,leaf.y,leaf.rx,leaf.ry,leaf.r,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  function presentationDrawHeart(ctx,cx,cy,size,color){
    ctx.save();
    ctx.translate(cx,cy);
    ctx.scale(size/24,size/24);
    ctx.beginPath();
    ctx.moveTo(0,7);
    ctx.bezierCurveTo(-18,-5,-14,-18,-5,-18);
    ctx.bezierCurveTo(0,-18,3,-14,0,-9);
    ctx.bezierCurveTo(3,-14,6,-18,11,-18);
    ctx.bezierCurveTo(20,-18,22,-5,0,7);
    ctx.closePath();
    ctx.fillStyle=color;
    ctx.fill();
    ctx.restore();
  }

  async function buildMarketplacePresentationCanvas(p){
    const [loadedProductImage,loadedLogoImage]=await Promise.all([
      collageLoadCanvasImage(p),
      collageLoadCanvasImage({ docsImageUrl:COMPANY_LOGO })
    ]);
    const productImage=marketplacePresentationCanvasSafeImage(loadedProductImage,'imagen del producto');
    const logoImage=marketplacePresentationCanvasSafeImage(loadedLogoImage,'logo');

    const canvas=document.createElement('canvas');
    canvas.width=1200;
    canvas.height=1200;
    const ctx=canvas.getContext('2d');
    const W=canvas.width;
    const H=canvas.height;

    const dark='#2f282a';
    const mauveDark='#8f3f59';
    const muted='#6f6365';
    const gold='#b9954f';
    const border='#ead8d3';
    const roseSoft='#f9e7e8';

    const bg=ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,'#fffdf9');
    bg.addColorStop(.5,'#fffaf7');
    bg.addColorStop(1,'#f8eeeb');
    ctx.fillStyle=bg;
    ctx.fillRect(0,0,W,H);
    ctx.textBaseline='top';

    ctx.fillStyle='rgba(243,205,207,.28)';
    ctx.beginPath();
    ctx.moveTo(W-280,0);
    ctx.bezierCurveTo(W-185,95,W-112,73,W,204);
    ctx.lineTo(W,0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle='rgba(244,215,207,.24)';
    ctx.beginPath();
    ctx.moveTo(0,H-210);
    ctx.bezierCurveTo(135,H-120,165,H-60,330,H);
    ctx.lineTo(0,H);
    ctx.closePath();
    ctx.fill();
    presentationDrawBotanicalAccent(ctx,14,52,.78,1,'rgba(194,143,129,.14)');
    presentationDrawBotanicalAccent(ctx,W-14,H-160,.76,-1,'rgba(194,143,129,.14)');

    const drawPanel=(x,y,w,h,r=22)=>{
      ctx.save();
      ctx.shadowColor='rgba(113,73,80,.12)';
      ctx.shadowBlur=18;
      ctx.shadowOffsetY=7;
      collageCanvasRoundRect(ctx,x,y,w,h,r);
      ctx.fillStyle='rgba(255,255,255,.94)';
      ctx.fill();
      ctx.restore();
      collageCanvasRoundRect(ctx,x,y,w,h,r);
      ctx.strokeStyle=border;
      ctx.lineWidth=1.4;
      ctx.stroke();
    };

    const header={x:32,y:42,w:W-64,h:164};
    drawPanel(header.x,header.y,header.w,header.h,22);
    marketplacePresentationDrawContainedImage(ctx,logoImage,60,63,112,112,2);
    ctx.fillStyle=mauveDark;
    ctx.font='900 40px Calibri, "Segoe UI", Arial, sans-serif';
    ctx.fillText('IRENISMB STOCK NATURA',208,80);
    ctx.fillStyle=muted;
    ctx.font='500 25px Calibri, "Segoe UI", Arial, sans-serif';
    ctx.fillText('Natura & AVON · Santa Marta · Envíos a toda Colombia',208,129);
    ctx.fillStyle=gold;
    collageCanvasRoundRect(ctx,60,184,W-120,4,2);
    ctx.fill();

    const imageCard={x:32,y:228,w:493,h:520};
    const detailCard={x:540,y:228,w:628,h:520};
    drawPanel(imageCard.x,imageCard.y,imageCard.w,imageCard.h,22);
    drawPanel(detailCard.x,detailCard.y,detailCard.w,detailCard.h,22);

    ctx.save();
    collageCanvasRoundRect(ctx,imageCard.x+22,imageCard.y+22,imageCard.w-44,imageCard.h-44,15);
    ctx.clip();
    const imageBg=ctx.createLinearGradient(imageCard.x,imageCard.y,imageCard.x+imageCard.w,imageCard.y+imageCard.h);
    imageBg.addColorStop(0,'#f2e5d5');
    imageBg.addColorStop(.52,'#fffaf2');
    imageBg.addColorStop(1,'#ead7c5');
    ctx.fillStyle=imageBg;
    ctx.fillRect(imageCard.x+22,imageCard.y+22,imageCard.w-44,imageCard.h-44);
    presentationDrawBotanicalAccent(ctx,imageCard.x+34,imageCard.y+300,.92,1,'rgba(191,151,115,.14)');
    marketplacePresentationDrawContainedImage(ctx,productImage,imageCard.x+22,imageCard.y+22,imageCard.w-44,imageCard.h-44,26);
    ctx.restore();

    const textX=detailCard.x+28;
    const textW=detailCard.w-56;
    let y=detailCard.y+32;
    collageCanvasRoundRect(ctx,textX,y,318,48,12);
    ctx.fillStyle=roseSoft;
    ctx.fill();
    ctx.fillStyle=mauveDark;
    ctx.font='900 21px Calibri, "Segoe UI", Arial, sans-serif';
    ctx.fillText('PRESENTACIÓN DE PRODUCTO',textX+20,y+11);
    y+=78;

    let titleSize=42;
    let titleLines=[];
    do{
      ctx.font=`900 ${titleSize}px Calibri, "Segoe UI", Arial, sans-serif`;
      titleLines=marketplacePresentationWrapLines(ctx,String(p.name||'Producto').toUpperCase(),textW,5);
      if(titleLines.length<=4) break;
      titleSize-=2;
    }while(titleSize>=32);
    ctx.fillStyle=dark;
    ctx.font=`900 ${titleSize}px Calibri, "Segoe UI", Arial, sans-serif`;
    const titleLineHeight=Math.round(titleSize*1.08);
    for(const line of titleLines.slice(0,4)){
      ctx.fillText(line,textX,y);
      y+=titleLineHeight;
    }

    y+=14;
    const metaParts=[];
    if(p.id) metaParts.push(`Código ${p.id}`);
    if(p.category) metaParts.push(String(p.category).trim());
    if(p.subcategory) metaParts.push(String(p.subcategory).trim());
    if(p.line) metaParts.push(String(p.line).trim());
    ctx.fillStyle=muted;
    ctx.font='500 21px Calibri, "Segoe UI", Arial, sans-serif';
    const metaLines=marketplacePresentationWrapLines(ctx,metaParts.filter(Boolean).join(' · '),textW,3);
    for(const line of metaLines){
      ctx.fillText(line,textX,y);
      y+=28;
    }

    if(shouldShowProductPrices()){
      const priceText=p.hasPrice===false || !(Number(p.price)>0) ? 'Consultar precio' : fmtCOP.format(p.price);
      const priceY=Math.min(detailCard.y+detailCard.h-82,y+24);
      collageCanvasRoundRect(ctx,textX,priceY,270,54,14);
      ctx.fillStyle=roseSoft;
      ctx.fill();
      ctx.fillStyle=mauveDark;
      ctx.font='900 27px Calibri, "Segoe UI", Arial, sans-serif';
      ctx.fillText(priceText,textX+20,priceY+11);
    }

    const desc={x:32,y:770,w:W-64,h:324};
    drawPanel(desc.x,desc.y,desc.w,desc.h,22);
    collageCanvasRoundRect(ctx,desc.x+28,desc.y+22,180,48,12);
    ctx.fillStyle=roseSoft;
    ctx.fill();
    ctx.fillStyle=mauveDark;
    ctx.font='900 22px Calibri, "Segoe UI", Arial, sans-serif';
    ctx.fillText('DESCRIPCIÓN',desc.x+47,desc.y+33);

    const description=String(p.description||'').trim()||'Descripción no disponible.';
    const descTextX=desc.x+30;
    const descTextY=desc.y+90;
    const descTextW=desc.w-60;
    const maxLines=7;
    let descSize=23;
    let descLines=[];
    do{
      ctx.font=`500 ${descSize}px Calibri, "Segoe UI", Arial, sans-serif`;
      descLines=marketplacePresentationWrapLines(ctx,description,descTextW,999);
      if(descLines.length<=maxLines) break;
      descSize-=1;
    }while(descSize>=17);
    if(descLines.length>maxLines){
      descLines=descLines.slice(0,maxLines);
      descLines[maxLines-1]=marketplacePresentationTrimLine(ctx,descLines[maxLines-1],descTextW);
    }
    ctx.fillStyle=dark;
    ctx.font=`500 ${descSize}px Calibri, "Segoe UI", Arial, sans-serif`;
    marketplacePresentationDrawJustified(ctx,descLines,descTextX,descTextY,descTextW,Math.round(descSize*1.43));

    const footerLineY=1125;
    ctx.strokeStyle=gold;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(34,footerLineY);
    ctx.lineTo(W-34,footerLineY);
    ctx.stroke();
    ctx.textAlign='center';
    ctx.fillStyle=mauveDark;
    ctx.font='900 20px Calibri, "Segoe UI", Arial, sans-serif';
    ctx.fillText('IRENISMB STOCK NATURA',W/2,1142);
    ctx.fillStyle=muted;
    ctx.font='500 17px Calibri, "Segoe UI", Arial, sans-serif';
    ctx.fillText('Santa Marta · WhatsApp +57 304 208 8961',W/2,1170);
    ctx.textAlign='left';

    const code=String(p.id||'').trim();
    const safeName=marketplacePresentationSanitizeFilename(String(p.name||'')).slice(0,72);
    const fileName=`${code?`${code}_`:''}${safeName}_ficha.png`;
    return {canvas,fileName};
  }

  async function downloadCollageImage(action="download",options={}){
    const snapshot=collageCurrentSnapshot();
    if(!snapshot.products.length){
      if(action!=="prepare") alert("No hay productos para descargar con los filtros actuales.");
      return;
    }

    const format=COLLAGE_EXPORT_FORMATS[String(options.formatKey||"").trim().toLowerCase()]||getCollageExportFormat();
    const shareKey=collageShareCacheKey(snapshot,format);
    const isCopyAction=action==="copy";
    const isPrepareAction=action==="prepare";

    if(isCopyAction){
      const preparedFile=collagePreparedShareFiles.get(shareKey)||null;
      if(!preparedFile){
        queueCollageSharePreparation(format.key);
        return;
      }
      if(shareBtn){
        shareBtn.disabled=true;
        shareBtn.textContent="Copiando…";
      }
      try{
        await copyPreparedPngFile(preparedFile);
        if(shareBtn) shareBtn.textContent="Copiada";
        window.setTimeout(()=>{
          if(shareBtn && collageExportMode==="collage"){
            shareBtn.disabled=false;
            shareBtn.textContent="Copiar imagen";
          }
        },900);
      }catch(copyError){
        console.error(`No se pudo copiar el PNG del collage para ${format.label}.`,copyError);
        alert("Este navegador no permite copiar esta imagen al portapapeles. Puedes usar Descargar PNG.");
        if(shareBtn){
          shareBtn.disabled=false;
          shareBtn.textContent="Copiar imagen";
        }
      }
      return;
    }

    const targetBtn=downloadBtn;
    const originalText=targetBtn?.textContent||"Descargar PNG";
    if(isPrepareAction){
      if(shareBtn){
        shareBtn.disabled=true;
        shareBtn.textContent="Preparando PNG…";
      }
    }else{
      if(downloadBtn) downloadBtn.disabled=true;
      if(shareBtn) shareBtn.disabled=true;
      if(targetBtn) targetBtn.textContent="Generando PNG…";
      for(const button of formatButtons) button.disabled=true;
    }

    try{
      const PAGE_W=format.pageW;
      const PAGE_H=format.pageH;
      const MARGIN=format.margin;
      const RENDER_SCALE=2;
      const cardMargin=format.key==="marketplace" ? 22 : MARGIN;
      const CONTENT_W=PAGE_W-(cardMargin*2);
      const total=snapshot.products.length;
      const isMarketplace=format.key==="marketplace";
      const columns=isMarketplace ? Math.min(3,total) : (total<=4 ? 2 : total<=9 ? 3 : total<=16 ? 4 : total<=25 ? 5 : total<=36 ? 6 : 7);
      const gap=isMarketplace?10:14;
      const headingGap=isMarketplace?18:16;
      const parentTitleFontSize=isMarketplace?31:34;
      const focusTitleFontSize=isMarketplace?37:42;
      const parentTitleLineHeight=Math.round(parentTitleFontSize*1.14);
      const focusTitleLineHeight=Math.round(focusTitleFontSize*1.12);
      const blocks=isMarketplace ? [{type:"grid",depth:0,products:snapshot.products}] : collageExportBlocks(snapshot.tree);
      const imageMap=new Map();
      const imageBounds=new WeakMap();
      function visibleImageBounds(image){
        if(imageBounds.has(image)) return imageBounds.get(image);
        const full={x:0,y:0,w:image.naturalWidth,h:image.naturalHeight};
        try{
          const scan=document.createElement("canvas");
          const ratio=Math.min(1,500/Math.max(full.w,full.h));
          scan.width=Math.max(1,Math.round(full.w*ratio));scan.height=Math.max(1,Math.round(full.h*ratio));
          const context=scan.getContext("2d",{willReadFrequently:true});context.drawImage(image,0,0,scan.width,scan.height);
          const pixels=context.getImageData(0,0,scan.width,scan.height).data;
          let left=scan.width,top=scan.height,right=-1,bottom=-1;
          for(let y=0;y<scan.height;y++)for(let x=0;x<scan.width;x++){
            const i=(y*scan.width+x)*4;
            if(pixels[i+3]>12 && (pixels[i]<247 || pixels[i+1]<247 || pixels[i+2]<247)){
              left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
            }
          }
          if(right>=left && bottom>=top){
            const x=Math.max(0,(left-3)/ratio),y=Math.max(0,(top-3)/ratio);
            const box={x,y,w:Math.min(full.w-x,(right-left+7)/ratio),h:Math.min(full.h-y,(bottom-top+7)/ratio)};
            imageBounds.set(image,box);return box;
          }
        }catch(_){ }
        imageBounds.set(image,full);return full;
      }
      const routeParts=Array.isArray(snapshot.titleParts)?snapshot.titleParts.filter(Boolean):[];
      const focusTitle=String(routeParts.at(-1)||snapshot.title||"Catálogo");
      const parentTitle=routeParts.length>1?routeParts.slice(0,-1).join(" › "):"";

      await Promise.all(snapshot.products.map(async p=>{
        imageMap.set(p,await collageLoadCanvasImage(p));
      }));

      const probe=document.createElement("canvas");
      probe.width=PAGE_W;
      probe.height=PAGE_H;
      const pctx=probe.getContext("2d");
      const cardLayouts=new Map();

      function headingMetrics(depth){
        const size=depth===1?(isMarketplace?23:24):depth===2?(isMarketplace?19:20):(isMarketplace?16:17);
        return {
          size,
          lineHeight:Math.round(size*1.22),
          before:depth===1?18:12,
          after:10
        };
      }

      function trimWrappedLines(ctx,lines,maxWidth,maxLines=3){
        if(lines.length<=maxLines) return lines;
        const out=lines.slice(0,maxLines);
        let last=out[maxLines-1].replace(/[.…]+$/,""
        ).trim();
        while(last && ctx.measureText(last+"…").width>maxWidth){
          last=last.slice(0,-1).trimEnd();
        }
        out[maxLines-1]=(last||"Producto")+"…";
        return out;
      }

      function gridLayout(block){
        const indent=Math.min(block.depth,3)*18;
        const available=CONTENT_W-indent;
        const cols=Math.min(columns,Math.max(1,block.products.length));
        const cardW=Math.floor((available-gap*(cols-1))/cols);

        const rowsCount=Math.ceil(block.products.length/cols);
        const nameSize=isMarketplace ? 18 : (columns<=2?25:columns===3?20:columns===4?16:columns===5?14:columns===6?12:11);
        const nameLine=Math.round(nameSize*1.16);
        const priceSize=Math.max(12,nameSize+2);
        const captionPad=isMarketplace?6:10;
        const reservedCaption=3*nameLine+priceSize+24+captionPad*2;
        const imageH=isMarketplace
          ? Math.max(60,Math.min(cardW*.85,Math.floor((PAGE_H-235-gap*(rowsCount-1))/rowsCount)-reservedCaption))
          : Math.round(Math.min(250,Math.max(190,cardW*.88)));

        pctx.font=`800 ${nameSize}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
        const items=block.products.map(product=>{
          const maxTextW=Math.max(64,cardW-(captionPad*2));
          let lines=collageCanvasWrapLines(
            pctx,
            String(product?.name||"Producto").toUpperCase(),
            maxTextW
          );
          lines=trimWrappedLines(pctx,lines,maxTextW,columns>=5?2:3);
          const price=collagePriceText(product);
          const textH=
            lines.length*nameLine+
            (price?priceSize+24:0)+
            (captionPad*2);
          return {product,lines,price,height:imageH+textH};
        });

        const rows=[];
        for(let i=0;i<items.length;i+=cols){
          const rowItems=items.slice(i,i+cols);
          rows.push({items:rowItems,height:Math.max(...rowItems.map(v=>v.height))});
        }

        const height=
          rows.reduce((sum,row)=>sum+row.height,0)+
          gap*Math.max(0,rows.length-1);

        const layout={
          indent,available,cols,cardW,imageH,nameSize,nameLine,priceSize,captionPad,rows,height
        };
        cardLayouts.set(block,layout);
        return layout;
      }

      pctx.font=`900 ${parentTitleFontSize}px Georgia, Cambria, serif`;
      const parentTitleLines=parentTitle
        ? collageCanvasWrapLines(pctx,parentTitle,CONTENT_W-(isMarketplace?150:130)).slice(0,2)
        : [];
      pctx.font=`900 ${focusTitleFontSize}px Georgia, Cambria, serif`;
      const focusTitleLines=collageCanvasWrapLines(pctx,focusTitle,CONTENT_W-(isMarketplace?180:150)).slice(0,2);
      let naturalH=isMarketplace?92:104;
      naturalH+=parentTitleLines.length*parentTitleLineHeight;
      naturalH+=focusTitleLines.length*focusTitleLineHeight+(isMarketplace?62:68);

      for(const block of blocks){
        if(block.type==="heading"){
          const m=headingMetrics(block.depth);
          naturalH+=m.before+m.lineHeight+m.after;
        }else{
          const gl=gridLayout(block);
          naturalH+=gl.height+headingGap;
        }
      }
      naturalH+=72;

      const natural=document.createElement("canvas");
      const naturalLogicalHeight=Math.max(PAGE_H,Math.ceil(naturalH));
      natural.width=PAGE_W*RENDER_SCALE;
      natural.height=naturalLogicalHeight*RENDER_SCALE;
      const ctx=natural.getContext("2d");
      ctx.scale(RENDER_SCALE,RENDER_SCALE);

      const bgGradient=ctx.createLinearGradient(0,0,0,naturalLogicalHeight);
      bgGradient.addColorStop(0,"#fffdfa");
      bgGradient.addColorStop(.42,"#faf6f2");
      bgGradient.addColorStop(1,"#f4eee9");
      ctx.fillStyle=bgGradient;
      ctx.fillRect(0,0,PAGE_W,naturalLogicalHeight);
      ctx.textBaseline="top";

      ctx.fillStyle="rgba(240,204,199,.22)";
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(155,0);
      ctx.bezierCurveTo(93,68,82,128,0,182);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(PAGE_W,naturalLogicalHeight);
      ctx.lineTo(PAGE_W-190,naturalLogicalHeight);
      ctx.bezierCurveTo(PAGE_W-102,naturalLogicalHeight-70,PAGE_W-92,naturalLogicalHeight-132,PAGE_W,naturalLogicalHeight-190);
      ctx.closePath();
      ctx.fill();
      presentationDrawBotanicalAccent(ctx,4,42,isMarketplace ? .7 : .64,1,"rgba(186,137,122,.17)");
      presentationDrawBotanicalAccent(ctx,PAGE_W-4,naturalLogicalHeight-168,isMarketplace ? .72 : .66,-1,"rgba(186,137,122,.17)");

      let y=isMarketplace?30:34;
      const brandLineGap=isMarketplace?170:155;
      ctx.strokeStyle="#b9954f";
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(MARGIN,y+10);
      ctx.lineTo(PAGE_W/2-brandLineGap,y+10);
      ctx.moveTo(PAGE_W/2+brandLineGap,y+10);
      ctx.lineTo(PAGE_W-MARGIN,y+10);
      ctx.stroke();
      ctx.fillStyle="#8d5360";
      ctx.font=`900 ${isMarketplace?18:17}px Calibri, "Segoe UI", Arial, sans-serif`;
      ctx.textAlign="center";
      ctx.fillText("IRENISMB STOCK NATURA",PAGE_W/2,y);
      y+=isMarketplace?46:44;

      if(parentTitleLines.length){
        ctx.fillStyle="#352b2c";
        ctx.font=`900 ${parentTitleFontSize}px Georgia, Cambria, serif`;
        for(const line of parentTitleLines){
          ctx.fillText(line,PAGE_W/2,y);
          y+=parentTitleLineHeight;
        }
      }
      ctx.fillStyle="#9a3f5a";
      ctx.font=`900 ${focusTitleFontSize}px Georgia, Cambria, serif`;
      for(const line of focusTitleLines){
        ctx.fillText(line,PAGE_W/2,y);
        y+=focusTitleLineHeight;
      }
      y+=14;
      const ornamentY=y+5;
      ctx.strokeStyle="rgba(181,137,116,.58)";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(PAGE_W/2-150,ornamentY);
      ctx.lineTo(PAGE_W/2-36,ornamentY);
      ctx.moveTo(PAGE_W/2+36,ornamentY);
      ctx.lineTo(PAGE_W/2+150,ornamentY);
      ctx.stroke();
      presentationDrawHeart(ctx,PAGE_W/2,ornamentY+5,isMarketplace?22:20,"rgba(199,139,132,.72)");
      y+=isMarketplace?42:40;
      ctx.textAlign="left";

      for(const block of blocks){
        if(block.type==="heading"){
          const m=headingMetrics(block.depth);
          y+=m.before;
          const indent=Math.min(block.depth-1,3)*18;
          ctx.fillStyle=
            block.depth===1?"#352b2c":
            block.depth===2?"#8d5360":
            "#78696b";
          ctx.font=`900 ${m.size}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
          ctx.fillText(String(block.label||""),MARGIN+indent,y);
          y+=m.lineHeight+m.after;
          continue;
        }

        const gl=cardLayouts.get(block)||gridLayout(block);
        const xStart=cardMargin+gl.indent;

        for(const row of gl.rows){
          const rowWidth=row.items.length*gl.cardW+Math.max(0,row.items.length-1)*gap;
          const rowX=xStart+Math.max(0,(gl.available-rowWidth)/2);
          for(let c=0;c<row.items.length;c++){
            const entry=row.items[c];
            const x=rowX+c*(gl.cardW+gap);
            const h=row.height;

            collageCanvasRoundRect(ctx,x,y,gl.cardW,h,18);
            ctx.save();
            ctx.shadowColor="rgba(104,72,78,.16)";
            ctx.shadowBlur=16;
            ctx.shadowOffsetY=7;
            ctx.fillStyle="rgba(255,255,255,.96)";
            ctx.fill();
            ctx.restore();

            ctx.strokeStyle="#eadfda";
            ctx.lineWidth=1.2;
            ctx.stroke();

            ctx.save();
            const imageInset=isMarketplace?5:Math.max(9,Math.min(14,gl.cardW*.055));
            collageCanvasRoundRect(ctx,x+imageInset,y+imageInset,gl.cardW-imageInset*2,gl.imageH-imageInset,13);
            ctx.clip();
            const cardImageBg=ctx.createLinearGradient(x,y,x+gl.cardW,y+gl.imageH);
            cardImageBg.addColorStop(0,"#f5e9dd");
            cardImageBg.addColorStop(.5,"#fffdfa");
            cardImageBg.addColorStop(1,"#eee0d4");
            ctx.fillStyle=cardImageBg;
            ctx.fillRect(x+imageInset,y+imageInset,gl.cardW-imageInset*2,gl.imageH-imageInset);

            const img=imageMap.get(entry.product);
            if(img&&img.naturalWidth&&img.naturalHeight){
              const pad=isMarketplace?2:Math.max(8,Math.min(15,gl.cardW*.06));
              const aw=gl.cardW-(imageInset+pad)*2;
              const ah=gl.imageH-imageInset-pad*2;
              const bounds=isMarketplace?visibleImageBounds(img):{x:0,y:0,w:img.naturalWidth,h:img.naturalHeight};
              const scale=Math.min(aw/bounds.w,ah/bounds.h);
              const dw=bounds.w*scale;
              const dh=bounds.h*scale;
              ctx.drawImage(
                img,bounds.x,bounds.y,bounds.w,bounds.h,
                x+(gl.cardW-dw)/2,
                y+imageInset+(gl.imageH-imageInset-dh)/2,
                dw,
                dh
              );
            }
            ctx.restore();

            ctx.strokeStyle="#f0e7e2";
            ctx.lineWidth=1;
            ctx.beginPath();
            ctx.moveTo(x+imageInset,y+gl.imageH);
            ctx.lineTo(x+gl.cardW-imageInset,y+gl.imageH);
            ctx.stroke();

            let ty=y+gl.imageH+gl.captionPad;
            ctx.fillStyle="#352b2c";
            ctx.font=`800 ${gl.nameSize}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
            ctx.textAlign="center";
            for(const line of entry.lines){
              ctx.fillText(line,x+gl.cardW/2,ty);
              ty+=gl.nameLine;
            }

            if(entry.price){
              const pillH=gl.priceSize+17;
              const pillY=y+h-gl.captionPad-pillH;
              collageCanvasRoundRect(ctx,x+imageInset,pillY,gl.cardW-imageInset*2,pillH,11);
              ctx.fillStyle="#f9e6e5";
              ctx.fill();
              ctx.fillStyle="#8d5360";
              ctx.font=`950 ${gl.priceSize}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
              ctx.fillText(entry.price,x+gl.cardW/2,pillY+Math.max(7,(pillH-gl.priceSize)/2-1));
            }
            ctx.textAlign="left";
          }
          y+=row.height+gap;
        }
        y-=gap;
        y+=headingGap;
      }

      y+=18;
      ctx.strokeStyle="#e6d8d2";
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(MARGIN,y);
      ctx.lineTo(PAGE_W-MARGIN,y);
      ctx.stroke();

      y+=14;
      ctx.fillStyle="#78696b";
      ctx.font="650 13px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.textAlign="center";
      ctx.fillText(
        "Irenismb Stock Natura · Santa Marta · WhatsApp +57 304 208 8961",
        PAGE_W/2,
        y
      );
      ctx.textAlign="left";
      y+=44;

      const finalCanvas=document.createElement("canvas");
      finalCanvas.width=PAGE_W;
      finalCanvas.height=PAGE_H;
      const fctx=finalCanvas.getContext("2d");
      fctx.imageSmoothingEnabled=true;
      fctx.imageSmoothingQuality="high";

      const finalGradient=fctx.createLinearGradient(0,0,0,PAGE_H);
      finalGradient.addColorStop(0,"#fffdfa");
      finalGradient.addColorStop(1,"#f4eee9");
      fctx.fillStyle=finalGradient;
      fctx.fillRect(0,0,PAGE_W,PAGE_H);

      const usedHeight=Math.max(1,Math.min(naturalLogicalHeight,Math.ceil(y+42)));
      const verticalPadding=isMarketplace?24:18;
      const horizontalPadding=0;
      const scale=Math.min(1,(PAGE_H-verticalPadding)/usedHeight,(PAGE_W-horizontalPadding)/PAGE_W);
      const drawW=PAGE_W*scale;
      const drawH=usedHeight*scale;

      fctx.drawImage(
        natural,
        0,0,PAGE_W*RENDER_SCALE,usedHeight*RENDER_SCALE,
        (PAGE_W-drawW)/2,
        (PAGE_H-drawH)/2,
        drawW,drawH
      );

      const blob=await new Promise((resolve,reject)=>{
        try{
          finalCanvas.toBlob(
            value=>value?resolve(value):reject(new Error("No se pudo crear el archivo PNG.")),
            "image/png",
            1
          );
        }catch(error){
          reject(error);
        }
      });

      if(isPrepareAction){
        const file=window.File ? new File([blob],format.downloadName,{type:"image/png"}) : null;
        const stillCurrent=options.token===collagePrepareSequence && options.key===shareKey;
        collagePreparingShareKeys.delete(shareKey);
        if(stillCurrent){
          if(file) collagePreparedShareFiles.set(shareKey,file);
          else collagePreparedShareFiles.delete(shareKey);
          if(collageExportMode==="collage") setActionReady();
        }
      }else{
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url;
        a.download=format.downloadName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
      }
    }catch(error){
      if(isPrepareAction){
        const stillCurrent=options.token===collagePrepareSequence;
        collagePreparingShareKeys.delete(shareKey);
        if(stillCurrent){
          collagePreparedShareFiles.delete(shareKey);
          if(collageExportMode==="collage") setActionReady();
        }
        console.info(`No se pudo preparar el PNG del collage para ${format.label}.`,error);
      }else{
        console.error(`No se pudo generar el PNG del collage para ${format.label}.`,error);
        alert("No se pudo generar la imagen del collage. Intenta nuevamente después de que terminen de cargar las imágenes.");
      }
    }finally{
      if(!isPrepareAction){
        for(const button of formatButtons) button.disabled=false;
        if(downloadBtn){
          downloadBtn.disabled=false;
          downloadBtn.textContent="Descargar PNG";
        }
        if(collageExportMode==="collage"){
          queueCollageSharePreparation();
          setActionReady();
        }
      }
    }
  }


  function renderCollage(){
    const snapshot=collageCurrentSnapshot();
    renderCollageRouteHeading(routeEl,snapshot.titleSlots);
    collageTree.innerHTML="";
    invalidateCollageSharePreparation();
    setCollageSelectedProduct(null,null);

    if(!snapshot.products.length){
      const empty=document.createElement("div");
      empty.className="collage-empty";
      empty.textContent="No hay productos para mostrar con los filtros actuales.";
      collageTree.appendChild(empty);
      return;
    }

    if(snapshot.tree.products.length){
      collageTree.appendChild(makeCollageGrid(snapshot.tree.products,true));
    }

    appendTreeChildren(collageTree,snapshot.tree,1);

    const firstSelectable=collageTree.querySelector('.collage-item[data-ficha-selectable="true"]');
    if(firstSelectable){
      setCollageSelectedProduct(firstSelectable._collageProduct||null,firstSelectable);
    }else{
      setCollageSelectedProduct(null,null);
    }
  }

  function openCollageModal(mode="collage"){
    renderCollage();
    modal.classList.remove("admin-embedded");
    if(modal.parentNode!==document.body) document.body.appendChild(modal);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden","false");
    document.body.classList.add("collage-open");
    setCollageExportMode(mode);
    requestAnimationFrame(()=>closeBtn?.focus({preventScroll:true}));
  }

  function embedCollageInAdminHost(host){
    if(!host) return;
    renderCollage();
    document.body.classList.remove("collage-open");
    modal.classList.add("open","admin-embedded");
    modal.setAttribute("aria-hidden","false");
    host.replaceChildren(modal);
    setCollageExportMode("collage");
  }

  function releaseEmbeddedCollage(){
    if(!modal.classList.contains("admin-embedded")) return;
    modal.classList.remove("open","admin-embedded");
    modal.setAttribute("aria-hidden","true");
    document.body.appendChild(modal);
  }

  window.openCatalogFolletoPanel=()=>{
    const host=document.getElementById("catalogAdminFolletoHost");
    if(host) embedCollageInAdminHost(host);
    else openCollageModal();
  };

  btn.addEventListener("click",()=>{
    const products=buildFilteredList().filter(product=>product && !product.isGiftGalleryImage);
    const seen=new Set();
    let added=0,existing=0,unavailable=0;
    for(const product of products){
      const id=String(product.id||"");
      if(!id || seen.has(id)) continue;
      seen.add(id);
      if((Number(cart[id]?.qty)||0)>0){existing++;continue;}
      const knownStock=Number.isFinite(product.stock) && product.stock>=0;
      if(shouldEnforceStockLimits() && (!knownStock || product.stock<1)){unavailable++;continue;}
      cart[id]={id:product.id,name:product.name,price:product.price,hasPrice:product.hasPrice!==false,qty:1,stock:product.stock,imgFilename:product.imgFilename||null};
      added++;
    }
    saveCart();
    render();
    if(typeof renderCartModal==="function") renderCartModal();
    const status=document.getElementById("bulkAddStatus");
    if(status) status.textContent=`Se agregaron ${added} productos; ${existing} ya estaban en el carrito; ${unavailable} sin stock disponible.`;
  });
  let cartExportBusy=false;
  async function makeCartExportFile(mode,product){
    if(mode==="ficha"){
      const {canvas,fileName}=await buildMarketplacePresentationCanvas(product);
      const prepared=await prepareCanvasPngFile(canvas,fileName);
      return prepared.file || new File([prepared.blob],fileName || "ficha.png",{type:"image/png"});
    }
    const format=COLLAGE_EXPORT_FORMATS.marketplace;
    const key=collageShareCacheKey(collageCurrentSnapshot(),format);
    const token=++collagePrepareSequence;
    await downloadCollageImage("prepare",{token,key,formatKey:"marketplace"});
    const file=collagePreparedShareFiles.get(key);
    if(!file) throw new Error("No se pudo generar el collage.");
    return file;
  }
  function showCartImagePreview(file,mode){
    const dialog=document.createElement("dialog");
    dialog.setAttribute("aria-label",mode==="ficha" ? "Vista previa de la ficha" : "Vista previa del collage");
    dialog.style.cssText="width:min(92vw,760px);max-height:92vh;padding:18px;border:0;border-radius:18px;background:#fffdfc;color:#352f2f;box-sizing:border-box;";
    const title=document.createElement("h2");
    title.textContent=mode==="ficha" ? "Vista previa de la ficha" : "Vista previa del collage";
    title.style.cssText="margin:0 0 12px;font-size:22px;";
    const image=document.createElement("img");
    const url=URL.createObjectURL(file);
    image.src=url;
    image.alt=title.textContent;
    image.style.cssText="display:block;width:100%;max-height:65vh;object-fit:contain;";
    const actions=document.createElement("div");
    actions.style.cssText="display:flex;gap:12px;justify-content:center;margin-top:14px;flex-wrap:wrap;";
    const save=document.createElement("button");
    save.type="button"; save.className="btn"; save.textContent="Copiar y descargar";
    const close=document.createElement("button");
    close.type="button"; close.className="btn-ghost"; close.textContent="Cerrar";
    const message=document.createElement("p");
    message.setAttribute("role","status");
    message.style.cssText="margin:10px 0 0;text-align:center;";
    close.addEventListener("click",()=>dialog.close());
    dialog.addEventListener("close",()=>{URL.revokeObjectURL(url);dialog.remove();},{once:true});
    save.addEventListener("click",async()=>{
      save.disabled=true;
      let copyPromise;
      try{copyPromise=copyPreparedPngFile(file).then(()=>true,()=>false);}
      catch(_){copyPromise=Promise.resolve(false);}
      let downloaded=true;
      try{downloadPreparedPngFile(file,file.name);}catch(_){downloaded=false;}
      const copied=await copyPromise;
      message.textContent=copied && downloaded
        ? "Imagen copiada y descargada."
        : downloaded ? "Imagen descargada; el navegador no permitió copiarla al portapapeles."
        : copied ? "Imagen copiada; no se pudo descargar." : "No se pudo copiar ni descargar la imagen.";
      save.disabled=false;
    });
    actions.append(save,close);
    dialog.append(title,image,actions,message);
    document.body.appendChild(dialog);
    dialog.showModal();
  }
  async function exportCartImage(mode,product,button,productStatus=null){
    if(cartExportBusy) return;
    if(mode==="collage" && !cartItemsArray().length) return;
    if(mode==="ficha" && (!product || product.isGiftGalleryImage)) return;
    cartExportBusy=true;
    const label=button.textContent;
    button.disabled=true;
    button.textContent="Generando…";
    const status=productStatus || document.getElementById("cartImageStatus");
    if(status) status.textContent="Generando vista previa…";
    try{
      const file=await makeCartExportFile(mode,product);
      showCartImagePreview(file,mode);
      if(status) status.textContent="";
    }catch(error){
      if(status) status.textContent="No se pudo generar la imagen. Inténtalo nuevamente.";
      console.error("No se pudo generar la imagen del carrito.",error);
    }finally{
      cartExportBusy=false;
      button.disabled=false;
      button.textContent=label;
    }
  }
  window.createCartProductFicha=(product,button)=>exportCartImage("ficha",product,button);
  window.createProductFicha=(product,button,status)=>exportCartImage("ficha",product,button,status);
  document.getElementById("cartCollageBtn")?.addEventListener("click",event=>{
    void exportCartImage("collage",null,event.currentTarget);
  });

  window.addEventListener("irenismb:admin-section-change",event=>{
    const section=String(event?.detail?.section||"").trim().toLowerCase();
    if(section==="folleto"&&window.CATALOG_ADMIN_MODE_ACTIVE===true){
      const host=document.getElementById("catalogAdminFolletoHost");
      if(host) embedCollageInAdminHost(host);
      return;
    }
    releaseEmbeddedCollage();
  });

  for(const button of formatButtons){
    button.addEventListener("click",()=>{
      setCollageExportFormat(button.dataset.collageFormat);
      void copyAndDownloadForChannel(button);
    });
  }
  setCollageExportFormat("instagram");
  collageTypeBtn?.addEventListener("click",()=>setCollageExportMode("collage"));
  fichaBtn?.addEventListener("click",()=>{
    if(!collageSelectedProduct) return;
    setCollageExportMode("ficha");
  });
  async function copyAndDownloadForChannel(button){
    const format=COLLAGE_EXPORT_FORMATS[String(button?.dataset?.collageFormat||"").trim().toLowerCase()]||getCollageExportFormat();
    const snapshot=collageCurrentSnapshot();
    const key=collageShareCacheKey(snapshot,format);
    const file=collagePreparedShareFiles.get(key)||null;
    if(!file){
      queueCollageSharePreparation(format.key);
      return {copied:false,downloaded:false,pending:true};
    }
    const label=format.label;
    for(const current of formatButtons) current.disabled=true;
    if(button) button.textContent=`${label} · copiando y descargando…`;

    let copyPromise=null;
    let copyError=null;
    let downloadError=null;
    try{ copyPromise=copyPreparedPngFile(file); }catch(error){ copyError=error; }
    try{ downloadPreparedPngFile(file,file.name); }catch(error){ downloadError=error; }
    if(copyPromise){
      try{ await copyPromise; }catch(error){ copyError=error; }
    }

    if(copyError) console.error(`No se pudo copiar el collage para ${label}.`,copyError);
    if(downloadError) console.error(`No se pudo descargar el collage para ${label}.`,downloadError);

    if(button){
      if(!copyError && !downloadError) button.textContent=`${label} · copiada y descargada`;
      else if(copyError && !downloadError) button.textContent=`${label} · descargada`;
      else if(!copyError && downloadError) button.textContent=`${label} · copiada`;
      else button.textContent=`${label} · no se pudo completar`;
    }

    if(copyError && !downloadError){
      alert("La imagen se descargó, pero este navegador no permitió copiarla al portapapeles.");
    }else if(!copyError && downloadError){
      alert("La imagen se copió al portapapeles, pero el navegador no permitió descargarla.");
    }else if(copyError && downloadError){
      alert("No se pudo copiar ni descargar la imagen.");
    }

    window.setTimeout(()=>{
      if(collageExportMode==="collage") setActionReady();
    },1200);

    return {
      copied:!copyError,
      downloaded:!downloadError,
      pending:false
    };
  }

  window.catalogoCopyAndDownloadCollageForChannel=copyAndDownloadForChannel;

  shareBtn?.addEventListener("click",async()=>{
    if(collageExportMode!=="ficha") return;
    const file=fichaPreparedFile;
    if(!file){
      queueFichaPreparation();
      return;
    }
    shareBtn.disabled=true;
    shareBtn.textContent="Copiando y descargando…";

    let copyPromise=null;
    let copyError=null;
    let downloadError=null;
    try{ copyPromise=copyPreparedPngFile(file); }catch(error){ copyError=error; }
    try{ downloadPreparedPngFile(file,file.name); }catch(error){ downloadError=error; }
    if(copyPromise){
      try{ await copyPromise; }catch(error){ copyError=error; }
    }

    if(copyError) console.error("No se pudo copiar la ficha al portapapeles.",copyError);
    if(downloadError) console.error("No se pudo descargar la ficha PNG.",downloadError);

    if(!copyError && !downloadError) shareBtn.textContent="Copiada y descargada";
    else if(copyError && !downloadError) shareBtn.textContent="Descargada";
    else if(!copyError && downloadError) shareBtn.textContent="Copiada";
    else shareBtn.textContent="No se pudo completar";

    window.setTimeout(()=>{
      if(collageExportMode==="ficha") setActionReady();
    },1200);
  });

  modal.addEventListener("click",event=>{
    if(event.target.closest("[data-collage-close]")) closeCollage();
  });

  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&modal.classList.contains("open")) closeCollage();
  });
}

