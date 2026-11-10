const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {numberedBaseName,planLightGroups,applyLightGroups,createLightGroupStore,isLightGroupId}=require('../src/light-groups');
const lights=[
 {entityId:'light.esstisch_4',name:'Esstisch 4',areaId:'kueche'},
 {entityId:'light.esstisch_5',name:'Esstisch 5',areaId:'kueche'},
 {entityId:'light.esstisch_1',name:'Esstisch 1',areaId:'wohnzimmer'},
 {entityId:'light.spuele',name:'Spüle',areaId:'kueche'},
 {entityId:'light.decke',name:'Decke',areaId:'wohnzimmer'}
];
const base={autoGroup:true,groups:[],ungrouped:[]};

test('Lampengruppen: Basisname nur bei angehängter Nummer',()=>{
 assert.equal(numberedBaseName('Esstisch 4'),'Esstisch');
 assert.equal(numberedBaseName('  Spot Flur 12 '),'Spot Flur');
 assert.equal(numberedBaseName('Esstisch'),null);
 assert.equal(numberedBaseName('4'),null);
 assert.equal(numberedBaseName('Lampe 2024'),null);
});

test('Lampengruppen: durchnummerierte Lampen desselben Raums werden zusammengefasst',()=>{
 const groups=planLightGroups(lights,base);
 assert.equal(groups.length,1);
 assert.deepEqual(groups[0],{id:'group:auto:kueche:esstisch',name:'Esstisch',room:'kueche',members:['light.esstisch_4','light.esstisch_5'],auto:true});
 assert.ok(isLightGroupId(groups[0].id));
 assert.equal(planLightGroups(lights,{...base,autoGroup:false}).length,0);
 assert.equal(planLightGroups(lights,{...base,ungrouped:['group:auto:kueche:esstisch']}).length,0);
});

test('Lampengruppen: manuelle Gruppe hat Vorrang, Lampen sind nie doppelt',()=>{
 const groups=planLightGroups(lights,{...base,groups:[{id:'group:abc',name:'Küche',room:'kueche',members:['light.esstisch_4','light.spuele','light.weg']}]});
 assert.deepEqual(groups.map(g=>[g.id,g.members]),[['group:abc',['light.esstisch_4','light.spuele']]]);
});

test('Lampengruppen: Panel zeigt eine Gruppen-Lampe statt der Einzellampen',()=>{
 const entity=(id,name,state,attributes={})=>({entityId:id,name,domain:'light',areaId:'kueche',state,attributes,platform:'hue'});
 const list=[entity('light.esstisch_4','Esstisch 4','on',{brightness:100,supported_color_modes:['color_temp'],color_temp_kelvin:2700}),entity('light.esstisch_5','Esstisch 5','on',{brightness:200,supported_color_modes:['brightness']}),entity('light.spuele','Spüle','off'),{entityId:'climate.x',domain:'climate',name:'Heizung',state:'heat',attributes:{}}];
 const out=applyLightGroups(list,planLightGroups(list,base));
 assert.deepEqual(out.map(e=>e.entityId),['light.spuele','climate.x','group:auto:kueche:esstisch']);
 const group=out[2];
 assert.equal(group.name,'Esstisch');assert.equal(group.state,'on');assert.equal(group.attributes.brightness,150);
 assert.deepEqual(group.attributes.supported_color_modes.sort(),['brightness','color_temp']);assert.equal(group.attributes.color_temp_kelvin,2700);
 assert.equal(group.group.auto,true);assert.deepEqual(group.group.members.map(m=>m.name),['Esstisch 4','Esstisch 5']);
 const off=applyLightGroups(list.map(e=>e.domain==='light'?{...e,state:'unavailable'}:e),planLightGroups(list,base));
 assert.equal(off.find(e=>e.entityId.startsWith('group:')).state,'unavailable');
});

test('Lampengruppen: Speicher bildet, benennt um und löst auf',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'groups-'));const file=path.join(dir,'light-groups.json');
 try{
  const known=new Set(lights.map(l=>l.entityId));
  let store=createLightGroupStore(file);
  assert.throws(()=>store.save({name:'X',room:'kueche',members:['light.spuele']},known),/mindestens zwei/);
  assert.throws(()=>store.save({name:'X',room:'kueche',members:['light.spuele','light.fremd']},known),/Unbekannte/);
  assert.throws(()=>store.save({name:' ',room:'kueche',members:['light.spuele','light.decke']},known),/Namen/);
  // Umbenennen einer automatischen Gruppe: wird manuell, die automatische bleibt aus
  const renamed=store.save({name:'Großer Tisch',room:'kueche',members:['light.esstisch_4','light.esstisch_5'],replaces:'group:auto:kueche:esstisch'},known);
  assert.match(renamed.id,/^group:[a-f0-9]{12}$/);
  store=createLightGroupStore(file);
  assert.deepEqual(planLightGroups(lights,store.get()).map(g=>g.name),['Großer Tisch']);
  store.remove(renamed.id);store.remove('group:auto:kueche:esstisch');
  assert.equal(planLightGroups(lights,createLightGroupStore(file).get()).length,0);
  store.setAutoGroup(true);
  assert.deepEqual(planLightGroups(lights,createLightGroupStore(file).get()).map(g=>g.name),['Esstisch']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
