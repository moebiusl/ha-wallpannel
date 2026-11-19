/* Verwaltung im Panel: Klingel & Töne, Automationen, System sowie Add-ons & Info.
   Ersetzt die frühere klassische Optionen-Seite. Bearbeitet wird in Dialogen (wie bei den Tablet-Einstellungen).
   ES5 für alte iPads, keine eigenen Netzwerkpfade außer den bestehenden Verwaltungs-Schnittstellen. */
(function(){'use strict';
window.createWallpanelAdmin=function(ctx){
  var ui=ctx.ui,esc=ui.esc,request=ctx.request;
  var TABS=[['klingel','Klingel & Töne'],['automations','Automationen'],['system','System'],['addons','Add-ons & Info']];
  var SOUNDS=[['gong','Gong (Ding-Dong)'],['glocke','Glocke'],['ping','Ping (dezent)'],['hinweis','Hinweis (drei Töne)'],['alarm','Alarm (dringend)'],['none','Kein Ton']];
  var TANK=[['maxLiter','Tankinhalt','Liter','number.hof_wasserstand_test_max_tank_liter'],['fullDistance','Abstand bei vollem Tank','cm','number.hof_wasserstand_test_tank_full_distance'],['emptyDistance','Abstand bei leerem Tank','cm','number.hof_wasserstand_test_tank_empty_distance']];
  var SENSOR_GROUPS=[['cpu','Prozessor',['prozessor','cpu','neustart','last_boot']],['ram','Arbeitsspeicher',['arbeitsspeicher','swap','speicher']],['disk','Massenspeicher',['massenspeicher','disk']],['network','Netzwerk',['pakete','bytes','netzwerk','network','throughput']]];
  var KEY_SENSORS=['prozessornutzung','prozessortemperatur','arbeitsspeicherauslastung','massenspeicher-auslastung /','swap-auslastung'];
  var S={data:{},error:{},loading:{},filter:'gate',changelog:null,allSensors:false};

  /* ---------- Helfer ---------- */
  function pad(n){return n<10?'0'+n:String(n);}
  function clock(iso){var d=new Date(iso);return isNaN(d.getTime())?'–':pad(d.getHours())+':'+pad(d.getMinutes());}
  function dateKey(iso){var d=new Date(iso);return isNaN(d.getTime())?'':pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear();}
  function dateTime(iso){var d=new Date(iso);return isNaN(d.getTime())?'–':dateKey(iso)+' '+clock(iso);}
  function dayLabel(key){var now=new Date(),today=pad(now.getDate())+'.'+pad(now.getMonth()+1)+'.'+now.getFullYear(),y=new Date(now.getTime()-864e5),yesterday=pad(y.getDate())+'.'+pad(y.getMonth()+1)+'.'+y.getFullYear();return key===today?'Heute':key===yesterday?'Gestern':key;}
  function nameOf(list,id){list=list || [];for(var i=0;i<list.length;i++){if(list[i].entityId===id){return list[i].name;}}return id;}
  function btn(action,label,id,cls,extra){return '<button type="button" class="button'+(cls?' '+cls:'')+'" data-action="'+action+'"'+(id?' data-id="'+esc(id)+'"':'')+(extra || '')+'>'+esc(label)+'</button>';}
  function card(title,body,head){return '<section class="card settings-card"><div class="card-head"><h2>'+esc(title)+'</h2>'+(head || '')+'</div>'+body+'</section>';}
  function rows(list){var html='<div class="admin-rows">';for(var i=0;i<list.length;i++){html+='<div class="admin-row"><span>'+esc(list[i][0])+'</span><strong>'+esc(list[i][1])+'</strong></div>';}return html+'</div>';}
  function status(){return '<p id="adminStatus" class="pin-status" role="status"></p>';}
  function setStatus(text){var n=document.getElementById('adminStatus');if(n){n.textContent=text || '';}}
  function notice(key,tab){if(S.error[key]){return '<p role="alert">'+esc(S.error[key])+'</p>'+btn('admin-reload','Erneut laden',tab);}return S.loading[key] && S.data[key]===undefined?'<p class="muted" role="status">Wird geladen …</p>':'';}
  function options(list,selected){var html='';for(var i=0;i<list.length;i++){html+='<option value="'+esc(list[i][0])+'"'+(list[i][0]===selected?' selected':'')+'>'+esc(list[i][1])+'</option>';}return html;}

  function load(key,url,force){
    if(S.loading[key] || (!force && (S.data[key]!==undefined || S.error[key]))){return;}
    S.loading[key]=true;S.error[key]='';
    request('GET',url,null,function(err,data){S.loading[key]=false;if(err){S.error[key]=err;}else{S.data[key]=data;}ctx.changed();});
  }
  function loadActivity(force){
    if(S.filter==='automationen'){load('logbook','/api/ha-logbook?hours=24',force);}
    else{load('activity:'+S.filter,'/api/activity-log'+(S.filter==='all'?'':'?category='+encodeURIComponent(S.filter)),force);}
  }
  function open(tab,force){
    if(tab==='klingel'){load('tablets','/api/tablets',force);}
    else if(tab==='automations'){load('automations','/api/automations',force);}
    else if(tab==='system'){load('sensors','/api/system-sensors',force);loadActivity(force);load('tank','/api/wassertank',force);}
    else if(tab==='addons'){load('addons','/api/addons',force);load('info','/api/addon-info',force);}
  }
  function save(url,body,after){
    var buttons=document.querySelectorAll('#adminForm button');for(var i=0;i<buttons.length;i++){buttons[i].disabled=true;}
    setStatus('Wird gespeichert …');
    request('POST',url,body,function(err,data){
      for(var j=0;j<buttons.length;j++){buttons[j].disabled=false;}
      if(err){if(/entsperren/.test(err)){ui.state.settingsUnlockedUntil=0;}setStatus(err);return;}
      ui.closeDialog();ui.toast('Gespeichert');if(after){after(data);}
    });
  }

  /* ---------- Klingel & Töne ---------- */
  function viewKlingel(){
    var d=S.data.tablets;
    if(!d){return card('Klingel',notice('tablets','klingel') || '<p class="muted" role="status">Wird geladen …</p>');}
    var st=d.settings || {},bell=d.doorbell || {},c=d.candidates || {},boiler=d.boiler || {};
    var sensor=st.doorbellEntity?nameOf(c.doorbell,st.doorbellEntity):'Automatisch'+(bell.autoEntity?' ('+bell.autoEntity+')':' – nichts gefunden');
    var names=[],active=bell.lights || [];for(var i=0;i<active.length;i++){names.push(nameOf(c.lights,active[i]));}
    var lights=active.length?((st.doorbellLights || []).length?'':'Automatisch: ')+names.join(', '):'Keine';
    var boilerName=st.boilerEntity?nameOf(c.boiler,st.boilerEntity):boiler.auto?'Automatisch ('+boiler.auto.name+')':'Automatisch – nichts gefunden, nur Timer';
    var presets=st.announcementPresets || [],chips='';for(var p=0;p<presets.length;p++){chips+='<span class="pill">'+esc(presets[p])+'</span> ';}
    return card('Klingel',rows([['Klingel-Sensor',sensor],['Kamera',st.doorbellCamera?nameOf(c.cameras,st.doorbellCamera):'–'],['Lichter beim Klingeln',lights]])+'<div class="admin-actions">'+btn('admin-edit','Bearbeiten','doorbell')+btn('admin-bell-test','Test-Klingel senden')+'</div><p class="info-note">Die Test-Klingel erscheint auf allen angemeldeten Tablets.</p>')
      +card('Boiler',rows([['Boiler-Schalter',boilerName]])+'<div class="admin-actions">'+btn('admin-edit','Bearbeiten','boiler')+'</div>')
      +card('Töne',rows([['Klingelton',nameOf(SOUNDS.map(function(s){return {entityId:s[0],name:s[1]};}),st.doorbellSound || 'gong')],['Mitteilungston',nameOf(SOUNDS.map(function(s){return {entityId:s[0],name:s[1]};}),st.noticeSound || 'ping')]])+'<div class="admin-actions">'+btn('admin-edit','Bearbeiten','sounds')+'</div>')
      +card('Schnell-Durchsagen',(chips || '<p class="muted">Keine Vorlagen.</p>')+'<div class="admin-actions">'+btn('admin-edit','Bearbeiten','presets')+'</div>')
      +card('Mitteilungen aus Home Assistant','<p class="card-description">In einer HA-Automation als Aktion ein Event auslösen. <code>tablet</code> ist der Tablet-Name oder <code>all</code>.</p><pre class="admin-code">action: event\nevent: wallpanel_notify\nevent_data:\n  tablet: Flur\n  title: Hoftor\n  message: Das Tor ist seit 10 Minuten offen.\n  duration: 60\n  sound: hinweis   # gong, glocke, ping, hinweis, alarm oder none\n  speak: true      # Mitteilung vorlesen</pre>');
  }
  function formDoorbell(){
    var d=S.data.tablets,st=d.settings || {},bell=d.doorbell || {},c=d.candidates || {};
    var sensors='<option value="">Automatisch'+(bell.autoEntity?' ('+esc(bell.autoEntity)+')':' – nichts gefunden')+'</option>',list=c.doorbell || [];
    for(var i=0;i<list.length;i++){sensors+='<option value="'+esc(list[i].entityId)+'"'+(list[i].entityId===st.doorbellEntity?' selected':'')+'>'+esc(list[i].name)+' ('+esc(list[i].entityId)+')</option>';}
    var cams='',cl=c.cameras || [];for(var k=0;k<cl.length;k++){cams+='<option value="'+esc(cl[k].entityId)+'"'+(cl[k].entityId===st.doorbellCamera?' selected':'')+'>'+esc(cl[k].name)+'</option>';}
    var active=bell.lights || [],lights='',ll=c.lights || [];
    for(var l=0;l<ll.length;l++){lights+='<label class="checkbox-line"><input type="checkbox" name="adminLight" value="'+esc(ll[l].entityId)+'"'+(active.indexOf(ll[l].entityId)>=0?' checked':'')+'> '+esc(ll[l].name)+'</label>';}
    ui.openDialog('Klingel bearbeiten','<form id="adminForm" data-kind="doorbell"><div class="field"><label for="adminSensor">Klingel-Sensor</label><select id="adminSensor">'+sensors+'</select></div><div class="field"><label for="adminCamera">Kamera</label><select id="adminCamera">'+cams+'</select></div><div class="field"><label>Lichter beim Klingeln</label><div class="admin-checks">'+(lights || '<p class="muted">Keine Lichter gefunden.</p>')+'</div><p class="info-note">'+((st.doorbellLights || []).length?'Eigene Auswahl.':'Automatisch erkannt – zum Ändern Häkchen setzen und speichern.')+'</p></div>'+status()+'<button type="submit" class="button primary">Speichern</button></form>','admin','doorbell');
  }
  function formBoiler(){
    var d=S.data.tablets,st=d.settings || {},boiler=d.boiler || {},list=(d.candidates || {}).boiler || [];
    var html='<option value="">Automatisch'+(boiler.auto?' ('+esc(boiler.auto.name)+')':' – nichts gefunden, nur Timer')+'</option>',found=false;
    for(var i=0;i<list.length;i++){if(list[i].entityId===st.boilerEntity){found=true;}html+='<option value="'+esc(list[i].entityId)+'"'+(list[i].entityId===st.boilerEntity?' selected':'')+'>'+esc(list[i].name)+' ('+esc(list[i].entityId)+')</option>';}
    if(st.boilerEntity && !found){html+='<option value="'+esc(st.boilerEntity)+'" selected>'+esc(st.boilerEntity)+'</option>';}
    ui.openDialog('Boiler bearbeiten','<form id="adminForm" data-kind="boiler"><div class="field"><label for="adminBoiler">Schalter, Szene oder Skript für den Boiler</label><select id="adminBoiler">'+html+'</select></div><p class="info-note">Der Knopf in der Küche schaltet diese Entität ein und startet danach den 10-Minuten-Timer.</p>'+status()+'<button type="submit" class="button primary">Speichern</button></form>','admin','boiler');
  }
  function formSounds(){
    var st=S.data.tablets.settings || {};
    ui.openDialog('Töne bearbeiten','<form id="adminForm" data-kind="sounds"><div class="field"><label for="adminDoorbellSound">Klingelton</label><select id="adminDoorbellSound">'+options(SOUNDS,st.doorbellSound || 'gong')+'</select></div>'+btn('admin-sound','Anhören','adminDoorbellSound')+'<div class="field"><label for="adminNoticeSound">Mitteilungston</label><select id="adminNoticeSound">'+options(SOUNDS,st.noticeSound || 'ping')+'</select></div>'+btn('admin-sound','Anhören','adminNoticeSound')+'<p class="info-note">Zum Anhören muss der Ton auf diesem Gerät aktiviert sein.</p>'+status()+'<button type="submit" class="button primary">Speichern</button></form>','admin','sounds');
  }
  function formPresets(){
    var st=S.data.tablets.settings || {};
    ui.openDialog('Schnell-Durchsagen bearbeiten','<form id="adminForm" data-kind="presets"><div class="field"><label for="adminPresets">Eine Vorlage pro Zeile</label><textarea id="adminPresets" class="dialog-input" rows="7">'+esc((st.announcementPresets || []).join('\n'))+'</textarea></div>'+status()+'<button type="submit" class="button primary">Speichern</button></form>','admin','presets');
  }

  /* ---------- Automationen ---------- */
  function viewAutomations(){
    var list=S.data.automations;
    if(!list || !list.length){return card('Home-Assistant-Automationen',notice('automations','automations') || '<p class="muted">Keine Automationen gefunden.</p>'+btn('admin-reload','Aktualisieren','automations'));}
    var html='<div class="admin-list">';
    for(var i=0;i<list.length;i++){var a=list[i],on=a.state==='on',at=a.attributes || {};
      html+='<div class="admin-list-row"><div class="grow"><strong>'+esc(at.friendly_name || a.entity_id)+'</strong><small>'+(at.last_triggered?'Zuletzt: '+esc(dateTime(at.last_triggered)):'Noch nie ausgeführt')+'</small></div>'+btn('admin-automation',on?'Aktiv':'Inaktiv',a.entity_id,on?'primary':'',' aria-pressed="'+on+'"')+'</div>';}
    return card('Home-Assistant-Automationen',html+'</div>','<span class="pill">'+list.length+'</span>')+'<div class="admin-actions">'+btn('admin-reload','Aktualisieren','automations')+'</div>';
  }

  /* ---------- System ---------- */
  function sensorGroup(id){id=String(id).toLowerCase();for(var g=0;g<SENSOR_GROUPS.length;g++){for(var k=0;k<SENSOR_GROUPS[g][2].length;k++){if(id.indexOf(SENSOR_GROUPS[g][2][k])>=0){return g;}}}return -1;}
  function sensorName(sensor){var at=sensor.attributes || {};return String(at.friendly_name || sensor.entity_id).replace(/^System Monitor /i,'').replace(/^system_monitor_/i,'');}
  function tile(sensor){var at=sensor.attributes || {};return '<div class="detail-metric"><span>'+esc(sensorName(sensor))+'</span><strong>'+esc(sensor.state)+(at.unit_of_measurement?' '+esc(at.unit_of_measurement):'')+'</strong></div>';}
  function viewSystem(){
    var html='',sensors=S.data.sensors;
    if(sensors && sensors.length){
      // Oben nur die wichtigsten Werte; viele Messwerte wiederholen sich (z. B. je Laufwerk), der Rest ist einklappbar.
      var key='<div class="detail-grid">',shown=0;
      for(var k=0;k<KEY_SENSORS.length;k++){for(var i=0;i<sensors.length;i++){if(sensorName(sensors[i]).toLowerCase()===KEY_SENSORS[k]){key+=tile(sensors[i]);shown++;break;}}}
      key+='</div>';
      html+=card('Server-Auslastung',(shown?key:'')+'<div class="admin-actions">'+btn('admin-sensors',S.allSensors?'Weniger anzeigen':'Alle Messwerte ('+sensors.length+')')+btn('admin-reload','Aktualisieren','system')+'</div>');
      if(S.allSensors){
        var groups={};for(var s2=0;s2<sensors.length;s2++){var g=sensorGroup(sensors[s2].entity_id);(groups[g]=groups[g] || []).push(sensors[s2]);}
        var order=[0,1,2,3,-1];
        for(var o=0;o<order.length;o++){var items=groups[order[o]];if(!items){continue;}
          var body='<div class="detail-grid">';for(var j=0;j<items.length;j++){body+=tile(items[j]);}
          html+=card(order[o]>=0?SENSOR_GROUPS[order[o]][1]:'Weitere Werte',body+'</div>');}
      }
    }else{html+=card('Server-Auslastung',notice('sensors','system') || '<p class="muted">Keine Systemwerte gefunden. Die Integration „System Monitor“ in Home Assistant liefert sie.</p>');}
    html+=viewActivity();
    var tank=S.data.tank && S.data.tank.calibration;
    if(tank){var list=[];for(var t=0;t<TANK.length;t++){var m=tank[TANK[t][0]];list.push([TANK[t][1],m && m.value!=='unavailable' && m.value!==undefined?String(m.value).replace('.',',')+' '+TANK[t][2]:'–']);}
      html+=card('Wassertank-Kalibrierung',rows(list)+'<div class="admin-actions">'+btn('admin-edit','Bearbeiten','tank')+'</div>');}
    return html;
  }
  function viewActivity(){
    var filters=[['gate','Tor'],['automationen','Automationen'],['all','Alle']],bar='<div class="settings-tabs admin-filter">';
    for(var f=0;f<filters.length;f++){bar+='<button type="button" class="settings-tab'+(S.filter===filters[f][0]?' active':'')+'" data-action="admin-filter" data-id="'+filters[f][0]+'">'+filters[f][1]+'</button>';}
    bar+='</div>';
    var key=S.filter==='automationen'?'logbook':'activity:'+S.filter,data=S.data[key],body='';
    if(!data){body=notice(key,'system') || '<p class="muted" role="status">Wird geladen …</p>';}
    else if(!data.length){body='<p class="muted">Keine Einträge.</p>';}
    else{
      var last='',count=Math.min(data.length,80);body='<div class="admin-log">';
      var entries=S.filter==='automationen'?data.slice().reverse():data;
      for(var i=0;i<count && i<entries.length;i++){var e=entries[i];
        if(S.filter!=='automationen'){var dk=dateKey(e.ts);if(dk && dk!==last){body+='<div class="admin-log-day">'+esc(dayLabel(dk))+'</div>';last=dk;}}
        var text=S.filter==='automationen'?(e.name || e.entity_id || 'Automation'):e.action,sub=S.filter==='automationen'?(e.message || ''):(!e.ok && e.detail?e.detail:e.context?(e.kind==='action'?'Torstatus: ':'vorher: ')+e.context:''),
            time=S.filter==='automationen'?(e.when?clock(e.when):'–'):clock(e.ts),badge=S.filter==='automationen'?'ausgelöst':!e.ok?'Fehler':e.kind==='state'?'Status':e.kind==='sensor'?'Sensor':'Aktion';
        body+='<div class="admin-log-row'+(S.filter!=='automationen' && !e.ok?' is-error':'')+'"><span class="admin-log-time">'+esc(time)+'</span><span class="grow">'+esc(text)+(e.trigger?' <em>'+esc(e.trigger)+'</em>':'')+(sub?'<small>'+esc(sub)+'</small>':'')+'</span><span class="pill">'+esc(badge)+'</span></div>';}
      body+='</div>'+(entries.length>count?'<p class="info-note">Die letzten '+count+' von '+entries.length+' Einträgen.</p>':'');
    }
    return card('Aktivität',bar+body);
  }
  function formTank(){
    var cal=S.data.tank.calibration || {},html='';
    for(var t=0;t<TANK.length;t++){var m=cal[TANK[t][0]];html+='<div class="field"><label for="adminTank'+t+'">'+esc(TANK[t][1])+' ('+esc(TANK[t][2])+')</label><input id="adminTank'+t+'" type="number" step="any" inputmode="decimal" value="'+esc(m && m.value!=='unavailable' && m.value!==undefined?m.value:'')+'"></div>';}
    ui.openDialog('Wassertank kalibrieren','<form id="adminForm" data-kind="tank">'+html+status()+'<button type="submit" class="button primary">Speichern</button></form>','admin','tank');
  }
  function saveTank(){
    var index=0,buttons=document.querySelectorAll('#adminForm button');for(var b=0;b<buttons.length;b++){buttons[b].disabled=true;}
    setStatus('Wird gespeichert …');
    function next(err){
      if(err){for(var j=0;j<buttons.length;j++){buttons[j].disabled=false;}setStatus(err);return;}
      if(index>=TANK.length){ui.closeDialog();ui.toast('Gespeichert');load('tank','/api/wassertank',true);return;}
      var i=index++,input=document.getElementById('adminTank'+i),value=input?Number(input.value):NaN;
      if(!isFinite(value) || !input.value){next();return;}
      request('POST','/api/entity/'+encodeURIComponent(TANK[i][3])+'/service',{service:'set_value',data:{value:value}},next);
    }
    next();
  }

  /* ---------- Add-ons & Info ---------- */
  function viewAddons(){
    var info=S.data.info,html='';
    if(info){html+=card(info.name || 'HA Wallpanel',rows([['Version',info.version || '–'],['Stand',info.update_available?'Update verfügbar: v'+info.version_latest:'Aktuell – neueste Version installiert']])+'<div class="admin-actions">'+btn('admin-changelog','Änderungen anzeigen')+'</div>');}
    else{html+=card('Dieses Add-on',notice('info','addons') || '<p class="muted" role="status">Wird geladen …</p>');}
    var list=S.data.addons,body='';
    if(!list){body=notice('addons','addons') || '<p class="muted" role="status">Wird geladen …</p>';}
    else if(!list.length){body='<p class="muted">Keine Add-ons gefunden.</p>';}
    else{body='<div class="admin-list">';for(var i=0;i<list.length;i++){var a=list[i];
      body+='<div class="admin-list-row"><div class="grow"><strong>'+esc(a.name || a.slug || '–')+'</strong><small>v'+esc(a.version || '?')+(a.state?' · '+esc(a.state):'')+(a.update_available?' · Update verfügbar: v'+esc(a.version_latest || '?'):'')+'</small></div>'+(a.update_available?btn('admin-addon-update','Updaten',a.slug,'primary'):'')+'</div>';}
      body+='</div>';}
    return html+card('Installierte Add-ons',body+'<div class="admin-actions">'+btn('admin-reload','Aktualisieren','addons')+'</div>');
  }
  function changelogHtml(text){
    var lines=String(text).split('\n'),html='';
    for(var i=0;i<lines.length;i++){var l=lines[i];
      if(l.indexOf('## ')===0){html+='<h3 class="admin-cl-version">'+esc(l.slice(3))+'</h3>';}
      else if(l.indexOf('### ')===0){html+='<h4 class="admin-cl-category">'+esc(l.slice(4))+'</h4>';}
      else if(l.indexOf('- ')===0){html+='<p class="admin-cl-item">'+esc(l.slice(2))+'</p>';}}
    return html || '<p class="muted">Kein Inhalt.</p>';
  }
  function showChangelog(){
    ui.openDialog('Änderungen','<div id="adminChangelog" class="admin-changelog"><p class="muted" role="status">Wird geladen …</p></div>','admin','changelog');
    if(S.changelog){document.getElementById('adminChangelog').innerHTML=S.changelog;return;}
    var xhr=new XMLHttpRequest();xhr.open('GET','/api/changelog',true);xhr.timeout=15000;
    function show(html){var n=document.getElementById('adminChangelog');if(n){n.innerHTML=html;}}
    xhr.onload=function(){if(xhr.status===200){S.changelog=changelogHtml(xhr.responseText);show(S.changelog);}else{show('<p role="alert">Änderungsliste nicht verfügbar.</p>');}};
    xhr.onerror=xhr.ontimeout=function(){show('<p role="alert">Änderungsliste nicht verfügbar.</p>');};
    xhr.send(null);
  }

  /* ---------- Einhängen in die Einstellungsansicht ---------- */
  function view(tab){return tab==='klingel'?viewKlingel():tab==='automations'?viewAutomations():tab==='system'?viewSystem():tab==='addons'?viewAddons():'';}
  function isTab(tab){for(var i=0;i<TABS.length;i++){if(TABS[i][0]===tab){return true;}}return false;}

  function action(name,id,node){
    if(name==='admin-tab'){if(isTab(id)){ui.state.settingsTab=id;open(id,true);ui.render();}return true;}
    if(name==='admin-reload'){open(id,true);ctx.changed();return true;}
    if(name==='admin-edit'){
      if(id==='tank'){if(S.data.tank){formTank();}return true;}
      if(!S.data.tablets){ui.toast('Daten werden noch geladen.');return true;}
      (id==='doorbell'?formDoorbell:id==='boiler'?formBoiler:id==='sounds'?formSounds:formPresets)();return true;
    }
    if(name==='admin-sound'){var select=document.getElementById(id);if(select){ctx.play(select.value);}return true;}
    if(name==='admin-bell-test'){
      if(!window.confirm('Test-Klingel jetzt auf allen angemeldeten Tablets auslösen?')){return true;}
      node.disabled=true;request('POST','/api/tablets/doorbell-test',{tablet:'all'},function(err){node.disabled=false;if(err){if(/entsperren/.test(err)){ui.state.settingsUnlockedUntil=0;}ui.toast(err);}else{ui.toast('Test-Klingel gesendet');}});return true;
    }
    if(name==='admin-automation'){
      node.disabled=true;
      var current=null,list=S.data.automations || [];for(var i=0;i<list.length;i++){if(list[i].entity_id===id){current=list[i];}}
      request('POST','/api/entity/'+encodeURIComponent(id)+'/service',{service:current && current.state==='on'?'turn_off':'turn_on',data:{}},function(err){if(err){ui.toast(err);}load('automations','/api/automations',true);});return true;
    }
    if(name==='admin-sensors'){S.allSensors=!S.allSensors;ui.render();return true;}
    if(name==='admin-filter'){S.filter=id;loadActivity(true);ui.render();return true;}
    if(name==='admin-changelog'){showChangelog();return true;}
    if(name==='admin-addon-update'){
      if(!window.confirm('Dieses Add-on jetzt aktualisieren? Es startet dabei kurz neu.')){return true;}
      node.disabled=true;node.textContent='…';
      request('POST','/api/addons/'+encodeURIComponent(id)+'/update',{},function(err){node.textContent=err?'Fehler':'Gestartet';if(err){ui.toast(err);}setTimeout(function(){load('addons','/api/addons',true);},3000);});return true;
    }
    return false;
  }

  function submit(event){
    var form=event.target;if(form.id!=='adminForm'){return false;}
    var kind=form.getAttribute('data-kind'),el=function(id){return document.getElementById(id);},reload=function(){load('tablets','/api/tablets',true);};
    if(kind==='doorbell'){var checks=form.querySelectorAll('[name=adminLight]'),lights=[];for(var i=0;i<checks.length;i++){if(checks[i].checked){lights.push(checks[i].value);}}
      save('/api/tablets/settings',{doorbellEntity:el('adminSensor').value,doorbellCamera:el('adminCamera').value,doorbellLights:lights},reload);}
    else if(kind==='boiler'){save('/api/tablets/settings',{boilerEntity:el('adminBoiler').value},reload);}
    else if(kind==='sounds'){save('/api/tablets/settings',{doorbellSound:el('adminDoorbellSound').value || 'gong',noticeSound:el('adminNoticeSound').value || 'ping'},reload);}
    else if(kind==='presets'){save('/api/tablets/settings',{announcementPresets:el('adminPresets').value.split('\n')},reload);}
    else if(kind==='tank'){saveTank();}
    return true;
  }

  return {tabs:function(){return TABS;},view:view,isTab:isTab,open:open,action:action,submit:submit};
};
})();
