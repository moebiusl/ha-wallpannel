var currentCameras = [];
var currentCameraIndex = 0;
var currentCameraSourceMode = "event";
var liveCameraRefreshIntervalMs = 750;
var notificationState = {
  dashboard: null,
  structure: null
};
function openModal(id) {
  var backdrop = document.getElementById("modalBackdrop");
  var modal = document.getElementById(id);

  if (backdrop) {
    backdrop.className = "modal-backdrop open";
  }

  if (modal) {
    modal.className = "dashboard-modal open";
  }
}

function closeModal() {
  var backdrop = document.getElementById("modalBackdrop");
  var modals = document.getElementsByClassName("dashboard-modal");
  var i;

  if (backdrop) {
    backdrop.className = "modal-backdrop";
  }

  for (i = 0; i < modals.length; i++) {
    modals[i].className = "dashboard-modal";
  }
}

function setImageSource(imageId, url) {
  var image = document.getElementById(imageId);
  if (!image) {
    return;
  }

  if (url) {
    image.src = url + "?t=" + new Date().getTime();
    image.style.display = "block";
  } else {
    image.removeAttribute("src");
    image.style.display = "none";
  }
}

function getCameraImageUrl(camera) {
  if (!camera) {
    return "";
  }

  if (currentCameraSourceMode === "live") {
    return camera.liveUrl || camera.liveImageUrl || camera.streamUrl || camera.imageUrl || "";
  }

  return camera.imageUrl || camera.eventUrl || camera.eventImageUrl || "";
}

function updateCameraSourceButtons() {
  var eventButtons = [
    document.getElementById("cameraEventModeButton"),
    document.getElementById("cameraEventModeButtonModal")
  ];
  var liveButtons = [
    document.getElementById("cameraLiveModeButton"),
    document.getElementById("cameraLiveModeButtonModal")
  ];
  var i;

  for (i = 0; i < eventButtons.length; i++) {
    if (eventButtons[i]) {
      eventButtons[i].className = currentCameraSourceMode === "event"
        ? "camera-source-button active"
        : "camera-source-button";
    }
  }

  for (i = 0; i < liveButtons.length; i++) {
    if (liveButtons[i]) {
      liveButtons[i].className = currentCameraSourceMode === "live"
        ? "camera-source-button active"
        : "camera-source-button";
    }
  }
}

function setCameraSourceMode(mode) {
  if (mode !== "event" && mode !== "live") {
    return;
  }

  currentCameraSourceMode = mode;
  updateCameraSourceButtons();
  renderCameras(currentCameras);
  refreshActiveCameraImages();
}
function refreshCameraThumb(index, imageId, nameId, fallbackName) {
  var camera = currentCameras[index];
  if (!camera) {
    return;
  }

  setText(nameId, camera.name || fallbackName);
  setImageSource(imageId, getCameraImageUrl(camera));
}

function refreshActiveCameraImages() {
  if (!currentCameras || !currentCameras.length) {
    return;
  }

  updateMainCamera(currentCameraIndex || 0);
  refreshCameraThumb(1, "camera2Image", "camera2Name", "Kamera 2");
  refreshCameraThumb(2, "camera3Image", "camera3Name", "Kamera 3");
  refreshCameraThumb(3, "camera4Image", "camera4Name", "Kamera 4");
  refreshCameraThumb(4, "camera5Image", "camera5Name", "Kamera 5");
}
function updateCameraThumbSelection() {
  var thumbs = document.getElementsByClassName("camera-strip-thumb");
  var i;

  for (i = 0; i < thumbs.length; i++) {
    thumbs[i].className = i === (currentCameraIndex - 1)
      ? "camera-strip-thumb active"
      : "camera-strip-thumb";
  }
}

function updateMainCamera(index) {
  if (!currentCameras || !currentCameras.length) {
    return;
  }

  if (index < 0 || index >= currentCameras.length) {
    return;
  }

  currentCameraIndex = index;
  var camera = currentCameras[index];

  updateCameraThumbSelection();

  setText("cameraMainName", camera.name || "Kamera");
  setText("cameraMainNameModal", camera.name || "Kamera");
  setImageSource("cameraMainImage", getCameraImageUrl(camera));
  setImageSource("cameraModalImage", getCameraImageUrl(camera));
}

function selectCameraByIndex(index) {
  updateMainCamera(index);
}

function openCameraModal() {
  openModal("cameraModal");
}

function updateClockTime() {
  var el = document.getElementById("clockTime");
  if (!el) {
    return;
  }

  var now = new Date();
  var h = now.getHours();
  var m = now.getMinutes();
  var s = now.getSeconds();

  if (h < 10) {
    h = "0" + h;
  }
  if (m < 10) {
    m = "0" + m;
  }
  if (s < 10) {
    s = "0" + s;
  }

  el.innerHTML = h + ":" + m + ":" + s;
}

function setText(id, value) {
  var el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.innerHTML = value;
}

function setChecked(id, value) {
  var el = document.getElementById(id);
  if (el) {
    el.checked = !!value;
  }
}

function formatValue(value, suffix) {
  if (value === undefined || value === null || value === "" || value === "unavailable") {
    return "unavailable";
  }
  return String(value) + suffix;
}

function renderWeather(weather) {
  if (!weather) {
    return;
  }

  var state = weather.stateLabel || weather.state || "unavailable";
  var temp = formatValue(weather.temperature, " °C");
  var humidity = formatValue(weather.humidity, " %");
  var wind = formatValue(weather.windSpeed, " km/h");
  var cloudCoverage = formatValue(weather.cloudCoverage, " %");
  var pressure = formatValue(weather.pressure, " hPa");
  var dewPoint = formatValue(weather.dewPoint, " °C");
  var uvIndex = formatValue(weather.uvIndex, "");

  setText("weatherState", state);
  setText("weatherTemp", temp);
  setText("weatherStateModal", state);
  setText("weatherTempModal", temp);
  setText("weatherHumidity", humidity);
  setText("weatherWind", wind);
  setText("weatherCloudCoverage", cloudCoverage);
  setText("weatherPressure", pressure);
  setText("weatherDewPoint", dewPoint);
  setText("weatherUvIndex", uvIndex);
}

function renderWaste(data) {
  var gelbeTonne = data.gelbeTonneNaechsteLeerung || "unavailable";
  var blaueTonne = data.blaueTonneNaechsteLeerung || "unavailable";
  var restmuell = data.restmuellNaechsteLeerung || "unavailable";
  var nextWaste = getNextWaste([
    { key: "yellow", name: "Gelbe Tonne", value: gelbeTonne },
    { key: "blue", name: "Papiertonne", value: blaueTonne },
    { key: "dark", name: "Restmüll", value: restmuell }
  ]);

  setText("gelbeTonne", gelbeTonne);
  setText("blaueTonne", blaueTonne);
  setText("restmuell", restmuell);
  setText("wasteNextName", nextWaste.name);
  setText("wasteNextDays", nextWaste.value);
  var icon = document.getElementById("wasteNextIcon");
  if (icon) {
    icon.className = "waste-inline-icon waste-dashboard-icon " + nextWaste.key;
  }

  setText("gelbeTonneModal", gelbeTonne);
  setText("blaueTonneModal", blaueTonne);
  setText("restmuellModal", restmuell);
}

function parseWasteUrgency(value) {
  if (!value || value === "unavailable") { return 999; }
  var text = String(value).toLowerCase();
  if (text.indexOf("heute") !== -1) { return 0; }
  if (text.indexOf("morgen") !== -1) { return 1; }
  var match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 999;
}

function getNextWaste(items) {
  var sorted = items.slice().sort(function (a, b) {
    return parseWasteUrgency(a.value) - parseWasteUrgency(b.value);
  });
  return sorted[0] || { key: "dark", name: "Nächste Leerung", value: "unavailable" };
}

function toggleWastePanel(event) {
  if (event) { event.stopPropagation(); }
  var panel = document.getElementById("wastePanel");
  var hint = document.getElementById("wastePanelHint");
  if (!panel) { return; }
  var expanded = panel.className.indexOf(" expanded") !== -1;
  panel.className = expanded ? panel.className.replace(" expanded", "") : panel.className + " expanded";
  if (hint) { hint.textContent = expanded ? "Details" : "Weniger"; }
}

function isIgnoredBatteryEntity(entity) {
  var text = ((entity.name || "") + " " + (entity.entityId || "")).toLowerCase();
  return text.indexOf("apple watch") !== -1 ||
    text.indexOf("iphone") !== -1;
}

function isExcludedHomeSecurityEntity(entity) {
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

function isHomeSecurityEntity(entity) {
  if (!entity || isExcludedHomeSecurityEntity(entity)) { return false; }
  if (entity.domain === "alarm_control_panel" || entity.domain === "lock") { return true; }
  if (entity.domain !== "binary_sensor") { return false; }
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
    "problem"
  ].indexOf(entity.deviceClass) !== -1;
}

function getHomeSecuritySeverity(entity) {
  if (entity.state === "unavailable" || entity.state === "unknown") {
    if (["smoke", "gas", "carbon_monoxide", "carbon_dioxide"].indexOf(entity.deviceClass) !== -1) { return "danger"; }
    return "warn";
  }
  if (entity.domain === "alarm_control_panel") {
    if (entity.state === "triggered") { return "danger"; }
    return entity.state === "disarmed" ? "warn" : "ok";
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

function buildHomeSecurityNotice(entities) {
  var securityEntities = [];
  var openDoors = 0;
  var openWindows = 0;
  var activeMotion = 0;
  var hazardCount = 0;
  var warningCount = 0;
  var dangerCount = 0;

  for (var i = 0; i < entities.length; i++) {
    var entity = entities[i];
    if (!isHomeSecurityEntity(entity)) { continue; }
    securityEntities.push(entity);
    if ((entity.deviceClass === "door" || entity.deviceClass === "opening") && entity.state === "on") { openDoors++; }
    if (entity.deviceClass === "window" && entity.state === "on") { openWindows++; }
    if ((entity.deviceClass === "motion" || entity.deviceClass === "occupancy") && entity.state === "on") { activeMotion++; }
    if (["smoke", "gas", "carbon_monoxide", "carbon_dioxide"].indexOf(entity.deviceClass) !== -1 && getHomeSecuritySeverity(entity) !== "ok") { hazardCount++; }
    var severity = getHomeSecuritySeverity(entity);
    if (severity === "danger") { dangerCount++; }
    if (severity === "warn") { warningCount++; }
  }

  var notSecure = openDoors > 0 || openWindows > 0 || hazardCount > 0 || dangerCount > 0 || warningCount > 0;
  var parts = [
    openDoors + " Türen offen",
    openWindows + " Fenster offen"
  ];
  if (hazardCount > 0) { parts.push(hazardCount + " Gefahrenmelder"); }
  if (activeMotion > 0) { parts.push(activeMotion + " Bewegungen"); }
  if (securityEntities.length === 0) { parts.push("keine Sensoren"); }

  return {
    level: dangerCount > 0 || hazardCount > 0 ? "danger security-summary" : (notSecure ? "warn security-summary" : "ok security-summary"),
    priority: dangerCount > 0 || hazardCount > 0 ? -30 : (notSecure ? -20 : -10),
    title: notSecure ? "NICHT SICHER" : "SICHER",
    text: parts.join(" · ")
  };
}

function renderEnergy(energy) {
  if (!energy || !energy.summary) { return; }
  var summary = energy.summary;
  setText("energySolarPower", summary.solarPowerDisplay || "unavailable");
  setText("energyHomeSummary", "Delta2 " + (summary.deltaBatteryDisplay || "unavailable") + " · PS " + (summary.powerstreamBatteryDisplay || "unavailable"));
  setText("energySolarPowerModal", summary.solarPowerDisplay || "unavailable");
  setText("energyGridPowerModal", summary.gridPowerDisplay || "unavailable");
  setText("energyDeltaBatteryModal", summary.deltaBatteryDisplay || "unavailable");
  setText("energyPowerstreamBatteryModal", summary.powerstreamBatteryDisplay || "unavailable");
}

function renderLights(lights) {
  if (!lights || !lights.length) {
    return;
  }

  if (lights[0]) {
    var light1Name = lights[0].name || "Licht 1";
    var light1State = lights[0].state || "unavailable";
    setText("light1Name", light1Name);
    setText("light1State", light1State);
    setText("light1NameModal", light1Name);
    setText("light1StateModal", light1State);
  }

  if (lights[1]) {
    var light2Name = lights[1].name || "Licht 2";
    var light2State = lights[1].state || "unavailable";
    setText("light2Name", light2Name);
    setText("light2State", light2State);
    setText("light2NameModal", light2Name);
    setText("light2StateModal", light2State);
  }

  if (lights[2]) {
    var light3Name = lights[2].name || "Licht 3";
    var light3State = lights[2].state || "unavailable";
    setText("light3Name", light3Name);
    setText("light3State", light3State);
    setText("light3NameModal", light3Name);
    setText("light3StateModal", light3State);
  }
}

function renderCameras(cameras) {
  if (!cameras || !cameras.length) {
    return;
  }

  currentCameras = cameras;

  if (currentCameraIndex < 0 || currentCameraIndex >= cameras.length) {
    currentCameraIndex = 0;
  }

  updateCameraSourceButtons();
  refreshActiveCameraImages();
}

function updateTorVisual(mode, text) {
  var trackWrapper = document.getElementById("torVisual");
  var textEl = document.getElementById("torVisualText");

  if (trackWrapper) {
    var gateTrack = trackWrapper.getElementsByClassName("gate-track")[0];
    if (gateTrack) {
      gateTrack.className = "gate-track mode-" + mode;
    }
  }

  setText("torVisualText", text || "Status unbekannt");
}

function loadDashboard() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "api/dashboard", true);

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);

          setText("livingTemp", formatValue(data.livingTemp, " °C"));
          setText("livingHumidity", formatValue(data.livingHumidity, " %"));
          setText("kitchenLight", data.kitchenLight || "unavailable");
          setText("schliessZeit", formatValue(data.schliessZeit, " s"));
          setText("fahrZeit", formatValue(data.fahrZeit, " s"));

          renderWeather(data.weather);
          renderEnergy(data.energy);
          renderWaste(data);
          renderLights(data.lights);
          renderCameras(data.cameras);
          notificationState.dashboard = data;
          renderNotifications();

setLightCardState("light1Card", data.light1On);
setLightCardState("light2Card", data.light2On);
setLightCardState("light3Card", data.light3On);
setLightCardState("light1CardModal", data.light1On);
setLightCardState("light2CardModal", data.light2On);
setLightCardState("light3CardModal", data.light3On);

          setText("torStatus", data.torStatus || "unavailable");
          setText("torStatusModal", data.torStatus || "unavailable");
          updateTorVisual(data.torVisualMode, data.torVisualText);

          setChecked("smartControl", data.smartControl);
          setChecked("torAutomatik", data.torAutomatik);
          setChecked("torDauerAuf", data.torDauerAuf);

          setText("smartControlState", data.smartControl ? "Ein" : "Aus");
            setText("torAutomatikState", data.torAutomatik ? "Ein" : "Aus");
            setText("torAutomatikStateSwitch", data.torAutomatik ? "Ein" : "Aus");
            setText("torDauerAufState", data.torDauerAuf ? "Ein" : "Aus");
          setText("updatedAt", "Letztes Update: " + (data.updatedAt || "unavailable"));
        } catch (e) {
          setText("updatedAt", "Fehler beim Verarbeiten der Daten");
        }
      } else {
        setText("updatedAt", "Fehler beim Laden");
      }
    }
  };

  xhr.send();
}

function getWasteNotification(label, value) {
  if (!value || value === "unavailable") { return null; }
  var text = String(value);
  var days = parseWasteUrgency(text);
  if (days > 1) { return null; }
  return {
    level: days === 0 ? "danger waste-urgent" : "warn waste-urgent",
    priority: days,
    title: label,
    text: days === 0 ? "Heute Leerung" : "Morgen Leerung"
  };
}

function renderNotifications() {
  var mount = document.getElementById("homeNotifications");
  if (!mount) { return; }
  var notices = [];
  var waste;
  var dashboard = notificationState.dashboard;
  var structure = notificationState.structure;
  var entities = structure && structure.entities ? structure.entities : [];

  if (structure && structure.entities) {
    notices.push(buildHomeSecurityNotice(entities));
  }

  if (dashboard) {
    waste = getWasteNotification("Gelbe Tonne", dashboard.gelbeTonneNaechsteLeerung);
    if (waste) { notices.push(waste); }
    waste = getWasteNotification("Papiertonne", dashboard.blaueTonneNaechsteLeerung);
    if (waste) { notices.push(waste); }
    waste = getWasteNotification("Restmüll", dashboard.restmuellNaechsteLeerung);
    if (waste) { notices.push(waste); }
  }

  for (var i = 0; i < entities.length; i++) {
    var entity = entities[i];
    if (entity.deviceClass !== "battery") { continue; }
    if (isIgnoredBatteryEntity(entity)) { continue; }
    var value = Number(entity.state);
    if (!Number.isNaN(value) && value <= 20) {
      notices.push({
        level: value <= 10 ? "danger" : "warn",
        priority: value <= 10 ? 10 + value : 100 + value,
        title: "Batterie niedrig",
        text: (entity.name || entity.entityId) + ": " + value + " %"
      });
    }
  }

  notices.sort(function (a, b) {
    return (a.priority || 999) - (b.priority || 999);
  });

  mount.innerHTML = "";

  if (notices.length === 0) {
    var empty = document.createElement("div");
    empty.className = "home-notification-empty";
    empty.textContent = "Keine aktuellen Mitteilungen";
    mount.appendChild(empty);
    return;
  }

  for (i = 0; i < Math.min(notices.length, 8); i++) {
    var item = document.createElement("div");
    item.className = "home-notification-item " + notices[i].level;

    var title = document.createElement("div");
    title.className = "home-notification-title";
    title.textContent = notices[i].title;
    item.appendChild(title);

    var text = document.createElement("div");
    text.className = "home-notification-text";
    text.textContent = notices[i].text;
    item.appendChild(text);

    mount.appendChild(item);
  }
}

function loadHomeStructure() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "api/ha/structure", true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4 || xhr.status !== 200) { return; }
    try {
      notificationState.structure = JSON.parse(xhr.responseText);
      renderNotifications();
    } catch (_error) {
      /* ignore */
    }
  };
  xhr.send();
}

function postAction(url) {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      setTimeout(loadDashboard, 500);
    }
  };

  xhr.send("{}");
}

function switchMainLight(state) {
  if (state === "on") {
    postAction("api/light/main/on");
  } else {
    postAction("api/light/main/off");
  }
}

function triggerTorButton(url) {
  postAction(url);
}

function toggleSwitch(id, urlOn, urlOff) {
  var el = document.getElementById(id);
  if (!el) {
    return;
  }

  if (el.checked) {
    postAction(urlOn);
  } else {
    postAction(urlOff);
  }
}

function toggleLightSwitch(id, urlOn, urlOff) {
  var el = document.getElementById(id);
  if (!el) {
    return;
  }

  if (el.checked) {
    postAction(urlOn);
  } else {
    postAction(urlOff);
  }
}

function setLightCardState(cardId, isOn) {
  var el = document.getElementById(cardId);
  if (!el) {
    return;
  }

  var baseClass = el.getAttribute("data-base-class") || "light-card";
  el.className = isOn ? baseClass + " is-on" : baseClass;
}

function toggleLightCard(cardId, urlOn, urlOff) {
  var el = document.getElementById(cardId);
  if (!el) {
    return;
  }

  var isOn = el.className.indexOf(" is-on") !== -1;
  if (isOn) {
    postAction(urlOff);
  } else {
    postAction(urlOn);
  }
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeModal();
  }
});

updateCameraSourceButtons();
loadDashboard();
loadHomeStructure();
updateClockTime();
setInterval(loadDashboard, 1000);
setInterval(updateClockTime, 1000);
setInterval(function () {
  if (currentCameraSourceMode === "live") {
    refreshActiveCameraImages();
  }
}, liveCameraRefreshIntervalMs);
