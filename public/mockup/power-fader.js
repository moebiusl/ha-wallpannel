/* ES5 vertical brightness control. Preview while dragging, commit on release. */
(function(root){
'use strict';
var press=null;
function clamp(value){return Math.max(0,Math.min(100,Math.round(value)));}
function valueAt(rect,y){return clamp((rect.bottom-y)/rect.height*100);}
function node(target){while(target&&target!==document&&!target.hasAttribute('data-power-fader'))target=target.parentNode;return target&&target!==document?target:null;}
function preview(n,value){value=clamp(value);n.setAttribute('aria-valuenow',String(value));n.setAttribute('aria-valuetext',value?value+' Prozent':'Aus');n.querySelector('.home-fader-fill').style.height=value+'%';n.className=n.className.replace(/\s+is-on\b/g,'')+(value?' is-on':'');var label=document.querySelector('[data-power-level]');if(label)label.textContent=value?value+' %':'Aus';}
function install(doc,commit){
 function start(e){var touch=e.type==='touchstart';if(!touch&&e.button!==0)return;var n=node(e.target);if(!n||n.getAttribute('aria-disabled')==='true'||touch&&e.touches.length!==1)return;press={node:n,before:Number(n.getAttribute('aria-valuenow'))};preview(n,valueAt(n.getBoundingClientRect(),(touch?e.touches[0]:e).clientY));if(e.cancelable)e.preventDefault();}
 function move(e){if(!press)return;if(!doc.documentElement.contains(press.node)){press=null;return;}var point=e.touches?e.touches[0]:e;if(point)preview(press.node,valueAt(press.node.getBoundingClientRect(),point.clientY));if(e.cancelable)e.preventDefault();}
 function end(e){if(!press)return;var p=press;press=null;if(e.cancelable)e.preventDefault();if(!doc.documentElement.contains(p.node))return;var value=Number(p.node.getAttribute('aria-valuenow'));if(value!==p.before)commit(p.node.getAttribute('data-power-fader'),value);}
 function cancel(){if(press){if(doc.documentElement.contains(press.node))preview(press.node,press.before);press=null;}}
 doc.addEventListener('mousedown',start,false);doc.addEventListener('mousemove',move,false);doc.addEventListener('mouseup',end,false);doc.addEventListener('touchstart',start,false);doc.addEventListener('touchmove',move,false);doc.addEventListener('touchend',end,false);doc.addEventListener('touchcancel',cancel,false);root.addEventListener('blur',cancel);
 function key(e){return e.key||({38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',37:'ArrowLeft',36:'Home',35:'End',33:'PageUp',34:'PageDown'})[e.keyCode];}
 var keys=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End','PageUp','PageDown'];
 doc.addEventListener('keydown',function(e){var n=node(e.target),k=key(e);if(!n||n.getAttribute('aria-disabled')==='true'||keys.indexOf(k)===-1)return;e.preventDefault();if(!press)press={node:n,before:Number(n.getAttribute('aria-valuenow'))};var value=Number(n.getAttribute('aria-valuenow'));preview(n,k==='Home'?0:k==='End'?100:value+(k==='ArrowDown'||k==='ArrowLeft'?-1:k==='PageDown'?-10:k==='PageUp'?10:1));});
 doc.addEventListener('keyup',function(e){if(keys.indexOf(key(e))!==-1)end(e);});
}
var api={valueAt:valueAt,clamp:clamp,install:install,active:function(){return Boolean(press);}};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WallpanelPowerFader=api;
}(this));
