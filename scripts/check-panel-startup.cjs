/* iOS 9 path: startup/audio confirmation, Apps and static blurred cover. Mocked API only. */
const assert=require('node:assert/strict');const {chromium,webkit}=require(process.env.WALLPANEL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch();try{
 const context=await browser.newContext({viewport:{width:1024,height:768},userAgent:'Mozilla/5.0 (iPad; CPU OS 9_3_6 like Mac OS X) AppleWebKit/601.1.46 Version/9.0 Mobile/13G37 Safari/601.1'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));let sounds=true;
 await context.addInitScript(()=>{window.playCount=0;HTMLMediaElement.prototype.play=function(){window.playCount++;window.activationAudio=this;return undefined;};});
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
 await context.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;let data={ok:true};
 if(path==='/api/tablet/sync')data={ok:true,config:{name:'Altes iPad',room:'living',rooms:['living'],sounds,screensaver:{enabled:false,minutes:5}},assetVersion:'test-version',commands:[]};
 else if(path==='/api/panel/state')data={areas:[{area_id:'living',name:'Wohnzimmer'}],entities:[{entityId:'media_player.pod',domain:'media_player',areaId:'living',name:'HomePod',state:'playing',artwork:'data:image/png;base64,'+png,attributes:{media_title:'Ein Titel',volume_level:.2}}],inbox:[],roomReadings:{}};
 else if(path==='/api/dashboard')data={cameras:[],weather:{},energy:{summary:{}}};else if(path==='/api/tablets')data={tablets:[]};
 await route.fulfill({json:data});});
 await p.goto('http://127.0.0.1:3000/panel/');await p.locator('[data-action="startup-confirm"]').waitFor();assert.match(await p.getByRole('dialog').innerText(),/Neue Version/);assert.match(await p.getByRole('dialog').innerText(),/Version/);assert.equal(await p.locator('.dialog-close').isVisible(),false);
 await p.keyboard.press('Escape');assert.equal(await p.getByRole('dialog').count(),1);await p.locator('.dialog-backdrop').click({position:{x:2,y:2}});assert.equal(await p.getByRole('dialog').count(),1);
 await p.locator('[data-action="startup-confirm"]').click();assert.equal(await p.locator('[data-action="startup-confirm"]').isDisabled(),true);await p.waitForTimeout(120);assert.equal(await p.getByRole('dialog').count(),1,'undefined play return must not confirm audio');
 await p.evaluate(()=>activationAudio.dispatchEvent(new Event('error')));await p.getByRole('button',{name:'Ton erneut aktivieren',exact:true}).waitFor();assert.equal(await p.locator('#startupSkipAudio').isVisible(),true);await p.locator('[data-action="startup-confirm"]').click();await p.evaluate(()=>activationAudio.dispatchEvent(new Event('playing')));await p.getByRole('dialog').waitFor({state:'detached'});
 assert.deepEqual(await p.locator('#mainNav > *').allTextContents(),['Home','Wohnzimmer','Räume','Apps']);assert.equal(await p.locator('.topbar #settingsNav').count(),0);assert.equal(await p.locator('#panelSound').textContent(),'');assert.equal(await p.locator('#panelSound svg').count(),1);assert.equal(await p.locator('#panelSound').getAttribute('aria-label'),'Ton bereit');
 await p.locator('#mainNav').getByRole('button',{name:'Wohnzimmer',exact:true}).click();await p.locator('.music-artwork-background canvas').waitFor();assert.equal(await p.locator('.music-artwork-background img').count(),0);assert.equal(await p.locator('.music-artwork-background canvas').getAttribute('width'),'12');
 await p.getByRole('button',{name:'Apps',exact:true}).click();await p.locator('#settingsNav').click();await p.locator('#pinDots').waitFor();await p.getByRole('button',{name:'Schließen',exact:true}).click();assert.equal(await p.getByRole('dialog').count(),0);
 sounds=false;await p.reload();await p.locator('[data-action="startup-confirm"]').waitFor();assert.equal(await p.locator('[data-action="startup-confirm"]').textContent(),'Bestätigen');await p.locator('[data-action="startup-confirm"]').click();await p.getByRole('dialog').waitFor({state:'detached'});assert.equal(await p.evaluate(()=>playCount),0);
 await p.screenshot({path:'data/mockup-preview/apps-ipad-'+name+'.png'});assert.deepEqual(errors,[]);console.log(name+': Startbestätigung ohne Wegklicken, alter Audiostart/Fehler/Wiederholung, stummes Profil, Apps und iOS-9-Cover geprüft.');await context.close();
 }finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
