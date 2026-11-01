/* Read-only app pages. ES5, no live streams or extra polling outside their pages. */
(function(){
  'use strict';
  window.createWallpanelApps=function(ctx){
    var ui=ctx.ui,esc=ui.esc,energyData=null,energyBusy=false,energyError='',attemptAt=0,fetchedAt=0;
    var movement=['motion','occupancy','presence'],openings=['door','window','opening','garage_door'],warnings=['smoke','gas','carbon_monoxide','moisture','safety'];
    function known(v){return v!==undefined&&v!==null&&String(v).replace(/^\s+|\s+$/g,'')!==''&&v!=='unavailable'&&v!=='unknown';}
    function value(v){return known(v)?String(v).replace(/^(\-?\d+)\.(\d+)/,'$1,$2'):'–';}
    function percent(v){if(!known(v)||!isFinite(Number(v))||Number(v)<0||Number(v)>100){return null;}return Math.round(Number(v));}
    function clock(v){var d=new Date(v);if(!isFinite(d.getTime())){return '';}function pad(n){return n<10?'0'+n:String(n);}return pad(d.getHours())+':'+pad(d.getMinutes());}
    function changedTime(v){var d=new Date(v),now=new Date();if(!isFinite(d.getTime())){return '';}return (d.toDateString()===now.toDateString()?'':d.getDate()+'.'+(d.getMonth()+1)+'.'+(d.getFullYear()!==now.getFullYear()?d.getFullYear()+' ':' '))+clock(v);}
    function sensorClass(e){return e.deviceClass || (e.attributes || {}).device_class;}
    function header(title,subtitle,action){return '<div class="app-page-head"><div><h2>'+esc(title)+'</h2><p>'+esc(subtitle)+'</p></div><button type="button" class="button" data-action="'+action+'">Aktualisieren</button></div>';}
    function empty(text){return '<p class="app-empty">'+esc(text)+'</p>';}
    function metric(label,v,cls){return '<div class="app-metric '+(cls || '')+'"><span>'+esc(label)+'</span><strong>'+esc(value(v))+'</strong></div>';}
    function section(title,body){return '<section class="card app-section"><h3>'+esc(title)+'</h3>'+body+'</section>';}
    function sensorSection(title,entities,kind){
      var html='<div class="security-sensors">';
      for(var i=0;i<entities.length;i++){
        var e=entities[i],available=e.state==='on'||e.state==='off',active=e.state==='on',label=available?(kind==='opening'?(active?'Offen':'Geschlossen'):kind==='movement'?(sensorClass(e)==='motion'?(active?'Bewegung erkannt':'Keine Bewegung'):(active?'Anwesend':'Keine Anwesenheit')):(active?'Alarm':'Unauffällig')):e.state==='unavailable'?'Nicht erreichbar':'Zustand unbekannt';
        html+='<article class="security-sensor'+(!available?' is-unavailable':active?' is-active':'')+'" data-sensor="'+esc(e.entityId)+'"><span class="sensor-symbol">'+ui.icon(kind==='opening'?'home':kind==='movement'?'motion':'shield')+'</span><div class="sensor-copy"><strong>'+esc(e.name)+'</strong><small>'+esc(e.areaName || 'Ohne Raum')+'</small>'+(e.lastChanged&&changedTime(e.lastChanged)?'<small>Geändert '+esc(changedTime(e.lastChanged))+'</small>':'')+'</div><span class="sensor-state">'+esc(label)+'</span></article>';
      }
      return section(title,entities.length?html+'</div>':empty('Keine sichtbaren '+title+' in Home Assistant.'));
    }
    function security(){
      var all=ctx.entities().filter(function(e){return e.domain==='binary_sensor';}),motion=all.filter(function(e){return movement.indexOf(sensorClass(e))>=0;}),doors=all.filter(function(e){return openings.indexOf(sensorClass(e))>=0;}),alerts=all.filter(function(e){return warnings.indexOf(sensorClass(e))>=0;}),cameras=ctx.cameras(),relevant=motion.concat(doors,alerts);
      var activeMotion=motion.filter(function(e){return e.state==='on';}).length,open=doors.filter(function(e){return e.state==='on';}).length,offline=relevant.filter(function(e){return e.state!=='on'&&e.state!=='off';}).length;
      var ready=ctx.securityReady?ctx.securityReady():true;
      var html=header('Sicherheit','Kameras und HA-Sensoren','security-refresh')+'<div class="app-summary security-summary">'+metric('Bewegung / Anwesenheit',ready?activeMotion:null)+metric('Türen / Fenster offen',ready?open:null,open?'is-warning':'')+metric('Ohne aktuellen Zustand',ready?offline:null,offline?'is-warning':'')+'</div>';
      var pictures='<div class="security-cameras">';
      for(var i=0;i<cameras.length;i++){var c=cameras[i];pictures+='<button type="button" class="security-camera" data-camera-key="'+esc(JSON.stringify([c.id,c.imageUrl,c.eventTimestamp,c.name,c.lastMotionMinutes]))+'" data-action="camera" data-id="'+esc(c.id)+'" aria-label="Kamera '+esc(c.name)+' öffnen"><span class="security-camera-picture">'+ctx.cameraImage(c,false)+'</span><span class="security-camera-label"><strong>'+esc(c.name)+'</strong><small>'+(typeof c.lastMotionMinutes==='number'?(c.lastMotionMinutes===0?'Letzte Bewegung gerade eben':'Letzte Bewegung vor '+c.lastMotionMinutes+' Min.'):'Kein Ereigniszeitpunkt')+'</small></span></button>';}
      html+=section('Kameras',cameras.length?pictures+'</div>':empty('Keine erreichbare Kamera.'));
      html+=ready?sensorSection('Bewegungsmelder',motion,'movement')+sensorSection('Tür- und Fenstersensoren',doors,'opening'):empty('Sensordaten werden geladen …');
      if(alerts.length){html+=sensorSection('Warnmelder',alerts,'warning');}
      return '<div class="security-page">'+html+'</div>';
    }
    function metricList(group){var html='<div class="energy-metrics">',count=0;for(var key in group){if(Object.prototype.hasOwnProperty.call(group,key)){var m=group[key];if(m&&typeof m==='object'&&m.label){count++;html+=metric(m.label,m.display);}}}return count?html+'</div>':empty('Keine Messwerte verfügbar.');}
    function batteryBar(v){var p=percent(v);return '<div class="battery-track'+(p===null?' is-unknown':p<=20?' is-low':'')+'" aria-hidden="true"><span style="width:'+(p===null?0:p)+'%"></span></div>';}
    function storage(title,group,level){var p=percent(level && level.value);return '<section class="card energy-storage"><div class="storage-head"><span class="sensor-symbol">'+ui.icon('battery')+'</span><h3>'+esc(title)+'</h3><strong>'+(p===null?'–':p+' %')+'</strong></div>'+batteryBar(level && level.value)+metricList(group || {})+'</section>';}
    function batteryGroups(entities){
      var map={},order=[];
      for(var i=0;i<entities.length;i++){var e=entities[i];if(sensorClass(e)!=='battery'){continue;}var key=e.deviceId || e.entityId;if(!map[key]){map[key]={name:e.deviceId&&e.deviceName&&e.deviceName!=='Ohne Gerät'?e.deviceName:e.name,room:e.areaName,values:[],binary:[]};order.push(key);}var group=map[key];if(e.domain==='binary_sensor'){group.binary.push(e.state);}else{var p=percent(e.state);if(p!==null){group.values.push(p);}}}
      return order.map(function(key){var g=map[key];g.level=g.values.length?Math.min.apply(Math,g.values):null;g.low=g.level!==null&&g.level<=20 || g.binary.indexOf('on')>=0;g.label=g.level!==null?g.level+' %':g.binary.indexOf('on')>=0?'Batterie schwach':g.binary.indexOf('off')>=0?'Batterie okay':'Unbekannt';return g;}).sort(function(a,b){if(a.low!==b.low){return a.low?-1:1;}return (a.level===null?101:a.level)-(b.level===null?101:b.level);});
    }
    function batteryList(entities){var groups=batteryGroups(entities),html='<div class="energy-batteries">';for(var i=0;i<groups.length;i++){var g=groups[i];html+='<article class="energy-battery'+(g.low?' is-warning':'')+'"><div class="storage-head"><strong>'+esc(g.name)+'</strong><span>'+esc(g.label)+'</span></div><small>'+esc(g.room || 'Ohne Raum')+'</small>'+batteryBar(g.level)+'</article>';}return groups.length?html+'</div>':empty('Keine sichtbaren Batteriedaten.');}
    function measurementGroups(entities){var groups={},keys=[];for(var i=0;i<entities.length;i++){var e=entities[i];if(sensorClass(e)==='battery'){continue;}var key=e.deviceId || e.entityId;if(!groups[key]){groups[key]={name:e.deviceId&&e.deviceName&&e.deviceName!=='Ohne Gerät'?e.deviceName:e.name,values:[]};keys.push(key);}groups[key].values.push(e);}var html='';for(var j=0;j<keys.length;j++){var g=groups[keys[j]],body='<div class="energy-metrics">';for(var n=0;n<g.values.length;n++){var v=g.values[n],unit=(v.attributes || {}).unit_of_measurement;body+=metric(v.name,known(v.state)?value(v.state)+(unit?' '+unit:''):'–');}html+='<section class="card energy-device"><h3>'+esc(g.name)+'</h3>'+body+'</div></section>';}return html?'<div class="energy-device-grid">'+html+'</div>':empty('Keine weiteren sichtbaren Energiemessgeräte.');}
    function energy(){
      var html=header('Energie',fetchedAt?'Stand '+clock(fetchedAt):'Solar, Verbrauch und Speicher','energy-app-refresh');
      if(energyError){html+='<p class="app-error" role="alert">'+esc(energyError)+(energyData?' · Letzter bekannter Stand':'')+'</p>';}
      if(!energyData){return '<div class="energy-page">'+html+(energyError?'':'<p class="app-empty" role="status"><span class="panel-spinner"></span> Energiedaten werden geladen …</p>')+'</div>';}
      var d=energyData.energy || {},s=d.summary || {},devices=energyData.devices || [];
      html+='<div class="app-summary energy-flow">'+metric('Solarleistung',s.solarPowerDisplay,'flow-solar')+metric('Hausverbrauch',s.consumptionDisplay,'flow-home')+metric('Netzleistung',s.gridPowerDisplay,'flow-grid')+metric('Einspeisung',s.feedInDisplay,'flow-export')+'</div>';
      html+='<div class="energy-storage-grid">'+storage('Powerstream',d.powerstream,d.powerstream && d.powerstream.batteryCharge)+storage('Delta2',d.delta2,d.delta2 && d.delta2.mainBattery)+'</div>';
      html+=section('Haus & Netz',metricList(d.grid || {}));
      html+=section('Batterien & Akkus',batteryList(devices));
      html+='<section class="app-section"><h3>Weitere Energiemessgeräte</h3>'+measurementGroups(devices)+'</section>';
      return '<div class="energy-page">'+html+'</div>';
    }
    function loadEnergy(force){
      if(energyBusy || document.hidden || ui.state.dialog && ui.state.dialog.type==='startup' || ui.state.view!=='energy' || !force&&Date.now()-attemptAt<10000){return;}
      energyBusy=true;attemptAt=Date.now();
      ctx.request('GET','/api/panel/energy',null,function(err,data){energyBusy=false;energyError=err || '';if(!err){energyData=data;fetchedAt=Date.now();}if(ui.state.view==='energy'){ctx.changed();}});
    }
    return {view:function(name){return name==='security'?security():name==='energy'?energy():null;},tick:function(){loadEnergy(false);},action:function(name){if(name==='energy-app-refresh'){loadEnergy(true);return true;}if(name==='security-refresh'){ctx.refreshSecurity();return true;}return false;}};
  };
})();
