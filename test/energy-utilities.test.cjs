const {test}=require('node:test'),assert=require('node:assert/strict');
const {pickUtilitySources,parseDailyBuckets,formatAmount,utilityMetrics,buildUtilityGroups,utilityChart}=require('../src/energy-utilities');
const DAY=86400000,localDay=Date.UTC(2026,10,19); // 19.11.2026
const bucket=(daysAgo,change)=>({start:localDay-daysAgo*DAY-3600000,change}); // Mitternacht deutscher Zeit = 23:00 UTC Vortag

test('Energie-Einstellungen: Gas und Wasser, jeder Zähler einmal, leere Einträge ignoriert',()=>{
 const prefs={energy_sources:[{type:'grid'},{type:'gas',stat_energy_from:'sensor.gas'},{type:'water',stat_energy_from:'sensor.wasser'},{type:'gas',stat_energy_from:'sensor.gas'},{type:'solar'},{type:'water'}]};
 assert.deepEqual(pickUtilitySources(prefs),[{kind:'gas',statIds:['sensor.gas']},{kind:'water',statIds:['sensor.wasser']}]);
 assert.deepEqual(pickUtilitySources(null),[]);assert.deepEqual(pickUtilitySources({energy_sources:'x'}),[]);
});

test('Statistik: Zahlen und Zeitstempel in beiden Formaten, sortiert',()=>{
 const raw={'sensor.gas':[{start:'2026-11-19T00:00:00+01:00',change:0.5},{start:1700000000000,change:'1.25'},{start:1,change:null}]};
 const b=parseDailyBuckets(raw,'sensor.gas');
 assert.equal(b.length,2);assert.ok(b[0].start<b[1].start);assert.equal(b[0].change,1.25);
 assert.deepEqual(parseDailyBuckets(raw,'sensor.nope'),[]);
});

test('Mengen deutsch formatiert, je Einheit sinnvoll gerundet',()=>{
 assert.equal(formatAmount(0.762,'m³'),'0,762 m³');assert.equal(formatAmount(12.345,'m³'),'12,35 m³');assert.equal(formatAmount(4.17,'kWh'),'4,17 kWh');
 assert.equal(formatAmount(152.6,'L'),'153 L');assert.equal(formatAmount(3,''),'3,00');
});

test('Heute, Gestern, 7 Tage, Monat und Zählerstand',()=>{
 const buckets=[bucket(20,9),bucket(8,1),bucket(6,2),bucket(1,4),bucket(0,0.762)];
 const m=utilityMetrics(buckets,'m³',1234.5,localDay);
 const by=Object.fromEntries(m.map(x=>[x.id,x.display]));
 assert.equal(by.today,'0,762 m³');assert.equal(by.yesterday,'4,000 m³');
 assert.equal(by.week,'6,762 m³');             // 6 Tage zurück + heute, 8 Tage zurück zählt nicht
 assert.equal(by.month,'7,762 m³');            // 1.–19.11.: 1+2+4+0,762, ohne den Eintrag vom 30.10.
 assert.equal(by.meter,'1234,5 m³');
});

test('Ohne Statistik nur der Zählerstand, ohne beides nichts',()=>{
 assert.deepEqual(utilityMetrics([],'m³',12,localDay).map(x=>x.id),['meter']);
 assert.deepEqual(utilityMetrics([],'m³',null,localDay),[]);
});

test('Gruppen: Titel Gas/Wasser, bei mehreren Zählern mit Namen',()=>{
 const states={'sensor.gas':{state:'10',attributes:{unit_of_measurement:'m³',friendly_name:'Gaszähler'}},'sensor.wasser':{state:'5',attributes:{unit_of_measurement:'L'}}};
 const g=buildUtilityGroups([{kind:'gas',statIds:['sensor.gas']},{kind:'water',statIds:['sensor.wasser']}],{'sensor.gas':[bucket(0,1)]},id=>states[id],localDay);
 assert.deepEqual(g.map(x=>x.title),['Gas','Wasser']);assert.equal(g[0].metrics[0].id,'gas:sensor.gas:today');
 const two=buildUtilityGroups([{kind:'gas',statIds:['sensor.gas']},{kind:'gas',statIds:['sensor.gas2']}],{},id=>id==='sensor.gas'?states['sensor.gas']:{state:'3',attributes:{unit_of_measurement:'m³'}},localDay);
 assert.deepEqual(two.map(x=>x.title),['Gas · Gaszähler','Gas · sensor.gas2']);
});

test('Diagramm: ein Messfehler staucht die anderen Balken nicht, bleibt aber sichtbar gekennzeichnet',()=>{
 const buckets=[bucket(0,0.762),bucket(1,4.5),bucket(2,5.9),bucket(3,6.5),bucket(4,5.7),bucket(5,8.4),bucket(6,151767.9),bucket(7,367.4)];
 const c=utilityChart(buckets,'m³',localDay);
 const clipped=c.bars.filter(b=>b.clipped);
 assert.deepEqual(clipped.map(b=>b.value),[367.4,151767.9]);   // echte Werte bleiben im Label erhalten
 assert.ok(c.max<30&&c.max>=8.4);                               // Maßstab richtet sich nach den normalen Tagen
 assert.equal(utilityChart([bucket(0,1),bucket(1,50)],'m³',localDay).bars.some(b=>b.clipped),false); // zu wenig Daten: nie kappen
});

test('Diagramm: 14 Tage, lückenlos, heute zuletzt, ohne Statistik kein Diagramm',()=>{
 const c=utilityChart([bucket(0,0.762),bucket(1,4),bucket(3,2),bucket(20,9)],'m³',localDay);
 assert.equal(c.bars.length,14);assert.equal(c.bars[13].today,true);assert.equal(c.bars.filter(b=>b.today).length,1);
 assert.equal(c.bars[13].day,'19');assert.equal(c.bars[13].weekday,'Do');   // 19.11.2026 ist ein Donnerstag
 assert.equal(c.bars[12].day,'18');assert.equal(c.bars[12].value,4);
 assert.equal(c.bars[11].value,0);assert.equal(c.bars[10].value,2);       // Lücke wird 0
 assert.equal(c.bars[13].label,'0,762');assert.equal(c.max,4);            // 20 Tage alte Daten fehlen
 assert.equal(utilityChart([],'m³',localDay),null);
 const g=buildUtilityGroups([{kind:'gas',statIds:['sensor.gas']}],{'sensor.gas':[bucket(0,1)]},()=>({state:'1',attributes:{unit_of_measurement:'m³'}}),localDay);
 assert.equal(g[0].kind,'gas');assert.equal(g[0].chart.unit,'m³');
});

test('Energie-Einstellungen: Netz (neues und altes Format), Solar und Akku',()=>{
 const neu={energy_sources:[{type:'grid',flow_from:[{stat_energy_from:'sensor.bezug'}],flow_to:[{stat_energy_to:'sensor.einsp'}]},{type:'solar',stat_energy_from:'sensor.pv1'},{type:'solar',stat_energy_from:'sensor.pv2'},{type:'battery',stat_energy_from:'sensor.aus',stat_energy_to:'sensor.ein'}]};
 assert.deepEqual(pickUtilitySources(neu),[{kind:'grid',statIds:['sensor.bezug']},{kind:'grid_export',statIds:['sensor.einsp']},{kind:'solar',statIds:['sensor.pv1','sensor.pv2']},{kind:'battery_out',statIds:['sensor.aus']},{kind:'battery_in',statIds:['sensor.ein']}]);
 const alt={energy_sources:[{type:'grid',stat_energy_from:'sensor.verbrauch',stat_energy_to:'sensor.einspeisung',stat_rate:'sensor.leistung'}]};
 assert.deepEqual(pickUtilitySources(alt),[{kind:'grid',statIds:['sensor.verbrauch']},{kind:'grid_export',statIds:['sensor.einspeisung']}]);
});

test('Gruppen: Wh werden zu kWh, mehrere Zähler addiert, feste Reihenfolge, kein Zählerstand bei „heute“-Zählern',()=>{
 const states={'sensor.pv1':{state:'1022',attributes:{unit_of_measurement:'Wh'}},'sensor.pv2':{state:'1056',attributes:{unit_of_measurement:'Wh'}},'sensor.bezug':{state:'5000.5',attributes:{unit_of_measurement:'kWh'}}};
 const g=buildUtilityGroups([{kind:'solar',statIds:['sensor.pv1','sensor.pv2'],meter:false},{kind:'grid',statIds:['sensor.bezug']}],{'sensor.pv1':[bucket(0,500),bucket(1,1000)],'sensor.pv2':[bucket(0,250)],'sensor.bezug':[bucket(0,4)]},id=>states[id],localDay);
 assert.deepEqual(g.map(x=>x.kind),['grid','solar']);                       // Netz vor Solar
 const by=Object.fromEntries(g[1].metrics.map(m=>[m.id.split(':').pop(),m.display]));
 assert.equal(by.today,'0,75 kWh');assert.equal(by.yesterday,'1,00 kWh');assert.equal(by.meter,undefined);
 assert.equal(g[1].chart.unit,'kWh');assert.equal(g[1].chart.bars[13].value,0.75);
 assert.equal(g[0].metrics.find(m=>m.id.endsWith(':meter')).display,'5000,5 kWh');
});

test('Eingefrorene Zähler ergeben Nullen statt falscher Balken',()=>{
 const g=buildUtilityGroups([{kind:'solar',statIds:['sensor.pv'],meter:false}],{'sensor.pv':[bucket(0,0),bucket(1,0),bucket(2,0)]},()=>({state:'1022',attributes:{unit_of_measurement:'Wh'}}),localDay);
 assert.equal(g[0].chart.max,0);assert.ok(g[0].chart.bars.every(b=>b.value===0));
});
