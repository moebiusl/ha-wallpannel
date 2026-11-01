const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function app(entities=[],payload={energy:{},devices:[]}){
 const sandbox={window:{},document:{hidden:false},Date};vm.runInNewContext(fs.readFileSync('public/panel/apps.js','utf8'),sandbox);
 const ui={state:{view:'energy'},esc:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),icon:()=>'<svg></svg>'};
 const calls=[];const view=sandbox.window.createWallpanelApps({ui,entities:()=>entities,cameras:()=>[],cameraImage:()=>'',request:(method,url,body,cb)=>{calls.push(url);cb(null,payload);},changed:()=>{},refreshSecurity:()=>{}});
 return {ui,view,calls,sandbox};
}
test('Sicherheits-App zeigt unbekannte Sensoren nicht als geschlossene Türen oder inaktive Melder',()=>{
 const {view}=app([{entityId:'binary_sensor.door',name:'Haustür',domain:'binary_sensor',deviceClass:'door',state:'unknown'},{entityId:'binary_sensor.motion',name:'Flur',domain:'binary_sensor',deviceClass:'motion',state:'on'},{entityId:'binary_sensor.window',name:'Fenster',domain:'binary_sensor',deviceClass:'window',state:'off'}]);
 const html=view.view('security');assert.match(html,/Haustür[\s\S]*?Zustand unbekannt/);assert.match(html,/Fenster[\s\S]*?Geschlossen/);assert.match(html,/Bewegung \/ Anwesenheit/);assert.doesNotMatch(html,/data-action="(?:light|socket|climate)/);
});
test('Energie-App bündelt Batterie nach Gerät und behandelt unbekannte Füllstände ehrlich',()=>{
 const {view}=app([],{energy:{summary:{solarPowerDisplay:'unavailable'}},devices:[{entityId:'sensor.bat',deviceId:'dev',deviceName:'Türkontakt',deviceClass:'battery',domain:'sensor',state:'15'},{entityId:'binary_sensor.bat',deviceId:'dev',deviceName:'Türkontakt',deviceClass:'battery',domain:'binary_sensor',state:'on'},{entityId:'sensor.unknown',deviceClass:'battery',name:'Unbekannter Akku',domain:'sensor',state:'unavailable'}]});
 view.tick();const html=view.view('energy');assert.equal((html.match(/Türkontakt/g)||[]).length,1);assert.match(html,/15 %/);assert.match(html,/Unbekannter Akku[\s\S]*?Unbekannt/);assert.doesNotMatch(html,/unavailable/);assert.doesNotMatch(html,/>0 %</);
});
test('Energie-App fragt nur bei sichtbarer Energie-Seite ab und begrenzt Wiederholungen',()=>{
 const {view,ui,calls,sandbox}=app();ui.state.view='security';view.tick();assert.equal(calls.length,0);ui.state.view='energy';sandbox.document.hidden=true;view.tick();assert.equal(calls.length,0);sandbox.document.hidden=false;view.tick();view.tick();assert.equal(calls.length,1);assert.equal(calls[0],'/api/panel/energy');
});
test('Energie-Messgeräte zeigen Einheiten und maskieren Gerätebezeichnungen',()=>{
 const {view}=app([],{energy:{summary:{}},devices:[{entityId:'sensor.power',domain:'sensor',deviceClass:'power',name:'<img onerror="bad">',state:'12.5',attributes:{unit_of_measurement:'W'}}]});view.tick();const html=view.view('energy');assert.match(html,/12,5 W/);assert.doesNotMatch(html,/<img onerror=/);assert.match(html,/&lt;img/);
});
