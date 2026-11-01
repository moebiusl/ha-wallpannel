(function(root){
'use strict';
var press=null;
function snap(value,min,max,step){return Math.max(min,Math.min(max,Math.round((value-min)/step)*step+min));}
function fraction(x,y){var angle=Math.atan2(Math.max(0,-y),x);if(y>0)return x<0?0:1;return Math.max(0,Math.min(1,1-angle/Math.PI));}
function point(value,min,max){var f=max>min?Math.max(0,Math.min(1,(value-min)/(max-min))):0,angle=Math.PI*(1-f);return {x:100+82*Math.cos(angle),y:110-82*Math.sin(angle),fraction:f};}
function node(target){while(target&&target!==document&&!target.hasAttribute('data-thermostat'))target=target.parentNode;return target&&target!==document?target:null;}
function preview(n,value){var min=Number(n.getAttribute('aria-valuemin')),max=Number(n.getAttribute('aria-valuemax')),p=point(value,min,max),knob=n.querySelector('.dial-knob'),fill=n.querySelector('.dial-fill');n.setAttribute('aria-valuenow',String(value));n.setAttribute('aria-valuetext',String(value).replace('.',',')+' Grad');n.querySelector('.dial-value').textContent=String(Math.round(value*10)/10).replace('.',',')+'°';knob.setAttribute('cx',p.x);knob.setAttribute('cy',p.y);fill.setAttribute('stroke-dasharray',String(p.fraction*257.61)+' 258');}
function valueAt(n,p){var rect=n.querySelector('svg').getBoundingClientRect(),x=(p.clientX-rect.left)*200/rect.width-100,y=(p.clientY-rect.top)*130/rect.height-110,min=Number(n.getAttribute('aria-valuemin')),max=Number(n.getAttribute('aria-valuemax')),step=Number(n.getAttribute('data-step'));return snap(min+fraction(x,y)*(max-min),min,max,step);}
function install(doc,commit){
 function start(e){var touch=e.type==='touchstart';if(!touch&&e.button!==0)return;var n=node(e.target);if(!n||n.getAttribute('aria-disabled')==='true'||touch&&e.touches.length!==1)return;var p=touch?e.touches[0]:e,r=n.querySelector('svg').getBoundingClientRect(),x=(p.clientX-r.left)*200/r.width-100,y=(p.clientY-r.top)*130/r.height-110,d=Math.sqrt(x*x+y*y);if(y>14||d<55||d>108)return;press={node:n,before:Number(n.getAttribute('aria-valuenow'))};preview(n,valueAt(n,p));if(e.cancelable)e.preventDefault();}
 function move(e){if(!press)return;var p=e.touches?e.touches[0]:e;if(!p)return;preview(press.node,valueAt(press.node,p));if(e.cancelable)e.preventDefault();}
 function end(e){if(!press)return;var p=press;press=null;var value=Number(p.node.getAttribute('aria-valuenow'));if(e.cancelable)e.preventDefault();if(Math.abs(value-p.before)>.001)commit(p.node.getAttribute('data-thermostat'),value);}
 function cancel(){if(press){preview(press.node,press.before);press=null;}}
 doc.addEventListener('mousedown',start,false);doc.addEventListener('mousemove',move,false);doc.addEventListener('mouseup',end,false);doc.addEventListener('touchstart',start,false);doc.addEventListener('touchmove',move,false);doc.addEventListener('touchend',end,false);doc.addEventListener('touchcancel',cancel,false);root.addEventListener('blur',cancel);
 doc.addEventListener('keydown',function(e){var n=node(e.target),keys=['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End'];if(!n||n.getAttribute('aria-disabled')==='true'||keys.indexOf(e.key)===-1)return;e.preventDefault();if(!press)press={node:n,before:Number(n.getAttribute('aria-valuenow'))};var min=Number(n.getAttribute('aria-valuemin')),max=Number(n.getAttribute('aria-valuemax')),step=Number(n.getAttribute('data-step')),v=Number(n.getAttribute('aria-valuenow'));preview(n,e.key==='Home'?min:e.key==='End'?max:snap(v+(e.key==='ArrowLeft'||e.key==='ArrowDown'?-step:step),min,max,step));});
 doc.addEventListener('keyup',function(e){if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End'].indexOf(e.key)!==-1)end(e);});
}
var api={snap:snap,fraction:fraction,point:point,install:install,active:function(){return !!press;}};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WallpanelThermostat=api;
}(this));
