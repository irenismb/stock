const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(path.join(process.env.NATURA_BROWSER_RUNTIME,'node_modules','playwright'));
(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://irenismb.github.io/stock/natura/catalogo.html?verificar=dos-columnas-2026-10-10',{waitUntil:'domcontentloaded'});
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
  assert.deepEqual(errors,[]);console.log('WEB PUBLICA VERIFICADA',JSON.stringify(info));
  fs.writeFileSync(path.join(directory,'verificacion.json'),JSON.stringify(info,null,2));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
