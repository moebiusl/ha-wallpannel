function setEnergyText(id, value) {
  var el = document.getElementById(id);
  if (el) {
    el.textContent = value || "unavailable";
  }
}

function setEnergyRetryStatus(active) {
  var el = document.getElementById("energyUpdateState");
  if (!el) { return; }
  el.className = active ? "panel-meta energy-update-meta retry-status" : "panel-meta energy-update-meta";
  el.title = active ? "Zum Neuladen tippen" : "";
  el.onclick = active ? function () {
    el.textContent = "Lade...";
    el.className = "panel-meta energy-update-meta retry-status is-loading";
    window.location.reload();
  } : null;
}

var energyPageConfig = null;
var energyBatteryEntities = [];
var energyPageRequestActive = false;
var energyBatteryRequestActive = false;

function getEnergyConfig() {
  if (!energyPageConfig) { return null; }
  var panel = energyPageConfig.panels && energyPageConfig.panels[getPanelId()] ? energyPageConfig.panels[getPanelId()] : null;
  return panel && panel.pages ? panel.pages.energie : null;
}

function isEnergyMetricVisible(metric) {
  var page = getEnergyConfig();
  var id = metric && metric.id;
  if (!page || !id) { return true; }
  if (page.hiddenEntities && page.hiddenEntities.indexOf(id) !== -1) { return false; }
  return true;
}

function visibleEnergyMetrics(metrics) {
  return (metrics || []).filter(isEnergyMetricVisible);
}

function metricTile(metric, emphasis) {
  var tile = document.createElement("article");
  tile.className = "energy-metric-tile" + (emphasis ? " emphasis" : "");

  var label = document.createElement("div");
  label.className = "energy-metric-label";
  label.textContent = metric.label || "Wert";
  tile.appendChild(label);

  var value = document.createElement("div");
  value.className = "energy-metric-value";
  value.textContent = metric.display || "unavailable";
  tile.appendChild(value);

  return tile;
}

function energySection(title, metrics) {
  metrics = visibleEnergyMetrics(metrics);
  if (metrics.length === 0) { return null; }

  var section = document.createElement("section");
  section.className = "energy-detail-section";

  var heading = document.createElement("div");
  heading.className = "room-section-title";
  heading.textContent = title;
  section.appendChild(heading);

  var grid = document.createElement("div");
  grid.className = "energy-metric-grid";
  for (var i = 0; i < metrics.length; i++) {
    grid.appendChild(metricTile(metrics[i], i < 4));
  }
  section.appendChild(grid);
  return section;
}

function renderEnergyPage(data) {
  if (!data || !data.summary) { return; }

  setEnergyText("energyPageSolar", data.summary.solarPowerDisplay);
  setEnergyText("energyPageGrid", data.summary.gridPowerDisplay);
  setEnergyText("energyPageDeltaBattery", data.summary.deltaBatteryDisplay);
  setEnergyText("energyPagePowerstreamBattery", data.summary.powerstreamBatteryDisplay);

  var mount = document.getElementById("energySections");
  if (!mount) { return; }
  mount.innerHTML = "";

  appendEnergySection(mount, "Delta2", [
    data.delta2.battery,
    data.delta2.status,
    data.delta2.totalInPower,
    data.delta2.totalOutPower,
    data.delta2.solarInPower,
    data.delta2.acInPower,
    data.delta2.acOutPower,
    data.delta2.remainingTime,
    data.delta2.batteryTemperature,
    data.delta2.cycles
  ]);

  appendEnergySection(mount, "Powerstream", [
    data.powerstream.batteryCharge,
    data.powerstream.status,
    data.powerstream.solarPower,
    data.powerstream.inverterOutputWatts,
    data.powerstream.batteryInputWatts,
    data.powerstream.smartPlugLoads,
    data.powerstream.otherLoads,
    data.powerstream.batteryStatus,
    data.powerstream.batteryTemperature,
    data.powerstream.inverterTemperature
  ]);

  appendEnergySection(mount, "Haus / Netz", [
    data.grid.power,
    data.grid.feedIn,
    data.grid.consumption,
    data.grid.feedInTotal
  ]);

  setEnergyText("energyUpdateState", "Letztes Update: " + (data.updatedAt || formatGermanDateTime(new Date())));
  setEnergyRetryStatus(false);
}

function isIgnoredEnergyBatteryEntity(entity) {
  var text = ((entity.name || "") + " " + (entity.entityId || "")).toLowerCase();
  return text.indexOf("apple watch") !== -1 ||
    text.indexOf("iphone") !== -1 ||
    text.indexOf("macbook") !== -1 ||
    text.indexOf("mac book") !== -1;
}

function renderEnergyBatteryOverview() {
  var mount = document.getElementById("energyBatteryOverviewList");
  if (!mount) { return; }
  mount.innerHTML = "";

  if (energyBatteryEntities.length === 0) {
    var empty = document.createElement("div");
    empty.className = "home-notification-empty";
    empty.textContent = "Keine Batterie-Entitäten gefunden";
    mount.appendChild(empty);
    return;
  }

  for (var i = 0; i < energyBatteryEntities.length; i++) {
    var entity = energyBatteryEntities[i];
    var value = Number(entity.state);
    var unit = entity.attributes && entity.attributes.unit_of_measurement ? entity.attributes.unit_of_measurement : "%";
    var row = document.createElement("div");
    row.className = "battery-overview-row" + (!Number.isNaN(value) && value <= 20 ? " warn" : "");
    row.innerHTML = '<span>' + (entity.name || entity.entityId) + '</span><b>' + entity.state + ' ' + unit + '</b>';
    mount.appendChild(row);
  }
}

function loadEnergyBatteryEntities() {
  if (energyBatteryRequestActive) { return; }
  energyBatteryRequestActive = true;
  apiGet("api/ha/structure", function (_error, structure) {
    energyBatteryRequestActive = false;
    var entities = structure && structure.entities ? structure.entities : [];
    energyBatteryEntities = [];
    for (var i = 0; i < entities.length; i++) {
      if (entities[i].deviceClass === "battery" && !isIgnoredEnergyBatteryEntity(entities[i])) {
        energyBatteryEntities.push(entities[i]);
      }
    }
    energyBatteryEntities.sort(function (a, b) {
      var av = Number(a.state);
      var bv = Number(b.state);
      if (Number.isNaN(av)) { av = 999; }
      if (Number.isNaN(bv)) { bv = 999; }
      if (av !== bv) { return av - bv; }
      return String(a.name || a.entityId).localeCompare(String(b.name || b.entityId), "de");
    });
    renderEnergyBatteryOverview();
  });
}

function openEnergyBatteryModal() {
  renderEnergyBatteryOverview();
  var backdrop = document.getElementById("energyModalBackdrop");
  var modal = document.getElementById("energyBatteryModal");
  if (backdrop) { backdrop.className = "modal-backdrop open"; }
  if (modal) { modal.className = "dashboard-modal open"; }
}

function closeEnergyBatteryModal() {
  var backdrop = document.getElementById("energyModalBackdrop");
  var modal = document.getElementById("energyBatteryModal");
  if (backdrop) { backdrop.className = "modal-backdrop"; }
  if (modal) { modal.className = "dashboard-modal"; }
}

function appendEnergySection(mount, title, metrics) {
  var section = energySection(title, metrics);
  if (section) {
    mount.appendChild(section);
  }
}

function loadEnergyPage() {
  if (energyPageRequestActive) { return; }
  energyPageRequestActive = true;
  apiGet("api/energy", function (error, data) {
    energyPageRequestActive = false;
    if (error) {
      setEnergyText("energyUpdateState", "Fehler beim Laden");
      setEnergyRetryStatus(true);
      return;
    }
    renderEnergyPage(data);
  });
}

apiGet("api/panel-config", function (_error, payload) {
  energyPageConfig = payload && payload.config ? payload.config : null;
  loadEnergyPage();
  loadEnergyBatteryEntities();
});
setInterval(loadEnergyPage, 10000);
setInterval(loadEnergyBatteryEntities, 60000);
