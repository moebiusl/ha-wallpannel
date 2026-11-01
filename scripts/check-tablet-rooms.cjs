const {confirmPanelStartup,openPanelSettings}=require('./panel-test-helpers.cjs');
/* Regression: removing the primary/all room buttons, persisted in both profile editors. */
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.WALLPANEL_PLAYWRIGHT_MODULE || 'playwright');
(async()=>{for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch();try{
  const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];
  const configs={own:{name:'Wohnzimmer-iPad',room:'living',rooms:['living','kitchen'],screensaver:{enabled:false}},tabletremote1:{name:'Küchen-iPad',room:'kitchen',rooms:['kitchen'],screensaver:{enabled:false}}};
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{const req=route.request(),path=new URL(req.url()).pathname;let data={ok:true};
   if(path==='/api/panel/state')data={revision:'test',areas:[{area_id:'living',name:'Wohnzimmer'},{area_id:'kitchen',name:'Küche'}],entities:[]};
   else if(path==='/api/dashboard')data={weather:{},cameras:[]};
   else if(path==='/api/tablets')data={tablets:[{id:'tabletremote1',config:configs.tabletremote1,online:true}]};
   else if(path==='/api/tablet/sync')data={ok:true,config:configs.own,commands:[],assetVersion:'test'};
   else if(path==='/api/settings/unlock')assert.equal(req.postDataJSON().pin,'1234');
   else if(req.method()==='POST'&&path.indexOf('/api/tablets/')===0){const id=path.split('/')[3];configs[id==='tabletremote1'?id:'own']=req.postDataJSON().config;}
   else throw Error('Unexpected API '+path);
   return route.fulfill({json:data});
  });
  async function unlock(){await openPanelSettings(page);for(const key of '1234')await page.getByRole('dialog').getByRole('button',{name:key,exact:true}).click();await page.locator('#tabletSettings').waitFor();}
  async function home(){await page.getByRole('link',{name:'Home',exact:true}).click();}
  await page.goto('http://127.0.0.1:3000/panel/');await confirmPanelStartup(page);await page.locator('.assigned-room-buttons').waitFor();
  await unlock();const size=await page.locator('.settings-card').evaluate(n=>({width:n.offsetWidth,available:document.getElementById('content').clientWidth}));assert.ok(size.width>=size.available-1);
  await page.getByRole('checkbox',{name:'Wohnzimmer',exact:true}).uncheck();await page.getByRole('button',{name:'Einstellungen speichern',exact:true}).click();await page.waitForFunction(()=>WallpanelMockup.model.tablets[0].rooms.length===1);assert.deepEqual(configs.own.rooms,['kitchen']);
  await home();assert.deepEqual(await page.locator('.assigned-room-buttons button').allTextContents(),['Küche']);await page.reload();await confirmPanelStartup(page);await page.locator('.assigned-room-buttons').waitFor();assert.deepEqual(await page.locator('.assigned-room-buttons button').allTextContents(),['Küche']);
  await unlock();await page.getByRole('checkbox',{name:'Küche',exact:true}).uncheck();await page.getByRole('button',{name:'Einstellungen speichern',exact:true}).click();await page.waitForFunction(()=>WallpanelMockup.model.tablets[0].rooms.length===0);assert.deepEqual(configs.own.rooms,[]);assert.equal(configs.own.room,'living');await home();assert.equal(await page.locator('.assigned-room-buttons').count(),0);
  await page.reload();await confirmPanelStartup(page);await page.locator('#mainNav [aria-current=page]').waitFor();await page.waitForFunction(()=>WallpanelMockup.model.tablets[0].name==='Wohnzimmer-iPad');assert.equal(await page.locator('.assigned-room-buttons').count(),0);
  await unlock();await page.getByRole('checkbox',{name:'Wohnzimmer',exact:true}).check();await page.getByRole('checkbox',{name:'Küche',exact:true}).check();await page.getByRole('button',{name:'Einstellungen speichern',exact:true}).click();await page.waitForFunction(()=>WallpanelMockup.model.tablets[0].rooms.length===2);
  await page.getByRole('button',{name:'Alle Tablets',exact:true}).click();await page.locator('.tablet-row').filter({hasText:'Küchen-iPad'}).getByRole('button',{name:'Bearbeiten',exact:true}).click();await page.getByRole('checkbox',{name:'Küche',exact:true}).uncheck();await page.getByRole('button',{name:'Speichern',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});assert.deepEqual(configs.tabletremote1.rooms,[]);
  await page.locator('.tablet-row').filter({hasText:'Küchen-iPad'}).getByRole('button',{name:'Bearbeiten',exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'Küche',exact:true}).isChecked(),false);const remote=await page.getByRole('dialog').boundingBox();assert.ok(remote.width>950);await page.screenshot({path:'data/mockup-preview/'+name+'-settings-full-width.png'});await page.getByRole('button',{name:'Schließen',exact:true}).click();
  await home();await page.screenshot({path:'data/mockup-preview/'+name+'-settings-gear.png'});assert.deepEqual(errors,[]);console.log(name+': Hauptraum entfernen, alle Räume entfernen, Neuladen, erneut hinzufügen und zentrales Profil sowie volle Formularbreite geprüft.');
 }finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
