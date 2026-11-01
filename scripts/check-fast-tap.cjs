/* Touch taps act on touchend exactly once; swipes and holds do not tap. All HA writes are mocked. */
const assert=require('node:assert/strict');const {chromium,webkit}=require(process.env.WALLPANEL_PLAYWRIGHT_MODULE||'playwright');const {confirmPanelStartup}=require('./panel-test-helpers.cjs');
(async()=>{for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch();try{
 const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true}),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
 const state={areas:[{area_id:'living',name:'Wohnzimmer'}],entities:[{entityId:'light.one',domain:'light',name:'Klavier',areaId:'living',state:'off',attributes:{supported_color_modes:['brightness']}}],inbox:[]};
 await page.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname,body=req.method()==='POST'?req.postDataJSON():null;let data={ok:true};if(body&&path!=='/api/tablet/sync')writes.push({path,body});
 if(path==='/api/tablet/sync')data={ok:true,config:{name:'Touch-iPad',room:'living',rooms:['living'],sounds:false,screensaver:{enabled:false,minutes:5}},commands:[],assetVersion:'test'};
 else if(path==='/api/panel/state')data=state;else if(path==='/api/dashboard')data={cameras:[],weather:{},energy:{summary:{}}};else if(path==='/api/tablets')data={tablets:[]};
 else if(path==='/api/settings/session')data={ok:true,unlocked:false};else if(path==='/api/settings/unlock'){await route.fulfill({status:403,json:{ok:false,error:'PIN stimmt nicht'}});return;}
 else if(path==='/api/light-presets/light.one')data={ok:true,presets:[]};
 else if(path==='/api/entity/light.one/service')state.entities[0].state=body.service==='turn_off'?'off':'on';
 await route.fulfill({json:data});});
 await page.goto('http://127.0.0.1:3000/panel/');await confirmPanelStartup(page);
 await page.evaluate(()=>{window.clicks=0;document.addEventListener('click',()=>window.clicks++,true);});
 await page.evaluate(()=>WallpanelMockup.go('settings'));await page.locator('#pinDots').waitFor();
 for(const d of ['1','3','1','0']){await page.locator('.pin-key[data-id="'+d+'"]').tap();}
 await page.waitForFunction(()=>document.getElementById('pinStatus').textContent.length>0);
 const unlocks=writes.filter(w=>w.path==='/api/settings/unlock');assert.equal(unlocks.length,1,JSON.stringify(writes));assert.equal(unlocks[0].body.pin,'1310');
 assert.equal(await page.evaluate(()=>window.clicks),0,'touchend must suppress the synthesized click');
 await page.locator('.dialog-close').tap();await page.waitForFunction(()=>!WallpanelMockup.state.dialog);
 await page.locator('#mainNav').getByRole('button',{name:'Wohnzimmer',exact:true}).tap();await page.locator('.home-light-card').waitFor();
 writes.length=0;await page.locator('.home-light-card').tap();await page.waitForTimeout(300);
 assert.equal(writes.filter(w=>w.path==='/api/entity/light.one/service').length,1,JSON.stringify(writes));
 if(name==='chromium'){
  const cdp=await page.context().newCDPSession(page),box=await page.locator('.home-light-card').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  const touch=(type,px,py)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:px,y:py}]});
  await page.waitForFunction(()=>!document.querySelector('.home-light-card[aria-busy=true]'),null,{timeout:10000});writes.length=0;await touch('touchStart',x,y);await touch('touchMove',x,y+40);await touch('touchEnd');await page.waitForTimeout(300);
  assert.equal(writes.length,0,'swipe must not tap '+JSON.stringify(writes));
  await touch('touchStart',x,y);await page.waitForTimeout(800);await touch('touchEnd');await page.waitForTimeout(300);
  assert.equal(writes.filter(w=>w.path==='/api/entity/light.one/service').length,0,'hold must not toggle');assert.equal(await page.evaluate(()=>WallpanelMockup.state.dialog&&WallpanelMockup.state.dialog.type),'light');
 }
 assert.deepEqual(errors,[]);console.log(name+': PIN-Ziffern einmalig per touchend, kein Folgeklick, Lichttipp einmalig'+(name==='chromium'?', Wischen und Halten ohne Schaltbefehl':'')+' geprüft.');
 }finally{await browser.close();}}})().catch(e=>{console.error(e);process.exit(1);});
