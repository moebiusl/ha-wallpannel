/* Isolated function checks only. No browser, network, audio or device actions. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const acorn = require('acorn');
const source = fs.readFileSync(require.resolve('../public/panel/live.js'), 'utf8');
const body = acorn.parse(source, {ecmaVersion:5}).body[0].expression.callee.body.body;
function harness(intent, unlocked=true) {
  const calls=[], status={textContent:''};
  const env={busy:{},pinIntent:intent,Date,
    el:()=>status,requestReload:target=>calls.push(['reload',target]),directory:()=>calls.push(['directory']),
    request:(method,url,body,cb)=>cb(unlocked?null:'PIN stimmt nicht.',{unlocked}),
    ui:{state:{dialog:{type:'pin'},pin:'1234',view:'apps'},updatePin:()=>{},
      closeDialog:()=>{env.pinIntent='';env.ui.state.dialog=null;},
      go:view=>{env.ui.state.view=view;calls.push(['go',view]);},toast:()=>{}}
  };
  return {calls,env,status,run(name,...args){const node=body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return vm.runInNewContext('('+source.slice(node.start,node.end)+')',env)(...args);}};
}
test('PIN confirmation for collective reload sends reload instead of opening settings',()=>{
  const h=harness('reload-all');h.run('unlock','dummy-pin');
  assert.deepEqual(h.calls,[['reload','all']]);
});
test('incorrect PIN cannot schedule collective reload',()=>{
  const h=harness('reload-all',false);h.run('unlock','dummy-pin');
  assert.deepEqual(h.calls,[]);assert.equal(h.status.textContent,'PIN stimmt nicht.');
});
test('ordinary PIN confirmation still opens settings',()=>{
  const h=harness('');h.run('unlock','dummy-pin');
  assert.deepEqual(h.calls,[['directory'],['go','settings']]);
});
test('reload restores valid settings session without showing a PIN dialog',()=>{
  const h=harness('');h.env.ui.state.dialog=null;h.run('restoreSettings');
  assert.deepEqual(h.calls,[['go','settings'],['directory']]);assert.equal(h.env.ui.state.dialog,null);
});
test('expired session remains in Apps without opening keypad or Home',()=>{
  const h=harness('',false);h.env.ui.state.dialog=null;h.run('restoreSettings');
  assert.deepEqual(h.calls,[['go','apps']]);assert.equal(h.env.ui.state.dialog,null);
});
