/* Side-effect-free route helpers, also used by isolated Node checks. ES5. */
(function(root){'use strict';
 var views=['home','room','scenes','cameras','weather','settings','apps','security','energy'];
 function parse(value){var parts=String(value||'').replace(/^#/,'').split('/'),view=views.indexOf(parts[0])>=0?parts[0]:'home',room='';try{room=decodeURIComponent(parts.slice(1).join('/'));}catch(_){}return {view:view,roomId:view==='room'?room:''};}
 function hash(view,room){return '#'+(views.indexOf(view)>=0?view:'home')+(view==='room'&&room?'/'+encodeURIComponent(room):'');}
 var api={parse:parse,hash:hash};if(typeof module!=='undefined'&&module.exports){module.exports=api;}else{root.WallpanelNavigation=api;}
}(this));
