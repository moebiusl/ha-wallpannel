/* Hausgeräte (Backofen, Geschirrspüler …) als Karten in der Raumansicht. Nur Anzeige, es wird nichts geschaltet.
   Daten kommen von /api/appliances. ES5 für alte iPads. */
(function(){'use strict';
window.createWallpanelAppliances=function(ctx){
  var esc=ctx.ui.esc,list=[],offset=0,loading=false,loadedAt=0,signature='';
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
  function matchesRoom(appliance,roomId){
    if(appliance.room){return appliance.room===roomId;}
    /* Ohne Raum in Home Assistant: in der Küche zeigen. */
    var rooms=ctx.rooms();for(var i=0;i<rooms.length;i++){if(rooms[i].id===roomId){return /küche|kueche|kitchen/i.test(rooms[i].name);}}
    return false;
  }
  function card(a){
    var running=a.status==='running'||a.status==='paused'||a.status==='delayed';
    var html='<article class="appliance appliance-'+esc(a.status)+(running?' is-running':'')+'" aria-label="'+esc(a.name)+'">';
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
  /* Restzeit ohne Neuaufbau aktualisieren. */
  function tick(){
    var nodes=document.querySelectorAll('[data-appliance-end]');
    for(var i=0;i<nodes.length;i++){var end=Number(nodes[i].getAttribute('data-appliance-end')),text=remaining(end)+' · fertig um '+clock(end)+' Uhr';if(nodes[i].textContent!==text){nodes[i].textContent=text;}}
  }
  function load(){
    if(loading||document.hidden){return;}loading=true;loadedAt=Date.now();
    ctx.request('GET','/api/appliances',null,function(err,data){
      loading=false;if(err||!data||!data.appliances){return;}
      list=data.appliances;offset=typeof data.serverTime==='number'?data.serverTime-Date.now():0;
      var parts=[];for(var i=0;i<list.length;i++){var a=list[i];parts.push([a.id,a.status,a.program,a.progress,a.endsAt,a.temperature===null?'':Math.round(a.temperature),a.door,a.childLock].join(','));}
      var next=parts.join('|');if(next!==signature){signature=next;ctx.changed();}
    });
  }
  /* Läuft etwas, öfter abfragen; sonst gelegentlich. */
  function poll(){
    var busy=false;for(var i=0;i<list.length;i++){if(list[i].status==='running'||list[i].status==='paused'||list[i].status==='delayed'){busy=true;}}
    if(!loadedAt||Date.now()-loadedAt>=(busy?15000:60000)){load();}
    tick();
  }
  return {room:room,poll:poll,load:load};
};
})();
