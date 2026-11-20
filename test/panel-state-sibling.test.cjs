const test = require("node:test");
const assert = require("node:assert/strict");
require("ts-node/register/transpile-only");
const { projectPanelEntities } = require("../src/panel-state");

const ma = { entityId: "media_player.kuche_2", domain: "media_player", visibleByDefault: true, haHidden: false, siblingEntityId: "media_player.kuche", musicAssistant: true };
const state = (id, s, title) => ({ entity_id: id, state: s, attributes: { media_title: title } });

test("HomePod: läuft Musik nur über AirPlay, zeigt das Panel diesen Zustand", () => {
  const [entity] = projectPanelEntities([ma], [state("media_player.kuche_2", "idle", "alt"), state("media_player.kuche", "playing", "neu")]);
  assert.equal(entity.state, "playing");
  assert.equal(entity.attributes.media_title, "neu");
  assert.equal(entity.entityId, "media_player.kuche_2");
});

test("HomePod: Music Assistant hat Vorrang, wenn er selbst spielt oder nichts läuft", () => {
  const [a] = projectPanelEntities([ma], [state("media_player.kuche_2", "playing", "ma"), state("media_player.kuche", "playing", "air")]);
  assert.equal(a.attributes.media_title, "ma");
  const [b] = projectPanelEntities([ma], [state("media_player.kuche_2", "idle", "ma"), state("media_player.kuche", "idle", "air")]);
  assert.equal(b.state, "idle");
});
