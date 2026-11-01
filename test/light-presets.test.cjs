const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createLightPresets,validateLightColor}=require('../src/light-presets');const {validateEntityService}=require('../src/entity-service');
const attrs={supported_color_modes:['hs','color_temp'],min_color_temp_kelvin:2200,max_color_temp_kelvin:6000};
test('Farben und Weißtemperatur: gültige Werte, einzelne Farbmodi und echte Lampenfähigkeiten',()=>{
 assert.deepEqual(validateEntityService('light.test','turn_on',{rgb_color:[1,2,255],entity_id:'light.foreign'}),{rgb_color:[1,2,255]});
 assert.throws(()=>validateEntityService('light.test','turn_on',{rgb_color:[-1,2,3]}));assert.throws(()=>validateEntityService('light.test','turn_on',{rgb_color:[1.2,2,3]}));assert.throws(()=>validateEntityService('light.test','turn_on',{hs_color:[20,50],color_temp_kelvin:2700}));
 assert.doesNotThrow(()=>validateLightColor({color_temp_kelvin:2700},attrs));assert.throws(()=>validateLightColor({color_temp_kelvin:6500},attrs));assert.throws(()=>validateLightColor({rgb_color:[1,2,3]},{supported_color_modes:['brightness']}));
});
test('Farb-Vorauswahlen bleiben pro Lampe dauerhaft und können einschließlich Standardfarben gelöscht werden',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'panel-colors-'));try{
 const file=path.join(dir,'colors.json');let store=createLightPresets(file);const defaults=store.list('light.test',attrs);assert.equal(defaults[0].value,2700);
 const list=store.change('light.test',{type:'save',preset:{name:'Abends',action:'color',value:[30,40,240]}},attrs);assert.equal(list.length,defaults.length+1);store=createLightPresets(file);assert.equal(store.list('light.test',attrs).at(-1).name,'Abends');assert.equal(store.list('light.other',attrs).length,defaults.length);
 assert.throws(()=>store.change('light.test',{type:'save',preset:{action:'color_temp',value:7000}},attrs));
 for(const p of store.list('light.test',attrs))store.change('light.test',{type:'remove',presetId:p.id},attrs);
 assert.deepEqual(createLightPresets(file).list('light.test',attrs),[]);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
