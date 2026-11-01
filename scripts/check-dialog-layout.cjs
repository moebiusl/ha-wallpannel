const {confirmPanelStartup,openPanelSettings}=require('./panel-test-helpers.cjs');
/* Popup overflow audit. Every API is mocked; no actual HA writes or live streams. */
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.WALLPANEL_PLAYWRIGHT_MODULE || 'playwright');
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
const metric=label=>({label,display:'12345,67 kWh',value:12});
const forecast={forecast:Array.from({length:7},(_,i)=>({weekday:'Tag '+(i+1),conditionLabel:'Überwiegend bewölkt mit Niederschlag',temperature:15,templow:7,precipitation:1}))};
const weather={forecast};for(const name of ['outdoorTemp','outdoorHumidity','dailyRain','rainRate','monthlyRain','yearlyRain','pressure','pressureChange3h','barometerForecast','windSpeed','windDirection','uvIndex'])weather[name]=metric(name);
const energy={summary:{consumptionDisplay:'12345 W',solarPowerDisplay:'345 W'},powerstream:{},delta2:{},grid:{}};for(const group of ['powerstream','delta2','grid'])for(const name of ['batteryCharge','solarPower','inverterOutputWatts','batteryInputWatts','chargeTime','dischargeTime','fromBatteryToday','toBatteryToday','pv1Today','pv2Today','status','smartPlugLoads','otherLoads','batteryStatus','batteryTemperature','inverterTemperature','power','feedIn','consumption','feedInTotal','totalInPower','totalOutPower','solarInPower','acInPower','acOutPower','remainingTime','cycles'])energy[group][name]=metric('Längerer Messwert '+name);
(async()=>{for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch();try{
  const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{const req=route.request(),path=new URL(req.url()).pathname;let data={ok:true};
   if(req.method()!=='GET'&&path!=='/api/tablet/sync'&&path!=='/api/tablets/doorbell-close')throw Error('Unexpected write '+path);
   if(path==='/api/tablet/sync')data={config:{name:'Test-iPad',room:'living',rooms:['living'],sounds:false,screensaver:{enabled:false}},commands:[],assetVersion:'test'};
   else if(path==='/api/panel/state')data={revision:'test',areas:[{area_id:'living',name:'Wohnzimmer'},{area_id:'kitchen',name:'Küche'}],entities:[{entityId:'light.rgb',name:'Stehlampe',domain:'light',areaId:'living',state:'on',attributes:{brightness:128,supported_color_modes:['hs']}},{entityId:'light.binary',name:'Küchenlicht',domain:'light',areaId:'kitchen',state:'off',attributes:{supported_color_modes:['onoff']}},{entityId:'media_player.pod',name:'HomePod',domain:'media_player',areaId:'living',state:'paused',attributes:{volume_level:.3}},{entityId:'scene.cozy',name:'Gemütlich',domain:'scene',areaId:'living',state:'2026-10-29T10:00:00Z',attributes:{}},{entityId:'sensor.battery',name:'Batterie eines Thermostats mit einem langen Gerätenamen',domain:'sensor',deviceClass:'battery',areaId:'living',state:'12',attributes:{unit_of_measurement:'%'}}]};
   else if(path==='/api/dashboard')data={weather:{stateLabel:'Wolkig',temperature:12,forecast:forecast.forecast},energy,torStatus:'closed',torVisualText:'Zu',cameras:[{entity_id:'image.event',name:'Einfahrt',state:'idle',imageUrl:'/api/camera-image/image.event',streamUrl:'/api/camera-stream/camera.front'}]};
   else if(path==='/api/energy')data=energy;
   else if(path==='/api/wetterstation')data=weather;
   else if(path==='/api/wassertank')data={fillLevelPercent:65,liter:metric('Inhalt'),height:metric('Wasserhöhe'),led:{entity_id:'light.binary',state:'on',brightness:128}};
   else if(path==='/api/radar')data={frames:[{time:'2026-10-29T10:00:00Z',forecast:false}],home:{x:.4,y:.6},series:[]};
   else if(path==='/api/tablets')data={tablets:[]};
   else if(path==='/api/tablets/directory')data={tablets:[],presets:[]};
   else if(/^\/api\/light-presets\//.test(path))data={ok:true,presets:[]};
   else if(path==='/api/tablets/doorbell-close')data={ok:true};
   else if(/\/api\/(camera-|radar\/)/.test(path))return route.fulfill({contentType:'image/png',body:image});
   else throw Error('Unexpected API '+path);
   return route.fulfill({json:data});
  });
  await page.goto('http://127.0.0.1:3000/panel/');await confirmPanelStartup(page);await page.waitForFunction(()=>window.WallpanelMockup&&WallpanelMockup.model.lights.length===2);
  const kinds=['weather','energy','gate','rooms','light','binary','music','announcement','assist','pin','tablet','notice','doorbell'];
  for(const size of [{width:1024,height:768},{width:1024,height:600},{width:800,height:600},{width:768,height:1024},{width:640,height:480}]){
   await page.setViewportSize(size);
   for(const view of ['home','room','scenes','cameras','settings']){await page.evaluate(view=>{WallpanelMockup.closeDialog();WallpanelMockup.state.settingsUnlockedUntil=Date.now()+60000;WallpanelMockup.state.roomId='living';WallpanelMockup.go(view);},view);assert.equal(await page.locator('#content').evaluate(n=>n.scrollWidth>n.clientWidth+1),false,name+' page '+view+' '+JSON.stringify(size));}await page.evaluate(()=>WallpanelMockup.go('home'));
   for(const kind of kinds){
    await page.evaluate(kind=>{const ui=WallpanelMockup;ui.closeDialog();ui.state.roomId='living';if(kind==='weather')ui.go('weather');else if(kind==='energy'||kind==='gate'||kind==='rooms'||kind==='announcement'||kind==='assist'){const action={energy:'energy',gate:'gate-request',rooms:'rooms',announcement:'announce',assist:'assist'}[kind];document.querySelector('[data-action="'+action+'"]').click();}else if(kind==='light'||kind==='binary')ui.openLight(kind==='light'?'light.rgb':'light.binary');else if(kind==='music')ui.openMusic('media_player.pod');else if(kind==='pin')ui.openSettingsPin();else if(kind==='tablet')ui.openDialog('Tablet bearbeiten','<form id="tabletSettings" data-tablet-id="this">'+ui.tabletFields(ui.model.tablets[0])+'</form>','tablet');else if(kind==='notice')ui.openDialog('Durchsage','<div class="incoming-notice"><p class="incoming-message">'+Array(40).join('Eine längere Durchsage mit allen wichtigen Informationen. ')+'</p></div>','notice');else if(kind==='doorbell')ui.receiveDoorbell();},kind);
    await page.getByRole('dialog').waitFor();
    if(kind==='weather'){await page.locator('#detailWeather .detail-section').first().waitFor();await page.locator('#detailForecast article').first().waitFor();assert.equal(await page.locator('#detailForecast article').count(),7);}
    if(kind==='energy')await page.locator('#detailEnergy .detail-section').first().waitFor();
    const report=await page.getByRole('dialog').evaluate(dialog=>{const body=dialog.querySelector('.dialog-body');body.scrollLeft=100;body.scrollTop=body.scrollHeight;const close=dialog.querySelector('.dialog-close').getBoundingClientRect();return{dialogOverflow:dialog.scrollWidth-dialog.clientWidth,bodyOverflow:body.scrollWidth-body.clientWidth,scrollLeft:body.scrollLeft,closeVisible:close.top>=0&&close.bottom<=innerHeight};});
    assert.ok(report.dialogOverflow<=1&&report.bodyOverflow<=1&&report.scrollLeft===0,name+' '+kind+' '+JSON.stringify({size,report}));assert.equal(report.closeVisible,true,name+' close '+kind);
    if(size.width===1024&&size.height===768&&(kind==='weather'||kind==='energy'))await page.screenshot({path:'data/mockup-preview/'+name+'-'+kind+'-no-horizontal.png'});
    await page.getByRole('button',{name:'Schließen',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
   }
  }
  assert.deepEqual(errors,[]);console.log(name+': 13 Popup-Arten in fünf Auflösungen ohne horizontales Scrollen; Schließen bleibt erreichbar.');
 }finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
