const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function client() {
  let xhr;
  class FakeXHR {
    constructor(){xhr=this;this.headers={};}
    open(){} setRequestHeader(key,value){this.headers[key]=value;} send(){}
    reply(status,body){this.status=status;this.responseText=body;this.readyState=4;this.onreadystatechange();}
  }
  const context={XMLHttpRequest:FakeXHR,window:{get localStorage(){throw new Error('Storage blocked');}}};
  vm.createContext(context);vm.runInContext(fs.readFileSync('public/api.js','utf8'),context);
  return {context,get xhr(){return xhr;}};
}
test('Ein Fehler im UI-Callback wird nicht als JSON-Fehler ein zweites Mal ausgeliefert',()=>{
  const c=client();let calls=0;
  c.context.apiGet('/test',()=>{calls++;throw new Error('UI error');});
  assert.throws(()=>c.xhr.reply(200,'{"ok":true}'),/UI error/);assert.equal(calls,1);
});
test('Netzwerkfehler und Timeout liefern genau eine Fehlermeldung',()=>{
  const c=client();let calls=0;
  c.context.apiPost('/test',{},error=>{assert.ok(error);calls++;});
  assert.equal(c.xhr.headers['X-Wallpanel-Admin'],'1');
  c.xhr.ontimeout();c.xhr.onerror();c.xhr.reply(0,'');assert.equal(calls,1);
  assert.equal(c.context.getPanelId(),'default');
});
