/* Live HA adapter. All browser code stays ES5 for iOS 9. */
(function () {
  'use strict';
  var ui, raw = [], dashboard = null, config = {}, tabletId = '', busy = {}, pending = {}, tabletConfigs = {}, stateBusy = false, syncBusy = false, dashboardBusy = false;
  var lastSignature = '', dashboardSignature = '', lastInteraction = Date.now(), lastScrollAt=0, gesture = false, dirty = false, online = false, lastState = 0, failedCameras = {}, lastVersion = '', conversation = '', searchTimer, generation = 0;
  var lightUI,musicItems=[],musicOffset=0,musicQuery='',musicBusy=false;
  var pinIntent='',alerts,audioQueue=[],audioCurrent=false,profileLoaded=false,lastThemeRevision=null,pendingDesign=null,hiddenAt=0;
  var appPages,lastAppView='',securityReady=false,details, cameraPoll=null, cameraTimeout=null;
  var inbox=null,readings={},loadedVersion=window.WallpanelBuild || '',reloadJob=null,reloading=false,reloadAck='',stateSequence=0,unlockingAudio=false,inboxDialogSignature='';
  var bootReload=/[?&]_reloadJob=([a-f0-9]{24})/.exec(window.location.search);if(bootReload){reloadAck=bootReload[1];}
  var startupConfirmed=false,startupReady=false,startupStarted=false,startupCommands=[],audioCallbacks=[],audioAttempt=0,lastDashboardAt=0,pendingRefresh=null;
  var lowPower=/iP(ad|hone|od)/.test(navigator.userAgent) && /OS (?:[1-9]|1[0-2])_/.test(navigator.userAgent);
  var audio = document.createElement('audio'), soundUnlocked = false;
  var model = { rooms: [], lights: [], players: [], climates: [], switches: [], scenes: [], cameras: [], announcements: [], tablets: [{id:'this',name:'Dieses iPad',room:'',rooms:[],quickLights:[],saver:'5',night:true,sounds:true,online:true}], gateOpen:false, livePreviewActive:null };
  function el(id) { return document.getElementById(id); }
  function esc(v) { return String(v === undefined || v === null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function get(list, id) { for (var i=0;i<list.length;i++) { if (list[i].id === id || list[i].entityId === id) { return list[i]; } } return null; }
  function available(e) { return ['unavailable','unknown'].indexOf(e.state) < 0; }
  function display(v) { return v === undefined || v === null || v === 'unavailable' || v === 'unknown' ? '–' : String(v).replace(/^(\d+)\.(\d+)/,'$1,$2'); }
  function request(method, url, body, cb) {
    var xhr = new XMLHttpRequest(), done = false;
    function finish(error, data) { if (done) { return; } done=true; cb(error,data); }
    xhr.open(method,url,true); xhr.timeout=20000;
    if (method !== 'GET') { xhr.setRequestHeader('Content-Type','application/json'); xhr.setRequestHeader('X-Wallpanel-Admin','1'); }
    xhr.onload=function () { var result; try { result=JSON.parse(xhr.responseText); } catch (_e) { finish('Ungültige Serverantwort'); return; } if (xhr.status < 200 || xhr.status >= 300 || result.ok === false) { finish(xhr.status === 401 || xhr.status === 403 ? (url === '/api/settings/unlock' ? 'PIN stimmt nicht. Bitte erneut versuchen.' : 'Bitte Einstellungen erneut entsperren.') : result.message || 'Anfrage fehlgeschlagen ('+xhr.status+')'); return; } finish(null,result); };
    xhr.onerror=function () { finish('Verbindung zum Wallpanel unterbrochen.'); }; xhr.ontimeout=function () { finish('Keine Antwort erhalten.'); }; xhr.send(body ? JSON.stringify(body) : null);
  }
  function error(message) { if (ui) { ui.toast(message); } }
  function connection() { var node=el('panelConnection'); if (!node) { node=document.createElement('div'); node.id='panelConnection'; node.className='panel-connection'; node.setAttribute('role','status'); document.body.appendChild(node); } node.textContent=online?'':'Home Assistant nicht erreichbar'; node.style.display=online?'none':'block'; }
  function render() {
    if (el('panelSaver') && el('panelSaver').style.display==='block') { dirty=true; return; }
    if (!ui) { return; }
    if (gesture || Date.now()-lastScrollAt<250 || window.WallpanelThermostat.active() || window.WallpanelPowerFader.active() || ui.state.dialog || ui.state.view === 'settings' || Object.keys(busy).length) { dirty=true; return; }
    ui.render(); dirty=false;
  }
  function profile(c, id, isOnline) {
    var primary=c.room || '';
    return {id:id,theme:id==='this'?'panel':window.WallpanelDesign.normalize(c.theme),name:c.name || 'Tablet',room:primary,rooms:c.rooms || (primary?[primary]:[]),quickLights:c.quickLights || model.lights.filter(function (l) { return l.room === primary; }).slice(0,2).map(function (l) { return l.id; }),saver:c.screensaver && c.screensaver.enabled ? String(c.screensaver.minutes) : '0',night:!!(c.nightMode && c.nightMode.enabled),sounds:c.sounds !== false,large:!!c.large,online:!!isOnline};
  }
  function applyConfig(c,fromServer) { c=c || {};if(fromServer){if(profileLoaded&&lastThemeRevision!==(c.themeRevision || 0)&&c.theme){pendingDesign=c.theme==='panel'?null:c.theme;}lastThemeRevision=c.themeRevision || 0;profileLoaded=true;}var oldRoom=config.room || '';config=c || {};if(ui && (!ui.state.roomId || ui.state.roomId===oldRoom && oldRoom!==config.room)){ui.state.roomId=config.room || '';} tabletConfigs[tabletId]=config; model.tablets[0]=profile(config,'this',true); }
  function project(data) {
    raw=data.entities || [];inbox=Array.isArray(data.inbox)?data.inbox:null;readings=data.roomReadings || {};
    model.rooms=(data.areas || []).filter(function (a) { return !/^\s*#/.test(a.name || ''); }).map(function (a) { return {id:a.area_id,name:a.name}; });
    var roomIds=model.rooms.map(function (r) { return r.id; });
    var entities=raw.filter(function (e) { return roomIds.indexOf(e.areaId) !== -1; });
    model.lights=entities.filter(function (e) { return e.domain==='light'; }).map(function (e) { var a=e.attributes || {}, modes=a.supported_color_modes || []; return {id:e.entityId,name:e.name,room:e.areaId,on:e.state==='on',brightness:Math.round((a.brightness || 0)/255*100) || 1,dim:modes.length ? modes.some(function(m){return ['onoff','unknown'].indexOf(m)<0;}) : a.brightness !== undefined, colorCapable:modes.some(function(m){return ['hs','rgb','rgbw','rgbww','xy'].indexOf(m)>=0;}),color:'warm',unavailable:!available(e)}; });
    model.players=entities.filter(function (e) { return e.domain==='media_player'; }).map(function (e) { var a=e.attributes || {};return {id:e.entityId,name:e.name,room:e.areaId,title:a.media_title || '',subtitle:a.media_artist || a.source || '',playing:e.state==='playing',volume:Math.round((a.volume_level || 0)*100),artwork:e.artwork,unavailable:!available(e),musicAssistant:e.musicAssistant,source:a.source || '',sources:a.source_list || []}; });
    model.climates=entities.filter(function(e){return e.domain==='climate';}).map(function(e){var a=e.attributes || {};return {id:e.entityId,name:e.name,room:e.areaId,target:a.temperature,temperature:a.current_temperature,min:typeof a.min_temp==='number'?a.min_temp:5,max:typeof a.max_temp==='number'?a.max_temp:30,step:a.target_temp_step || .5,mode:e.state,modes:a.hvac_modes || [],heating:a.hvac_action==='heating',unavailable:!available(e)};});
    model.switches=entities.filter(function(e){return e.domain==='switch' || e.domain==='input_boolean';}).map(function(e){return {id:e.entityId,name:e.name,room:e.areaId,on:e.state==='on',unavailable:!available(e)};});
    model.scenes=raw.filter(function(e){return e.domain==='scene';}).map(function(e){return {id:e.entityId,name:e.name,icon:'scenes',room:e.areaId};});
    applyConfig(config);
    if (!get(model.rooms,ui.state.roomId)) { ui.state.roomId=get(model.rooms,model.tablets[0].room)?model.tablets[0].room:(model.rooms[0] || {}).id || ''; }
  }
  function refresh() {
    if (stateBusy || document.hidden || el('panelSaver') && el('panelSaver').style.display==='block') { return; } stateBusy=true;var sequence=++stateSequence,securityRequest=ui.state.view==='security';
    request('GET','/api/panel/state?compact=1'+(ui.state.view==='security'?'&view=security':''),null,function(err,data){stateBusy=false;if(err){online=false;connection();return;}var readyChanged=securityReady!==securityRequest;online=true;securityReady=securityRequest;lastState=Date.now();connection();if(ui.state.view==='security'&&!securityRequest){setTimeout(refresh,0);}var cleared=reconcile(data.entities || [],sequence),signature=JSON.stringify(data);if(signature!==lastSignature){lastSignature=signature;project(data);updateLightDialog();updateMusicDialog();updateInboxDialog();render();}else if(cleared||readyChanged){render();}clearTimeout(pendingRefresh);pendingRefresh=null;if(Object.keys(pending).length){pendingRefresh=setTimeout(function(){pendingRefresh=null;refresh();},500);}});
  }
  function loadDashboard() {
    if (ui && ui.state.view!=='home' && ui.state.view!=='security' && !(ui.state.dialog && ['weather','energy','gate','camera','doorbell'].indexOf(ui.state.dialog.type)>=0)){return;}
    if (dashboardBusy || document.hidden || el('panelSaver') && el('panelSaver').style.display==='block') { return; } dashboardBusy=true;
    request('GET','/api/dashboard',null,function(err,data){dashboardBusy=false;if(err){return;}lastDashboardAt=Date.now();dashboard=data;model.gateOpen=data.torVisualMode==='open';if(details){details.updateGate(data);}model.cameras=(data.cameras || []).filter(function(c){return ['unavailable','unknown','off'].indexOf(c.state)<0;}).map(function(c){return {id:c.entity_id,name:c.name,state:c.state,platform:'camera',imageUrl:c.imageUrl,streamUrl:c.streamUrl,eventTimestamp:c.eventTimestamp,lastMotionMinutes:c.eventTimestamp?Math.max(0,Math.floor((Date.now()-Date.parse(c.eventTimestamp))/60000)):null};}).filter(function(c){return !failedCameras[c.id] || Date.now()-failedCameras[c.id]>60000;}); var copy={weather:data.weather,energy:data.energy,tor:data.torVisualMode,cameras:model.cameras,waste:[data.gelbeTonneNaechsteLeerung,data.blaueTonneNaechsteLeerung,data.restmuellNaechsteLeerung],rain:data.precipitationOutlook}; var sig=JSON.stringify(copy); if(sig!==dashboardSignature){dashboardSignature=sig;render();}});
  }
  function markPending(id, on) {
    var nodes=document.querySelectorAll('[data-id="'+id+'"], [data-brightness="'+id+'"], [data-volume="'+id+'"], [data-thermostat="'+id+'"], [data-power-fader="'+id+'"]');
    for(var i=0;i<nodes.length;i++){var n=nodes[i];if(on){if(!n.hasAttribute('data-pending')){n.setAttribute('data-pending',n.disabled?'disabled':'enabled');}n.setAttribute('aria-busy','true');if(n.tagName==='BUTTON'||n.tagName==='INPUT'){n.disabled=true;}if(n.hasAttribute('data-thermostat')||n.hasAttribute('data-power-fader')||n.hasAttribute('data-color-wheel')){n.setAttribute('aria-disabled','true');}}
      else if(n.hasAttribute('data-pending')){if(n.getAttribute('data-pending')==='enabled'){n.disabled=false;}n.removeAttribute('data-pending');n.removeAttribute('aria-busy');if(n.hasAttribute('data-thermostat')||n.hasAttribute('data-power-fader')||n.hasAttribute('data-color-wheel')){var c=get(model.climates,id)||get(model.lights,id);n.setAttribute('aria-disabled',String(!!(c&&(c.unavailable||c.mode==='off'))));}}}
  }
  function matches(entity, service, data) {
    if(!entity){return false;} var a=entity.attributes || {};
    if(service==='turn_on'||service==='turn_off'){var colorMatch=true;if(data.rgb_color){var rgb=a.rgb_color || (a.hs_color?window.WallpanelLightColor.rgb(a.hs_color[0],a.hs_color[1]):[]);colorMatch=rgb.length===3&&rgb.every(function(v,i){return Math.abs(v-data.rgb_color[i])<=4;});}if(data.hs_color){colorMatch=Array.isArray(a.hs_color)&&Math.abs(a.hs_color[1]-data.hs_color[1])<2&&(data.hs_color[1]<1||Math.min(Math.abs(a.hs_color[0]-data.hs_color[0]),360-Math.abs(a.hs_color[0]-data.hs_color[0]))<3);}if(data.color_temp_kelvin!==undefined){colorMatch=Math.abs(Number(a.color_temp_kelvin)-data.color_temp_kelvin)<=25;}return colorMatch&& entity.state===(service==='turn_on'?'on':'off') && (data.brightness_pct===undefined || Math.abs((a.brightness || 0)/255*100-data.brightness_pct)<2);}
    if(service==='sync_climate'){return entity.state===data.hvac_mode && (data.temperature===undefined || Math.abs(Number(a.temperature)-data.temperature)<.05);}
    if(service==='set_temperature'){return Math.abs(Number(a.temperature)-data.temperature)<.05;}
    if(service==='set_hvac_mode'){return entity.state===data.hvac_mode;}
    if(service==='volume_set'){return Math.abs(Number(a.volume_level)-data.volume_level)<.015;}
    if(service==='media_play'||service==='media_pause'){return entity.state===(service==='media_play'?'playing':'paused') || service==='media_pause' && entity.state==='idle';}
    return true;
  }
  function reconcile(entities,sequence) {var changed=false;for(var id in pending){if(Object.prototype.hasOwnProperty.call(pending,id)){var p=pending[id];if(sequence>p.after && matches(get(entities,id),p.service,p.data)){delete pending[id];delete busy[id];markPending(id,false);changed=true;}}}return changed;}
  function command(id, service, data) {
    if (!online || Date.now()-lastState>30000) { error('Keine aktuelle Verbindung zu Home Assistant.'); return; }
    if (busy[id]) { return; } busy[id]=true;markPending(id,true);
    request('POST','/api/entity/'+encodeURIComponent(id)+'/service',{service:service,data:data || {}},function(err){
      if(err){delete busy[id];markPending(id,false);error(err);if(!ui.state.dialog){ui.render();}return;}
      if(id.indexOf('scene.')!==0&&['turn_on','turn_off','set_temperature','set_hvac_mode','volume_set','media_play','media_pause'].indexOf(service)>=0){pending[id]={service:service,data:data || {},after:stateSequence,until:Date.now()+15000};}
      else{delete busy[id];markPending(id,false);}refresh();
    });
  }
  function temperature(id,value) { var c=get(model.climates,id); if(c&&!c.unavailable){command(id,'set_temperature',{temperature:window.WallpanelThermostat.snap(value,c.min,c.max,c.step)});} }
  function brightness(id,value){var light=get(model.lights,id);if(light&&!light.unavailable){command(id,value>0?'turn_on':'turn_off',value>0?{brightness_pct:value}:{});}}
  function updateLightDialog(){if(!ui.state.dialog||ui.state.dialog.type!=='light'||window.WallpanelPowerFader.active()){return;}var l=get(model.lights,ui.state.dialog.id);if(!l){ui.closeDialog();return;}var label=document.querySelector('[data-power-level]'),fader=document.querySelector('[data-power-fader]'),sw=document.querySelector('.home-power-switch');if(label){label.textContent=l.unavailable?'Nicht erreichbar':l.dim&&l.on?l.brightness+' %':l.on?'An':'Aus';}if(fader&&!busy[l.id]){var value=l.on?l.brightness:0;fader.setAttribute('aria-valuenow',String(value));fader.setAttribute('aria-valuetext',value+' Prozent');fader.setAttribute('aria-disabled',String(!!l.unavailable));fader.querySelector('.home-fader-fill').style.height=value+'%';fader.className='home-power-fader'+(l.on?' is-on':'');}if(sw){sw.className='home-power-switch'+(l.on?' is-on':'');sw.setAttribute('aria-pressed',String(!!l.on));sw.disabled=!!(l.unavailable||busy[l.id]);}}
  function camerasRelease() { clearInterval(cameraPoll);clearTimeout(cameraTimeout);cameraPoll=null;cameraTimeout=null;var imgs=el('dialogRoot').querySelectorAll('img[data-live]');for(var i=0;i<imgs.length;i++){imgs[i].onload=null;imgs[i].onerror=null;imgs[i].removeAttribute('src');imgs[i].removeAttribute('data-src');} }
  function cameraImage(c, full, caption) {
    var live=full && /^LIVE/.test(caption || ''), url=live?c.streamUrl:c.imageUrl;
    if (!url) { return '<p>Kein Kamerabild verfügbar.</p>'; }
    if (!live && c.eventTimestamp) { url+=(url.indexOf('?')>=0?'&':'?')+'v='+encodeURIComponent(c.eventTimestamp); }
    if(live){url+=(url.indexOf('?')>=0?'&':'?')+'liveOnly=1&_live='+Date.now()+'-'+Math.floor(Math.random()*1000000);}
    var image='<img '+(live?'data-src':'src')+'="'+esc(url)+'" alt="'+esc(c.name)+'" data-camera="'+esc(c.id)+'"'+(live?' data-live="1"':'')+'>';
    if(!full){return image;}
    return '<div class="camera-full-image'+(live?' is-live-loading':'')+'" style="height:'+Math.max(140,Math.min(440,window.innerHeight-270))+'px">'+image+(live?'<div class="camera-loading" role="status"><span class="panel-spinner"></span><span>Live wird gestartet …</span></div><span class="camera-live-state">Verbindet …</span>':'')+'</div>';
  }
  function afterDialog(){if(lightUI){lightUI.afterDialog();}var img=el('dialogRoot').querySelector('img[data-live]');if(!img){return;}var stage=img.parentNode;function finish(err){if(!document.documentElement.contains(img)){return;}img.onload=null;img.onerror=null;clearInterval(cameraPoll);clearTimeout(cameraTimeout);cameraPoll=null;cameraTimeout=null;stage.className='camera-full-image'+(err?' has-camera-error':'');var loader=stage.querySelector('.camera-loading'),badge=stage.querySelector('.camera-live-state');if(err){img.removeAttribute('src');badge.textContent='Live nicht verfügbar';loader.innerHTML='<span>'+esc(err)+'</span><button type="button" class="button" data-action="camera-retry">Erneut versuchen</button>';loader.style.display='';}else{loader.style.display='none';badge.textContent='Live';img.onerror=function(){finish('Der Livestream wurde unterbrochen.');};}}
    img.onload=function(){finish(null);};img.onerror=function(){finish('Der Livestream konnte nicht gestartet werden.');};img.src=img.getAttribute('data-src');
    cameraPoll=setInterval(function(){if(!document.documentElement.contains(img)){camerasRelease();return;}if(img.naturalWidth>0){finish(null);}},250);
    cameraTimeout=setTimeout(function(){finish('Der Livestream antwortet nicht.');},65000);
  }
  function afterRender(){if(lastAppView!==ui.state.view){lastAppView=ui.state.view;if(lastAppView==='security'){refresh();loadDashboard();}}if(appPages){appPages.tick();}indicators();softenLegacyArtwork();showStartup();if(ui.state.view==='home'&&Date.now()-lastDashboardAt>15000){loadDashboard();}for(var id in busy){if(Object.prototype.hasOwnProperty.call(busy,id)&&busy[id]){markPending(id,true);}}}
  function notices() {
    if(inbox){return inbox.filter(function(n){return !n.done&&!n.hidden;});}
    var result=[];
    for(var i=0;i<raw.length;i++){var e=raw[i],dc=e.deviceClass || (e.attributes || {}).device_class;
      if(!available(e)){continue;}
      if(dc==='battery' && ((e.domain==='sensor' && isFinite(Number(e.state)) && Number(e.state)<=20) || (e.domain==='binary_sensor' && e.state==='on'))){result.push(e.name+' · Batterie '+(e.domain==='sensor'?display(e.state)+' %':'schwach'));}
      if(e.domain==='binary_sensor' && ['door','window','opening','smoke','gas','moisture','safety'].indexOf(dc)>=0 && e.state==='on'){result.push(e.name+' · '+(['door','window','opening'].indexOf(dc)>=0?'Offen':'Alarm'));}
    }
    return result;
  }
  function wasteList() { var d=dashboard || {}, list=[{name:'Papiertonne',color:'blue',value:d.blaueTonneNaechsteLeerung},{name:'Gelbe Tonne',color:'yellow',value:d.gelbeTonneNaechsteLeerung},{name:'Restmüll',color:'brown',value:d.restmuellNaechsteLeerung}].filter(function(w){return w.value && ['unavailable','unknown'].indexOf(w.value)<0;});list.forEach(function(w){w.time=Date.parse(w.value);w.label=isFinite(w.time)?new Date(w.time).toLocaleDateString('de-DE'):display(w.value);});list.sort(function(a,b){return (isFinite(a.time)?a.time:Infinity)-(isFinite(b.time)?b.time:Infinity);});return list; }
  function wasteContents() {
    var list=wasteList(),all=ui.state.wasteExpanded,shown=all?list:list.slice(0,1),html='<span class="waste-content"><span class="home-kicker">ABFALL</span><span class="waste-items'+(all?' waste-inline-list':'')+'">';
    for(var i=0;i<shown.length;i++){var w=shown[i];html+='<span class="waste-item bin-'+w.color+'"><span class="bin-mark">'+ui.icon('waste')+'</span><span class="bin-copy"><strong class="waste-name">'+esc(w.name)+'</strong><em class="waste-due">'+esc(w.label)+'</em></span></span>';}
    return html+(shown.length?'':'<span class="waste-empty">Keine Abholungen</span>')+'</span></span>';
  }
  function noticeCards(list){var html='<div class="notice-list" role="list">';for(var i=0;i<list.length;i++){var n=list[i];html+='<article class="notice-item" role="listitem">'+ui.icon('shield')+'<p>'+esc(typeof n==='string'?n:n.title+' · '+n.message)+'</p></article>';}return html+(list.length?'':'<p class="notice-empty">Keine Hinweise</p>')+'</div>';}

  function home() {
    var d=dashboard || {}, w=d.weather || {}, energy=d.energy && d.energy.summary || {}, n=notices();
    var html='<div class="general-home"><div class="general-metrics"><button type="button" class="card overview-metric weather-metric" data-view="weather"><span class="home-kicker">WETTER</span><div class="overview-value">'+esc(display(w.temperature))+' °C '+ui.icon('cloud')+'</div><span class="metric-detail">'+esc(w.stateLabel && w.stateLabel!=='unavailable' ? w.stateLabel : 'Wetter nicht verfügbar')+' · '+esc(d.precipitationOutlook && d.precipitationOutlook.text || '')+'</span></button>';
    html+='<button type="button" class="card overview-metric" data-action="energy"><span class="home-kicker">ENERGIE</span><div class="overview-value">'+esc(display(energy.consumptionDisplay))+' '+ui.icon('energy')+'</div><span class="metric-detail">Solar '+esc(display(energy.solarPowerDisplay))+'</span></button>';
    html+='<button type="button" class="card overview-metric gate-metric" data-action="gate-request" aria-label="Torsteuerung öffnen"><span><span class="home-kicker">HOFTOR</span><span class="overview-value">'+esc(d.torVisualText || '–')+'</span></span></button></div>';
    html+='<div class="general-main">'+ui.homeCamera()+'<div class="general-side"><div class="home-room-stack"><button type="button" class="card overview-side waste-summary'+(ui.state.wasteExpanded?' is-expanded':'')+'" data-action="waste" aria-label="'+(ui.state.wasteExpanded?'Nächste Abholung anzeigen':'Alle Abholungen anzeigen')+'" aria-expanded="'+ui.state.wasteExpanded+'">'+wasteContents()+'</button>'+ui.homeRoomButtons()+'</div>';
    html+='<section class="card overview-side status-summary"><div class="card-head"><h2 class="home-kicker">STATUS &amp; HINWEISE</h2><button class="text-button" type="button" data-action="inbox-open">Posteingang</button></div>'+noticeCards(n)+'</section>';
    return html+'</div></div></div>';
  }
  function settings() {var version=loadedVersion || '–',update=lastVersion&&version!==lastVersion;return '<section class="card panel-device-status"><h2>Dieses Tablet</h2><p id="panelAudioInfo">Ton: '+(soundState()==='disabled'?'im Profil ausgeschaltet':soundUnlocked?'freigegeben':'noch nicht freigegeben')+'</p><p id="panelVersionInfo">Geladene Version: '+esc(version)+(update?' · Update verfügbar: '+esc(lastVersion):'')+'</p><div class="settings-actions"><button class="button" type="button" data-action="sound-unlock">Ton aktivieren</button><button class="button" type="button" data-action="reload-fresh">Dieses iPad neu laden</button><button class="button" type="button" data-action="reload-all">Alle iPads neu laden</button></div></section>'+ui.settingsView().replace(/<p class="info-note">[\s\S]*?<\/p>/g,''); }

  function directory() { request('GET','/api/tablets',null,function(err,data){if(err){return;}data.tablets.forEach(function(t){tabletConfigs[t.id]=t.config;});model.tablets=[model.tablets[0]].concat(data.tablets.filter(function(t){return t.id!==tabletId;}).map(function(t){var p=profile(t.config,t.id,t.online),r=t.panelStatus || {};p.statusText=(r.sound==='ready'?'Ton bereit':r.sound==='disabled'?'Ton aus':'Ton nicht freigegeben')+(r.version?' · '+r.version:'')+(r.version&&r.version!==lastVersion?' · Update verfügbar':'')+(r.reload?' · Neuladen vorgemerkt':'');return p;}));if(ui.state.view==='settings' && ui.state.settingsTab==='all' && !ui.state.dialog){ui.render();}}); }
  function musicDetails(id){var p=get(model.players,id)||get(model.players,ui.state.dialog&&ui.state.dialog.id);if(!p){return;}musicItems=[];musicOffset=0;musicQuery='';ui.openMusic(p.id);el('musicVolume').setAttribute('data-volume',p.id);el('playlistResults').textContent=p.musicAssistant?'Playlists werden geladen …':'Keine Music-Assistant-Bibliothek für dieses Gerät.';el('playlistSearch').style.display=p.musicAssistant?'':'none';var radios=document.querySelectorAll('.radio-station');for(var i=0;i<radios.length;i++){radios[i].disabled=!p.musicAssistant||p.unavailable;}if(p.sources.length){var html='<label for="playerSource">Quelle</label><select id="playerSource" class="dialog-input" data-player="'+esc(p.id)+'">';for(var s=0;s<p.sources.length;s++){html+='<option'+(p.sources[s]===p.source?' selected':'')+'>'+esc(p.sources[s])+'</option>';}html+='</select>';el('playlistResults').insertAdjacentHTML('beforebegin',html);}if(p.musicAssistant){loadMusic(p.id,'',false);}}
  function loadMusic(id,query,append){if(append&&musicBusy){return;}musicBusy=true;var seq=++generation,offset=append?musicOffset:0;if(!append){musicItems=[];}musicQuery=query;request('GET','/api/music/'+encodeURIComponent(id)+'/playlists?q='+encodeURIComponent(query)+'&offset='+offset,null,function(err,data){if(seq!==generation){return;}musicBusy=false;if(!ui.state.dialog||ui.state.dialog.type!=='music'||ui.state.dialog.id!==id){return;}var node=el('playlistResults');if(err){el('musicLibraryStatus').textContent=err;if(!append){node.innerHTML='';}return;}el('musicLibraryStatus').textContent='';var items=data.items || [];for(var i=0;i<items.length;i++){if(!musicItems.some(function(existing){return existing.uri===items[i].uri;})){musicItems.push(items[i]);}}musicOffset=data.nextOffset!==undefined?data.nextOffset:offset+20;var html='';for(var j=0;j<musicItems.length;j++){var item=musicItems[j];html+='<button type="button" class="playlist playlist-tile" data-action="live-playlist" data-id="'+esc(id)+'" data-uri="'+esc(item.uri)+'"><span class="playlist-art">'+ui.icon('music')+'</span><span><strong>'+esc(item.name)+'</strong><small>'+esc(item.source || 'Bibliothek')+'</small></span></button>';}node.innerHTML=html||'<p>Keine passende Playlist. Apple-Music-Playlists müssen in Music Assistant verfügbar sein.</p>';el('playlistMore').style.display=data.more?'':'none';});}
  function updateMusicDialog(){if(!ui.state.dialog||ui.state.dialog.type!=='music'){return;}var p=get(model.players,ui.state.dialog.id);if(!p){return;}textIfChanged(el('musicNowTitle'),p.title||'Keine Wiedergabe');textIfChanged(el('musicNowSubtitle'),p.subtitle||p.name||'');var button=document.querySelector('.music-dialog-play');if(button){attrIfChanged(button,'aria-label',p.playing?'Musik pausieren':'Musik abspielen');var glyph=ui.icon(p.playing?'pause':'play');if(button.getAttribute('data-playing')!==String(p.playing)){button.innerHTML=glyph;button.setAttribute('data-playing',String(p.playing));}}if(!gesture&&!busy[p.id]){if(Number(el('musicVolume').value)!==p.volume){el('musicVolume').value=p.volume;}textIfChanged(el('musicVolumeValue'),p.volume+' %');}}

  function unlock(pin){if(busy.pin){return;}busy.pin=true;request('POST','/api/settings/unlock',{pin:pin},function(err){delete busy.pin;if(!ui.state.dialog || ui.state.dialog.type!=='pin'){return;}ui.state.pin='';ui.updatePin();if(err){el('pinStatus').textContent=err;return;}ui.state.settingsUnlockedUntil=Date.now()+9*60000;var intent=pinIntent;ui.closeDialog();if(intent==='reload-all'){requestReload('all');}else{directory();ui.go('settings');}});}
  function restoreSettings(){var view=ui.state.view;request('GET','/api/settings/session',null,function(err,data){if(ui.state.view!==view){return;}if(!err&&data.unlocked){ui.state.settingsUnlockedUntil=Date.now()+9*60000;ui.go('settings');directory();}else{ui.go('apps');ui.toast('Einstellungen bei Bedarf erneut entsperren.');}});}
  function saveTablet(form){var id=form.getAttribute('data-tablet-id'),actual=id==='this'?tabletId:id;if(busy.settings){return;}var c=JSON.parse(JSON.stringify(tabletConfigs[actual] || {})),checks=form.querySelectorAll('[name=assignedRoom]');c.theme=el('tabletTheme').value;c.name=el('tabletName').value;c.room=el('tabletRoom').value;c.rooms=[];for(var i=0;i<checks.length;i++){if(checks[i].checked){c.rooms.push(checks[i].value);}}c.quickLights=[];for(var q=0;q<2;q++){var v=el('tabletQuick'+q).value;if(v&&c.quickLights.indexOf(v)<0){c.quickLights.push(v);}}c.large=el('tabletSize').value==='large';c.screensaver={enabled:el('tabletSaver').value!=='0',minutes:Number(el('tabletSaver').value) || 5};c.sounds=el('tabletSounds').checked;var old=c.nightMode;c.nightMode=old?JSON.parse(JSON.stringify(old)):{startHour:22,startMinute:0,endHour:7,endMinute:0,brightness:15};c.nightMode.enabled=el('tabletNight').checked;busy.settings=true;request('POST','/api/tablets/'+encodeURIComponent(actual),{config:c},function(err,data){delete busy.settings;if(err){if(/entsperren/.test(err)){ui.state.settingsUnlockedUntil=0;}error(err);return;}c=data.config || data.tablet&&data.tablet.config || c;tabletConfigs[actual]=c;if(id==='this'){applyConfig(c,true);if(c.theme!=='panel'){pendingDesign=c.theme;}}ui.closeDialog();ui.render();directory();ui.toast('Einstellungen gespeichert');});}
  function announce(){if(busy.announce){return;}var text=el('announcementText').value.replace(/^\s+|\s+$/g,'');if(!text){return;}try{localStorage.setItem('haWallpanel.announceSpeak',el('announcementSpeak').checked?'1':'0');}catch(_e){}busy.announce=true;request('POST','/api/tablets/notify',{tablet:el('announcementTarget').value,from:tabletId,title:model.tablets[0].name,message:text,speak:el('announcementSpeak').checked},function(err,data){delete busy.announce;if(err){error(err);return;}if(ui.state.dialog&&ui.state.dialog.type==='announcement'){el('announcementText').value='';}ui.toast(data.delivered?'Durchsage an '+data.delivered+' Tablet(s) gesendet.':'Keine anderen Tablets erreichbar.');});}
  function nextAudio(){if(audioCurrent||unlockingAudio||!audioQueue.length){return;}audioCurrent=true;audio.muted=false;audio.src=audioQueue.shift();try{var result=audio.play();if(result&&result.catch){result.catch(audioFailed);}}catch(_e){audioFailed();}}
  function audioFailed(){audio.pause();audioCurrent=false;audioQueue=[];soundUnlocked=false;indicators();}
  function play(url){if(!model.tablets[0].sounds || !url){return;}if(audioQueue.length<20){audioQueue.push(url);}nextAudio();}
  function playSequence(cmd){if(model.tablets[0].sounds===false){return;}if(cmd.sound&&cmd.sound!=='none'){play('/sounds/'+encodeURIComponent(cmd.sound)+'.mp3');}if(cmd.speechUrl){play(cmd.speechUrl);}}
  function maybeDesign(){if(!pendingDesign||!startupConfirmed||ui.state.dialog||gesture||Object.keys(busy).length||audioCurrent||audioQueue.length||!audio.paused||Date.now()-lastInteraction<2000||/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement||{}).tagName||'')){return;}camerasRelease();window.WallpanelDesign.go(pendingDesign);}

  function assist(){if(busy.assist){return;}var input=el('assistQuestion'),text=input.value.replace(/^\s+|\s+$/g,'');if(!text){return;}busy.assist=true;el('assistAnswer').textContent='Assist antwortet …';request('POST','/api/assist',{text:text,conversationId:conversation},function(err,data){delete busy.assist;if(!err){conversation=data.conversationId || conversation;}if(ui.state.dialog && ui.state.dialog.type==='assist'){el('assistAnswer').textContent=err || data.speech || 'Keine Antwort.';if(!err&&data.audioUrl){play('/'+data.audioUrl.replace(/^\//,''));}}});}
  function weather(){details.weather();}
  function wake(){lastInteraction=Date.now();var saver=el('panelSaver');if(saver && saver.style.display==='block'){saver.style.display='none';refresh();loadDashboard();}}
  function receive(cmd){
    if(cmd.type==='doorbell-close'){startupCommands=startupCommands.filter(function(c){return c.type!=='doorbell';});if(ui.state.dialog&&ui.state.dialog.type==='doorbell'){ui.closeDialog(true,'remote');}return;}
    if(cmd.type==='reload'){reloadJob={id:'legacy'+cmd.createdAt,expiresAt:Date.now()+60000};return;}
    if(!startupConfirmed||(cmd.type==='notify'&&ui.state.dialog)){if(startupCommands.length<20){startupCommands.push(cmd);}return;}
    if(cmd.type==='doorbell'&&config.doorbellWake===false){playSequence(cmd);return;}
    wake();if(cmd.type==='notify'){alerts.notice(cmd);}else if(cmd.type==='doorbell'){alerts.bell(cmd);}else if(cmd.type==='identify'){ui.openDialog(model.tablets[0].name,'<p>'+esc(tabletId)+'</p>','identify');}else if(cmd.type==='sound'){playSequence(cmd);}
  }

  function sync(){if(syncBusy || document.hidden){return;}syncBusy=true;request('POST','/api/tablet/sync',{id:tabletId,page:'panel/'+ui.state.view,version:loadedVersion,sound:soundState(),reloadAck:reloadAck,local:{name:'Neues iPad',room:model.tablets[0].room,screensaver:{enabled:true,minutes:5},sounds:true}},function(err,data){syncBusy=false;if(err){return;}var before=JSON.stringify(model.tablets[0]);applyConfig(data.config,true);if(before!==JSON.stringify(model.tablets[0])){render();}if(!loadedVersion){loadedVersion=data.assetVersion;}lastVersion=data.assetVersion;reloadJob=data.reload || null;startupReady=true;showStartup();indicators();(data.commands || []).forEach(receive);maybeReload();});}
  function unlockAudio(event,callback){
    if(event&&!startupConfirmed){return;}
    if(soundUnlocked || model.tablets[0].sounds===false){if(callback){callback(null);}return;}
    if(callback){audioCallbacks.push(callback);}if(unlockingAudio){return;}
    if(!audio.paused||audioCurrent||audioQueue.length){finishAudioActivation('busy');return;}
    unlockingAudio=true;var attempt=++audioAttempt;audio.src=event?'/sounds/silence.wav':'/sounds/ping.mp3';audio.muted=false;
    try{var promise=audio.play();if(promise&&promise.catch){promise.catch(function(){if(unlockingAudio&&attempt===audioAttempt){finishAudioActivation('blocked');}});}}
    catch(_e){finishAudioActivation('blocked');}
    setTimeout(function(){if(unlockingAudio&&attempt===audioAttempt){finishAudioActivation('timeout');}},6000);
  }
  function textIfChanged(node,value){if(node&&node.textContent!==value){node.textContent=value;}}
  function attrIfChanged(node,key,value){if(node&&node.getAttribute(key)!==value){node.setAttribute(key,value);}}
  function showStartup(){
    if(!startupReady || startupConfirmed || startupStarted || ui.state.dialog){return;}
    startupStarted=true;
    ui.openDialog('Neue Version','<div class="startup-summary"><strong>'+esc(model.tablets[0].name)+'</strong><p id="startupVersion">Version '+esc(loadedVersion)+'</p></div><div id="startupUpdate"></div><p id="startupError" class="startup-error" role="status"></p><button type="button" class="button primary" data-action="startup-confirm">'+(model.tablets[0].sounds===false?'Bestätigen':'Bestätigen & Ton aktivieren')+'</button><button type="button" class="button" id="startupSkipAudio" data-action="startup-silent" style="display:none">Ohne Ton fortfahren</button>','startup');
    el('dialogRoot').querySelector('.dialog-close').style.display='none';
    var button=el('dialogRoot').querySelector('[data-action="startup-confirm"]');button.focus();indicators();
  }
  function confirmStartup(){
    var button=el('dialogRoot').querySelector('[data-action="startup-confirm"]');if(!button || button.disabled){return;}
    if(model.tablets[0].sounds===false || soundUnlocked){completeStartup();return;}
    button.disabled=true;button.textContent='Ton wird aktiviert …';textIfChanged(el('startupError'),'');
    unlockAudio(null,function(err){if(!ui.state.dialog || ui.state.dialog.type!=='startup'){return;}if(err){button.disabled=false;button.textContent='Ton erneut aktivieren';textIfChanged(el('startupError'),'Ton konnte nicht freigegeben werden. Bitte erneut versuchen.');el('startupSkipAudio').style.display='inline-block';}else{completeStartup();}});
  }
  function completeStartup(){startupConfirmed=true;ui.closeDialog(true);dirty=true;render();drainStartupCommands();sync();}
  function drainStartupCommands(){if(startupConfirmed&&!ui.state.dialog&&startupCommands.length){receive(startupCommands.shift());}}
  function finishAudioActivation(err){
    unlockingAudio=false;soundUnlocked=!err;indicators();var callbacks=audioCallbacks;audioCallbacks=[];
    for(var i=0;i<callbacks.length;i++){callbacks[i](err);}if(!err){nextAudio();}
  }

  function soundState(){return model.tablets[0].sounds===false?'disabled':soundUnlocked?'ready':'blocked';}
  function indicators(){
    var s=el('panelSound'),update=!!(loadedVersion&&lastVersion&&loadedVersion!==lastVersion),g=el('settingsNav'),apps=el('appsNav');
    if(s){var text=soundState()==='disabled'?'Ton aus':soundUnlocked?'Ton bereit':'Ton aktivieren';if(!s.firstChild&&ui){s.innerHTML=ui.icon('sound');}attrIfChanged(s,'aria-label',text);attrIfChanged(s,'title',text);attrIfChanged(s,'aria-pressed',String(soundUnlocked));var cls='quick-tool sound-tool'+(soundState()==='blocked'?' needs-sound':'');if(s.className!==cls){s.className=cls;}}
    textIfChanged(el('panelVersionInfo'),'Geladene Version: '+(loadedVersion || '–')+(update?' · Update verfügbar: '+lastVersion:'')+(reloadJob?' · Neuladen vorgemerkt':''));
    textIfChanged(el('panelAudioInfo'),'Ton: '+(soundState()==='disabled'?'im Profil ausgeschaltet':soundUnlocked?'freigegeben':'noch nicht freigegeben'));
    if(g){attrIfChanged(g,'title',update?'Einstellungen · Update verfügbar':'Einstellungen');attrIfChanged(g,'data-update',update?'true':'false');attrIfChanged(g,'aria-label',update?'Tablet-Einstellungen · Update verfügbar':'Tablet-Einstellungen');}
    if(apps){attrIfChanged(apps,'data-update',update?'true':'false');attrIfChanged(apps,'title',update?'Apps · Update verfügbar':'Apps');}
    var notice=el('startupUpdate');if(notice){var html=update?'<p>Update verfügbar: '+esc(lastVersion)+'</p><button class="button" type="button" data-action="reload-fresh">Aktuelle Version laden</button>':'';if(notice.getAttribute('data-version')!==lastVersion){notice.innerHTML=html;notice.setAttribute('data-version',lastVersion);}}
  }
  function softenLegacyArtwork(){
    if(!lowPower){return;}var img=document.querySelector('.music-artwork-background img');if(!img){return;}
    function soften(){if(!img.parentNode || !img.complete || !img.naturalWidth){return;}var canvas=document.createElement('canvas');canvas.width=12;canvas.height=12;canvas.setAttribute('aria-hidden','true');var ctx=canvas.getContext('2d');if(!ctx){return;}ctx.drawImage(img,0,0,12,12);img.parentNode.replaceChild(canvas,img);}
    if(img.complete){soften();}else{img.onload=soften;}
  }

  // Boiler-Timer: nur in der Raumansicht abfragen; der Server ordnet ihn einem Raum (Küche) zu.
  var boiler=null,boilerLoading=false,boilerAt=0,boilerSignature='';
  function boilerRemaining(){if(!boiler||boiler.state!=='active'||!boiler.attributes||!boiler.attributes.finishes_at){return null;}var end=new Date(boiler.attributes.finishes_at).getTime();return isNaN(end)?null:Math.max(0,Math.ceil((end-Date.now())/1000));}
  function boilerText(){if(!boiler||boiler.state!=='active'){return boiler&&boiler.state==='paused'?'Pausiert':'Aus';}var r=boilerRemaining();if(r===null){return 'Läuft';}var m=Math.floor(r/60),sec=r%60;return 'Läuft · noch '+(m<10?'0':'')+m+':'+(sec<10?'0':'')+sec;}
  function loadBoiler(force){
    if(!ui||ui.state.view!=='room'||boilerLoading||document.hidden){return;}boilerLoading=true;boilerAt=Date.now();
    request('GET','/api/timer/boiler',null,function(err,data){boilerLoading=false;if(err||!data||typeof data!=='object'){return;}boiler=data;var sig=[data.roomId || '',data.state || '',data.attributes&&data.attributes.finishes_at || ''].join('|');if(sig!==boilerSignature||force){boilerSignature=sig;dirty=true;render();}});
  }
  function tickBoiler(){
    if(!ui||ui.state.view!=='room'||document.hidden){return;}
    if(!boilerAt||Date.now()-boilerAt>=5000||boilerRemaining()===0&&Date.now()-boilerAt>2000){loadBoiler(false);}
    textIfChanged(el('panelBoilerState'),boilerText());
  }
  function roomBoiler(id){
    // Nur anzeigen, solange der Timer der Boiler-Automation tatsächlich zählt.
    if(!boiler||!boiler.roomId||boiler.roomId!==id||boiler.state!=='active'){return '';}var active=true;
    return '<section class="card boiler-card'+(active?' is-active':'')+'" aria-label="Boiler"><div class="boiler-copy"><h2 class="section-label">Boiler</h2><strong id="panelBoilerState" class="boiler-state" role="status">'+esc(boilerText())+'</strong></div><button type="button" class="button'+(active?'':' primary')+' boiler-start" data-action="boiler-start"'+(busy.boiler?' disabled':'')+'>'+(active?'Neu starten (10 Min.)':'10 Minuten starten')+'</button></section>';
  }
  function startBoiler(node){
    if(busy.boiler){return;}if(!window.confirm('Timer auf 10 Minuten setzen?')){return;}
    busy.boiler=true;if(node){node.disabled=true;node.setAttribute('aria-busy','true');}
    request('POST','/api/timer/boiler/reset',{},function(err){setTimeout(function(){delete busy.boiler;if(err){error('Boiler-Timer konnte nicht gestartet werden.');}else{ui.toast('Boiler läuft 10 Minuten.');}boilerAt=0;loadBoiler(true);if(node&&node.parentNode){node.disabled=false;node.removeAttribute('aria-busy');}},err?0:600);});
  }
  function roomClimate(id){var r=readings[id],html='';if(!r){return html;}if(typeof r.temperature==='number'){html+='<span>Temperatur <strong>'+esc(display(r.temperature))+' °C</strong></span>';}if(typeof r.humidity==='number'){html+='<span>Luftfeuchte <strong>'+esc(display(r.humidity))+' %</strong></span>';}return html?'<div class="room-readings" aria-label="Raumklima">'+html+'</div>':'';}
  function inboxItems(){return inbox || [];}
  function openInbox(){ui.openDialog('Posteingang',inboxContents(),'inbox');inboxDialogSignature=JSON.stringify(inbox);}
  function updateInboxDialog(){if(gesture||!ui.state.dialog||ui.state.dialog.type!=='inbox'){return;}var signature=JSON.stringify(inbox);if(signature!==inboxDialogSignature){el('dialogRoot').querySelector('.dialog-body').innerHTML=inboxContents();inboxDialogSignature=signature;}}
  function inboxContents(){var all=inboxItems(),html='<div class="inbox-list">';for(var i=0;i<all.length;i++){var n=all[i];html+='<article class="inbox-item'+(n.done?' is-done':'')+'"><div><strong>'+esc(n.title)+'</strong><p>'+esc(n.message)+'</p><small>'+esc(n.done?(n.active?'Erledigt':'Behoben'):n.hidden?'Ausgeblendet':'Offen')+'</small></div><div class="inbox-actions">';if(!n.done&&!n.hidden){html+='<button class="button" type="button" data-action="inbox-hide" data-id="'+esc(n.id)+'">Ausblenden</button>';}if(!n.done){html+='<button class="button primary" type="button" data-action="inbox-done" data-id="'+esc(n.id)+'">Erledigt</button>';}else if(n.active){html+='<button class="button" type="button" data-action="inbox-show" data-id="'+esc(n.id)+'">Wieder öffnen</button>';}if(n.hidden&&!n.done){html+='<button class="button" type="button" data-action="inbox-show" data-id="'+esc(n.id)+'">Einblenden</button>';}html+='</div></article>'; }return html+(all.length?'':'<p>Keine Hinweise vorhanden.</p>')+'</div>';}
  function changeInbox(id,act){if(busy.inbox){return;}busy.inbox=true;request('POST','/api/panel/inbox/action',{id:id,action:act},function(err,data){delete busy.inbox;if(err){error(err);return;}inbox=data.items || [];dirty=true;if(ui.state.dialog&&ui.state.dialog.type==='inbox'){el('dialogRoot').querySelector('.dialog-body').innerHTML=inboxContents();}else{render();}});}
  function syncClimates(id){
    var source=get(model.climates,id),targets=source?model.climates.filter(function(c){return c.room===source.room&&c.id!==id&&!c.unavailable;}):[];
    if(!source||source.unavailable||!online||Date.now()-lastState>30000){error('Keine aktuelle Verbindung zur Heizung.');return;}
    var ids=[id].concat(targets.map(function(c){return c.id;}));if(ids.some(function(k){return !!busy[k];})){return;}
    ids.forEach(function(k){busy[k]=true;markPending(k,true);});
    request('POST','/api/panel/climate-sync',{source:id},function(err,data){
      ids.forEach(function(k){delete busy[k];markPending(k,false);});
      if(err){error(err);return;}
      var failed=[],count=0; (data.results || []).forEach(function(p){if(!p.ok){failed.push((get(model.climates,p.id) || {}).name || 'Heizung');return;}count++;busy[p.id]=true;markPending(p.id,true);pending[p.id]={service:'sync_climate',data:{hvac_mode:p.mode,temperature:p.temperature},after:stateSequence,until:Date.now()+20000};});
      ui.toast(failed.length?'Einige Heizungen konnten nicht übernommen werden: '+failed.join(', '):count?'Synchronisierung läuft'+(data.skipped.length?' · '+data.skipped.length+' nicht erreichbar':''):'Keine weiteren erreichbaren Heizungen.');refresh();
    });
  }
  function requestReloadFromPin(){pinIntent='reload-all';var dialog=ui.state.dialog;request('GET','/api/settings/session',null,function(err,data){if(ui.state.dialog!==dialog){return;}if(!err&&data.unlocked){ui.closeDialog();requestReload('all');}else{el('pinStatus').textContent=err || 'PIN eingeben, um alle iPads neu zu laden.';}});}
  function requestReload(target){if(busy.reload){return;}busy.reload=true;request('POST','/api/panel/reload',{target:target},function(err,data){delete busy.reload;if(err){error(err);}else{ui.toast('Neuladen für '+data.delivered+' Tablet(s) vorgemerkt.');directory();}});}
  function maybeReload(){
    if(!reloadJob || reloadJob.expiresAt<=Date.now()){reloadJob=null;return;}
    if(!startupConfirmed||reloading||gesture||Object.keys(busy).length||ui.state.dialog||ui.state.view==='settings'||Date.now()-lastInteraction<1800||audioCurrent||audioQueue.length||!audio.paused||window.WallpanelThermostat.active()||window.WallpanelPowerFader.active()){return;}
    var focused=document.activeElement;if(focused&&/^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName)){return;}
    reloading=true;var url=window.location.pathname+'?_reload='+Date.now()+'&_reloadJob='+encodeURIComponent(reloadJob.id)+window.location.hash;window.location.replace(url);
  }

  function action(name,id,node){if(alerts&&alerts.action(name,id,node)){return true;}if(lightUI&&lightUI.action(name,id,node)){return true;}if(name==='music-more'){loadMusic(id,musicQuery,true);return true;}if(name==='boiler-start'){startBoiler(node);return true;}if(name==='live-radio'){var radioPlayer=get(model.players,id);if(busy.music||!radioPlayer||!radioPlayer.musicAssistant||radioPlayer.unavailable){return true;}busy.music=true;node.disabled=true;node.setAttribute('aria-busy','true');request('POST','/api/music/'+encodeURIComponent(id)+'/radio',{station:node.getAttribute('data-station')},function(err){delete busy.music;node.disabled=false;node.removeAttribute('aria-busy');if(err){error(err);}else{ui.closeDialog();refresh();}});return true;}if(appPages&&appPages.action(name,id,node)){return true;}if(name==='startup-confirm'){confirmStartup();return true;}if(name==='startup-silent'){completeStartup();return true;}if(name==='climate-sync'){syncClimates(id);return true;}if(name==='sound-unlock'){unlockAudio();return true;}if(name==='inbox-open'){openInbox();return true;}if(name.indexOf('inbox-')===0){changeInbox(id,name.slice(6));return true;}if(name==='reload-all'){if(ui.state.dialog&&ui.state.dialog.type==='pin'){requestReloadFromPin();}else{requestReload('all');}return true;}if(name==='reload-tablet'){requestReload(id==='this'?tabletId:id);return true;}if(details&&details.action(name,id,node)){return true;}if(name==='camera-retry'&&ui.state.dialog&&ui.state.dialog.type==='camera'){ui.openCamera(ui.state.dialog.id,'live');return true;}var l=get(model.lights,id),p=get(model.players,id) || get(model.players,ui.state.dialog && ui.state.dialog.id),c=get(model.climates,id);
    if(name==='light'||name==='light-dialog-toggle'){if(l&&!l.unavailable){command(id,l.on?'turn_off':'turn_on',{});}return true;}
    if(name==='color'){l=get(model.lights,ui.state.dialog && ui.state.dialog.id);if(l&&l.colorCapable){command(l.id,'turn_on',{hs_color:({warm:[35,45],white:[0,0],blue:[210,65],green:[115,50]})[id]});}return true;}
    if(name==='temperature-up'||name==='temperature-down'){if(c){temperature(id,(typeof c.target==='number'?c.target:c.min)+(name==='temperature-up'?c.step:-c.step));}return true;}
    if(name==='climate-mode'){if(c&&!c.unavailable){command(id,'set_hvac_mode',{hvac_mode:node.getAttribute('data-mode')});}return true;}
    if(name==='socket'){var sw=get(model.switches,id);if(sw&&!sw.unavailable){command(id,sw.on?'turn_off':'turn_on',{});}return true;}
    if(name==='music-play'||name==='music-next'||name==='music-previous'){if(p&&!p.unavailable){command(p.id,name==='music-play'?(p.playing?'media_pause':'media_play'):name==='music-next'?'media_next_track':'media_previous_track',{});}return true;}
    if(name==='music-library'||name==='music-details'){musicDetails(id);return true;}
    if(name==='live-playlist'){if(!busy.music){busy.music=true;request('POST','/api/music/'+encodeURIComponent(id)+'/play',{uri:node.getAttribute('data-uri')},function(err){delete busy.music;if(err){error(err);}else{ui.closeDialog();refresh();}});}return true;}
    if(name==='scene'||name==='confirm-scene'){command(id,'turn_on',{});return true;}
    if(name==='waste'){ui.state.wasteExpanded=!ui.state.wasteExpanded;var tile=document.querySelector('.waste-summary');tile.className='card overview-side waste-summary'+(ui.state.wasteExpanded?' is-expanded':'');tile.setAttribute('aria-expanded',String(ui.state.wasteExpanded));tile.setAttribute('aria-label',ui.state.wasteExpanded?'Nächste Abholung anzeigen':'Alle Abholungen anzeigen');tile.innerHTML=wasteContents();return true;}
    if(name==='house-status'){var ns=notices();ui.openDialog('Status & Hinweise',noticeCards(ns),'status');return true;}
    if(name==='identify'){request('POST','/api/tablets/'+encodeURIComponent(id==='this'?tabletId:id)+'/command',{type:'identify'},function(err){if(err){error(err);}});return true;}
    // Altes/doppeltes Tablet aus der Liste entfernen (nicht das eigene). Läuft es noch, meldet es sich neu an.
    if(name==='tablet-remove'){var removeId=id==='this'?tabletId:id;if(removeId===tabletId||busy.remove){return true;}if(!window.confirm('Dieses Tablet aus der Liste entfernen?')){return true;}busy.remove=true;request('DELETE','/api/tablets/'+encodeURIComponent(removeId),null,function(err,data){delete busy.remove;if(err){if(/entsperren/.test(err)){ui.state.settingsUnlockedUntil=0;}error(err);return;}delete tabletConfigs[removeId];ui.closeDialog();directory();ui.toast(data&&data.wasOnline?'Entfernt – das Tablet ist aber noch online und meldet sich gleich wieder an.':'Tablet entfernt');});return true;}
    if(name==='dialog-close' || name==='backdrop-close'){setTimeout(function(){if(dirty){render();}showStartup();drainStartupCommands();},0);return false;}
    if(name==='settings-all'){ui.state.settingsTab='all';ui.render();directory();return true;}
    if(name==='tablet-edit'){var t=get(model.tablets,id);if(t){ui.openDialog(t.name,'<form id="tabletSettings" data-tablet-id="'+esc(id)+'">'+ui.tabletFields(t)+'<button type="submit" class="button primary">Speichern</button></form><button type="button" class="button" data-action="identify" data-id="'+esc(id)+'">Tablet identifizieren</button><button type="button" class="button" data-action="reload-tablet" data-id="'+esc(id)+'">Tablet neu laden</button>','tablet',id);}return true;}
    if(name==='announcement-preset'){el('announcementText').value=id;announce();return true;}if(name==='announce'){setTimeout(function(){var speak=el('announcementSpeak');if(speak){try{speak.checked=localStorage.getItem('haWallpanel.announceSpeak')!=='0';}catch(_e){}}},0);directory();request('GET','/api/tablets/directory',null,function(err,data){if(err||!ui.state.dialog||ui.state.dialog.type!=='announcement'){return;}var select=el('announcementTarget'),html='<option value="all">Alle Tablets</option>';for(var i=0;i<data.tablets.length;i++){var t=data.tablets[i];if(t.id!==tabletId){html+='<option value="'+esc(t.id)+'">'+esc(t.name || 'Tablet')+(t.online?'':' (offline)')+'</option>';}}select.innerHTML=html;var presets=document.querySelector('.announcement-presets');if(presets && Array.isArray(data.presets)){var buttons='';for(var j=0;j<data.presets.length;j++){buttons+='<button type="button" class="button" data-action="announcement-preset" data-id="'+esc(data.presets[j])+'">'+esc(data.presets[j])+'</button>';}presets.innerHTML=buttons;}});return false;}
    if(name==='notice-demo'||name==='doorbell-demo'||name==='playlist'){return true;}
    return false;
  }
  function change(event){if(lightUI&&lightUI.change(event)){return true;}if(details&&details.change(event)){return true;}var n=event.target,bid=n.getAttribute('data-brightness') || (n.id==='brightness'?n.getAttribute('data-light'):null),pid=n.getAttribute('data-volume') || (n.id==='musicVolume'&&ui.state.dialog?ui.state.dialog.id:null);if(bid){command(bid,'turn_on',{brightness_pct:Number(n.value)});return true;}if(pid){command(pid,'volume_set',{volume_level:Number(n.value)/100});return true;}if(n.id==='announcementSpeak'){try{localStorage.setItem('haWallpanel.announceSpeak',n.checked?'1':'0');}catch(_e){}return true;}if(n.id==='playerSource'){command(n.getAttribute('data-player'),'select_source',{source:n.value});return true;}return false;}
  function attach(api){ui=api;window.WallpanelDesign.store('panel');alerts=window.createWallpanelAlerts({ui:ui,request:request,playSequence:playSequence,cameraImage:cameraImage,bindCamera:afterDialog,releaseCamera:camerasRelease,tabletId:function(){return tabletId;}});lightUI=window.createWallpanelLightControls({ui:ui,request:request,entities:function(){return raw;},command:command,lowPower:lowPower});appPages=window.createWallpanelApps({ui:ui,request:request,entities:function(){return raw;},securityReady:function(){return securityReady;},cameras:function(){return model.cameras;},cameraImage:cameraImage,changed:render,refreshSecurity:function(){refresh();loadDashboard();}});details=window.createWallpanelDetails({ui:ui,request:request,dashboard:function(){return dashboard || {};},entities:function(){return raw;},loadDashboard:loadDashboard});try{tabletId=localStorage.getItem('haWallpanel.tabletId') || '';if(!/^[a-zA-Z0-9]{8,40}$/.test(tabletId)){tabletId='tablet'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);localStorage.setItem('haWallpanel.tabletId',tabletId);}}catch(_e){tabletId='tablet'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);}
    el('content').addEventListener('scroll',function(){lastScrollAt=Date.now();},false);
    var saver=document.createElement('div');saver.id='panelSaver';saver.className='panel-saver';saver.innerHTML='<strong id="saverTime"></strong><p>'+esc(model.tablets[0].name)+'</p>';document.body.appendChild(saver);var night=document.createElement('div');night.className='panel-night';night.id='panelNight';document.body.appendChild(night);
    function start(e){wake();gesture=true;}
    function end(){gesture=false;if(dirty){setTimeout(function(){if(dirty){render();}},100);}}
    document.addEventListener('touchstart',start,false);document.addEventListener('mousedown',start,false);document.addEventListener('touchend',end,false);document.addEventListener('touchcancel',end,false);document.addEventListener('mouseup',end,false);document.addEventListener('keydown',wake,false);
    audio.addEventListener('playing',function(){if(unlockingAudio){finishAudioActivation(null);}else{soundUnlocked=true;indicators();}},false);
    audio.addEventListener('ended',function(){audioCurrent=false;nextAudio();},false);
    audio.addEventListener('error',function(){audio.pause();audioCurrent=false;audioQueue=[];audio.muted=false;if(unlockingAudio){finishAudioActivation('error');}else{soundUnlocked=false;indicators();}},false);
    document.addEventListener('error',function(e){var id=e.target.getAttribute&&e.target.getAttribute('data-camera');if(id&&!e.target.hasAttribute('data-live')){failedCameras[id]=Date.now();e.target.style.display='none';model.cameras=model.cameras.filter(function(c){return c.id!==id;});render();}},true);
    document.addEventListener('visibilitychange',function(){if(document.hidden){hiddenAt=Date.now();camerasRelease();}else{if(hiddenAt){for(var key in pending){if(Object.prototype.hasOwnProperty.call(pending,key)){pending[key].until+=Date.now()-hiddenAt;}}hiddenAt=0;}if(alerts){alerts.visibility();}if(ui.state.dialog&&ui.state.dialog.type==='camera'&&ui.state.dialog.mode==='live'){ui.openCamera(ui.state.dialog.id,'event');}refresh();loadDashboard();sync();}},false);
    refresh();loadDashboard();sync();setInterval(refresh,5000);setInterval(tickBoiler,1000);setInterval(loadDashboard,15000);setInterval(sync,3000);setInterval(function(){if(document.hidden){return;}var p=model.tablets[0],nm=config.nightMode,d=new Date(),minute=d.getHours()*60+d.getMinutes(),nightActive=false;if(nm&&nm.enabled){var a=nm.startHour*60+nm.startMinute,b=nm.endHour*60+nm.endMinute;nightActive=a<=b?minute>=a&&minute<b:minute>=a||minute<b;}var nightDisplay=nightActive?'block':'none',nightOpacity=String(1-(nm&&nm.brightness || 15)/100);if(night.style.display!==nightDisplay){night.style.display=nightDisplay;}if(night.style.opacity!==nightOpacity){night.style.opacity=nightOpacity;}if(startupConfirmed&&!ui.state.dialog&&ui.state.view!=='settings'&&p.saver!=='0'&&Date.now()-lastInteraction>Number(p.saver)*60000){if(saver.style.display!=='block'){saver.style.display='block';}textIfChanged(el('saverTime'),el('clockTime').textContent);}for(var id in pending){if(Object.prototype.hasOwnProperty.call(pending,id)&&pending[id].until<Date.now()){delete pending[id];delete busy[id];markPending(id,false);error('Änderung von Home Assistant noch nicht bestätigt.');dirty=true;}}if(dirty){render();}indicators();updateInboxDialog();showStartup();drainStartupCommands();if(appPages){appPages.tick();}maybeReload();maybeDesign();},1000);setInterval(function(){if(!document.hidden&&ui.state.view==='settings'&&ui.state.settingsTab==='all'&&!ui.state.dialog){directory();}},15000);
  }
  window.WallpanelRuntime={lightControls:function(id){return lightUI?lightUI.controls(id):'';},lowPower:lowPower,canCloseDialog:function(){return !ui.state.dialog || ui.state.dialog.type!=='startup';},roomClimate:roomClimate,roomBoiler:roomBoiler,weather:weather,model:model,attach:attach,brightness:brightness,afterDialog:afterDialog,afterRender:afterRender,view:function(name){return name==='home'?home():name==='settings'?settings():appPages?appPages.view(name):null;},action:action,temperature:temperature,releaseDialog:function(){pinIntent='';if(lightUI){lightUI.release();}camerasRelease();if(details){details.release();}if(alerts){alerts.release();}},dialogClosed:function(dialog,reason){if(alerts){alerts.closed(dialog,reason);}},cameraImage:cameraImage,unlock:unlock,restoreSettings:restoreSettings,saveTablet:saveTablet,announce:announce,assist:assist,input:function(e){if(lightUI&&lightUI.input(e)){return true;}if(e.target.id==='playlistSearch'){clearTimeout(searchTimer);var id=ui.state.dialog&&ui.state.dialog.id,query=e.target.value;searchTimer=setTimeout(function(){loadMusic(id,query);},300);return true;}return false;},change:change};
})();
