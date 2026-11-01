const {test}=require('node:test');const assert=require('node:assert/strict');
const {projectPanelEntities}=require('../src/panel-state');
test('Live-Ansicht liefert aktuelle, sichtbare Geräte ohne große oder geheime HA-Attribute',()=>{
 const entities=[{entityId:'media_player.one',visibleByDefault:true,domain:'media_player',name:'Alt'},{entityId:'light.hidden',visibleByDefault:true,haHidden:true},{entityId:'light.deleted',visibleByDefault:true}];
 const result=projectPanelEntities(entities,[{entity_id:'media_player.one',state:'playing',attributes:{friendly_name:'Musik',entity_picture:'/api/image?token=secret',media_title:'Titel',volume_level:.4,large_history:['unneeded']}},{entity_id:'light.hidden',state:'on'}]);
 assert.equal(result.length,1);assert.equal(result[0].state,'playing');assert.equal(result[0].name,'Musik');assert.equal(result[0].attributes.volume_level,.4);assert.ok(result[0].artwork.startsWith('/api/media-artwork/'));assert.doesNotMatch(JSON.stringify(result),/secret|large_history/);
});

test('Globale Wetterkarte bleibt bei #Status-Raum erhalten, explizit versteckte Wettergeräte bleiben verborgen',()=>{
 const {discoverHaEntities}=require('../src/ha-discovery');
 const {selectDashboardWeather}=require('../src/panel-state');
 const states=[{entity_id:'weather.home',state:'sunny'},{entity_id:'weather.hidden',state:'sunny'},{entity_id:'weather.offline',state:'unavailable'}];
 const entities=discoverHaEntities(states,{areas:[{area_id:'status',name:'#Status'}],floors:[],devices:[],entities:[{entity_id:'weather.home',area_id:'status'},{entity_id:'weather.hidden',hidden_by:'user'},{entity_id:'weather.offline'}]});
 assert.equal(entities[0].visibleByDefault,false);
 assert.equal(selectDashboardWeather(entities,new Map(states.map(s=>[s.entity_id,s]))),'weather.home');
 assert.equal(selectDashboardWeather(entities.slice(1),new Map(states.map(s=>[s.entity_id,s]))),undefined);
});
