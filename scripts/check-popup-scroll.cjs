/* Modal scroll containment, including the touch-boundary fallback needed by iOS 9. */
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.WALLPANEL_PLAYWRIGHT_MODULE || 'playwright');
(async()=>{for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch();try{
  const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>{throw Error('Unexpected API '+r.request().url());});
  await page.goto('http://127.0.0.1:3000/mockup/');await page.waitForFunction(()=>window.WallpanelMockup);
  await page.evaluate(()=>{const ui=WallpanelMockup;for(let i=0;i<40;i++)ui.model.lights.push({id:'extra'+i,room:'living',name:'Lampe '+i,on:false,brightness:40,dim:true});ui.state.roomId='living';ui.go('room');document.getElementById('content').scrollTop=240;ui.openDialog('Scrolltest',Array(30).join('<p>Ein langer Popup-Inhalt, der vertikal gescrollt werden kann.</p>')+'<textarea id="nestedScroll" rows="2">'+Array(30).join('Eine Zeile im Textfeld.\n')+'</textarea><input id="testRange" type="range">','music');});
  // Overflow must stay untouched while a popup is open: toggling it makes iOS blank and repaint the background.
  assert.equal(await page.locator('#content').evaluate(n=>getComputedStyle(n).overflowY),'auto');
  const body=page.locator('.dialog-body'),box=await body.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,350);await page.waitForFunction(()=>document.querySelector('.dialog-body').scrollTop>0);
  assert.equal(await page.locator('#content').evaluate(n=>n.scrollTop),240);
  await body.evaluate(n=>n.scrollTop=n.scrollHeight);await page.mouse.wheel(0,600);assert.equal(await page.locator('#content').evaluate(n=>n.scrollTop),240);
  async function touch(selector,position,dx,dy){return page.evaluate(({selector,position,dx,dy})=>{const n=document.querySelector(selector),body=document.querySelector('.dialog-body');body.scrollTop=position==='bottom'?body.scrollHeight:position==='top'?0:100;function event(type,x,y){const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[{clientX:x,clientY:y}]});return e;}n.dispatchEvent(event('touchstart',150,250));const move=event('touchmove',150-dx,250-dy);n.dispatchEvent(move);n.dispatchEvent(event('touchend',150-dx,250-dy));return move.defaultPrevented;},{selector,position,dx,dy});}
  assert.equal(await touch('.dialog-body','top',0,60),false,'popup may scroll down');
  assert.equal(await touch('.dialog-body','top',0,-60),true,'top boundary does not scroll background');
  assert.equal(await touch('.dialog-body','bottom',0,60),true,'bottom boundary does not scroll background');
  assert.equal(await touch('.dialog-head','top',0,60),true,'header gestures do not scroll background');
  assert.equal(await touch('.dialog-backdrop','top',0,60),true,'backdrop gestures do not scroll background');
  assert.equal(await touch('#content','top',0,60),true,'a touch that began on the background before opening is also stopped');
  assert.equal(await touch('#testRange','top',50,0),false,'native range remains usable');
  assert.equal(await touch('#nestedScroll','top',0,50),false,'nested textarea can scroll');
  await page.evaluate(()=>WallpanelMockup.openDialog('Anderes Popup','<p>Ersetzt den ersten Dialog.</p>','notice'));assert.equal(await page.locator('#content').evaluate(n=>n.scrollTop),240);
  await page.getByRole('button',{name:'Schließen',exact:true}).tap();assert.equal(await page.locator('#content').evaluate(n=>n.scrollTop),240);assert.equal(await page.locator('#app').evaluate(n=>n.className.indexOf('is-modal-open')>=0),false);assert.equal(await page.locator('#content').evaluate(n=>getComputedStyle(n).overflowY),'auto');
  const contentBox=await page.locator('#content').boundingBox();await page.mouse.move(contentBox.x+contentBox.width/2,contentBox.y+contentBox.height/2);await page.mouse.wheel(0,300);await page.waitForFunction(()=>document.getElementById('content').scrollTop>240);
  await page.evaluate(()=>WallpanelMockup.openLight('sofa'));const slider=page.getByRole('slider',{name:'Stehlampe Helligkeit',exact:true});await slider.focus();await page.keyboard.press('End');assert.equal(await page.evaluate(()=>WallpanelMockup.model.lights[0].brightness),100);const faderGuard=await slider.evaluate(n=>{const r=n.getBoundingClientRect();function send(type,y){const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[{clientX:r.left+r.width/2,clientY:y}]});n.dispatchEvent(e);return e.defaultPrevented;}send('touchstart',r.bottom-20);const blocked=send('touchmove',r.top+r.height/2);send('touchend',r.top+r.height/2);return blocked;});assert.equal(faderGuard,true);assert.equal(await page.evaluate(()=>WallpanelMockup.model.lights[0].brightness),50);await page.getByRole('button',{name:'Schließen',exact:true}).tap();
  assert.deepEqual(errors,[]);console.log(name+': Popup scrollt, Hintergrund bleibt gesperrt, Rand-/Header-/Backdrop-Gesten abgefangen; Schließen, Regler und Wiederfreigabe geprüft.');
 }finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
