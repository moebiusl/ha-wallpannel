const test = require("node:test");
const assert = require("node:assert/strict");
const { buildAppliances } = require("../src/appliances.ts");

const devices = [
  { id: "d1", name: "Geschirrspüler", area_id: "kueche" },
  { id: "d2", name: "Backofen", area_id: null }
];
const reg = (entity_id, device_id, key, extra = {}) => ({ entity_id, device_id, platform: "home_connect", unique_id: `HAID123-${key}`, ...extra });
const entities = [
  reg("sensor.gs_zustand", "d1", "BSH.Common.Status.OperationState"),
  reg("sensor.gs_ende", "d1", "BSH.Common.Option.RemainingProgramTime"),
  reg("sensor.gs_fortschritt", "d1", "BSH.Common.Option.ProgramProgress"),
  reg("select.gs_aktiv", "d1", "BSH.Common.Root.ActiveProgram"),
  reg("sensor.gs_tuer", "d1", "BSH.Common.Status.DoorState"),
  reg("binary_sensor.gs_verbunden", "d1", "BSH.Common.Appliance.Connected"),
  reg("sensor.bo_zustand", "d2", "BSH.Common.Status.OperationState"),
  reg("sensor.bo_temp", "d2", "Cooking.Oven.Status.CurrentCavityTemperature"),
  reg("switch.bo_power", "d2", "BSH.Common.Setting.PowerState"),
  reg("sensor.bo_event", "d2", "BSH.Common.Event.ProgramFinished", { disabled_by: "integration" }),
  { entity_id: "light.x", device_id: "d9", platform: "hue", unique_id: "abc" }
];
const state = (entity_id, s) => ({ entity_id, state: s });

test("Geschirrspüler läuft mit Programm, Fortschritt und Ende", () => {
  const list = buildAppliances([
    state("sensor.gs_zustand", "run"), state("sensor.gs_ende", "2026-11-20T09:59:03+00:00"), state("sensor.gs_fortschritt", "42.4"),
    state("select.gs_aktiv", "dishcare_dishwasher_program_eco_50"), state("sensor.gs_tuer", "closed"), state("binary_sensor.gs_verbunden", "on"),
    state("sensor.bo_zustand", "inactive"), state("sensor.bo_temp", "20"), state("switch.bo_power", "off")
  ], devices, entities);
  assert.equal(list.length, 2);
  const gs = list.find((a) => a.kind === "dishwasher");
  assert.equal(gs.status, "running");
  assert.equal(gs.statusText, "Läuft");
  assert.equal(gs.program, "Eco 50 °C");
  assert.equal(gs.progress, 42);
  assert.equal(gs.endsAt, Date.parse("2026-11-20T09:59:03+00:00"));
  assert.equal(gs.door, "closed");
  assert.equal(gs.room, "kueche");
});

test("Backofen aus: Temperatur, kein Programm, kein Raum", () => {
  const list = buildAppliances([state("sensor.bo_zustand", "inactive"), state("sensor.bo_temp", "20"), state("switch.bo_power", "off")], devices, entities);
  const oven = list.find((a) => a.kind === "oven");
  assert.equal(oven.status, "off");
  assert.equal(oven.temperature, 20);
  assert.equal(oven.program, null);
  assert.equal(oven.room, null);
});

test("Nicht verbunden oder Zustand fehlt: nicht erreichbar, fremde Geräte ignoriert", () => {
  const list = buildAppliances([
    state("sensor.gs_zustand", "run"), state("binary_sensor.gs_verbunden", "off"), state("sensor.bo_zustand", "unavailable")
  ], devices, entities);
  assert.equal(list.find((a) => a.kind === "dishwasher").status, "unavailable");
  assert.equal(list.find((a) => a.kind === "oven").status, "unavailable");
  assert.equal(list.length, 2);
});

test("Einschalter an im Leerlauf heißt bereit; unbekanntes Programm wird lesbar", () => {
  const list = buildAppliances([state("sensor.bo_zustand", "inactive"), state("switch.bo_power", "on")], devices, entities);
  assert.equal(list.find((a) => a.kind === "oven").status, "ready");
  const gs = buildAppliances([state("sensor.gs_zustand", "run"), state("select.gs_aktiv", "dishcare_dishwasher_program_super_clean")], devices, entities).find((a) => a.kind === "dishwasher");
  assert.equal(gs.program, "Super clean");
});

test("Steuerung: nur sinnvolle Aktionen, vom Server geprüft", () => {
  const { resolveApplianceAction } = require("../src/appliances.ts");
  const ctrl = [
    ...entities,
    reg("button.gs_stop", "d1", "StopProgram"),
    reg("button.bo_pause", "d2", "BSH.Common.Command.PauseProgram"),
    reg("button.bo_resume", "d2", "BSH.Common.Command.ResumeProgram"),
    reg("switch.gs_power", "d1", "BSH.Common.Setting.PowerState")
  ];
  const running = [
    state("sensor.gs_zustand", "run"), state("switch.gs_power", "on"), state("button.gs_stop", "unknown"),
    state("sensor.bo_zustand", "inactive"), state("switch.bo_power", "off"), state("button.bo_pause", "unknown"), state("button.bo_resume", "unknown")
  ];
  const list = buildAppliances(running, devices, ctrl);
  assert.deepEqual(list.find((a) => a.kind === "dishwasher").actions, ["stop"]);
  assert.deepEqual(list.find((a) => a.kind === "oven").actions, ["power-on"]);
  assert.deepEqual(resolveApplianceAction(running, devices, ctrl, "d1", "stop"), { domain: "button", service: "press", entityId: "button.gs_stop", label: "Geschirrspüler" });
  // Ausschalten während des Laufs, Fortsetzen ohne Pause und unbekannte Aktionen werden abgelehnt.
  assert.equal(resolveApplianceAction(running, devices, ctrl, "d1", "power-off"), null);
  assert.equal(resolveApplianceAction(running, devices, ctrl, "d2", "resume"), null);
  assert.equal(resolveApplianceAction(running, devices, ctrl, "d1", "start"), null);
  assert.equal(resolveApplianceAction(running, devices, ctrl, "d9", "stop"), null);
  const idle = running.map((s) => s.entity_id === "sensor.gs_zustand" ? state(s.entity_id, "inactive") : s);
  assert.deepEqual(resolveApplianceAction(idle, devices, ctrl, "d1", "power-off"), { domain: "switch", service: "turn_off", entityId: "switch.gs_power", label: "Geschirrspüler" });
});
