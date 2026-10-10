const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(path.join(process.env.NATURA_BROWSER_RUNTIME,'node_modules','playwright'));
(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  // Pages and the browser workflow start together; wait for the version being checked.
  const expectedVersion='descripcion-dos-columnas-beneficios-ajuste-2026-10-10-5';
  for(let attempt=0;attempt<12;attempt++){
    await page.goto('https://irenismb.github.io/stock/natura/catalogo.html?verificar=fichas-beneficios-ajuste-2026-10-10&t='+Date.now(),{waitUntil:'domcontentloaded'});
    const version=await page.locator('script[src*="catalogo-app.js"]').getAttribute('src');
    if(version.includes(expectedVersion))break;
    if(attempt===11)throw new Error('La publicación todavía no sirve la versión '+expectedVersion);
    await page.waitForTimeout(10000);
  }
  await page.waitForFunction(()=>window.CATALOG_INITIAL_LOAD_READY===true,null,{timeout:90000});
  const info=await page.evaluate(()=>({
    ready:window.CATALOG_PUBLIC_VISIBILITY_CONFIRMED,
    count:allLoadedProducts.filter(p=>/^\d{4}$/.test(p.id)).length,
    code:allLoadedProducts.find(p=>p.id==='0383')?.id,
    name:allLoadedProducts.find(p=>p.id==='0383')?.name,
    price:allLoadedProducts.find(p=>p.id==='0383')?.price,
    version:document.querySelector('script[src*="catalogo-app.js"]').src,
    privateLeak:allLoadedProducts.some(p=>String(p.fullTxtRecord||'').includes('Costo de adquisición:'))
  }));
  assert.equal(info.ready,true);assert.equal(info.count,363);assert.equal(info.code,'0383');assert.equal(info.price,110000);
  assert.ok(info.version.includes(expectedVersion));assert.equal(info.privateLeak,false);
  await page.waitForTimeout(1000);
  const directory=path.join(process.env.RUNNER_TEMP,'natura-browser-evidence');fs.mkdirSync(directory,{recursive:true});
  await page.evaluate(()=>{
    const p=allLoadedProducts.find(p=>p.id==='0383');
    const grid=document.getElementById('grid');grid.hidden=false;grid.replaceChildren(makeCard(p));
    queueCatalogFichaLayout();
  });
  await page.waitForTimeout(600);
  await page.locator('#grid .catalog-ficha-card').screenshot({path:path.join(directory,'ficha-predeterminada-escritorio.png')});
  await page.evaluate(()=>setCatalogFichaPriceVisibility(true));
  for(const width of [1280,390]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>{
      const original=allLoadedProducts.find(p=>p.id==='0383');
      const p={...original,fichaSelectionExplicit:true,fichaFields:[
        {key:'marca',label:'Marca',value:original.brand},
        {key:'precio',label:'Precio',value:original.priceText},
        {key:'nombre',label:'Nombre',value:original.name},
        {key:'codigo',label:'Código',value:original.id}
      ]};
      document.getElementById('grid').replaceChildren(makeCard(p));queueCatalogFichaLayout();
    });
    await page.waitForTimeout(700);
    const layout=await page.evaluate(()=>{
      const card=document.querySelector('#grid .catalog-ficha-card'),square=card.querySelector('.ficha-square'),facts=card.querySelector('.ficha-facts'),main=card.querySelector('.ficha-main'),detail=card.querySelector('.product-details');
      const ordered=[...facts.children].filter(node=>!node.hidden).map(node=>node.classList.contains('name')?'Nombre':node.classList.contains('row')?'Precio':node.querySelector('dt')?.textContent?.replace(/:$/,''));
      const rect=square.getBoundingClientRect(),description=detail.getBoundingClientRect();
      return {ordered,width:rect.width,height:rect.height,descriptionWidth:description.width,descriptionText:detail.querySelector('.description').textContent,
        factsOverflow:facts.scrollWidth>facts.clientWidth+1||facts.scrollHeight>main.clientHeight+1,
        cartButton:Boolean(card.querySelector('button[data-act="inc"]'))};
    });
    assert.deepEqual(layout.ordered,['Marca','Precio','Nombre','Código']);
    assert.ok(Math.abs(layout.height-layout.width)<3);
    assert.ok(layout.descriptionWidth>layout.width*.90);assert.ok(layout.descriptionText.length>10);
    assert.equal(layout.factsOverflow,false);assert.equal(layout.cartButton,true);
    await page.locator('#grid .catalog-ficha-card').screenshot({path:path.join(directory,'ficha-ordenada-'+width+'.png')});
    console.log('FICHA VERIFICADA',JSON.stringify({width,layout}));
  }

  const standards=await page.evaluate(()=>({
    selected:allLoadedProducts.filter(p=>/^\d{4}$/.test(p.id)).every(p=>p.fichaSelectionExplicit),
    beautyConditions:allLoadedProducts.filter(p=>/^\d{4}$/.test(p.id)&&p.section==='Belleza y cuidado'&&p.fichaFields.some(f=>f.key==='condicion')).length,
    otherConditions:allLoadedProducts.filter(p=>/^\d{4}$/.test(p.id)&&p.section==='Otros productos'&&p.condition&&!p.fichaFields.some(f=>f.key==='condicion')).length,
    otherName:allLoadedProducts.find(p=>p.id==='0011')?.name,
    presentation:allLoadedProducts.find(p=>p.id==='0401')?.fichaFields.find(f=>f.key==='presentacion')?.value
  }));
  assert.equal(standards.selected,true);assert.equal(standards.beautyConditions,0);assert.equal(standards.otherConditions,0);
  assert.equal(standards.otherName,'Enchufe inteligente Kasa HS100');assert.equal(standards.presentation,'60 ml');
  for(const code of ['0401','0383']){
    for(const width of [1280,390]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(code=>{
        const p=allLoadedProducts.find(p=>p.id===code),grid=document.getElementById('grid');
        grid.hidden=false;grid.replaceChildren(makeCard(p));queueCatalogFichaLayout();
      },code);
      await page.waitForFunction(()=>{const img=document.querySelector('#grid .img img');return img?.complete&&img.naturalWidth>0;},null,{timeout:45000});
      await page.waitForTimeout(700);
      const layout=await page.evaluate(code=>{
        const p=allLoadedProducts.find(p=>p.id===code),card=document.querySelector('#grid .catalog-ficha-card');
        const square=card.querySelector('.ficha-square'),facts=card.querySelector('.ficha-facts'),main=card.querySelector('.ficha-main'),detail=card.querySelector('.product-details');
        const description=detail.querySelector('.description'),style=getComputedStyle(description),rect=square.getBoundingClientRect();
        const ordered=[...facts.children].filter(node=>!node.hidden).map(node=>node.classList.contains('name')?'Nombre':node.classList.contains('row')?'Precio':node.classList.contains('ficha-presentation')?'Presentación':node.querySelector('dt')?.textContent?.replace(/:$/,''));
        const expected=p.fichaFields.filter(f=>f.key!=='precio'||!card.querySelector('.row').hidden).map(f=>f.label);
        return {code,ordered,expected,width:rect.width,height:rect.height,descriptionWidth:detail.getBoundingClientRect().width,descriptionText:description.textContent,
          lineRatio:parseFloat(style.lineHeight)/parseFloat(style.fontSize),textAlign:style.textAlign,hyphens:style.hyphens,
          factsOverflow:facts.scrollWidth>facts.clientWidth+1||facts.scrollHeight>main.clientHeight+1,
          fontSize:getComputedStyle(facts.querySelector('.name')).fontSize,presentation:card.querySelector('.ficha-presentation').textContent};
      },code);
      assert.deepEqual(layout.ordered,layout.expected);assert.equal(layout.ordered.includes('Condición'),false);
      assert.ok(Math.abs(layout.height-layout.width)<3);assert.ok(layout.descriptionWidth>layout.width*.90);
      assert.equal(layout.factsOverflow,false);assert.equal(layout.textAlign,'justify');assert.equal(layout.hyphens,'none');assert.ok(layout.lineRatio<=1.42);
      assert.ok(!layout.descriptionText.includes('\n\n'));assert.ok(layout.descriptionText.length>10);
      await page.locator('#grid .catalog-ficha-card').screenshot({path:path.join(directory,'ficha-estandar-'+code+'-'+width+'.png')});
      console.log('FICHA ESTANDAR VERIFICADA',JSON.stringify(layout));
    }
  }
  console.log('ORDEN ESTANDAR VERIFICADO',JSON.stringify(standards));


  for(const visible of [true,false])for(const width of [332,555,558,560,600]){
    await page.setViewportSize({width:1280,height:950});
    await page.evaluate(({visible,width})=>{
      setCatalogFichaPriceVisibility(visible);
      const grid=document.getElementById('grid');grid.style.gridTemplateColumns=width+'px';grid.hidden=false;
      grid.replaceChildren(makeCard(allLoadedProducts.find(p=>p.id==='0407')));queueCatalogFichaLayout();
    },{visible,width});
    await page.waitForFunction(()=>{const image=document.querySelector('#grid .img img');return image?.complete&&image.naturalWidth>0;},null,{timeout:45000});
    await page.waitForTimeout(500);
    const result=await page.evaluate(()=>{
      const p=allLoadedProducts.find(p=>p.id==='0407'),card=document.querySelector('#grid .catalog-ficha-card');
      const square=card.querySelector('.ficha-square'),facts=card.querySelector('.ficha-facts'),main=card.querySelector('.ficha-main');
      const fit=Number(square.style.getPropertyValue('--ficha-fit')||1);
      const actual=card.querySelector('.description').textContent;
      const benefit=p.fullTxtRecord.match(/Beneficios y funciones del producto: ([^\n]+)/)[1];
      const occasion=p.fullTxtRecord.match(/Descripción sensorial y uso recomendado: ([^\n]+)/)[1];
      const snapshot=buildFolletoSnapshot({scope:'selected',selectedIds:['0407']});
      const result={fit,font:getComputedStyle(card.querySelector('.name')).fontSize,
        overflow:facts.scrollHeight>main.clientHeight+1||facts.scrollWidth>facts.clientWidth+1,
        footer:actual,benefit,occasion,exportFooter:snapshot.products[0].description};
      if(fit<.96){
        square.style.setProperty('--ficha-fit',fit+.03);
        result.largerOverflows=facts.scrollHeight>main.clientHeight+1||facts.scrollWidth>facts.clientWidth+1;
        square.style.setProperty('--ficha-fit',fit);
      }
      return result;
    });
    assert.equal(result.overflow,false);if(width>=550)assert.ok(result.fit>.90,JSON.stringify(result));
    if(result.fit<.96)assert.equal(result.largerOverflows,true,'La ficha debe aprovechar el espacio disponible');
    assert.equal(result.footer,result.benefit+'\n'+result.occasion);assert.equal(result.exportFooter,result.footer);
    await page.locator('#grid .catalog-ficha-card').screenshot({path:path.join(directory,'kit-0407-'+width+'-'+(visible?'con':'sin')+'-precio.png')});
    console.log('KIT 0407 Y PIE VERIFICADOS',JSON.stringify({width,visible,result}));
  }
  await page.evaluate(()=>document.getElementById('grid').style.removeProperty('grid-template-columns'));
  const originals=await page.evaluate(()=>allLoadedProducts.filter(p=>/^\d{4}$/.test(p.id)).map(p=>[p.id,p.price]));
  await page.evaluate(()=>{
    const p=allLoadedProducts.find(p=>p.id==='0401');
    document.getElementById('grid').replaceChildren(makeCard(p));queueCatalogFichaLayout();
    FOLLETO_SELECTION.clear();FOLLETO_SELECTION.add('0401');
    document.querySelector('#folletoOptions input[name="scope"][value="selected"]').checked=true;
  });
  for(const visible of [false,true]){
    await page.locator('#folletoBtn').click();
    const checkbox=page.locator('#folletoOptions input[name="prices"]');
    if(visible)await checkbox.check();else await checkbox.uncheck();
    await page.locator('#folletoClose').click();
    for(const width of [1280,390]){
      await page.setViewportSize({width,height:900});await page.waitForTimeout(500);
      const details=await page.evaluate(()=>{
        const card=document.querySelector('#grid .catalog-ficha-card'),row=card.querySelector('.row'),price=card.querySelector('.price'),code=card.querySelector('.ficha-code'),description=card.querySelector('.description');
        const p=allLoadedProducts.find(p=>p.id==='0401');
        const snapshot=buildFolletoSnapshot({scope:'selected',selectedIds:['0401']});
        return {show:shouldShowFichaPrices(),rowVisible:getComputedStyle(row).display!=='none',border:getComputedStyle(row).borderTopWidth,
          priceVisible:getComputedStyle(price).display!=='none',price:price.textContent,codeBorder:getComputedStyle(code).borderTopWidth,
          descriptionAlign:getComputedStyle(description).textAlign,lineRatio:parseFloat(getComputedStyle(description).lineHeight)/parseFloat(getComputedStyle(description).fontSize),
          snapshotPrice:snapshot.products[0].priceText,snapshotShow:snapshot.settings.prices,expectedPrice:fmtCOP.format(p.price)};
      });
      assert.equal(details.show,visible);assert.equal(details.rowVisible,visible);assert.equal(details.priceVisible,visible);assert.equal(details.snapshotShow,visible);
      assert.equal(details.codeBorder,'1px');assert.equal(details.descriptionAlign,'justify');assert.ok(details.lineRatio<=1.42);
      assert.ok(!details.price.includes(String.fromCharCode(36)));assert.ok(!details.snapshotPrice.includes(String.fromCharCode(36)));
      if(visible){assert.equal(details.price,details.expectedPrice);assert.equal(details.snapshotPrice,details.expectedPrice);assert.equal(details.border,'1px');}
      else{assert.equal(details.price,'');assert.equal(details.snapshotPrice,'');assert.equal(details.border,'0px');}
      await page.locator('#grid .catalog-ficha-card').screenshot({path:path.join(directory,'ficha-0401-'+(visible?'con':'sin')+'-precio-'+width+'.png')});
      console.log('PRECIO COMPARTIDO VERIFICADO',JSON.stringify({width,visible,details}));
    }
  }
  for(const visible of [false,true]){
    await page.evaluate(visible=>setCatalogFichaPriceVisibility(visible),visible);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.CATALOG_INITIAL_LOAD_READY===true,null,{timeout:90000});
    assert.equal(await page.evaluate(()=>shouldShowFichaPrices()),visible);
    assert.equal(await page.locator('#folletoOptions input[name="prices"]').isChecked(),visible);
  }
  assert.deepEqual(await page.evaluate(()=>allLoadedProducts.filter(p=>/^\d{4}$/.test(p.id)).map(p=>[p.id,p.price])),originals);
  await page.evaluate(()=>{
    const p=allLoadedProducts.find(p=>p.id==='0401');
    FOLLETO_SELECTION.clear();FOLLETO_SELECTION.add('0401');setCatalogFichaPriceVisibility(false);
    const snapshot=buildFolletoSnapshot({scope:'selected',selectedIds:['0401']});
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;
    const ctx=canvas.getContext('2d'),product=snapshot.products[0];ctx.textBaseline='top';
    renderFicha(ctx,{x:0,y:0,width:1080,height:1080,product:{...product,imageUrl:''},measure:measureFicha(ctx,{...product,imageUrl:''})},null);
    window.__fichaFolletoPreview=canvas.toDataURL('image/png');
  });
  const canvasUrl=await page.evaluate(()=>window.__fichaFolletoPreview);
  fs.writeFileSync(path.join(directory,'folleto-texto-justificado-sin-precio.png'),Buffer.from(canvasUrl.split(',')[1],'base64'));
  console.log('PERSISTENCIA Y PRECIOS REALES CONSERVADOS');
  assert.deepEqual(errors,[]);console.log('WEB PUBLICA VERIFICADA',JSON.stringify(info));
  fs.writeFileSync(path.join(directory,'verificacion.json'),JSON.stringify(info,null,2));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
