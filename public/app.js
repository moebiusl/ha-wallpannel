function setText(id, value) {
  document.getElementById(id).innerHTML = value;
}

function setChecked(id, value) {
  var el = document.getElementById(id);
  if (el) {
    el.checked = !!value;
  }
}

function updateTorVisual(mode, text) {
  var trackWrapper = document.getElementById("torVisual");
  var textEl = document.getElementById("torVisualText");

  if (!trackWrapper || !textEl) {
    return;
  }

  var gateTrack = trackWrapper.getElementsByClassName("gate-track")[0];
  if (gateTrack) {
    gateTrack.className = "gate-track mode-" + mode;
  }

  textEl.innerHTML = text;
}

function loadDashboard() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "/api/dashboard", true);

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);

          setText("livingTemp", data.livingTemp + " °C");
          setText("livingHumidity", data.livingHumidity + " %");
          setText("kitchenLight", data.kitchenLight);
          setText("schliessZeit", data.schliessZeit + " s");
          setText("fahrZeit", data.fahrZeit + " s");
          setText("gelbeTonne", data.gelbeTonneNächsteLeerung);
          setText("blaueTonne", data.blaueTonneNächsteLeerung);
          setText("restmuell", data.restmuellNächsteLeerung);

          setText("torStatus", data.torStatus);
          updateTorVisual(data.torVisualMode, data.torVisualText);

          setChecked("smartControl", data.smartControl);
          setChecked("torAutomatik", data.torAutomatik);
          setChecked("torDauerAuf", data.torDauerAuf);

          setText("updatedAt", "Letztes Update: " + data.updatedAt);
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
    postAction("/api/light/main/on");
  } else {
    postAction("/api/light/main/off");
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

loadDashboard();
setInterval(loadDashboard, 10000);