var securityState = {
  cameras: [],
  activeCameraIndex: 0,
  config: null
};

function securityText(id, value) {
  var el = document.getElementById(id);
  if (el) { el.textContent = value; }
}

function isExcludedSecurityEntity(entity) {
  var id = entity.entityId || "";
  var name = (entity.name || "").toLowerCase();
  return id.indexOf("3d_drucker") !== -1 ||
    id.indexOf("skoda") !== -1 ||
    id.indexOf("f3de43e3e8b1") !== -1 ||
    id.indexOf("jura") !== -1 ||
    id.indexOf("kuhlschrank") !== -1 ||
    name.indexOf("3d drucker") !== -1 ||
    name.indexOf("skoda") !== -1 ||
    name.indexOf("škoda") !== -1 ||
    name.indexOf("jura") !== -1 ||
    name.indexOf("milk system") !== -1 ||
    name.indexOf("cleaning needed") !== -1 ||
    name.indexOf("kühlschrank") !== -1 ||
    name.indexOf("kuhlschrank") !== -1;
}

function isSecurityEntity(entity) {
  if (!entity || isExcludedSecurityEntity(entity)) {
    return false;
  }
  if (entity.domain === "alarm_control_panel") {
    return true;
  }
  if (entity.domain === "lock") {
    return true;
  }
  if (entity.domain !== "binary_sensor") {
    return false;
  }
  return [
    "door",
    "window",
    "opening",
    "motion",
    "occupancy",
    "safety",
    "smoke",
    "gas",
    "carbon_monoxide",
    "carbon_dioxide",
    "problem",
    "lock"
  ].indexOf(entity.deviceClass) !== -1;
}

function getSecurityPageConfig() {
  var config = securityState.config;
  var panel = config && config.panels && config.panels[getPanelId()] ? config.panels[getPanelId()] : null;
  return panel && panel.pages ? panel.pages.sicherheit : null;
}

function isSecurityEntityVisible(entity) {
  var page = getSecurityPageConfig();
  if (!page || !entity) { return true; }
  if (page.hiddenEntities && page.hiddenEntities.indexOf(entity.entityId) !== -1) { return false; }
  return true;
}

function securityCategory(entity) {
  if (entity.domain === "alarm_control_panel") {
    return "Alarmanlagen";
  }
  if (entity.domain === "lock") {
    return "Türen";
  }
  if (["smoke", "gas", "carbon_monoxide", "carbon_dioxide", "problem", "safety"].indexOf(entity.deviceClass) !== -1) {
    return "Gefahrenmelder";
  }
  if (["door", "opening", "lock"].indexOf(entity.deviceClass) !== -1) {
    return "Türen";
  }
  if (entity.deviceClass === "window") {
    return "Fenster";
  }
  if (["motion", "occupancy"].indexOf(entity.deviceClass) !== -1) {
    return "Kameras & Bewegung";
  }
  return "Weitere Sensoren";
}

function securityIcon(entity) {
  if (entity.domain === "alarm_control_panel") { return "ALARM"; }
  if (entity.domain === "lock") { return "LOCK"; }
  if (entity.deviceClass === "door") { return "DOOR"; }
  if (entity.deviceClass === "window") { return "WIN"; }
  if (entity.deviceClass === "opening") { return "OPEN"; }
  if (entity.deviceClass === "motion" || entity.deviceClass === "occupancy") { return "MOVE"; }
  if (entity.deviceClass === "smoke") { return "SMOKE"; }
  if (entity.deviceClass === "gas") { return "GAS"; }
  if (entity.deviceClass === "carbon_monoxide") { return "CO"; }
  if (entity.deviceClass === "carbon_dioxide") { return "CO2"; }
  if (entity.deviceClass === "problem") { return "!"; }
  if (entity.deviceClass === "safety") { return "SAFE"; }
  if (entity.deviceClass === "lock") { return "LOCK"; }
  return "STAT";
}

function securityStateText(entity) {
  if (entity.state === "unavailable") { return "nicht verfügbar"; }
  if (entity.state === "unknown") { return "unbekannt"; }
  if (entity.domain === "alarm_control_panel") {
    if (entity.state === "armed_home") { return "scharf zuhause"; }
    if (entity.state === "armed_away") { return "scharf"; }
    if (entity.state === "disarmed") { return "unscharf"; }
    if (entity.state === "triggered") { return "Alarm"; }
    return entity.state;
  }
  if (entity.domain === "lock") {
    return entity.state === "locked" ? "verriegelt" : "offen";
  }
  if (entity.deviceClass === "door" || entity.deviceClass === "window" || entity.deviceClass === "opening") {
    return entity.state === "on" ? "offen" : "zu";
  }
  if (entity.deviceClass === "motion" || entity.deviceClass === "occupancy") {
    return entity.state === "on" ? "Bewegung" : "ruhig";
  }
  if (entity.deviceClass === "smoke") {
    return entity.state === "on" ? "Rauch" : "ok";
  }
  if (entity.deviceClass === "gas") {
    return entity.state === "on" ? "Gas" : "ok";
  }
  if (entity.deviceClass === "carbon_monoxide") {
    return entity.state === "on" ? "CO" : "ok";
  }
  if (entity.deviceClass === "carbon_dioxide") {
    return entity.state === "on" ? "CO2" : "ok";
  }
  if (entity.deviceClass === "problem" || entity.deviceClass === "safety") {
    return entity.state === "on" ? "Problem" : "ok";
  }
  if (entity.deviceClass === "lock") {
    return entity.state === "on" ? "aktiv" : "inaktiv";
  }
  return entity.state;
}

function securitySeverity(entity) {
  if (entity.state === "unavailable" || entity.state === "unknown") {
    if (["smoke", "gas", "carbon_monoxide", "carbon_dioxide"].indexOf(entity.deviceClass) !== -1) { return "danger"; }
    return "warn";
  }
  if (entity.domain === "alarm_control_panel") {
    if (entity.state === "triggered") { return "danger"; }
    if (entity.state === "disarmed") { return "warn"; }
    return "ok";
  }
  if (entity.domain === "lock") {
    return entity.state === "locked" ? "ok" : "warn";
  }
  if (["smoke", "gas", "carbon_monoxide", "carbon_dioxide"].indexOf(entity.deviceClass) !== -1) {
    return entity.state === "on" ? "danger" : "ok";
  }
  if (["problem", "safety"].indexOf(entity.deviceClass) !== -1) {
    return entity.state === "on" ? "warn" : "ok";
  }
  return entity.state === "on" ? "warn" : "ok";
}

function isSecurityAlert(entity) {
  var severity = securitySeverity(entity);
  return severity === "warn" || severity === "danger";
}

function isSecurityHazard(entity) {
  return securityCategory(entity) === "Gefahrenmelder" && isSecurityAlert(entity);
}

function securitySort(a, b) {
  var severityRank = { danger: 3, warn: 2, ok: 1 };
  var severityDiff = (severityRank[securitySeverity(b)] || 0) - (severityRank[securitySeverity(a)] || 0);
  if (severityDiff !== 0) { return severityDiff; }
  var alertDiff = (isSecurityAlert(b) ? 1 : 0) - (isSecurityAlert(a) ? 1 : 0);
  if (alertDiff !== 0) { return alertDiff; }
  return String(a.name || a.entityId).localeCompare(String(b.name || b.entityId), "de");
}

function renderSecurityEntity(entity) {
  var card = document.createElement("article");
  card.className = "security-entity-card " + securitySeverity(entity) + (entity.state === "unavailable" || entity.state === "unknown" ? " muted" : "");

  var icon = document.createElement("div");
  icon.className = "security-entity-icon";
  icon.textContent = securityIcon(entity);
  card.appendChild(icon);

  var name = document.createElement("div");
  name.className = "security-entity-name";
  name.textContent = entity.name || entity.entityId;
  card.appendChild(name);

  var state = document.createElement("div");
  state.className = "security-entity-state";
  state.textContent = securityStateText(entity);
  card.appendChild(state);

  return card;
}

function renderSecuritySection(title, entities) {
  var section = document.createElement("section");
  section.className = "security-group-section";

  var heading = document.createElement("div");
  heading.className = "room-section-title";
  heading.textContent = title;
  section.appendChild(heading);

  var grid = document.createElement("div");
  grid.className = "security-entity-grid";
  entities.sort(securitySort);
  for (var i = 0; i < entities.length; i++) {
    grid.appendChild(renderSecurityEntity(entities[i]));
  }
  section.appendChild(grid);
  return section;
}

function renderSecuritySensors(structure) {
  var mount = document.getElementById("securitySections");
  if (!mount || !structure) { return; }
  var entities = (structure.entities || []).filter(function (entity) {
    return isSecurityEntity(entity) && isSecurityEntityVisible(entity);
  });
  var groups = {
    "Gefahrenmelder": [],
    "Alarmanlagen": [],
    "Türen": [],
    "Fenster": [],
    "Kameras & Bewegung": [],
    "Weitere Sensoren": []
  };
  var activeCount = 0;
  var hazardCount = 0;

  for (var i = 0; i < entities.length; i++) {
    var category = securityCategory(entities[i]);
    groups[category].push(entities[i]);
    if (isSecurityAlert(entities[i])) { activeCount++; }
    if (isSecurityHazard(entities[i])) { hazardCount++; }
  }

  securityText("securityActiveCount", String(activeCount));
  securityText("securityHazardCount", String(hazardCount));
  securityText("securitySensorCount", String(entities.length));

  mount.innerHTML = "";
  ["Gefahrenmelder", "Alarmanlagen", "Türen", "Fenster", "Kameras & Bewegung", "Weitere Sensoren"].forEach(function (title) {
    if (groups[title].length > 0) {
      mount.appendChild(renderSecuritySection(title, groups[title]));
    }
  });
}

function cameraImageUrl(camera) {
  return camera.imageUrl || camera.eventUrl || camera.liveUrl || "";
}

function selectSecurityCamera(index) {
  if (!securityState.cameras[index]) { return; }
  securityState.activeCameraIndex = index;
  renderSecurityCameras(securityState.cameras);
}

function renderSecurityCameras(cameras) {
  securityState.cameras = cameras || [];
  var main = document.getElementById("securityCameraMain");
  var strip = document.getElementById("securityCameraStrip");
  if (!main || !strip || securityState.cameras.length === 0) { return; }

  var active = securityState.cameras[securityState.activeCameraIndex] || securityState.cameras[0];
  main.innerHTML = '<div class="security-camera-name">' + (active.name || "Kamera") + '</div><img class="security-camera-image" src="' + cameraImageUrl(active) + '?t=' + new Date().getTime() + '" alt="Kamera">';
  strip.innerHTML = "";

  for (var i = 0; i < securityState.cameras.length; i++) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = i === securityState.activeCameraIndex ? "security-camera-thumb active" : "security-camera-thumb";
    button.setAttribute("data-camera-index", String(i));
    button.onclick = function () {
      selectSecurityCamera(Number(this.getAttribute("data-camera-index")));
    };
    button.innerHTML = '<img src="' + cameraImageUrl(securityState.cameras[i]) + '?t=' + new Date().getTime() + '" alt=""><span>' + (securityState.cameras[i].name || "Kamera") + '</span>';
    strip.appendChild(button);
  }
}

function loadSecurityPage() {
  apiGet("api/dashboard", function (_dashboardError, dashboard) {
    if (dashboard && dashboard.cameras) {
      renderSecurityCameras(dashboard.cameras);
    }
  });

  apiGet("api/panel-config", function (_configError, payload) {
    securityState.config = payload && payload.config ? payload.config : null;
    apiGet("api/ha/structure", function (error, structure) {
      if (error) {
        securityText("securityUpdateState", "Fehler beim Laden");
        return;
      }
      renderSecuritySensors(structure);
      securityText("securityUpdateState", "Letztes Update: " + new Date().toLocaleTimeString("de-DE"));
    });
  });
}

loadSecurityPage();
setInterval(loadSecurityPage, 5000);
