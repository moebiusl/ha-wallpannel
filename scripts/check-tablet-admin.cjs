const {confirmPanelStartup}=require('./panel-test-helpers.cjs');
/* Central Mac administration. All API calls mocked; no real tablet reloads/HA writes. */
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.WALLPANEL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch();try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>sessionStorage.setItem('haWallpanel.settingsUnlockedUntil',String(Date.now()+60000)));
  let cfg={name:'Flur-iPad',room:'living',rooms:['living','kitchen'],large:false,sounds:true,doorbellWake:true,screensaver:{enabled:true,minutes:5},nightMode:{enabled:true,startHour:22,startMinute:0,endHour:7,endMinute:0,brightness:15}},reload=null;
  let commands=[];let inbox=[{id:'battery:dev',title:'Fenstersensor',message:'Batterie 12 %',active:true,done:false,hidden:false}];
  const areas=[{areaId:'living',name:'Wohnzimmer'},{areaId:'kitchen',name:'Küche'},{areaId:'hidden',name:'#Technik'}];
  await context.route('**/api/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname,body=req.method()==='POST'?JSON.parse(req.postData()||'{}'):{};if(req.method()!=='GET')writes.push({path,body});let data={ok:true};
    if(path==='/api/tablet/sync')data={ok:true,assetVersion:'new',config:cfg,commands:commands.splice(0)};
    else if(path==='/api/panel/state')data={areas:areas.map(a=>({area_id:a.areaId,name:a.name})),entities:[]};
    else if(path==='/api/dashboard')data={cameras:[],weather:{},energy:{summary:{}}};
    else if(path==='/api/tablets/directory')data={tablets:[],presets:['Bitte zum Essen kommen']};
    else if(path==='/api/settings/session')data={unlocked:true};
    else if(path==='/api/ha/structure')data={areas,devices:[],entities:[],floors:[],tree:[{floorName:'Erdgeschoss',areas}]};
    else if(path==='/api/panel-config')data={config:{panels:{default:{name:'Wallpanel',defaultPage:'hof',visiblePages:['hof'],pages:{hof:{title:'Allgemein',enabledCards:[],enabledEntities:[],enabledDevices:[],hiddenEntities:[]}}}}}};
    else if(path==='/api/tablets')data={ok:true,assetVersion:'new',health:{haConnected:true},inbox,tablets:[{id:'tablet123456',config:cfg,online:true,lastSeen:Date.now(),ip:'192.168.1.25',device:'iPad 3',page:'panel/home',panelStatus:{version:'old',sound:'blocked',reload}}],settings:{announcementPresets:['Essen ist fertig'],doorbellLights:[]},doorbell:{},candidates:{doorbell:[],lights:[],cameras:[]}};
    else if(path==='/api/tablets/tablet123456'&&req.method()==='POST'){cfg={...cfg,...body.config};data={ok:true,config:cfg};}
    else if(path==='/api/panel/reload'){reload={id:'abc',createdAt:Date.now(),expiresAt:Date.now()+86400000};data={ok:true,delivered:1};}
    else if(path==='/api/tablets/tablet123456/command')data={ok:true,delivered:1};
    else if(path==='/api/panel/inbox/action'){if(body.action==='done')inbox[0].done=true;else if(body.action==='hide')inbox[0].hidden=true;else{inbox[0].hidden=false;inbox[0].done=false;}data={ok:true,items:inbox};}
    await route.fulfill({json:data});
  });
  await page.goto('http://127.0.0.1:3000/optionen.html#tablets');await page.locator('[name="tabletAssignedRoom"]').first().waitFor();
  const card=page.locator('[data-admin-tablet="tablet123456"]');
  assert.equal(await card.locator('[name="tabletAssignedRoom"]').count(),2);assert.match(await page.locator('#tabletsMaintenanceMount').textContent(),/Home Assistant verbunden/);assert.match(await card.locator('[data-tablet-health]').textContent(),/Update verfügbar/);
  await card.locator('#tab_tablet123456_name').fill('Name ungespeichert');await page.locator('#announcePresetsInput').fill('Nicht verlieren');await page.evaluate(()=>loadTabletsAdmin(true));await page.waitForTimeout(150);assert.equal(await card.locator('#tab_tablet123456_name').inputValue(),'Name ungespeichert');assert.equal(await page.locator('#announcePresetsInput').inputValue(),'Nicht verlieren');
  await card.locator('[name="tabletAssignedRoom"]').nth(0).uncheck();await card.locator('[name="tabletAssignedRoom"]').nth(1).uncheck();await card.locator('#tab_tablet123456_room').selectOption('');await card.locator('#tab_tablet123456_large').check();await card.locator('#tab_tablet123456_doorbell').uncheck();await card.locator('#tab_tablet123456_sounds').uncheck();await card.locator('#tab_tablet123456_ssmin').selectOption('10');
  for(const [field,value] of Object.entries({nmsh:21,nmsm:30,nmeh:6,nmem:45,nmb:12}))await card.locator('#tab_tablet123456_'+field).fill(String(value));
  await card.getByRole('button',{name:'Speichern',exact:true}).click();await page.waitForFunction(()=>document.getElementById('tab_tablet123456_state').textContent.indexOf('Gespeichert')>=0);
  assert.deepEqual(cfg.rooms,[]);assert.equal(cfg.room,'');assert.equal(cfg.large,true);assert.equal(cfg.doorbellWake,false);assert.equal(cfg.sounds,false);assert.equal(cfg.screensaver.minutes,10);assert.deepEqual(cfg.nightMode,{enabled:true,startHour:21,startMinute:30,endHour:6,endMinute:45,brightness:12});
  await page.getByRole('button',{name:'Alle iPads neu laden',exact:true}).click();await page.waitForFunction(()=>document.getElementById('tabletsMaintenanceState').textContent.indexOf('1 Tablet')>=0);assert.ok(writes.some(w=>w.path==='/api/panel/reload'&&w.body.target==='all'));assert.equal(await page.locator('#announcePresetsInput').inputValue(),'Nicht verlieren');
  await card.getByRole('button',{name:'Neu laden',exact:true}).click();await card.getByRole('button',{name:'Identifizieren',exact:true}).click();assert.ok(writes.some(w=>w.body.type==='reload'));assert.ok(writes.some(w=>w.body.type==='identify'));
  await page.locator('#tabletsMaintenanceMount').getByRole('button',{name:'Erledigt',exact:true}).click();await page.locator('#tabletsMaintenanceMount').getByText('Keine offenen Gerätehinweise.',{exact:true}).waitFor();await page.getByRole('button',{name:'Erledigte Hinweise anzeigen',exact:true}).click();await page.getByRole('button',{name:'Wieder anzeigen',exact:true}).click();assert.equal(inbox[0].done,false);
  const live=await context.newPage();await live.goto('http://127.0.0.1:3000/panel/');await confirmPanelStartup(live);await live.waitForFunction(()=>window.WallpanelMockup&&WallpanelMockup.model.tablets[0].name==='Name ungespeichert');assert.equal(await live.locator('body').getAttribute('class'),'large-type');
  commands.push({type:'doorbell',sound:'none'});await live.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await live.waitForTimeout(200);assert.equal(await live.getByRole('dialog').count(),0,'Remote setting disables the doorbell popup');
  await live.getByRole('button',{name:'Durchsage',exact:true}).click();await live.locator('.announcement-presets').getByRole('button',{name:'Bitte zum Essen kommen',exact:true}).waitFor();assert.equal(await live.locator('.announcement-presets button').count(),1);await live.close();
  assert.deepEqual(errors,[]);await page.screenshot({path:'data/mockup-preview/tablet-admin-'+name+'.png',fullPage:true});
  console.log(name+': Mac-Verwaltung mit Räumen entfernen, allen Profileinstellungen, geschützten Eingaben, Wartung, Einzel-/Sammel-Reload und Identifizieren geprüft.');await context.close();
 }finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
