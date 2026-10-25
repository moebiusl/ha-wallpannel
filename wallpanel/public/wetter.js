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

// ── Regenradar mit Zeitleiste (DWD) ─────────────────────────────────
// Bleibt über die minütliche Neuzeichnung der Seite erhalten (wird nur umgehängt),
// damit die Animation nicht ständig neu startet.
var RADAR_FRAME_MS = 700;
var RADAR_END_PAUSE_MS = 1800;
var radarWidget = null;

function radarRelativeLabel(iso) {
  var minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 5) { return "jetzt"; }
  if (minutes < 0) { return "vor " + (-minutes) + " Min."; }
  if (minutes >= 60) {
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return "in " + h + " Std." + (m ? " " + m + " Min." : "");
  }
  return "in " + minutes + " Min.";
}

function radarClock(iso) {
  var date = new Date(iso);
  var h = date.getHours();
  var m = date.getMinutes();
  return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
}

function createRadarWidget() {
  var section = document.createElement("section");
  section.className = "energy-detail-section radar-section";
  section.innerHTML = '' +
    '<div class="room-section-title">Regenradar</div>' +
    '<div class="radar-summary"></div>' +
    '<div class="radar-stage">' +
      '<img class="radar-base" alt="">' +
      '<img class="radar-frame" alt="Regenradar">' +
      '<span class="radar-home"></span>' +
      '<span class="radar-time-badge"></span>' +
      '<span class="radar-loading">Radar wird geladen …</span>' +
    '</div>' +
    '<div class="radar-controls">' +
      '<button class="radar-play" type="button" aria-label="Abspielen">❚❚</button>' +
      '<div class="radar-slider-wrap">' +
        '<input class="radar-slider entity-range" type="range" min="0" max="0" value="0">' +
        '<div class="radar-scale"><span>−1 Std.</span><span class="radar-scale-now">jetzt</span><span>+2 Std.</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="radar-legend"><span class="radar-legend-bar"></span><span>leicht</span><span>stark</span><span class="radar-credit">Quelle: Deutscher Wetterdienst</span></div>';

  var widget = {
    section: section,
    summary: section.getElementsByClassName("radar-summary")[0],
    base: section.getElementsByClassName("radar-base")[0],
    frame: section.getElementsByClassName("radar-frame")[0],
    home: section.getElementsByClassName("radar-home")[0],
    badge: section.getElementsByClassName("radar-time-badge")[0],
    loading: section.getElementsByClassName("radar-loading")[0],
    play: section.getElementsByClassName("radar-play")[0],
    slider: section.getElementsByClassName("radar-slider")[0],
    nowMark: section.getElementsByClassName("radar-scale-now")[0],
    info: null,
    index: 0,
    nowIndex: 0,
    loaded: [],
    playing: true,
    timer: null,
    failed: false
  };

  widget.play.onclick = function () {
    widget.playing = !widget.playing;
    updateRadarPlayButton(widget);
    if (widget.playing) { scheduleRadarStep(widget, RADAR_FRAME_MS); }
  };
  var onSlide = function () {
    widget.playing = false;
    updateRadarPlayButton(widget);
    showRadarFrame(widget, parseInt(widget.slider.value, 10) || 0);
  };
  widget.slider.addEventListener("input", onSlide, false);
  widget.slider.addEventListener("change", onSlide, false);
  return widget;
}

function updateRadarPlayButton(widget) {
  widget.play.textContent = widget.playing ? "❚❚" : "▶";
  widget.play.setAttribute("aria-label", widget.playing ? "Anhalten" : "Abspielen");
}

// Versionsnummer in der Adresse: Ändert sich die Darstellung, laden Tablets die Bilder neu.
var RADAR_IMAGE_VERSION = "2";

function radarFrameUrl(info, frame) {
  return "api/radar/frame?time=" + encodeURIComponent(frame.time) + "&ref=" + encodeURIComponent(info.reference) + "&v=" + RADAR_IMAGE_VERSION;
}

function showRadarFrame(widget, index) {
  var info = widget.info;
  if (!info || !info.frames.length) { return; }
  index = Math.max(0, Math.min(info.frames.length - 1, index));
  widget.index = index;
  var frame = info.frames[index];
  // Nur bereits geladene Bilder zeigen, sonst flackert es auf alten iPads.
  if (widget.loaded[index]) { widget.frame.src = radarFrameUrl(info, frame); }
  if (String(widget.slider.value) !== String(index)) { widget.slider.value = index; }
  widget.badge.textContent = radarClock(frame.time) + " · " + radarRelativeLabel(frame.time) + (frame.forecast ? " · Vorhersage" : "");
  widget.badge.className = "radar-time-badge" + (frame.forecast ? " is-forecast" : "");
}

function isRadarVisible(widget) {
  return !document.hidden && !window.wallpanelScreensaverActive && document.body.contains(widget.section);
}

function scheduleRadarStep(widget, delay) {
  if (widget.timer) { clearTimeout(widget.timer); }
  widget.timer = setTimeout(function () {
    widget.timer = null;
    if (!widget.playing || !widget.info) { return; }
    if (!isRadarVisible(widget)) {
      scheduleRadarStep(widget, 2000);
      return;
    }
    var count = widget.info.frames.length;
    var next = widget.index + 1 >= count ? 0 : widget.index + 1;
    // Nur durch geladene Bilder laufen.
    if (!widget.loaded[next]) { next = 0; }
    showRadarFrame(widget, next);
    scheduleRadarStep(widget, next === count - 1 ? RADAR_END_PAUSE_MS : RADAR_FRAME_MS);
  }, delay);
}

function preloadRadarFrames(widget, info) {
  // Nacheinander laden statt alle gleichzeitig – schont alte iPads und die Verbindung.
  var position = 0;
  var order = [];
  for (var i = widget.nowIndex; i >= 0; i--) { order.push(i); }
  for (var j = widget.nowIndex + 1; j < info.frames.length; j++) { order.push(j); }
  var loadNext = function () {
    if (widget.info !== info || position >= order.length) {
      if (widget.info === info) { widget.loading.style.display = "none"; }
      return;
    }
    var index = order[position];
    var img = new Image();
    img.onload = img.onerror = function () {
      widget.loaded[index] = true;
      position++;
      widget.loading.textContent = "Radar wird geladen … " + position + "/" + order.length;
      if (index === widget.nowIndex) { showRadarFrame(widget, widget.nowIndex); }
      loadNext();
    };
    img.src = radarFrameUrl(info, info.frames[index]);
  };
  widget.loading.style.display = "block";
  loadNext();
}

function applyRadarInfo(widget, info) {
  widget.summary.textContent = info.summary || "";
  widget.summary.className = "radar-summary is-" + (info.level || "dry");
  if (widget.info && widget.info.reference === info.reference) {
    widget.info.summary = info.summary;
    return;
  }
  widget.info = info;
  widget.loaded = [];
  widget.nowIndex = 0;
  for (var i = 0; i < info.frames.length; i++) {
    if (!info.frames[i].forecast) { widget.nowIndex = i; }
  }
  widget.slider.max = String(info.frames.length - 1);
  widget.nowMark.style.left = (info.frames.length > 1 ? widget.nowIndex / (info.frames.length - 1) * 100 : 0) + "%";
  if (!widget.base.getAttribute("src")) { widget.base.src = "api/radar/base.png?v=" + RADAR_IMAGE_VERSION; }
  widget.home.style.left = (info.home.x * 100) + "%";
  widget.home.style.top = (info.home.y * 100) + "%";
  widget.index = widget.nowIndex;
  showRadarFrame(widget, widget.nowIndex);
  preloadRadarFrames(widget, info);
  if (widget.playing) { scheduleRadarStep(widget, 2500); }
}

function loadRadarInfo(widget) {
  apiGet("api/radar", function (error, info) {
    if (error || !info || !info.ok || !info.frames || !info.frames.length) {
      widget.failed = true;
      return;
    }
    widget.failed = false;
    applyRadarInfo(widget, info);
  });
}

function weatherRadarSection(data) {
  if (!radarWidget) {
    radarWidget = createRadarWidget();
    loadRadarInfo(radarWidget);
    // Neuer DWD-Lauf etwa alle 5 Minuten.
    setInterval(function () {
      if (!document.hidden) { loadRadarInfo(radarWidget); }
    }, 5 * 60 * 1000);
  }
  // Fällt der DWD aus, bleibt das bisherige Radarbild aus Home Assistant als Ersatz.
  if (radarWidget.failed && data.radarImageUrl) { return legacyRadarSection(data); }
  return radarWidget.section;
}

function legacyRadarSection(data) {
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
