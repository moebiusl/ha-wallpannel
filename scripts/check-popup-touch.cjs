/* Regression for the stuck iPad close button after long press; no HA calls. */
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.WALLPANEL_PLAYWRIGHT_MODULE || 'playwright');
(async()=>{for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch();try{
  const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>{throw Error('Unexpected API: '+r.request().url());});
  await page.goto('http://127.0.0.1:3000/mockup/');await page.locator('#mainNav').getByRole('button',{name:'Wohnzimmer',exact:true}).tap();
  async function hold(locator){await locator.evaluate(n=>{window.touchOrigin=n;const r=n.getBoundingClientRect(),e=new Event('touchstart',{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:[{clientX:r.left+20,clientY:r.top+20}]});n.dispatchEvent(e);});await page.getByRole('dialog').waitFor();await page.evaluate(()=>{const e=new Event('touchend',{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:[]});window.touchOrigin.dispatchEvent(e);});}
  await hold(page.getByRole('button',{name:'Stehlampe ausschalten',exact:true}));await page.getByRole('button',{name:'Schließen',exact:true}).tap();assert.equal(await page.getByRole('dialog').count(),0,'the next real touch must close the popup');
  await hold(page.getByRole('button',{name:'Musik einstellen',exact:true}));await page.getByRole('button',{name:'Schließen',exact:true}).tap();assert.equal(await page.getByRole('dialog').count(),0);
  await page.setViewportSize({width:640,height:480});await page.evaluate(()=>WallpanelMockup.openDialog('Langer Dialog',Array(80).join('<p>Ein langer Inhalt zum Scrollen.</p>'),'music'));
  await page.locator('.dialog-body').evaluate(n=>n.scrollTop=n.scrollHeight);
  const close=await page.getByRole('button',{name:'Schließen',exact:true}).boundingBox();assert.ok(close.y>=0 && close.y+close.height<=480);await page.getByRole('button',{name:'Schließen',exact:true}).tap();assert.equal(await page.getByRole('dialog').count(),0);
  await page.getByRole('button',{name:'Apps',exact:true}).tap();await page.getByRole('button',{name:'Tablet-Einstellungen',exact:true}).tap();const footer=await page.locator('.reload-fresh').boundingBox(),pad=await page.locator('.pin-pad').boundingBox();assert.ok(footer.y>=pad.y+pad.height,'reload belongs below the keypad');assert.ok(footer.x<pad.x+pad.width/2,'reload belongs on the left');await page.screenshot({path:'data/mockup-preview/'+name+'-pin-footer.png'});await page.getByRole('button',{name:'Schließen',exact:true}).tap();assert.equal(await page.getByRole('dialog').count(),0);
  assert.deepEqual(errors,[]);console.log(name+': Haltegeste → Schließen per echtem Touch, langer Popup-Inhalt und PIN-Fußzeile geprüft.');
 }finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
