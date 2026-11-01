/* Rendering regression benchmark. All API requests use synthetic fixtures. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require(process.env.WALLPANEL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{for(const [name,engine] of Object.entries({chromium,webkit})){
 const b=await engine.launch();try{
 const p=await b.newPage({viewport:{width:1024,height:768}});let noise=0,energy='200 W',requests=0;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
 await p.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){setTimeout(()=>this.dispatchEvent(new Event('playing')),0);return undefined;};});
 await p.route('**/api/**',async route=>{requests++;const req=route.request(),path=new URL(req.url()).pathname;let data={ok:true};
 if(path==='/api/tablet/sync')data={ok:true,config:{name:'Benchmark',room:'living',rooms:['living'],sounds:false,screensaver:{enabled:false,minutes:5}},assetVersion:'bench',commands:[]};
 else if(path==='/api/tablets')data={tablets:[]};
 else if(path==='/api/panel/state')data={areas:[{area_id:'living',name:'Wohnzimmer'}],entities:Array.from({length:200},(_,i)=>({entityId:'sensor.noise_'+i,domain:'sensor',areaId:'other',name:'Sensor '+i,state:String(noise+i),attributes:{}})),inbox:[],roomReadings:{}};
 else if(path==='/api/dashboard')data={weather:{temperature:12,stateLabel:'Wolkig'},energy:{summary:{consumptionDisplay:energy,solarPowerDisplay:'350 W'}},cameras:[{entity_id:'image.event',name:'Einfahrt',state:'on',imageUrl:'/api/camera-image/image.event',eventTimestamp:'2026-11-01T12:00:00Z'}]};
 else if(path.includes('camera-image')){await route.fulfill({contentType:'image/png',body:png});return;}
 await route.fulfill({json:data});});
 await p.goto('http://127.0.0.1:3000/panel/');await p.waitForFunction(()=>window.WallpanelMockup&&WallpanelMockup.model.tablets[0].name==='Benchmark');
 if(await p.locator('[data-action="startup-confirm"]').count())await p.locator('[data-action="startup-confirm"]').click();
 await p.waitForTimeout(100);
 await p.evaluate(()=>{window.perfReplacements=0;window.perfCamera=document.querySelector('.home-camera img');new MutationObserver(ms=>{ms.forEach(m=>{if(m.target===document.getElementById('content'))window.perfReplacements++;});}).observe(document.getElementById('content'),{childList:true});});
 for(let i=0;i<8;i++){noise++;await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(80);}
 const unrelated=await p.evaluate(()=>window.perfReplacements);
 energy='275 W';await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForFunction(()=>document.querySelector('#content').textContent.indexOf('275 W')>=0);
 const result=await p.evaluate(()=>({unrelatedRedraws:window.perfReplacements-1,cameraRetained:window.perfCamera===document.querySelector('.home-camera img')}));result.unrelatedRedraws=unrelated;result.requests=requests;console.log(name+': '+JSON.stringify(result));
 if(!process.env.WALLPANEL_PERF_BASELINE){assert.equal(unrelated,0,'Unrelated HA sensor changes must not rebuild active view');assert.equal(result.cameraRetained,true,'Energy update must preserve the decoded camera image');}
 fs.writeFileSync('data/mockup-preview/performance-'+name+(process.env.WALLPANEL_PERF_BASELINE?'-before':'-after')+'.json',JSON.stringify(result));
 }finally{await b.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
