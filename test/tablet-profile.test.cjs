const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createTabletRegistry}=require('../src/tablets');
test('Tablet-Räume und Schnelllichter bleiben nach zentraler Änderung und Neustart erhalten',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wallpanel-profile-'));
 try{
  const file=path.join(dir,'tablets.json'),defaults={doorbellEntity:'',doorbellCamera:'',doorbellLights:[],doorbellSound:'gong',noticeSound:'ping',announcementPresets:[]};
  let registry=createTabletRegistry(file,defaults);
  registry.sync('tablet123456',{page:'panel/home',userAgent:'test',ip:'local',localConfig:{name:'iPad',room:'living',sounds:false}});
  registry.updateConfig('tablet123456',{rooms:['living','kitchen','living',null],quickLights:['light.sofa','light.sofa','light.table','light.third'],large:true});
  registry=createTabletRegistry(file,defaults);
  const result=registry.list()[0];
  assert.equal(result.config.room,'living');assert.equal(result.config.sounds,false);assert.equal(result.config.large,true);
  assert.deepEqual(result.config.rooms,['living','kitchen']);assert.deepEqual(result.config.quickLights,['light.sofa','light.table']);
  registry.updateConfig('tablet123456',{rooms:[]});
  const empty=createTabletRegistry(file,defaults).list()[0];assert.deepEqual(empty.config.rooms,[]);assert.equal(empty.config.room,'living');
 registry.updateConfig('tablet123456',{room:'',rooms:[],large:true,doorbellWake:false,nightMode:{enabled:true,startHour:21,startMinute:30,endHour:6,endMinute:45,brightness:12}});
 const remote=createTabletRegistry(file,defaults).list()[0];assert.equal(remote.config.room,'');assert.deepEqual(remote.config.rooms,[]);assert.equal(remote.config.large,true);assert.equal(remote.config.doorbellWake,false);assert.deepEqual(remote.config.nightMode,{enabled:true,startHour:21,startMinute:30,endHour:6,endMinute:45,brightness:12});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Alte Designs (classic, home, apartment) werden als panel gelesen, auch aus bestehenden Dateien',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wallpanel-theme-'));
 try{
  const file=path.join(dir,'tablets.json'),defaults={doorbellEntity:'',doorbellCamera:'',doorbellLights:[],doorbellSound:'gong',noticeSound:'ping',announcementPresets:[]};
  let registry=createTabletRegistry(file,defaults);
  for(const old of ['classic','home','apartment']){
   registry.sync('tablet-'+old+'-1234',{page:'index',userAgent:'t',ip:'l',localConfig:{name:old,theme:old}});
   assert.equal(registry.list().find(t=>t.id==='tablet-'+old+'-1234').config.theme,'panel');
  }
  registry.updateConfig('tablet-classic-1234',{theme:'home'});
  assert.equal(createTabletRegistry(file,defaults).list().find(t=>t.id==='tablet-classic-1234').config.theme,'panel');
  // Eine Datei aus früheren Versionen mit „classic“ und Design-Revision liest sich ebenfalls als panel.
  const saved=JSON.parse(fs.readFileSync(file,'utf8'));const first=Array.isArray(saved)?saved[0]:Object.values(saved.tablets||saved)[0];
  first.config.theme='classic';first.config.themeRevision=123;fs.writeFileSync(file,JSON.stringify(saved));
  const reread=createTabletRegistry(file,defaults).list()[0];
  assert.equal(reread.config.theme,'panel');assert.equal(reread.config.themeRevision,undefined);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
