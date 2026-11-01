const { test } = require('node:test');
const assert = require('node:assert/strict');
const { discoverHaEntities, discoverHaCameras, resolveHaRoom, selectHaRoomEntities } = require('../src/ha-discovery');
function fixture(){return {
 states:[{entity_id:'light.initial',state:'off',attributes:{friendly_name:'Deckenlicht'}}],
 registries:{areas:[{area_id:'living',name:'Wohnzimmer'},{area_id:'kitchen',name:'Küche'}],floors:[],devices:[{id:'device1',area_id:'living'}],entities:[{entity_id:'light.initial',device_id:'device1'}]}
};}
test('Neue und entfernte HA-Lampen ändern die Raumansicht ohne Geräteliste im Panel',()=>{
 const f=fixture();const page={areaId:'living'};
 const current=()=>selectHaRoomEntities(discoverHaEntities(f.states,f.registries),page);
 assert.equal(current().length,1);
 f.states.push({entity_id:'light.new',state:'on'});f.registries.entities.push({entity_id:'light.new',device_id:'device1'});
 assert.equal(current().length,2);
 f.states=f.states.filter(e=>e.entity_id!=='light.initial');f.registries.entities=f.registries.entities.filter(e=>e.entity_id!=='light.initial');
 assert.deepEqual(current().map(e=>e.entityId),['light.new']);
});
test('Namen und Raumwechsel folgen HA; die Raumzuordnung der Entität hat Vorrang',()=>{
 const f=fixture();f.states[0].attributes.friendly_name='Leselicht';f.registries.areas[0].name='Wohnen';
 let e=discoverHaEntities(f.states,f.registries)[0];assert.equal(e.name,'Leselicht');assert.equal(e.areaName,'Wohnen');
 f.registries.devices[0].area_id='kitchen';e=discoverHaEntities(f.states,f.registries)[0];assert.equal(e.areaId,'kitchen');
 f.registries.entities[0].area_id='living';assert.equal(discoverHaEntities(f.states,f.registries)[0].areaId,'living');
});
test('HA-Ausblenden und deaktivierte Geräte können durch eine alte Panelauswahl nicht überstimmt werden',()=>{
 for(const change of ['hidden_by','disabled_by','device_disabled']){
  const f=fixture();if(change==='device_disabled')f.registries.devices[0].disabled_by='user';else f.registries.entities[0][change]='user';
  const e=discoverHaEntities(f.states,f.registries);assert.equal(e[0].visibleByDefault,false);
  assert.deepEqual(selectHaRoomEntities(e,{areaId:'living',enabledEntities:['light.initial']}),[]);
 }
});
test('Offline ist keine Löschung, Umbenennen der Entity-ID erfordert keine Panelanpassung',()=>{
 const f=fixture();f.states[0].state='unavailable';assert.equal(selectHaRoomEntities(discoverHaEntities(f.states,f.registries),{areaId:'living'}).length,1);
 f.states[0].entity_id='light.renamed';f.registries.entities[0].entity_id='light.renamed';
 assert.equal(selectHaRoomEntities(discoverHaEntities(f.states,f.registries),{areaId:'living'})[0].entityId,'light.renamed');
});
test('Gerätenamen werden nicht als technische Konfiguration interpretiert',()=>{
 const f=fixture();f.states[0].entity_id='light.firmware_werkstatt';f.registries.entities[0].entity_id='light.firmware_werkstatt';
 assert.equal(discoverHaEntities(f.states,f.registries)[0].visibleByDefault,true);
 f.registries.entities[0].entity_category='config';assert.equal(discoverHaEntities(f.states,f.registries)[0].visibleByDefault,false);
});
test('Raumtitel folgen HA und gelöschte Räume haben keinen fremden Ersatzraum',()=>{
 assert.deepEqual(resolveHaRoom([{area_id:'living',name:'Wohnen'}],'living',{title:'Alter Name'}),{areaId:'living',title:'Wohnen',available:true});
 const removed=resolveHaRoom([{area_id:'kitchen',name:'Küche'}],'living',{title:'Wohnzimmer'});
 assert.equal(removed.available,false);assert.equal(removed.areaId,'living');
});
test('Kameras und ihre Bilder werden nur anhand eindeutiger HA-Gerätebeziehungen verbunden',()=>{
 const f=fixture();f.states=[{entity_id:'camera.new',state:'idle',attributes:{friendly_name:'Neue Kamera'}},{entity_id:'image.snapshot',state:'2026-10-29'}];
 f.registries.entities=[{entity_id:'camera.new',device_id:'device1'},{entity_id:'image.snapshot',device_id:'device1'}];
 let cams=discoverHaCameras(f.states,f.registries);assert.equal(cams.length,1);assert.equal(cams[0].name,'Neue Kamera');assert.equal(cams[0].eventImageEntityId,'image.snapshot');
 f.states.push({entity_id:'image.another',state:'2026-10-29'});f.registries.entities.push({entity_id:'image.another',device_id:'device1'});
 assert.equal(discoverHaCameras(f.states,f.registries)[0].eventImageEntityId,'camera.new');
 f.registries.entities[0].hidden_by='user';assert.deepEqual(discoverHaCameras(f.states,f.registries),[]);
});

test('Räume mit führendem # sind auch bei expliziter Auswahl ausgeblendet',()=>{
 const f=fixture();f.registries.areas[0].name='  #Technik';
 const entity=discoverHaEntities(f.states,f.registries)[0];
 assert.equal(entity.haHidden,true);assert.equal(entity.visibleByDefault,false);
 assert.deepEqual(selectHaRoomEntities([entity],{areaId:'living',enabledEntities:['light.initial']}),[]);
 assert.equal(resolveHaRoom(f.registries.areas,'living',undefined).available,false);
});
test('DWD-Karten und nicht erreichbare Kameras erscheinen nicht in der Kameraliste',()=>{
 const f=fixture();f.states=[
  {entity_id:'camera.hof',state:'idle'},
  {entity_id:'camera.offline',state:'unavailable'},
  {entity_id:'camera.unknown',state:'unknown'},
  {entity_id:'camera.dwd_weather_maps_precipitation',state:'Radar'},
  {entity_id:'camera.renamed_weather',state:'idle'}
 ];f.registries.entities=[
  {entity_id:'camera.hof',device_id:'device1'},
  {entity_id:'camera.offline',device_id:'other'},
  {entity_id:'camera.unknown',device_id:'third'},
  {entity_id:'camera.dwd_weather_maps_precipitation',platform:'dwd_weather'},
  {entity_id:'camera.renamed_weather',platform:'dwd_weather'}
 ];
 assert.deepEqual(discoverHaCameras(f.states,f.registries).map(e=>e.haCameraEntityId),['camera.hof']);
 f.states.push({entity_id:'binary_sensor.connectivity',state:'off',attributes:{device_class:'connectivity'}});
 f.registries.entities.push({entity_id:'binary_sensor.connectivity',device_id:'device1'});
 assert.deepEqual(discoverHaCameras(f.states,f.registries),[]);
});
