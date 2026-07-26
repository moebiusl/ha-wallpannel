var weatherStationPageConfig = null;
var weatherStationRequestActive = false;

function getWeatherStationPageConfig() {
  var panelId = typeof getPanelId === "function" ? getPanelId() : "default";
  var panel = weatherStationPageConfig && weatherStationPageConfig.panels && weatherStationPageConfig.panels[panelId]
    ? weatherStationPageConfig.panels[panelId]
    : null;
  if (!panel && weatherStationPageConfig && weatherStationPageConfig.panels) {
    panel = weatherStationPageConfig.panels.default || null;
  }
  return panel && panel.pages ? panel.pages.wetter : null;
}

function isWeatherMetricVisible(metric) {
  var page = getWeatherStationPageConfig();
  var id = metric && metric.id;
  if (!page || !id) { return true; }
  if (page.hiddenEntities && page.hiddenEntities.indexOf(id) !== -1) { return false; }
  return true;
}

function visibleWeatherMetrics(metrics) {
  return (metrics || []).filter(isWeatherMetricVisible);
}

function setWeatherStationStatus(text, retry) {
  var el = document.getElementById("weatherStationUpdateState");
  if (!el) { return; }
  el.textContent = text;
  el.className = retry ? "panel-meta weather-station-update-meta retry-status" : "panel-meta weather-station-update-meta";
  el.title = retry ? "Zum Neuladen tippen" : "";
  el.onclick = retry ? function () { window.location.reload(); } : null;
}

function weatherMetricTile(metric, emphasis) {
  var tile = document.createElement("article");
  tile.className = "metric-tile" + (emphasis ? " emphasis" : "");

  var label = document.createElement("div");
  label.className = "metric-tile-label";
  label.textContent = metric.label || "Wert";
  tile.appendChild(label);

  var value = document.createElement("div");
  value.className = "metric-tile-value";
  value.textContent = metric.display || "unavailable";
  tile.appendChild(value);

  return tile;
}

function weatherMetricSection(title, metrics) {
  metrics = visibleWeatherMetrics(metrics);
  if (metrics.length === 0) { return null; }

  var section = document.createElement("section");
  section.className = "energy-detail-section";

  var heading = document.createElement("div");
  heading.className = "room-section-title";
  heading.textContent = title;
  section.appendChild(heading);

  var grid = document.createElement("div");
  grid.className = "metric-tile-grid";
  for (var i = 0; i < metrics.length; i++) {
    grid.appendChild(weatherMetricTile(metrics[i], i === 0));
  }
  section.appendChild(grid);
  return section;
}

function uvIndexColor(value) {
  var uv = Number(value);
  if (!Number.isFinite(uv)) { return "#5dd9c7"; }
  if (uv >= 8) { return "#d32f2f"; }
  if (uv >= 6) { return "#f57c00"; }
  if (uv >= 3) { return "#fbc02d"; }
  return "#558b2f";
}

function windAndUvSection(data) {
  var metrics = visibleWeatherMetrics([data.windSpeed, data.windDirection]);
  var showUv = isWeatherMetricVisible(data.uvIndex);
  if (metrics.length === 0 && !showUv) { return null; }

  var section = document.createElement("section");
  section.className = "energy-detail-section";

  var heading = document.createElement("div");
  heading.className = "room-section-title";
  heading.textContent = "Wind und UV";
  section.appendChild(heading);

  if (metrics.length > 0) {
    var grid = document.createElement("div");
    grid.className = "metric-tile-grid";
    for (var i = 0; i < metrics.length; i++) {
      grid.appendChild(weatherMetricTile(metrics[i], false));
    }
    section.appendChild(grid);
  }

  if (showUv) {
    var uvValue = data.uvIndex && data.uvIndex.value !== "unavailable" ? Number(data.uvIndex.value) : null;
    var row = document.createElement("div");
    row.className = "ring-gauge-row";

    var ring = document.createElement("div");
    ring.className = "ring-gauge";
    ring.style.setProperty("--gauge-pct", uvValue !== null ? String(Math.min(100, (uvValue / 11) * 100)) : "0");
    ring.style.setProperty("--gauge-color", uvIndexColor(uvValue));

    var ringValue = document.createElement("div");
    ringValue.className = "ring-gauge-value";
    ringValue.innerHTML = (uvValue !== null ? uvValue : "--") + "<small>UV-Index</small>";
    ring.appendChild(ringValue);
    row.appendChild(ring);

    var info = document.createElement("div");
    info.className = "ring-gauge-info";
    info.innerHTML = '<div class="ring-gauge-title">UV-Strahlung</div><div class="ring-gauge-subtitle">Skala 0 – 11+</div>';
    row.appendChild(info);

    section.appendChild(row);
  }

  return section;
}

function weatherRadarSection(data) {
  if (!data.radarImageUrl) { return null; }

  var section = document.createElement("section");
  section.className = "energy-detail-section";

  var heading = document.createElement("div");
  heading.className = "room-section-title";
  heading.textContent = "DWD-Regenradar";
  section.appendChild(heading);

  var block = document.createElement("div");
  block.className = "weather-radar-block";
  var img = document.createElement("img");
  img.className = "weather-radar-image";
  img.alt = "Niederschlagsradar";
  img.src = data.radarImageUrl + "?t=" + Date.now();
  block.appendChild(img);
  section.appendChild(block);

  return section;
}

function formatWeatherForecastTemp(day) {
  var high = day && day.temperature && day.temperature !== "unavailable" ? day.temperature + "°" : "--";
  var low = day && day.templow && day.templow !== "unavailable" ? day.templow + "°" : "";
  return low ? high + " / " + low : high;
}

function weatherForecastSection(forecast) {
  var days = forecast && forecast.forecast ? forecast.forecast : [];
  if (days.length === 0) { return null; }

  var section = document.createElement("section");
  section.className = "energy-detail-section";

  var heading = document.createElement("div");
  heading.className = "room-section-title";
  heading.textContent = "DWD-Vorhersage";
  section.appendChild(heading);

  var list = document.createElement("div");
  list.className = "weather-forecast-list";
  for (var i = 0; i < days.length; i++) {
    var day = days[i];
    var icon = typeof iconForWeatherState === "function" ? iconForWeatherState(day.condition, "weather-forecast-icon") : "";
    var item = document.createElement("div");
    item.className = "weather-forecast-item";
    item.innerHTML = '<div class="weather-forecast-day">' + escapeHtml(day.weekday || "--") + '</div>' +
      '<div class="weather-forecast-symbol">' + icon + '</div>' +
      '<div class="weather-forecast-temp">' + escapeHtml(formatWeatherForecastTemp(day)) + '</div>' +
      '<div class="weather-forecast-state">' + escapeHtml(day.conditionLabel || day.condition || "unavailable") + '</div>';
    list.appendChild(item);
  }
  section.appendChild(list);
  return section;
}

/* ── Wassertank (Abschnitt auf der Wetter-Seite) ─────────────────── */
var waterTankData = null;

function waterTankGaugeColor(pct) {
  if (pct === null || !Number.isFinite(pct)) { return "#5dd9c7"; }
  if (pct <= 15) { return "#d32f2f"; }
  if (pct <= 30) { return "#fbc02d"; }
  return "#5dd9c7";
}

function callWaterTankService(entityId, service, data, callback) {
  apiPost("api/entity/" + encodeURIComponent(entityId) + "/service", {
    service: service,
    data: data || {}
  }, callback);
}

function waterTankSection(data) {
  if (!data) { return null; }
  var section = document.createElement("section");
  section.className = "energy-detail-section";

  var heading = document.createElement("div");
  heading.className = "room-section-title";
  heading.textContent = "Wassertank";
  section.appendChild(heading);

  var pct = data.fillLevelPercent;
  var row = document.createElement("div");
  row.className = "ring-gauge-row";

  var ring = document.createElement("div");
  ring.className = "ring-gauge";
  ring.style.setProperty("--gauge-pct", pct !== null && Number.isFinite(pct) ? String(Math.max(0, Math.min(100, pct))) : "0");
  ring.style.setProperty("--gauge-color", waterTankGaugeColor(pct));

  var ringValue = document.createElement("div");
  ringValue.className = "ring-gauge-value";
  ringValue.innerHTML = (pct !== null && Number.isFinite(pct) ? Math.round(pct) + "%" : "--") + "<small>Füllstand</small>";
  ring.appendChild(ringValue);
  row.appendChild(ring);

  var info = document.createElement("div");
  info.className = "ring-gauge-info";
  info.innerHTML = '<div class="ring-gauge-title">Regenwasserfass</div>' +
    '<div class="ring-gauge-subtitle">Kalibrierung: Optionen → System</div>';
  row.appendChild(info);
  section.appendChild(row);

  var grid = document.createElement("div");
  grid.className = "metric-tile-grid";
  grid.appendChild(weatherMetricTile(data.liter || {}, false));
  grid.appendChild(weatherMetricTile(data.height || {}, false));
  section.appendChild(grid);

  var led = data.led || {};
  if (led.entity_id) {
    var bar = document.createElement("div");
    bar.className = "climate-bulk-bar";

    var infoBlock = document.createElement("div");
    infoBlock.className = "climate-bulk-info";
    infoBlock.innerHTML = '<div class="climate-bulk-title">LED-Matrix-Panel</div>' +
      '<div class="climate-bulk-subtitle">' + (led.state === "on" ? "Eingeschaltet" : "Ausgeschaltet") + '</div>';
    bar.appendChild(infoBlock);

    var actions = document.createElement("div");
    actions.className = "climate-bulk-actions";

    var currentPct = led.brightness ? Math.round((led.brightness / 255) * 100) : 100;
    var slider = document.createElement("input");
    slider.className = "entity-range";
    slider.type = "range";
    slider.min = "1";
    slider.max = "100";
    slider.value = String(currentPct);
    slider.onchange = function () {
      callWaterTankService(led.entity_id, "turn_on", { brightness_pct: Number(slider.value) }, function () {
        setTimeout(loadWeatherStationPage, 600);
      });
    };
    actions.appendChild(slider);

    var toggleButton = document.createElement("button");
    toggleButton.className = "pill-button pill-button-large" + (led.state === "on" ? " active" : "");
    toggleButton.type = "button";
    toggleButton.textContent = led.state === "on" ? "Ausschalten" : "Einschalten";
    toggleButton.onclick = function () {
      callWaterTankService(led.entity_id, led.state === "on" ? "turn_off" : "turn_on", {}, function () {
        setTimeout(loadWeatherStationPage, 600);
      });
    };
    actions.appendChild(toggleButton);

    bar.appendChild(actions);
    section.appendChild(bar);
  }

  return section;
}

function renderWeatherStationPage(data) {
  var mount = document.getElementById("weatherStationSections");
  if (!mount) { return; }
  mount.innerHTML = "";

  var sections = [
    weatherMetricSection("Aktuelles Wetter", [data.outdoorTemp, data.outdoorHumidity]),
    weatherMetricSection("Niederschlag", [data.dailyRain, data.rainRate, data.monthlyRain, data.yearlyRain]),
    waterTankSection(waterTankData),
    weatherMetricSection("Luftdruck und Trend", [data.pressure, data.pressureChange3h, data.barometerForecast]),
    windAndUvSection(data),
    weatherRadarSection(data),
    weatherForecastSection(data.forecast)
  ];

  for (var i = 0; i < sections.length; i++) {
    if (sections[i]) { mount.appendChild(sections[i]); }
  }

  if (mount.children.length === 0) {
    var empty = document.createElement("div");
    empty.className = "home-notification-empty";
    empty.textContent = "Keine Wetterdaten verfügbar";
    mount.appendChild(empty);
  }
}

function loadWeatherStationPage() {
  if (weatherStationRequestActive) { return; }
  weatherStationRequestActive = true;
  apiGet("api/wetterstation", function (weatherError, weatherData) {
    apiGet("api/wassertank", function (_tankError, tankData) {
      weatherStationRequestActive = false;
      if (weatherError) {
        setWeatherStationStatus("Fehler beim Laden", true);
        return;
      }
      waterTankData = tankData || null;
      renderWeatherStationPage(weatherData || {});
      setWeatherStationStatus("Letztes Update: " + formatGermanDateTime(new Date()), false);
    });
  });
}

apiGet("api/panel-config", function (_configError, payload) {
  weatherStationPageConfig = payload && payload.config ? payload.config : null;
  loadWeatherStationPage();
});
setInterval(loadWeatherStationPage, 60000);
