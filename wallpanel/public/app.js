var currentCameras = [];
var currentCameraIndex = 0;
var currentCameraSourceMode = "event";
var liveCameraRefreshIntervalMs = 750;
var cameraManualHoldUntil = 0;
var cameraWebrtcFallbackTimer = null;
var dashboardRequestActive = false;
var notificationState = {
  dashboard: null,
  structure: null
};
var boilerTimerState = null;
var boilerCountdownInterval = null;
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

  resetCameraToEventMode();
}

function isCameraModalOpen() {
  var modal = document.getElementById("cameraModal");
  return !!modal && modal.className.indexOf(" open") !== -1;
}

function holdActiveCameraSelection() {
  cameraManualHoldUntil = new Date().getTime() + (isCameraModalOpen() ? 60000 : 10000);
}

function setImageSource(imageId, url) {
  var image = document.getElementById(imageId);
  if (!image) {
    return;
  }

  if (url) {
    var isStream = url.indexOf("camera-stream") !== -1;
    var nextSrc = isStream ? url : url + (url.indexOf("?") === -1 ? "?t=" : "&t=") + new Date().getTime();
    if (image.getAttribute("src") !== nextSrc) {
      image.src = nextSrc;
    }
    image.style.display = "block";
  } else {
    image.removeAttribute("src");
    image.style.display = "none";
  }
}

function setWebrtcFrame(camera) {
  var frame = document.getElementById("cameraWebrtcFrame");
  var image = document.getElementById("cameraModalImage");
  var url = camera && camera.webrtcUrl ? camera.webrtcUrl : "";
  var fallbackUrl = camera && camera.webrtcFallbackUrl ? camera.webrtcFallbackUrl : "";
  if (!frame) { return; }
  if (cameraWebrtcFallbackTimer) {
    clearTimeout(cameraWebrtcFallbackTimer);
    cameraWebrtcFallbackTimer = null;
  }

  if (currentCameraSourceMode === "live" && shouldUseMjpegLive(camera)) {
    frame.src = "about:blank";
    frame.style.display = "none";
    if (image) { image.style.display = "block"; }
  } else if (currentCameraSourceMode === "live" && url) {
    if (frame.getAttribute("src") !== url) {
      frame.src = url;
    }
    frame.style.display = "block";
    if (image) { image.style.display = "none"; }
    if (fallbackUrl && fallbackUrl !== url) {
      cameraWebrtcFallbackTimer = setTimeout(function () {
        if (currentCameraSourceMode === "live" && frame.style.display === "block" && frame.getAttribute("src") === url) {
          frame.src = fallbackUrl;
        }
      }, 3500);
    }
  } else {
    frame.src = "about:blank";
    frame.style.display = "none";
  }
}

function formatCameraEventTime(camera) {
  return camera && camera.eventUpdatedAt && camera.eventUpdatedAt !== "unavailable"
    ? "Event: " + camera.eventUpdatedAt
    : "Event: unbekannt";
}

function formatCameraStatus(camera) {
  if (currentCameraSourceMode === "live") {
    return "Live";
  }
  return formatCameraEventTime(camera);
}

function getCameraImageUrl(camera) {
  if (!camera) {
    return "";
  }

  if (currentCameraSourceMode === "live") {
    if (shouldUseMjpegLive(camera)) {
      return camera.mjpegUrl || camera.mjpegFallbackUrl || camera.streamUrl || camera.liveUrl || camera.imageUrl || "";
    }
    if (camera.webrtcUrl) { return ""; }
    return camera.streamUrl || camera.liveUrl || camera.liveImageUrl || camera.imageUrl || "";
  }

  return camera.imageUrl || camera.eventUrl || camera.eventImageUrl || "";
}

function shouldUseMjpegLive(camera) {
  if (!camera || (!camera.mjpegUrl && !camera.mjpegFallbackUrl)) { return false; }
  var ua = navigator.userAgent || "";
  var oldIos = /iPad|iPhone|iPod/.test(ua) && /OS (9|10|11|12|13)_/.test(ua);
  return oldIos || !window.RTCPeerConnection;
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

  holdActiveCameraSelection();
  currentCameraSourceMode = mode;
  updateCameraSourceButtons();
  renderCameras(currentCameras);
  refreshActiveCameraImages();
}

function resetCameraToEventMode() {
  currentCameraSourceMode = "event";
  updateCameraSourceButtons();
  setWebrtcFrame(null);
  refreshActiveCameraImages();
}

function renderCameraStrip() {
  var strip = document.querySelector(".camera-strip");
  if (!strip || !currentCameras || !currentCameras.length) {
    return;
  }

  strip.innerHTML = "";
  for (var i = 0; i < currentCameras.length; i++) {
    (function (index) {
      var camera = currentCameras[index];
      var button = document.createElement("button");
      button.className = index === currentCameraIndex ? "camera-strip-thumb active" : "camera-strip-thumb";
      button.type = "button";
      button.onclick = function () {
        selectCameraByIndex(index);
      };
      button.innerHTML =
        '<span class="camera-strip-preview"><img class="camera-thumb-image" src="' + (camera.imageUrl || camera.eventUrl || camera.eventImageUrl || "") + '?t=' + new Date().getTime() + '" alt=""><span class="camera-thumb-time">' + formatCameraEventTime(camera).replace("Event: ", "") + '</span></span>' +
        '<span class="camera-strip-title">' + escapeHtml(camera.name || "Kamera") + '</span>';
      strip.appendChild(button);
    })(i);
  }
}

function getLatestCameraIndex(cameras) {
  var latestIndex = 0;
  var latestTime = -1;
  for (var i = 0; i < (cameras || []).length; i++) {
    var raw = cameras[i].eventTimestamp || cameras[i].state || cameras[i].eventUpdatedAt || "";
    var time = Date.parse(raw);
    if (!Number.isNaN(time) && time > latestTime) {
      latestTime = time;
      latestIndex = i;
    }
  }
  return latestIndex;
}


function refreshCameraThumb(index, imageId, nameId, fallbackName) {
  var camera = currentCameras[index];
  if (!camera) {
    return;
  }

  setText(nameId, camera.name || fallbackName);
  setText(nameId.replace("Name", "Time"), formatCameraEventTime(camera).replace("Event: ", ""));
  setImageSource(imageId, getCameraImageUrl(camera));
}

function refreshActiveCameraImages() {
  if (!currentCameras || !currentCameras.length) {
    return;
  }

  updateMainCamera(currentCameraIndex || 0);
  renderCameraStrip();
}
function updateCameraThumbSelection() {
  var thumbs = document.getElementsByClassName("camera-strip-thumb");
  var i;

  for (i = 0; i < thumbs.length; i++) {
    thumbs[i].className = i === currentCameraIndex
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
  setText("cameraMainTime", formatCameraStatus(camera));
  setText("cameraModalTime", formatCameraStatus(camera));
  setImageSource("cameraMainImage", getCameraImageUrl(camera));
  setImageSource("cameraModalImage", getCameraImageUrl(camera));
  setWebrtcFrame(camera);
}

function selectCameraByIndex(index) {
  holdActiveCameraSelection();
  updateMainCamera(index);
}

function openCameraModal() {
  openModal("cameraModal");
  holdActiveCameraSelection();
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

function markRetryStatus(id, active) {
  var el = document.getElementById(id);
  if (!el) { return; }
  el.className = active ? "page-update-stamp retry-status" : "page-update-stamp";
  el.title = active ? "Zum Neuladen tippen" : "";
  el.onclick = active ? function () {
    el.innerHTML = "Lade...";
    el.className = "page-update-stamp retry-status is-loading";
    window.location.reload();
  } : null;
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
  var weatherIcon = document.querySelector(".weather-icon");
  if (weatherIcon && typeof iconForSpecialCard === "function") {
    weatherIcon.innerHTML = typeof iconForWeatherState === "function"
      ? iconForWeatherState(weather.state, "ha-icon-large")
      : iconForSpecialCard("weather", "ha-icon-large");
  }
  renderWeatherForecast(weather.forecast || []);
}

function renderWeatherForecast(forecast) {
  var mount = document.getElementById("weatherForecastList");
  if (!mount) { return; }
  mount.innerHTML = "";
  if (!forecast || forecast.length === 0) {
    var empty = document.createElement("div");
    empty.className = "home-notification-empty";
    empty.textContent = "Keine Vorhersage verfügbar";
    mount.appendChild(empty);
    return;
  }

  for (var i = 0; i < Math.min(forecast.length, 5); i++) {
    var day = forecast[i];
    var item = document.createElement("div");
    var icon = typeof iconForWeatherState === "function" ? iconForWeatherState(day.condition, "weather-forecast-icon") : "";
    item.className = "weather-forecast-item";
    item.innerHTML = '<div class="weather-forecast-day">' + escapeHtml(day.weekday || "--") + '</div>' +
      '<div class="weather-forecast-symbol">' + icon + '</div>' +
      '<div class="weather-forecast-temp">' + escapeHtml(formatForecastTemp(day)) + '</div>' +
      '<div class="weather-forecast-state">' + escapeHtml(day.conditionLabel || day.condition || "unavailable") + '</div>';
    mount.appendChild(item);
  }
}

function formatForecastTemp(day) {
  var high = day && day.temperature && day.temperature !== "unavailable" ? day.temperature + "°" : "--";
  var low = day && day.templow && day.templow !== "unavailable" ? day.templow + "°" : "";
  return low ? high + " / " + low : high;
}

function getBoilerTimerRemainingSeconds() {
  if (!boilerTimerState || boilerTimerState.state !== "active") { return null; }
  var attrs = boilerTimerState.attributes || {};
  var finishesAt = attrs.finishes_at;
  if (!finishesAt) { return null; }
  return Math.max(0, Math.ceil((new Date(finishesAt) - new Date()) / 1000));
}

function formatTimerCountdown(seconds) {
  var m = Math.floor(seconds / 60);
  var s = seconds % 60;
  return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}

function startBoilerCountdown() {
  if (boilerCountdownInterval) {
    clearInterval(boilerCountdownInterval);
    boilerCountdownInterval = null;
  }
  if (!boilerTimerState || boilerTimerState.state !== "active") { return; }
  boilerCountdownInterval = setInterval(function () {
    var el = document.getElementById("boilerCountdownText");
    if (!el) { return; }
    var remaining = getBoilerTimerRemainingSeconds();
    if (remaining === null || remaining <= 0) {
      clearInterval(boilerCountdownInterval);
      boilerCountdownInterval = null;
      loadBoilerTimer();
      return;
    }
    el.textContent = "Noch " + formatTimerCountdown(remaining);
  }, 1000);
}

function loadBoilerTimer() {
  apiGet("api/timer/boiler", function (error, data) {
    if (!error && data) {
      boilerTimerState = data;
      renderNotifications();
      startBoilerCountdown();
    }
  });
}

function confirmBoilerTimerReset() {
  if (!confirm("Timer auf 10 Minuten setzen?")) { return; }
  apiPost("api/timer/boiler/reset", {}, function () {
    setTimeout(loadBoilerTimer, 500);
  });
}

function formatWasteDisplay(value) {
  if (!value || value === "unavailable") { return "unavailable"; }
  var urgency = parseWasteUrgency(value);
  if (urgency === 0) { return "Heute"; }
  if (urgency === 1) { return "Morgen"; }
  return value;
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

  setText("gelbeTonne", formatWasteDisplay(gelbeTonne));
  setText("blaueTonne", formatWasteDisplay(blaueTonne));
  setText("restmuell", formatWasteDisplay(restmuell));
  setText("wasteNextName", nextWaste.name);
  setText("wasteNextDays", formatWasteDisplay(nextWaste.value));
  var icon = document.getElementById("wasteNextIcon");
  if (icon) {
    icon.className = "waste-inline-icon waste-dashboard-icon " + nextWaste.key;
  }

  setText("gelbeTonneModal", formatWasteDisplay(gelbeTonne));
  setText("blaueTonneModal", formatWasteDisplay(blaueTonne));
  setText("restmuellModal", formatWasteDisplay(restmuell));
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
    text.indexOf("iphone") !== -1 ||
    text.indexOf("ipad") !== -1 ||
    text.indexOf("macbook") !== -1 ||
    text.indexOf("mac book") !== -1 ||
    text.indexOf("powerstream-8801") !== -1 ||
    text.indexOf("powerstream_8801") !== -1 ||
    text.indexOf("powerstream 8801") !== -1;
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
  var offlineCount = 0;

  for (var i = 0; i < entities.length; i++) {
    var entity = entities[i];
    if (!isHomeSecurityEntity(entity)) { continue; }
    securityEntities.push(entity);
    if (entity.state === "unavailable" || entity.state === "unknown") {
      offlineCount++;
      continue;
    }
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
    "Türen " + openDoors,
    "Fenster " + openWindows
  ];
  if (hazardCount > 0) { parts.push("Warnmelder " + hazardCount); }
  if (activeMotion > 0) { parts.push("Bewegung " + activeMotion); }
  if (offlineCount > 0) { parts.push("Offline " + offlineCount); }
  if (securityEntities.length === 0) { parts.push("keine Sensoren"); }

  return {
    level: notSecure ? "danger security-summary" : (offlineCount > 0 ? "warn security-summary" : "ok security-summary"),
    priority: notSecure ? -30 : (offlineCount > 0 ? -20 : -10),
    title: notSecure ? "NICHT SICHER" : (offlineCount > 0 ? "PRÜFEN" : "SICHER"),
    text: parts.join(" · "),
    action: "security"
  };
}

function renderHomeSecurityCard(notice) {
  var panel = document.getElementById("homeSecurityPanel");
  if (!panel || !notice) { return; }
  var level = notice.level && notice.level.indexOf("warn") !== -1 ? "warn" : (notice.title === "SICHER" ? "ok" : "danger");
  panel.className = "panel security-home-panel dashboard-clickable " + level;
  setText("homeSecurityMeta", notice.title === "SICHER" ? "Alles ok" : (level === "warn" ? "Offline" : "Prüfen"));
  setText("homeSecurityTitle", notice.title);
  setText("homeSecurityText", notice.text);
}

function renderEnergy(energy) {
  if (!energy || !energy.summary) { return; }
  var summary = energy.summary;
  var solarDisplay = summary.solarPowerDisplay || "unavailable";
  var consumptionDisplay = summary.consumptionDisplay || summary.gridPowerDisplay || "unavailable";
  var gridDisplay = summary.gridPowerDisplay || "unavailable";
  var batteryDisplay = summary.powerstreamBatteryDisplay || "unavailable";
  setText("energySolarPower", summary.solarPowerDisplay || "unavailable");
  setText("energyHomeSummary", "Verbr. " + consumptionDisplay + " · Netz " + gridDisplay + " · Akku " + batteryDisplay);
  setText("energySolarPowerModal", summary.solarPowerDisplay || "unavailable");
  setText("energyGridPowerModal", summary.gridPowerDisplay || "unavailable");
  setText("energyConsumptionModal", consumptionDisplay);
  setText("energyPowerstreamBatteryModal", summary.powerstreamBatteryDisplay || "unavailable");
  setText("energyChargeTimeModal", summary.chargeTimeDisplay || "unavailable");
  setText("energyDischargeTimeModal", summary.dischargeTimeDisplay || "unavailable");
  setText("energyFromBatteryTodayModal", summary.fromBatteryTodayDisplay || "unavailable");
}

function renderLights(lights) {
  if (!lights || !lights.length) {
    return;
  }

  if (typeof iconForSpecialCard === "function") {
    var lightIconIds = ["light1IconModal", "light2IconModal", "light3IconModal"];
    for (var i = 0; i < lightIconIds.length; i++) {
      var icon = document.getElementById(lightIconIds[i]);
      if (icon) { icon.innerHTML = iconForSpecialCard("light"); }
    }
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
  if (new Date().getTime() >= cameraManualHoldUntil || currentCameraIndex < 0 || currentCameraIndex >= cameras.length) {
    currentCameraIndex = getLatestCameraIndex(cameras);
  }

  updateCameraSourceButtons();
  refreshActiveCameraImages();
}

function getBatteryEntities() {
  var structure = notificationState.structure;
  var entities = structure && structure.entities ? structure.entities : [];
  var batteries = [];

  for (var i = 0; i < entities.length; i++) {
    if (entities[i].deviceClass === "battery" && !isIgnoredBatteryEntity(entities[i])) {
      batteries.push(entities[i]);
    }
  }

  batteries.sort(function (a, b) {
    var av = Number(a.state);
    var bv = Number(b.state);
    if (Number.isNaN(av)) { av = 999; }
    if (Number.isNaN(bv)) { bv = 999; }
    if (av !== bv) { return av - bv; }
    return String(a.name || a.entityId).localeCompare(String(b.name || b.entityId), "de");
  });
  return batteries;
}

function openBatteryModal() {
  renderBatteryOverview();
  openModal("batteryModal");
}

function renderBatteryOverview() {
  var mount = document.getElementById("batteryOverviewList");
  if (!mount) { return; }
  var batteries = getBatteryEntities();
  mount.innerHTML = "";

  if (batteries.length === 0) {
    var empty = document.createElement("div");
    empty.className = "home-notification-empty";
    empty.textContent = "Keine Batterie-Entitäten gefunden";
    mount.appendChild(empty);
    return;
  }

  for (var i = 0; i < batteries.length; i++) {
    var entity = batteries[i];
    var value = Number(entity.state);
    var row = document.createElement("div");
    var batteryUnavailable = entity.state === "unavailable" || entity.state === "unknown";
    row.className = "battery-overview-row" + (!Number.isNaN(value) && value <= 20 ? " warn" : "") + (batteryUnavailable ? " is-unavailable" : "");
    row.innerHTML = (typeof iconForEntity === "function" ? iconForEntity(entity) : "") +
      '<span class="battery-overview-name">' + (entity.name || entity.entityId) + '</span><b>' + formatEntityBatteryValue(entity) + '</b>';
    mount.appendChild(row);
  }
}

function formatEntityBatteryValue(entity) {
  if (!entity) { return "unavailable"; }
  var unit = entity.attributes && entity.attributes.unit_of_measurement ? entity.attributes.unit_of_measurement : "%";
  return entity.state + " " + unit;
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
  if (dashboardRequestActive) {
    return;
  }
  dashboardRequestActive = true;
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "api/dashboard", true);

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      dashboardRequestActive = false;
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

setLightCardState("light1Card", data.light1On, data.light1State);
setLightCardState("light2Card", data.light2On, data.light2State);
setLightCardState("light3Card", data.light3On, data.light3State);
setLightCardState("light1CardModal", data.light1On, data.light1State);
setLightCardState("light2CardModal", data.light2On, data.light2State);
setLightCardState("light3CardModal", data.light3On, data.light3State);

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
          markRetryStatus("updatedAt", false);
          if (typeof setHaOnlineStatus === "function") { setHaOnlineStatus(true); }
        } catch (e) {
          setText("updatedAt", "Fehler beim Verarbeiten der Daten");
          markRetryStatus("updatedAt", true);
          if (typeof setHaOnlineStatus === "function") { setHaOnlineStatus(false); }
        }
      } else {
        setText("updatedAt", "Fehler beim Laden");
        markRetryStatus("updatedAt", true);
        if (typeof setHaOnlineStatus === "function") { setHaOnlineStatus(false); }
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
    renderHomeSecurityCard(buildHomeSecurityNotice(entities));
  }

  if (boilerTimerState && boilerTimerState.state === "active") {
    var remaining = getBoilerTimerRemainingSeconds();
    notices.push({
      level: remaining !== null && remaining <= 120 ? "warn timer-notice" : "ok timer-notice",
      priority: -60,
      title: "Boiler",
      text: remaining !== null ? "Noch " + formatTimerCountdown(remaining) : "Läuft...",
      action: "boiler-timer"
    });
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
        text: (entity.name || entity.entityId) + ": " + value + " %",
        action: "battery"
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
    item.setAttribute("data-action", notices[i].action || "");
    item.onclick = function () {
      var action = this.getAttribute("data-action");
      if (action === "security") {
        window.location.href = "sicherheit.html";
      } else if (action === "battery") {
        openBatteryModal();
      } else if (action === "boiler-timer") {
        confirmBoilerTimerReset();
      }
    };

    var title = document.createElement("div");
    title.className = "home-notification-title";
    title.textContent = notices[i].title;
    item.appendChild(title);

    var text = document.createElement("div");
    text.className = "home-notification-text";
    text.textContent = notices[i].text;
    if (notices[i].action === "boiler-timer") { text.id = "boilerCountdownText"; }
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
      setTimeout(loadDashboard, 1000);
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

function setLightCardState(cardId, isOn, state) {
  var el = document.getElementById(cardId);
  if (!el) {
    return;
  }

  var baseClass = el.getAttribute("data-base-class") || "light-card";
  var cls = isOn ? baseClass + " is-on" : baseClass;
  if (state === "unavailable" || state === "unknown") { cls += " is-unavailable"; }
  el.className = cls;
}

function toggleLightCard(cardId, urlOn, urlOff) {
  var el = document.getElementById(cardId);
  if (!el || el.className.indexOf("is-loading") !== -1) { return; }
  var baseClass = el.getAttribute("data-base-class") || "light-card";
  var isOn = el.className.indexOf(" is-on") !== -1;
  el.className = (isOn ? baseClass : baseClass + " is-on") + " is-loading";
  postAction(isOn ? urlOff : urlOn);
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeModal();
  }
});

updateCameraSourceButtons();
loadDashboard();
loadHomeStructure();
loadBoilerTimer();
updateClockTime();
setInterval(loadDashboard, 3000);
setInterval(loadBoilerTimer, 5000);
setInterval(loadHomeStructure, 10000);
setInterval(updateClockTime, 1000);
setInterval(function () {
  var camera = currentCameras && currentCameras[currentCameraIndex];
  if (currentCameraSourceMode === "live" && camera && !camera.streamUrl) {
    refreshActiveCameraImages();
  }
}, liveCameraRefreshIntervalMs);
