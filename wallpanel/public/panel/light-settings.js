/* Lampen-Einstellungen hinter dem Zahnrad im Lampen-Dialog: umbenennen und Raum wechseln (direkt in Home Assistant),
   Lampen nur im Wallpanel gruppieren. Alle Änderungen brauchen die PIN-Freigabe. ES5 für alte iPads. */
(function(){'use strict';
window.createWallpanelLightSettings=function(ctx){
  var ui=ctx.ui,esc=ui.esc,busy=false;
  function get(list,id){for(var i=0;i<list.length;i++){if(list[i].id===id){return list[i];}}return null;}
  function entity(id){var list=ctx.entities();for(var i=0;i<list.length;i++){if(list[i].entityId===id){return list[i];}}return null;}
  function el(id){return document.getElementById(id);}
  function status(text){var node=el('lightSettingsStatus');if(node){node.textContent=text || '';}}
  function baseName(name){var m=/^(.*\S)\s+\d{1,3}$/.exec(String(name || '').replace(/^\s+|\s+$/g,''));return m?m[1]:name;}
  function open(id){
    var light=get(ctx.model().lights,id),e=entity(id);if(!light||!e){ui.toast('Lampe nicht gefunden.');return;}
    var group=e.group || null,editable=group?true:!!e.platform,rooms=ctx.model().rooms,others=ctx.model().lights.filter(function(l){return l.id!==id&&l.room===light.room&&l.id.indexOf('group:')!==0;});
    var html='<div class="light-settings" data-light-settings="'+esc(id)+'">';
    html+='<div class="field"><label for="lightSettingsName">'+(group?'Name der Gruppe':'Name')+'</label><input id="lightSettingsName" class="dialog-input" type="text" maxlength="60" autocomplete="off" value="'+esc(light.name)+'"'+(editable?'':' disabled')+'></div>';
    html+='<button type="button" class="button primary" data-action="light-rename" data-id="'+esc(id)+'"'+(editable?'':' disabled')+'>Umbenennen</button>';
    var options='';for(var i=0;i<rooms.length;i++){options+='<option value="'+esc(rooms[i].id)+'"'+(rooms[i].id===light.room?' selected':'')+'>'+esc(rooms[i].name)+'</option>';}
    html+='<div class="field light-settings-room"><label for="lightSettingsRoom">Raum</label><select id="lightSettingsRoom"'+(editable?'':' disabled')+'>'+options+'</select></div>';
    html+='<button type="button" class="button" data-action="light-move" data-id="'+esc(id)+'"'+(editable?'':' disabled')+'>'+(group?'Alle Lampen verschieben':'Verschieben')+'</button>';
    html+='<h3 class="light-settings-heading">'+(group?'Lampen in dieser Gruppe':'Mit anderen Lampen gruppieren')+'</h3>';
    if(group){
      for(var g=0;g<group.members.length;g++){html+='<label class="checkbox-line"><input type="checkbox" name="lightGroupMember" value="'+esc(group.members[g].id)+'" checked> '+esc(group.members[g].name)+'</label>';}
      for(var o=0;o<others.length;o++){html+='<label class="checkbox-line"><input type="checkbox" name="lightGroupMember" value="'+esc(others[o].id)+'"> '+esc(others[o].name)+'</label>';}
      html+='<button type="button" class="button" data-action="light-group-save" data-id="'+esc(id)+'">Gruppe speichern</button><button type="button" class="button" data-action="light-group-remove" data-id="'+esc(id)+'">Gruppe auflösen</button>';
    }else if(others.length){
      for(var k=0;k<others.length;k++){html+='<label class="checkbox-line"><input type="checkbox" name="lightGroupMember" value="'+esc(others[k].id)+'"> '+esc(others[k].name)+'</label>';}
      html+='<div class="field"><label for="lightSettingsGroupName">Name der Gruppe</label><input id="lightSettingsGroupName" class="dialog-input" type="text" maxlength="60" autocomplete="off" value="'+esc(baseName(light.name))+'"></div>';
      html+='<button type="button" class="button" data-action="light-group-save" data-id="'+esc(id)+'">Gruppe bilden</button>';
    }else{html+='<p class="muted">Keine weiteren Lampen in diesem Raum.</p>';}
    html+='<p id="lightSettingsStatus" class="pin-status" role="status"></p>';
    html+='<p class="info-note">'+(group?(group.auto?'Automatisch zusammengefasst, weil die Lampen gleich heißen und nur die Nummer abweicht. ':'')+'Gruppen und ihr Name gelten nur im Wallpanel. „Verschieben“ ändert den Raum aller Lampen in Home Assistant.':editable?'Name und Raum werden direkt in Home Assistant geändert und gelten überall, auch in der HA-App. Gruppen gelten nur im Wallpanel.':'Diese Lampe hat in Home Assistant keine eindeutige ID. Name und Raum lassen sich nur in Home Assistant selbst ändern.')+'</p>';
    ui.openDialog(light.name+' · Einstellungen',html+'</div>','light-settings',id);
  }
  function send(url,body,done){
    if(busy){return;}busy=true;status('Wird gespeichert …');
    var buttons=document.querySelectorAll('.light-settings .button');for(var i=0;i<buttons.length;i++){buttons[i].setAttribute('aria-busy','true');}
    ctx.request('POST',url,body,function(err,data){busy=false;for(var j=0;j<buttons.length;j++){buttons[j].removeAttribute('aria-busy');}
      if(err){if(/entsperren/.test(err)){ui.state.settingsUnlockedUntil=0;}status(err);return;}
      ui.closeDialog();ui.toast(done);ctx.changed();
    });
  }
  function members(){var nodes=document.querySelectorAll('.light-settings [name=lightGroupMember]'),out=[];for(var i=0;i<nodes.length;i++){if(nodes[i].checked){out.push(nodes[i].value);}}return out;}
  function action(name,id){
    if(name==='light-settings'){ctx.openGuarded(id);return true;}
    if(name==='light-rename'){var value=el('lightSettingsName').value.replace(/^\s+|\s+$/g,'');if(!value){status('Bitte einen Namen eingeben.');return true;}send('/api/lights/'+encodeURIComponent(id)+'/rename',{name:value},'Umbenannt in „'+value+'“');return true;}
    if(name==='light-move'){var select=el('lightSettingsRoom'),room=get(ctx.model().rooms,select.value);send('/api/lights/'+encodeURIComponent(id)+'/room',{areaId:select.value},'Verschoben nach '+(room?room.name:'neuen Raum'));return true;}
    if(name==='light-group-save'){
      var e=entity(id),chosen=members();
      if(!(e&&e.group)){chosen.unshift(id);}
      if(chosen.length<2){status(e&&e.group?'Mindestens zwei Lampen auswählen – oder „Gruppe auflösen“.':'Bitte mindestens eine weitere Lampe auswählen.');return true;}
      var nameNode=el('lightSettingsGroupName');
      send('/api/light-groups',e&&e.group?{type:'save',id:id,members:chosen}:{type:'save',name:nameNode?nameNode.value:'',members:chosen},e&&e.group?'Gruppe gespeichert':'Gruppe gebildet');return true;
    }
    if(name==='light-group-remove'){send('/api/light-groups',{type:'remove',id:id},'Gruppe aufgelöst');return true;}
    return false;
  }
  return {open:open,action:action};
};
})();
