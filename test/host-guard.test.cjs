const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedHost } = require('../src/host-guard');
test('Lokale Adressen bleiben erreichbar, fremde Domains werden gegen DNS-Rebinding abgewiesen',()=>{
  for(const host of ['192.168.178.150:3000','127.0.0.1','localhost:3000','homeassistant.local:3000','homeassistant:3000','a0d7b954-wallpanel:3000','nas.fritz.box','[::1]:3000','HomeAssistant.Local'])assert.equal(isAllowedHost(host),true,host);
  for(const host of ['evil.example.com','192.168.178.150.evil.com','local.evil.com:3000','',undefined])assert.equal(isAllowedHost(host),false,String(host));
  assert.equal(isAllowedHost('wallpanel.example.de',['example.de']),true);assert.equal(isAllowedHost('notexample.de',['example.de']),false);
});
