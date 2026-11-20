/* Hausgeräte (Backofen, Geschirrspüler …) als Karten in der Raumansicht. Nur Anzeige, es wird nichts geschaltet.
   Daten kommen von /api/appliances. ES5 für alte iPads. */
(function(){'use strict';
window.createWallpanelAppliances=function(ctx){
  var esc=ctx.ui.esc,list=[],offset=0,loading=false,loadedAt=0,signature='',busy=false;
  var ICONS={
    oven:'<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="24" height="24" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><line x1="4" y1="11" x2="28" y2="11" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="7.5" r="1.2" fill="currentColor"/><circle cx="13" cy="7.5" r="1.2" fill="currentColor"/><rect x="8" y="15" width="16" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    dishwasher:'<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="24" height="24" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><line x1="4" y1="10" x2="28" y2="10" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="19" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="7" r="1.2" fill="currentColor"/></svg>',
    other:'<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="4" width="22" height="24" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="18" r="5" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  };
  function now(){return Date.now()+offset;}
  function clock(ms){var d=new Date(ms),h=d.getHours(),m=d.getMinutes();return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;}
  function remaining(ms){
    var min=Math.max(0,Math.ceil((ms-now())/60000));
    if(min<=0){return 'gleich fertig';}
    if(min<60){return 'noch '+min+' Min.';}
    var h=Math.floor(min/60),r=min%60;return 'noch '+h+' Std.'+(r?' '+r+' Min.':'');
  }
  function doorText(door){return door==='open'?'Tür offen':door==='locked'?'Tür verriegelt':door==='closed'?'Tür zu':'';}
  /* Raum aus Home Assistant; ohne Raum gilt die Küche. */
  function roomOf(appliance){
    if(appliance.room){return appliance.room;}
    var rooms=ctx.rooms();for(var i=0;i<rooms.length;i++){if(/küche|kueche|kitchen/i.test(rooms[i].name)){return rooms[i].id;}}
    return '';
  }
  function matchesRoom(appliance,roomId){return roomOf(appliance)===roomId;}
  function find(id){for(var i=0;i<list.length;i++){if(list[i].id===id){return list[i];}}return null;}
  function shortRemaining(ms){
    var min=Math.max(0,Math.ceil((ms-now())/60000));
    if(min<60){return min+' Min.';}
    var h=Math.floor(min/60),r=min%60;return h+':'+(r<10?'0':'')+r+' Std.';
  }
  var LABELS={'stop':'Programm stoppen','pause':'Pausieren','resume':'Fortsetzen','power-on':'Einschalten','power-off':'Ausschalten'};
  var ASK={'stop':'Laufendes Programm wirklich stoppen?','power-off':'Gerät wirklich ausschalten?'};
  function card(a){
    var running=a.status==='running'||a.status==='paused'||a.status==='delayed';
    var html='<article class="appliance appliance-'+esc(a.status)+(running?' is-running':'')+'" data-action="appliance-details" data-id="'+esc(a.id)+'" aria-label="'+esc(a.name)+'">';
    html+='<span class="appliance-icon">'+(ICONS[a.kind]||ICONS.other)+'</span>';
    html+='<div class="appliance-main"><div class="appliance-head"><h3 class="appliance-name">'+esc(a.name)+'</h3><span class="appliance-status" data-appliance-status="'+esc(a.id)+'">'+esc(a.statusText)+'</span></div>';
    var detail=[];
    if(a.program&&(running||a.status==='ready')){detail.push(esc(a.program));}
    if(a.kind==='oven'&&a.temperature!==null&&(running||a.temperature>=40||a.status==='ready')){detail.push('Garraum '+Math.round(a.temperature)+' °C');}
    if(detail.length){html+='<p class="appliance-detail">'+detail.join(' · ')+'</p>';}
    if(running&&a.progress!==null){html+='<div class="appliance-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+a.progress+'"><span style="width:'+a.progress+'%"></span></div>';}
    if(running&&a.endsAt){html+='<p class="appliance-time" data-appliance-end="'+a.endsAt+'">'+esc(remaining(a.endsAt))+' · fertig um '+esc(clock(a.endsAt))+' Uhr</p>';}
    var foot=[];var door=doorText(a.door);if(door){foot.push(door);}if(a.childLock){foot.push('Kindersicherung an');}
    if(foot.length){html+='<p class="appliance-foot">'+esc(foot.join(' · '))+'</p>';}
    return html+'</div></article>';
  }
  /* Karten für einen Raum; leer, wenn dort keine Geräte stehen. */
  function room(roomId){
    var html='';for(var i=0;i<list.length;i++){if(matchesRoom(list[i],roomId)){html+=card(list[i]);}}
    return html?'<section class="card appliances" aria-label="Geräte"><h2 class="section-label">Geräte</h2><div class="appliance-list">'+html+'</div></section>':'';
  }
  /* Laufende Geräte als Timer in der Kopfleiste (wie beim Boiler). */
  var timerSignature='';
  function timers(){
    var box=document.getElementById('panelApplianceTimers');if(!box){return;}
    var items=[],sig=[];
    for(var i=0;i<list.length;i++){var a=list[i];if((a.status==='running'||a.status==='paused'||a.status==='delayed')&&a.endsAt){items.push(a);sig.push(a.id+':'+roomOf(a));}}
    var next=sig.join('|');
    if(next!==timerSignature){
      timerSignature=next;var html='';
      for(var j=0;j<items.length;j++){html+='<button class="quick-tool boiler-pill appliance-pill" type="button" data-action="open-room" data-id="'+esc(roomOf(items[j]))+'" data-appliance-pill="'+esc(items[j].id)+'" aria-label="'+esc(items[j].name)+' Timer"></button>';}
      box.innerHTML=html;
    }
    for(var k=0;k<items.length;k++){
      var pill=box.querySelector('[data-appliance-pill="'+items[k].id+'"]');
      if(pill){var text=items[k].name+' · '+(items[k].status==='paused'?'pausiert':shortRemaining(items[k].endsAt));if(pill.textContent!==text){pill.textContent=text;}}
    }
  }
  /* Restzeit ohne Neuaufbau aktualisieren. */
  function tick(){
    timers();
    var nodes=document.querySelectorAll('[data-appliance-end]');
    for(var i=0;i<nodes.length;i++){var end=Number(nodes[i].getAttribute('data-appliance-end')),text=remaining(end)+' · fertig um '+clock(end)+' Uhr';if(nodes[i].textContent!==text){nodes[i].textContent=text;}}
  }
  function load(){
    if(loading||document.hidden){return;}loading=true;loadedAt=Date.now();
    ctx.request('GET','/api/appliances',null,function(err,data){
      loading=false;if(err||!data||!data.appliances){return;}
      list=data.appliances;offset=typeof data.serverTime==='number'?data.serverTime-Date.now():0;
      var parts=[];for(var i=0;i<list.length;i++){var a=list[i];parts.push([a.id,a.status,a.program,a.progress,a.endsAt,a.temperature===null?'':Math.round(a.temperature),a.door,a.childLock].join(','));}
      timers();var next=parts.join('|');if(next!==signature){signature=next;ctx.changed();}
    });
  }
  /* Läuft etwas, öfter abfragen; sonst gelegentlich. */
  function poll(){
    var busy=false;for(var i=0;i<list.length;i++){if(list[i].status==='running'||list[i].status==='paused'||list[i].status==='delayed'){busy=true;}}
    if(!loadedAt||Date.now()-loadedAt>=(busy?15000:60000)){load();}
    tick();
  }
  /* Steuerung per langem Drücken: nur Stoppen, Pausieren/Fortsetzen und Ein-/Ausschalten. */
  function control(id){
    var a=find(id);if(!a){return;}
    var html='<p class="appliance-dialog-status"><strong>'+esc(a.statusText)+'</strong>'+(a.program?' · '+esc(a.program):'')+'</p>';
    if(a.actions&&a.actions.length){
      html+='<div class="appliance-actions">';
      for(var i=0;i<a.actions.length;i++){var act=a.actions[i];html+='<button type="button" class="button'+(act==='stop'?' danger':act==='resume'||act==='power-on'?' primary':'')+'" data-action="appliance-do" data-id="'+esc(a.id)+'" data-act="'+esc(act)+'">'+esc(LABELS[act])+'</button>';}
      html+='</div>';
    }else{html+='<p class="muted">Gerade ist keine Aktion möglich.</p>';}
    if(a.status==='running'||a.status==='delayed'){html+='<p class="info-note">Ein Programm kann hier nur gestoppt, nicht gestartet werden.</p>';}
    ctx.ui.openDialog(a.name,html,'appliance',a.id);
  }
  function run(id,act,node){
    if(busy||!LABELS[act]){return;}
    if(ASK[act]&&!window.confirm(ASK[act])){return;}
    busy=true;if(node){node.disabled=true;node.setAttribute('aria-busy','true');}
    ctx.request('POST','/api/appliances/'+encodeURIComponent(id)+'/'+encodeURIComponent(act),{},function(err){
      busy=false;
      if(ctx.ui.state.dialog&&ctx.ui.state.dialog.type==='appliance'){ctx.ui.closeDialog(true);}
      ctx.ui.toast(err?'Das Gerät hat nicht reagiert.':LABELS[act]+' – gesendet.');
      setTimeout(load,1500);setTimeout(load,6000);
    });
  }
  function action(name,id,node){
    if(name==='appliance-details'){return true;}
    if(name==='appliance-control'){control(id);return true;}
    if(name==='appliance-do'){run(id,node?node.getAttribute('data-act'):'',node);return true;}
    return false;
  }
  return {room:room,poll:poll,load:load,action:action};
};
})();
