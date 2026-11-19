const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {rainWindow,rainSentences,tilePosition,createWeatherRadar,RadarError}=require('../src/weather-radar');
const NOW=Date.parse('2026-11-19T11:00:00Z');                    // 12:00 Uhr deutsche Zeit
const slot=(minutesFromNow,mm)=>({t:(NOW+minutesFromNow*60000)/1000,mm});
function minutely(list){return {time:list.map(s=>s.t),precipitation:list.map(s=>s.mm)};}
const dry=minutely([slot(15,0),slot(30,0),slot(45,0),slot(60,0)]);

test('Regentext: trocken, Regen beginnt, Regen läuft und endet, Regen ohne Ende, unbekannt',()=>{
 assert.deepEqual(rainSentences(rainWindow(dry,NOW)),{summary:'Bis ca. 13:00 kein Niederschlag erwartet.',shortSummary:'Kein Regen in Sicht',level:'dry'});
 const soon=rainSentences(rainWindow(minutely([slot(15,0),slot(30,0),slot(45,0.4),slot(60,0.3),slot(75,0)]),NOW));
 assert.equal(soon.shortSummary,'Regen ab etwa 12:30');assert.equal(soon.level,'soon');assert.match(soon.summary,/ab etwa 12:30\. Ende gegen 13:00\./);
 const ongoing=rainSentences(rainWindow(minutely([slot(15,0.5),slot(30,0.5),slot(45,0),slot(60,0)]),NOW));
 assert.equal(ongoing.shortSummary,'Regen hört gegen 12:30 auf');assert.equal(ongoing.level,'rain');
 const endless=rainSentences(rainWindow(minutely([slot(15,0.5),slot(30,0.5),slot(45,0.2)]),NOW));
 assert.equal(endless.shortSummary,'Regen hält noch an');
 assert.equal(rainSentences(rainWindow(null,NOW)).level,'unknown');
 assert.equal(rainSentences(rainWindow(minutely([slot(15,0),slot(30,null)]),NOW)).shortSummary,'');   // Lücke in den Daten: nichts behaupten
 assert.equal(rainSentences(rainWindow(minutely([slot(15,0.04),slot(30,0.01)]),NOW)).level,'dry');     // Nieseln unter der Schwelle
});

test('Sommerzeit: Uhrzeiten im Regentext stimmen auch im Juli',()=>{
 const july=Date.parse('2026-07-10T10:00:00Z');                  // 12:00 MESZ
 const w=rainWindow(minutely([{t:(july+15*60000)/1000,mm:0},{t:(july+30*60000)/1000,mm:0.4},{t:(july+45*60000)/1000,mm:0}]),july);
 assert.equal(rainSentences(w).shortSummary,'Regen ab etwa 12:15');
});

test('Kachelposition: Strehla liegt bei Zoom 7 in Kachel 68/42',()=>{
 const p=tilePosition(51.354,13.226,7);assert.equal(Math.floor(p.x),68);assert.equal(Math.floor(p.y),42);
});

function rig(overrides={}){
 const calls=[];let clock=NOW;const dir=fs.mkdtempSync(path.join(os.tmpdir(),'radar-'));
 const frames=Array.from({length:15},(_,i)=>({time:Math.floor(NOW/1000)-(14-i)*600,path:'/v2/radar/'+('abcdef0123456789'+i).slice(-16)}));
 const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.from('rest')]);
 const state={meteoFails:false,viewerFails:false,viewerHost:'https://tilecache.rainviewer.com',frames,png,...overrides};
 const http={get:async(url)=>{calls.push(url);
  if(url.includes('open-meteo')){if(state.meteoFails)throw new Error('timeout');return {data:{minutely_15:minutely([slot(15,0.4),slot(30,0.4),slot(45,0),slot(60,0)])}};}
  if(url.includes('weather-maps.json')){if(state.viewerFails)throw new Error('timeout');return {data:{host:state.viewerHost,radar:{past:state.frames}}};}
  if(state.tileFails)throw new Error('tile timeout');return {data:state.png};}};
 const radar=createWeatherRadar({http,getLocation:async()=>({lat:51.354,lon:13.226}),describeError:e=>String(e.message||e),cacheDir:path.join(dir,'tiles'),userAgent:'Test/1',now:()=>clock});
 return {radar,calls,state,advance:ms=>{clock+=ms;},dir,clean:()=>fs.rmSync(dir,{recursive:true,force:true}),frames};
}

test('Zusammenfassung: 13 neueste Bilder, Regentext, Zwischenspeicher für zehn Minuten',async()=>{
 const r=rig();try{
  const s=await r.radar.getSummary();
  assert.equal(s.frames.length,13);assert.equal(s.frames[12].time,r.frames[14].time);assert.equal(s.status,'ok');
  assert.equal(s.shortSummary,'Regen hört gegen 12:30 auf');assert.equal(s.series.length,4);assert.equal(s.view.z,7);
  const before=r.calls.length;await r.radar.getSummary();assert.equal(r.calls.length,before);              // aus dem Zwischenspeicher
  r.advance(11*60000);await r.radar.getSummary();assert.ok(r.calls.length>before);                            // nach zehn Minuten neu
 }finally{r.clean();}
});

test('Ungültige Radar-Antworten werden ignoriert (falscher Server, ungültiger Pfad)',async()=>{
 let r=rig({viewerHost:'https://evil.example'});try{assert.deepEqual((await r.radar.getSummary()).frames,[]);}finally{r.clean();}
 r=rig({frames:[{time:1,path:'/../../etc/passwd'},{time:2,path:'/v2/radar/zzz'}]});try{assert.deepEqual((await r.radar.getSummary()).frames,[]);}finally{r.clean();}
});

test('Ausfall: letzter guter Stand bleibt eine Weile sichtbar (veraltet), danach nichts; nie ein Absturz',async()=>{
 const r=rig();try{
  await r.radar.getSummary();r.state.meteoFails=true;r.state.viewerFails=true;r.advance(11*60000);
  const stale=await r.radar.getSummary();assert.equal(stale.status,'stale');assert.equal(stale.frames.length,13);
  r.advance(4*3600000);assert.equal(await r.radar.getSummary(),null);
 }finally{r.clean();}
 const none=rig({meteoFails:true,viewerFails:true});try{assert.equal(await none.radar.getSummary(),null);}finally{none.clean();}
});

test('Nur eine Quelle fällt aus: Regentext oder Radarbilder bleiben nutzbar',async()=>{
 let r=rig({viewerFails:true});try{const s=await r.radar.getSummary();assert.equal(s.frames.length,0);assert.equal(s.shortSummary,'Regen hört gegen 12:30 auf');}finally{r.clean();}
 r=rig({meteoFails:true});try{const s=await r.radar.getSummary();assert.equal(s.frames.length,13);assert.equal(s.shortSummary,'');}finally{r.clean();}
});

test('Kacheln: Prüfungen, Zwischenspeicher, gleichzeitige Anfragen, ungültige Bilder',async()=>{
 const r=rig();try{
  const s=await r.radar.getSummary(),t=s.frames[12].time,x=Math.floor(s.view.x),y=Math.floor(s.view.y);
  const code=async p=>{try{await p;return 200;}catch(e){return e instanceof RadarError?e.status:-1;}};
  assert.equal(await code(r.radar.getTile('foo',0,7,x,y)),400);assert.equal(await code(r.radar.getTile('map',5,7,x,y)),400);   // Karte hat keine Aufnahmezeit
  assert.equal(await code(r.radar.getTile('map',0,3,1,1)),400);assert.equal(await code(r.radar.getTile('map',0,8,x,y)),400);   // Zoomstufe
  assert.equal(await code(r.radar.getTile('map',0,7,x+9,y)),400);assert.equal(await code(r.radar.getTile('map',0,7,-1,y)),400);   // zu weit weg / ungültig
  assert.equal(await code(r.radar.getTile('radar',123,7,x,y)),404);                                                              // Aufnahme nicht in der Liste
  const before=r.calls.length;
  const [a,b]=await Promise.all([r.radar.getTile('radar',t,7,x,y),r.radar.getTile('radar',t,7,x,y)]);
  assert.equal(r.calls.length,before+1);assert.deepEqual(a,b);                                                                    // eine Anfrage für zwei Nutzer
  await r.radar.getTile('radar',t,7,x,y);assert.equal(r.calls.length,before+1);                                                  // danach aus dem Speicher
  assert.ok(r.calls[r.calls.length-1].startsWith('https://tilecache.rainviewer.com/v2/radar/'));
  await r.radar.getTile('map',0,7,x,y);const mapCalls=r.calls.length;await r.radar.getTile('map',0,7,x,y);assert.equal(r.calls.length,mapCalls);   // Karte von der Platte
  assert.ok(r.calls[mapCalls-1].startsWith('https://tile.openstreetmap.org/7/'));
  r.state.png=Buffer.from('keine png-datei');assert.equal(await code(r.radar.getTile('radar',s.frames[11].time,7,x,y)),502);
  r.state.tileFails=true;assert.equal(await code(r.radar.getTile('radar',s.frames[10].time,7,x,y)),502);
  // alte Kartenkachel wird bei einem Ausfall weiter geliefert
  r.advance(8*86400000);const old=await r.radar.getTile('map',0,7,x,y);assert.ok(old.length>0);
 }finally{r.clean();}
});
