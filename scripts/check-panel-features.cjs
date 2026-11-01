const {confirmPanelStartup,openPanelSettings}=require('./panel-test-helpers.cjs');
/* Six panel features, isolated API fixtures. No requests reach real HA devices. */
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.WALLPANEL_PLAYWRIGHT_MODULE || 'playwright');
const base='http://127.0.0.1:3000';
(async()=>{for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch();try{
 let version='fixture1',writes=[],reloads={},boots={a:0,b:0},syncs=[],inbox=[{id:'battery:door',kind:'battery',title:'Fenstersensor',message:'Batterie 12 %',active:true,hidden:false,done:false}];
 const config={name:'Test-iPad',room:'living',rooms:['living'],sounds:true,screensaver:{enabled:false,minutes:5}};
 const states=[{entityId:'climate.one',name:'Heizung eins',domain:'climate',areaId:'living',state:'heat',attributes:{temperature:21,current_temperature:20,min_temp:5,max_temp:30,target_temp_step:.5,hvac_modes:['off','heat']}},{entityId:'climate.two',name:'Heizung zwei',domain:'climate',areaId:'living',state:'off',attributes:{temperature:18,current_temperature:19,min_temp:5,max_temp:30,target_temp_step:.5,hvac_modes:['off','heat']}}];
 const contexts=[],pages={};let jobCounter=0;
 for(const key of ['a','b']){
  const context=await browser.newContext({viewport:{width:1024,height:768}});contexts.push(context);
  await context.addInitScript(key=>{localStorage.setItem('haWallpanel.tabletId','testtablet'+key+'12345');window.audioFail=false;Object.defineProperty(HTMLMediaElement.prototype,'paused',{get(){return !this.__running;}});HTMLMediaElement.prototype.play=function(){if(window.audioFail)return Promise.reject(new Error('blocked'));window.testAudio=this;this.__running=true;setTimeout(()=>{this.dispatchEvent(new Event('playing'));setTimeout(()=>{this.__running=false;this.dispatchEvent(new Event('ended'));},80);},30);return undefined;};HTMLMediaElement.prototype.pause=function(){this.__running=false;};},key);
  await context.route(/\/panel\/\?/,async route=>{const r=await route.fetch();boots[key]++;await route.fulfill({response:r,body:(await r.text()).replace(/window.WallpanelBuild=[^;]+;/,'window.WallpanelBuild="'+version+'";')});});
  await context.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname,body=req.method()==='POST'?JSON.parse(req.postData()||'{}'):{};let result={ok:true};
   if(req.method()!=='GET')writes.push({path,body,key});
   if(path==='/api/panel/state')result={revision:'one',areas:[{area_id:'living',name:'Wohnzimmer'}],roomReadings:{living:{temperature:20.5,humidity:46}},entities:states,inbox};
   else if(path==='/api/dashboard')result={cameras:[],weather:{},energy:{summary:{}}};
   else if(path==='/api/tablet/sync'){syncs.push(body);if(reloads[body.id]?.id===body.reloadAck)delete reloads[body.id];result={ok:true,assetVersion:version,config,commands:[],reload:reloads[body.id]||null};}
   else if(path==='/api/tablets')result={ok:true,tablets:['a','b'].map(k=>({id:'testtablet'+k+'12345',config:{...config,name:'iPad '+k},online:true,panelStatus:{version:'fixture1',sound:'ready',reload:reloads['testtablet'+k+'12345']}}))};
   else if(path==='/api/panel/inbox/action'){let item=inbox.find(n=>n.id===body.id);if(body.action==='hide')item.hidden=true;if(body.action==='done')item.done=true;if(body.action==='show'){item.done=false;item.hidden=false;}result={ok:true,items:inbox};}
   else if(path==='/api/panel/climate-sync'){states[1].state=states[0].state;states[1].attributes.temperature=states[0].attributes.temperature;result={ok:true,skipped:[],results:[{id:'climate.two',mode:'heat',temperature:21,ok:true}]};}
   else if(path==='/api/panel/reload'){const ids=body.target==='all'?['testtableta12345','testtabletb12345']:[body.target];ids.forEach(id=>reloads[id]={id:String(++jobCounter).padStart(24,'a'),createdAt:Date.now(),expiresAt:Date.now()+86400000});result={ok:true,delivered:ids.length};}
   else if(path==='/api/settings/unlock')result={ok:true};
   else if(path==='/api/tablets/directory')result={tablets:[]};
   else if(path.startsWith('/api/camera')||path.includes('media-artwork')){await route.abort();return;}
   else if(path!=='/api/settings/session')throw new Error('Unexpected API '+path);
   await route.fulfill({json:result});
  });
  const page=await context.newPage();pages[key]=page;await page.goto(base+'/panel/?_reload=20261101');if(key==='b'){await page.evaluate(()=>{window.audioFail=true;});await page.locator('[data-action="startup-confirm"]').click();await page.locator('#startupError').getByText('Ton konnte nicht freigegeben werden.',{exact:false}).waitFor();await page.evaluate(()=>{window.audioFail=false;});}await confirmPanelStartup(page);await page.waitForFunction(()=>window.WallpanelMockup&&WallpanelMockup.model.rooms.length);
 }
 const a=pages.a,b=pages.b;
 const poll=async p=>{await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(120);};

 await a.getByRole('button',{name:'Posteingang',exact:true}).click();await a.getByRole('button',{name:'Ausblenden',exact:true}).click();await poll(b);await b.waitForFunction(()=>document.querySelectorAll('.notice-item').length===0);assert.equal(inbox[0].hidden,true);
 await b.getByRole('button',{name:'Posteingang',exact:true}).click();await a.getByRole('button',{name:'Erledigt',exact:true}).click();assert.equal(inbox[0].done,true);await poll(b);await b.getByRole('button',{name:'Wieder öffnen',exact:true}).waitFor();await b.getByRole('button',{name:'Schließen',exact:true}).click();await a.getByRole('button',{name:'Wieder öffnen',exact:true}).click();assert.equal(inbox[0].done,false);await a.getByRole('button',{name:'Schließen',exact:true}).click();await poll(b);await b.waitForFunction(()=>document.querySelectorAll('.notice-item').length===1);
 await a.locator('#mainNav').getByRole('button',{name:'Wohnzimmer',exact:true}).click();await a.locator('.room-readings').waitFor();assert.match(await a.locator('.room-readings').textContent(),/20,5 °C.*46 %/);
 await a.screenshot({path:'data/mockup-preview/features-room-'+name+'.png'});await a.locator('[data-action="climate-sync"][data-id="climate.one"]').click();await poll(a);await a.waitForFunction(()=>WallpanelMockup.model.climates[1].target===21&&WallpanelMockup.model.climates[1].mode==='heat');assert.equal(writes.filter(w=>w.path==='/api/panel/climate-sync').length,1);
 // Legacy play() returns undefined: readiness waits for onplaying, never a timer assumption.
 await b.getByRole('button',{name:'Ton bereit',exact:true}).waitFor();
 version='fixture2';await poll(a);assert.equal(await a.locator('#appsNav').getAttribute('data-update'),'true');
 await openPanelSettings(a);assert.equal(await a.locator('#settingsNav').getAttribute('data-update'),'true');assert.equal(await a.locator('#appsNav').evaluate(n=>getComputedStyle(n,':after').content),'"1"');assert.equal(await a.locator('#settingsNav').evaluate(n=>getComputedStyle(n,':after').content),'"1"');for(const digit of '1310')await a.getByRole('dialog').getByRole('button',{name:digit,exact:true}).click();await a.locator('#tabletSettings').waitFor();
 await a.getByRole('button',{name:'Alle iPads neu laden',exact:true}).click();assert.equal(Object.keys(reloads).length,2);
 await b.evaluate(()=>WallpanelMockup.openDialog('Test','<textarea class="dialog-input">Text</textarea>','test'));
 await poll(b);const beforeB=boots.b;await b.waitForTimeout(2200);assert.equal(boots.b,beforeB,'Open popup must defer reload');assert.equal(boots.a,1,'Settings form must defer reload');
 await b.getByRole('button',{name:'Schließen',exact:true}).click();await b.evaluate(()=>{window.testAudio.__running=true;});await b.waitForTimeout(2200);assert.equal(boots.b,beforeB,'Playing audio must defer reload');await b.evaluate(()=>{window.testAudio.__running=false;});await b.waitForFunction(()=>window.WallpanelBuild==='fixture2');await confirmPanelStartup(b);await b.waitForTimeout(3300);assert.equal(boots.b,beforeB+1);assert.equal(reloads.testtabletb12345,undefined,'New document must acknowledge job');assert.equal(await b.locator('#appsNav').getAttribute('data-update'),'false');
 await a.getByRole('link',{name:'Home',exact:true}).click();await a.waitForFunction(()=>window.WallpanelBuild==='fixture2');await confirmPanelStartup(a);await a.waitForTimeout(3300);assert.equal(boots.a,2);assert.equal(Object.keys(reloads).length,0);
 for(const size of [{width:1024,height:768},{width:768,height:1024},{width:1024,height:650}]){await a.setViewportSize(size);await a.locator('#mainNav').getByRole('button',{name:'Wohnzimmer',exact:true}).click();assert.equal(await a.evaluate(()=>document.getElementById('content').scrollWidth>document.getElementById('content').clientWidth+1),false);}
 assert.ok(syncs.some(s=>s.sound==='ready'));assert.ok(syncs.some(s=>s.version==='fixture2'&&s.reloadAck));assert.ok(writes.some(w=>w.path==='/api/panel/reload'&&w.body.target==='all'));
 await openPanelSettings(a);for(const digit of '1310')await a.getByRole('dialog').getByRole('button',{name:digit,exact:true}).click();const beforeReload=a.url();await a.getByRole('button',{name:'Dieses iPad neu laden',exact:true}).click();await a.waitForURL(u=>u.href!==beforeReload&&u.hash==='#apps'); // reload keeps the page; settings need a fresh unlock
 await confirmPanelStartup(a);assert.equal(boots.a,3);
 console.log(name+': Raumklima, Heizungs-Sync, gemeinsamer Posteingang, alter Audio-Start, Updateanzeige und bestätigter Fern-Reload mit Dialog-/Eingabeschutz geprüft.');
 for(const c of contexts)await c.close();
 }finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
