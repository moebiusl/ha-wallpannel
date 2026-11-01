const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createSettingsAuth } = require('../src/settings-auth');

test('Verwaltungsänderungen benötigen eine gültige PIN-Sitzung und eigenen Header', async () => {
  const app = express(); const auth = createSettingsAuth('5678');
  app.use(express.json()); app.use(auth.guard);
  app.post('/api/settings/unlock', auth.unlock);
  app.post('/api/panel-config', (_, res) => res.json({ok:true}));
  app.delete('/api/tablets/test', (_, res) => res.json({ok:true}));
  app.post('/api/panel/reload', (_, res) => res.json({ok:true}));
  app.post('/api/tablets/notify', (_, res) => res.json({ok:true}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const post = (path, body={}, headers={}) => fetch(base+path, {method:'POST', headers:{'Content-Type':'application/json',...headers}, body:JSON.stringify(body)});
  try {
    assert.equal((await post('/api/panel-config')).status, 401);
    assert.equal((await post('/api/panel/reload',{target:'all'})).status,401);
    assert.equal((await post('/api/settings/unlock', {pin:'0000'})).status,401);
    const unlocked = await post('/api/settings/unlock', {pin:'5678'});
    assert.equal(unlocked.status,200);
    const cookieHeader = unlocked.headers.get('set-cookie');
    assert.match(cookieHeader,/HttpOnly/); assert.match(cookieHeader,/SameSite=Strict/);
    const cookie = cookieHeader.split(';')[0];
    assert.equal((await post('/api/panel-config',{}, {Cookie:cookie})).status,401);
    const headers = {Cookie:cookie,'X-Wallpanel-Admin':'1'};
    assert.equal((await post('/api/panel-config',{},headers)).status,200);
    assert.equal((await post('/api/panel/reload',{target:'all'},headers)).status,200);
    assert.equal((await post('/api/panel-config',{}, {...headers,Cookie:cookie.slice(0,-1)+(cookie.endsWith('a')?'b':'a')})).status,401);
    assert.equal((await fetch(base+'/api/tablets/test',{method:'DELETE',headers})).status,200);
    assert.equal((await post('/api/tablets/notify')).status,200);
    for(let i=0;i<5;i++)assert.equal((await post('/api/settings/unlock',{pin:'0000'})).status,401);
    assert.equal((await post('/api/settings/unlock',{pin:'5678'})).status,429);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
