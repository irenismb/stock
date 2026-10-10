const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(path.join(process.env.NATURA_BROWSER_RUNTIME,'node_modules','playwright'));
(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://irenismb.github.io/stock/natura/catalogo.html?verificar=orden-ficha-2026-10-10',{waitUntil:'domcontentloaded'});
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
  assert.ok(info.version.includes('descripcion-dos-columnas'));assert.equal(info.privateLeak,false);
  await page.waitForTimeout(1000);
  const directory=path.join(process.env.RUNNER_TEMP,'natura-browser-evidence');fs.mkdirSync(directory,{recursive:true});
  await page.evaluate(()=>{
    const p=allLoadedProducts.find(p=>p.id==='0383');
    const grid=document.getElementById('grid');grid.hidden=false;grid.replaceChildren(makeCard(p));
    queueCatalogFichaLayout();
  });
  await page.waitForTimeout(600);
  await page.locator('#grid .catalog-ficha-card').screenshot({path:path.join(directory,'ficha-predeterminada-escritorio.png')});
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
    beautyConditions:allLoadedProducts.filter(p=>p.section==='Belleza y cuidado'&&p.fichaFields.some(f=>f.key==='condicion')).length,
    otherConditions:allLoadedProducts.filter(p=>p.section==='Otros productos'&&p.condition&&!p.fichaFields.some(f=>f.key==='condicion')).length,
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
      assert.equal(layout.factsOverflow,false);assert.equal(layout.textAlign,'left');assert.equal(layout.hyphens,'none');assert.ok(layout.lineRatio<=1.42);
      assert.ok(!layout.descriptionText.includes('\n\n'));assert.ok(layout.descriptionText.length>10);
      await page.locator('#grid .catalog-ficha-card').screenshot({path:path.join(directory,'ficha-estandar-'+code+'-'+width+'.png')});
      console.log('FICHA ESTANDAR VERIFICADA',JSON.stringify(layout));
    }
  }
  console.log('ORDEN ESTANDAR VERIFICADO',JSON.stringify(standards));
  assert.deepEqual(errors,[]);console.log('WEB PUBLICA VERIFICADA',JSON.stringify(info));
  fs.writeFileSync(path.join(directory,'verificacion.json'),JSON.stringify(info,null,2));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
