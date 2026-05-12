function setEnergyText(id, value) {
  var el = document.getElementById(id);
  if (el) {
    el.textContent = value || "unavailable";
  }
}

var energyPageConfig = null;

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

  setEnergyText("energyUpdateState", "Letztes Update: " + (data.updatedAt || new Date().toLocaleTimeString("de-DE")));
}

function appendEnergySection(mount, title, metrics) {
  var section = energySection(title, metrics);
  if (section) {
    mount.appendChild(section);
  }
}

function loadEnergyPage() {
  apiGet("api/energy", function (error, data) {
    if (error) {
      setEnergyText("energyUpdateState", "Fehler beim Laden");
      return;
    }
    renderEnergyPage(data);
  });
}

apiGet("api/panel-config", function (_error, payload) {
  energyPageConfig = payload && payload.config ? payload.config : null;
  loadEnergyPage();
});
setInterval(loadEnergyPage, 5000);
