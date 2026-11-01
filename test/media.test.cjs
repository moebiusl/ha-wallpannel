const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mediaPlayerKey, validPlaylistUri } = require('../src/media');
test('AirPlay und Music Assistant werden über ihre physische Kennung zugeordnet', () => {
  assert.equal(mediaPlayerKey({platform:'apple_tv',unique_id:'AA:BB:CC:DD:EE:FF'}),mediaPlayerKey({platform:'music_assistant',unique_id:'apAABBCCDDEEFF'}));
  assert.equal(mediaPlayerKey({platform:'other',device_id:'device-1'}),'device:device-1');
  assert.equal(mediaPlayerKey({platform:'other',unique_id:'Wohnzimmer'}),null);
  assert.equal(mediaPlayerKey(undefined),null);
});
test('Playlist-Befehle akzeptieren nur Medienkennungen', () => {
  for(const uri of ['library://playlist/123','apple_music://playlist/abc','spotify://playlist/abc'])assert.equal(validPlaylistUri(uri),true);
  for(const uri of ['https://example.com/music','file:///etc/passwd','library://track/123','spotify://playlist/a b',null,''])assert.equal(validPlaylistUri(uri),false);
});
