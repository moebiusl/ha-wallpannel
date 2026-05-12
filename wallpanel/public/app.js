var currentCameras = [];
var currentCameraIndex = 0;
var currentCameraSourceMode = "event";
var liveCameraRefreshIntervalMs = 750;
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

  var state = weather.state || "unavailable";
  var temp = formatValue(weather.temperature, " °C");
  var humidity = formatValue(weather.humidity, " %");
  var wind = formatValue(weather.windSpeed, " km/h");
  var rain = formatValue(weather.precipitation, " %");
  var high = formatValue(weather.forecastHigh, " °C");
  var low = formatValue(weather.forecastLow, " °C");

  setText("weatherState", state);
  setText("weatherTemp", temp);
  setText("weatherStateModal", state);
  setText("weatherTempModal", temp);
  setText("weatherHumidity", humidity);
  setText("weatherWind", wind);
  setText("weatherRain", rain);
  setText("weatherHigh", high);
  setText("weatherLow", low);
}

function renderWaste(data) {
  var gelbeTonne = data.gelbeTonneNaechsteLeerung || "unavailable";
  var blaueTonne = data.blaueTonneNaechsteLeerung || "unavailable";
  var restmuell = data.restmuellNaechsteLeerung || "unavailable";

  setText("gelbeTonne", gelbeTonne);
  setText("blaueTonne", blaueTonne);
  setText("restmuell", restmuell);

  setText("gelbeTonneModal", gelbeTonne);
  setText("blaueTonneModal", blaueTonne);
  setText("restmuellModal", restmuell);
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
          renderWaste(data);
          renderLights(data.lights);
          renderCameras(data.cameras);

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
updateClockTime();
setInterval(loadDashboard, 1000);
setInterval(updateClockTime, 1000);
setInterval(function () {
  if (currentCameraSourceMode === "live") {
    refreshActiveCameraImages();
  }
}, liveCameraRefreshIntervalMs);