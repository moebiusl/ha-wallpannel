const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isEntityId, validateEntityService } = require('../src/entity-service');
test('Gerätebefehle erlauben keinen allgemeinen HA-Service oder zusätzlichen Zielbereich',()=>{
  assert.throws(()=>validateEntityService('homeassistant.core','restart',{}));
  assert.throws(()=>validateEntityService('light.test','__proto__',{}));
  assert.deepEqual(validateEntityService('light.test','turn_on',{brightness_pct:50,area_id:'all',entity_id:'all'}),{brightness_pct:50});
  assert.throws(()=>validateEntityService('climate.test','set_temperature',{}));
  assert.throws(()=>validateEntityService('media_player.test','volume_set',{volume_level:3}));
  assert.deepEqual(validateEntityService('climate.test','set_temperature',{temperature:21.5}),{temperature:21.5});
  assert.deepEqual(validateEntityService('light.test','turn_on',{hs_color:[25,80]}),{hs_color:[25,80]});
});
test('Entitätskennungen aus dem Browser können keine anderen HA-Pfade erreichen',()=>{
  for(const id of ['camera.einfahrt','image.klingel_event_image','media_player.home_pod_2'])assert.equal(isEntityId(id),true,id);
  for(const id of ['../../api/config','camera.x/../../api/config','camera.x?y=1','camera.x%2F..','Camera.X','camera.','.x','',null,['camera.x']])assert.equal(isEntityId(id),false,String(id));
});
