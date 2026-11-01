const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createPanelFeatures,planClimateSync,roomReadings}=require('../src/panel-features');
function entity(id,extras={}){return {entityId:id,name:id,domain:id.split('.')[0],state:'on',areaId:'living',haHidden:false,visibleByDefault:true,attributes:{},...extras};}
function climate(id,extras={}){return entity(id,{domain:'climate',state:'heat',attributes:{hvac_modes:['off','heat'],temperature:21,min_temp:5,max_temp:30,target_temp_step:.5},...extras});}
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'panel-features-'));try{return fn(path.join(dir,'state.json'));}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('Heizungen: nur gleicher sichtbarer Raum, Offline-Ziele überspringen, Aus bewahrt Temperatur',()=>{
 const entities=[climate('climate.source'),climate('climate.target'),climate('climate.other',{areaId:'other'}),climate('climate.hidden',{haHidden:true}),climate('climate.offline',{state:'unavailable'})];
 assert.deepEqual(planClimateSync(entities,'climate.source'),{plans:[{id:'climate.target',mode:'heat',temperature:21}],skipped:['climate.offline']});
 entities[0].state='off';entities[0].attributes.temperature=undefined;assert.equal(planClimateSync(entities,'climate.source').plans[0].temperature,undefined);
 assert.throws(()=>planClimateSync(entities,'light.invalid'));
});
test('Heizungen: ungültiges Ziel verhindert den gesamten Plan vor Schreibzugriff',()=>{
 const list=[climate('climate.source'),climate('climate.good'),climate('climate.bad',{attributes:{hvac_modes:['off'],min_temp:5,max_temp:30,target_temp_step:.5}})];assert.throws(()=>planClimateSync(list,'climate.source'),/Betriebsart/);
 list[2].attributes.hvac_modes=['off','heat'];list[2].attributes.target_temp_step=2;assert.equal(planClimateSync(list,'climate.source').plans.length,2);
 list[0].attributes.temperature=21.5;assert.throws(()=>planClimateSync(list,'climate.source'),/Schrittweite/);
 list[0].attributes.temperature=35;assert.throws(()=>planClimateSync(list,'climate.source'),/Bereich/);
});
test('Batteriehinweise pro HA-Gerät, unbekannte Werte sind keine Erholung',()=>fixture(file=>{
 const store=createPanelFeatures(file),a=entity('sensor.battery',{deviceId:'dev',deviceName:'Fenstersensor',domain:'sensor',deviceClass:'battery',state:'12'}),b=entity('binary_sensor.low',{deviceId:'dev',deviceName:'Fenstersensor',domain:'binary_sensor',deviceClass:'battery',state:'on'});
 store.observe([a,b]);assert.equal(store.list().length,1);assert.equal(store.list()[0].message,'Batterie 12 %');
 a.state='unavailable';b.state='unknown';store.observe([a,b]);assert.equal(store.list()[0].active,true);
 a.state='85';b.state='off';store.observe([a,b]);assert.equal(store.list()[0].active,false);
 a.state='9';store.observe([a,b]);assert.equal(store.list()[0].active,true);assert.equal(store.list()[0].done,false);
}));
test('Offline erst nach zehn Minuten fortlaufender Beobachtung, kurze Ausfälle bleiben still',()=>fixture(file=>{
 let now=1000000;const store=createPanelFeatures(file,()=>now),a=entity('light.one',{deviceId:'dev',state:'unavailable'});
 for(let i=0;i<40;i++){store.observe([a]);now+=15000;}assert.equal(store.list().length,0);store.observe([a]);assert.equal(store.list()[0].kind,'offline');
 a.state='on';store.observe([a]);assert.equal(store.list()[0].active,false);
 a.state='unavailable';now+=15000;store.observe([a]);now+=610000;store.observe([a]);assert.equal(store.list()[0].active,false,'HA-Verbindungsunterbrechung zählt nicht als gemessene Offlinezeit');
}));
test('Posteingang: Ausblenden und Erledigen geräteübergreifend dauerhaft, Wiederauftreten öffnet neu',()=>fixture(file=>{
 let store=createPanelFeatures(file);const a=entity('sensor.battery',{deviceId:'dev',deviceClass:'battery',state:'10'});store.observe([a]);const id=store.list()[0].id;
 store.action(id,'hide');store=createPanelFeatures(file);assert.equal(store.list()[0].hidden,true);store.observe([a]);assert.equal(store.list()[0].hidden,true);
 store.action(id,'done');store.observe([a]);assert.equal(store.list()[0].done,true);store.action(id,'show');assert.equal(store.list()[0].hidden,false);assert.equal(store.list()[0].done,false);
 store.action(id,'done');a.state='90';store.observe([a]);a.state='8';store.observe([a]);assert.equal(store.list()[0].done,false);assert.throws(()=>store.action(id,'delete-all'));
}));
test('Neustartaufträge überleben Serverneustart, wiederholen bis passende Boot-Quittierung, laufen ab',()=>fixture(file=>{
 let now=1000000,store=createPanelFeatures(file,()=>now);assert.equal(store.requestReload(['tablet1','tablet2']),2);const job=store.sync('tablet1',{});assert.match(job.id,/^[a-f0-9]{24}$/);
 store=createPanelFeatures(file,()=>now);assert.deepEqual(store.sync('tablet1',{ack:'falsch'}),job);assert.equal(store.sync('tablet1',{ack:job.id,version:'new',sound:'ready'}),null);assert.equal(store.status('tablet1').sound,'ready');assert.equal(store.status('tablet1').version,'new');assert.ok(store.sync('tablet2',{}));now+=86400001;assert.equal(store.sync('tablet2',{}),null);
}));
test('Raumklima: vorhandene Messwerte, Fahrenheit, fehlende/ungültige Werte und versteckte Räume',()=>{
 const sensors=[entity('sensor.temp',{state:'68',deviceClass:'temperature',attributes:{unit_of_measurement:'°F'}}),entity('sensor.humidity',{state:'45',deviceClass:'humidity',attributes:{unit_of_measurement:'%'}}),entity('sensor.invalid',{state:'unknown',deviceClass:'temperature',attributes:{unit_of_measurement:'°C'}}),entity('sensor.hidden',{state:'80',deviceClass:'humidity',haHidden:true,areaId:'hidden',attributes:{unit_of_measurement:'%'}})];
 assert.deepEqual(roomReadings(sensors),{living:{temperature:20,humidity:45}});sensors[1].state='150';assert.deepEqual(roomReadings(sensors),{living:{temperature:20}});
 assert.deepEqual(roomReadings([climate('climate.one',{attributes:{current_temperature:20,current_humidity:40}}),climate('climate.two',{attributes:{current_temperature:22,current_humidity:50}})]),{living:{temperature:21,humidity:45}});
});
