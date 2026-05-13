var roomPageState = {
  panelId: "default",
  pageId: "hof",
  structure: null,
  dashboard: null
};
var roomPageRequestActive = false;
var roomPageReloadQueued = false;

function getInitialRoomId() {
  if (typeof getActiveRoom === "function") {
    return getActiveRoom(typeof getTabletRoom === "function" ? getTabletRoom() : document.body.getAttribute("data-room"));
  }
  return document.body.getAttribute("data-room") || "hof";
}

function apiGetQuiet(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) { return; }
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        callback(null, JSON.parse(xhr.responseText));
      } catch (error) {
        callback(error);
      }
    } else {
      callback(new Error("HTTP " + xhr.status));
    }
  };
  xhr.send();
}

function setRetryStatus(el, active) {
  if (!el) { return; }
  el.className = active ? "panel-meta retry-status" : "panel-meta";
  el.title = active ? "Zum Neuladen tippen" : "";
  el.onclick = active ? function () {
    el.innerHTML = "Lade...";
    el.className = "panel-meta retry-status is-loading";
    window.location.reload();
  } : null;
}

function formatEntityValue(entity) {
  if (!entity) { return "unavailable"; }
  var unit = entity.attributes && entity.attributes.unit_of_measurement ? entity.attributes.unit_of_measurement : "";
  return entity.state + (unit ? " " + unit : "");
}

function formatValue(value, suffix) {
  if (value === undefined || value === null || value === "" || value === "unavailable") {
    return "unavailable";
  }
  return String(value) + suffix;
}

function formatEntityState(entity) {
  if (!entity) { return "unavailable"; }
  if (entity.domain === "climate") {
    var current = getNumberAttribute(entity, "current_temperature", null);
    var target = getNumberAttribute(entity, "temperature", null);
    if (target !== null) {
      return target + " °C";
    }
    if (current !== null) {
      return current + " °C";
    }
  }
  if (entity.domain === "binary_sensor") {
    if (entity.deviceClass === "window" || entity.deviceClass === "door" || entity.deviceClass === "garage_door" || entity.deviceClass === "opening") {
      return entity.state === "on" ? "offen" : "zu";
    }
    if (entity.deviceClass === "motion" || entity.deviceClass === "occupancy") {
      return entity.state === "on" ? "aktiv" : "ruhig";
    }
    if (entity.deviceClass === "problem") {
      return entity.state === "on" ? "Problem" : "ok";
    }
    return entity.state === "on" ? "an" : "aus";
  }
  return formatEntityValue(entity);
}

function getAttribute(entity, key, fallback) {
  if (!entity || !entity.attributes || entity.attributes[key] === undefined || entity.attributes[key] === null || entity.attributes[key] === "") {
    return fallback;
  }
  return entity.attributes[key];
}

function getNumberAttribute(entity, key, fallback) {
  var value = getAttribute(entity, key, null);
  var parsed;
  if (typeof value === "number") { return value; }
  if (typeof value === "string") {
    parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function getArrayAttribute(entity, key) {
  var value = getAttribute(entity, key, []);
  return Array.isArray(value) ? value : [];
}

function entityCanToggle(entity) {
  return entity && ["light", "switch", "fan", "input_boolean", "cover", "lock", "button", "scene", "script"].indexOf(entity.domain) !== -1;
}

function isOnEntity(entity) {
  return entity && (entity.state === "on" || entity.state === "open" || entity.state === "unlocked");
}

function getEntityKind(entity) {
  if (!entity) { return "other"; }
  if (["light", "switch", "fan", "input_boolean", "cover", "lock"].indexOf(entity.domain) !== -1) {
    return "control";
  }
  if (["button", "scene", "script"].indexOf(entity.domain) !== -1) {
    return "action";
  }
  if (entity.domain === "climate") {
    return "climate";
  }
  if (entity.domain === "binary_sensor") {
    return "binary";
  }
  if (["sensor", "number", "select"].indexOf(entity.domain) !== -1) {
    return "sensor";
  }
  return "other";
}

function getEntityPriority(entity) {
  var domainPriority = {
    light: 10,
    switch: 20,
    fan: 30,
    cover: 40,
    lock: 45,
    input_boolean: 50,
    climate: 60,
    button: 70,
    scene: 75,
    script: 80,
    binary_sensor: 90,
    sensor: 100,
    number: 110,
    select: 120
  };
  return domainPriority[entity.domain] || 200;
}

function getEntityIcon(entity) {
  if (typeof iconForEntity === "function") {
    return iconForEntity(entity);
  }
  if (!entity) { return "?"; }
  if (entity.domain === "light") { return "L"; }
  if (entity.domain === "switch" || entity.domain === "input_boolean") { return "I/O"; }
  if (entity.domain === "fan") { return "FAN"; }
  if (entity.domain === "cover") { return "ROL"; }
  if (entity.domain === "lock") { return "LOCK"; }
  if (entity.domain === "climate") { return "°C"; }
  if (entity.domain === "button") { return "GO"; }
  if (entity.domain === "scene" || entity.domain === "script") { return "▶"; }
  if (entity.domain === "binary_sensor") {
    if (entity.deviceClass === "window") { return "WIN"; }
    if (entity.deviceClass === "door" || entity.deviceClass === "garage_door" || entity.deviceClass === "opening") { return "DOOR"; }
    if (entity.deviceClass === "motion" || entity.deviceClass === "occupancy") { return "MOVE"; }
    if (entity.deviceClass === "problem") { return "!"; }
    return "STAT";
  }
  if (entity.deviceClass === "temperature") { return "°C"; }
  if (entity.deviceClass === "humidity") { return "%"; }
  if (entity.deviceClass === "battery") { return "BAT"; }
  if (entity.domain === "sensor") { return "SEN"; }
  return "HA";
}

function sortEntities(a, b) {
  var priority = getEntityPriority(a) - getEntityPriority(b);
  if (priority !== 0) { return priority; }
  return String(a.name || a.entityId).localeCompare(String(b.name || b.entityId), "de");
}

function makeSection(title, className) {
  var section = document.createElement("section");
  section.className = "room-entity-section " + (className || "");
  var heading = document.createElement("div");
  heading.className = "room-section-title";
  heading.textContent = title;
  section.appendChild(heading);
  return section;
}

function makeDetailsSection(title, className, open) {
  var details = document.createElement("details");
  details.className = "room-entity-section room-details-section " + (className || "");
  details.open = !!open;
  var summary = document.createElement("summary");
  summary.className = "room-section-title";
  summary.textContent = title;
  details.appendChild(summary);
  return details;
}

function appendEntityClick(card, entity) {
  if (!entityCanToggle(entity)) { return; }
  card.className += " is-clickable";
  card.onclick = function () {
    apiPost("api/entity/" + encodeURIComponent(entity.entityId) + "/toggle", {}, function () {
      setTimeout(loadRoomPage, 500);
    });
  };
}

function stopEntityControlEvent(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function callEntityService(entityId, service, data) {
  apiPost("api/entity/" + encodeURIComponent(entityId) + "/service", {
    service: service,
    data: data || {}
  }, function () {
    setTimeout(loadRoomPage, 500);
  });
}

function appendLightControls(card, entity) {
  var supportedModes = getArrayAttribute(entity, "supported_color_modes");
  var brightness = getNumberAttribute(entity, "brightness", null);
  var colorMode = String(getAttribute(entity, "color_mode", ""));
  var canDim = brightness !== null || supportedModes.indexOf("brightness") !== -1 || supportedModes.indexOf("color_temp") !== -1 || supportedModes.indexOf("hs") !== -1 || supportedModes.indexOf("rgb") !== -1 || supportedModes.indexOf("xy") !== -1;
  var canColor = supportedModes.indexOf("hs") !== -1 || supportedModes.indexOf("rgb") !== -1 || supportedModes.indexOf("xy") !== -1 || colorMode === "hs" || colorMode === "rgb" || colorMode === "xy";
  var brightnessPct = brightness === null ? 100 : Math.max(1, Math.round(brightness / 255 * 100));
  var controls;
  var slider;
  var colors;
  var swatches;
  var i;

  if (!canDim && !canColor) { return; }

  controls = document.createElement("div");
  controls.className = "entity-inline-controls light-inline-controls";
  controls.onclick = stopEntityControlEvent;

  if (canDim) {
    slider = document.createElement("input");
    slider.className = "entity-range";
    slider.type = "range";
    slider.min = "1";
    slider.max = "100";
    slider.step = "1";
    slider.value = String(brightnessPct);
    slider.title = "Helligkeit";
    slider.onchange = function () {
      callEntityService(entity.entityId, "turn_on", { brightness_pct: Number(slider.value) });
    };
    controls.appendChild(slider);
  }

  if (canColor) {
    colors = document.createElement("div");
    colors.className = "entity-color-row";
    swatches = [
      { label: "Warm", color: "#ffd28a", hs: [36, 70] },
      { label: "Weiß", color: "#f8fbff", hs: [210, 8] },
      { label: "Blau", color: "#67b7ff", hs: [205, 72] },
      { label: "Grün", color: "#5dd9c7", hs: [172, 62] },
      { label: "Rot", color: "#ff6b6b", hs: [0, 72] }
    ];

    for (i = 0; i < swatches.length; i++) {
      (function (swatch) {
        var button = document.createElement("button");
        button.className = "entity-color-button";
        button.type = "button";
        button.title = swatch.label;
        button.style.background = swatch.color;
        button.onclick = function (event) {
          stopEntityControlEvent(event);
          callEntityService(entity.entityId, "turn_on", { hs_color: swatch.hs });
        };
        colors.appendChild(button);
      })(swatches[i]);
    }
    controls.appendChild(colors);
  }

  card.appendChild(controls);
}

function appendClimateControls(card, entity) {
  var current = getNumberAttribute(entity, "current_temperature", null);
  var target = getNumberAttribute(entity, "temperature", current !== null ? current : 20);
  var min = getNumberAttribute(entity, "min_temp", 5);
  var max = getNumberAttribute(entity, "max_temp", 30);
  var step = getNumberAttribute(entity, "target_temp_step", 0.5);
  var controls = document.createElement("div");
  var temp = document.createElement("div");
  var minus = document.createElement("button");
  var plus = document.createElement("button");
  var slider = document.createElement("input");

  controls.className = "entity-inline-controls climate-inline-controls";
  controls.onclick = stopEntityControlEvent;

  temp.className = "entity-temp-readout";
  temp.textContent = "Soll " + target + " °C" + (current !== null ? " · Ist " + current + " °C" : "");
  controls.appendChild(temp);

  minus.className = "entity-step-button";
  minus.type = "button";
  minus.textContent = "-";
  minus.onclick = function (event) {
    stopEntityControlEvent(event);
    callEntityService(entity.entityId, "set_temperature", { temperature: Math.max(min, Number(target) - Number(step)) });
  };

  slider.className = "entity-range";
  slider.type = "range";
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(target);
  slider.title = "Solltemperatur";
  slider.onchange = function () {
    callEntityService(entity.entityId, "set_temperature", { temperature: Number(slider.value) });
  };

  plus.className = "entity-step-button";
  plus.type = "button";
  plus.textContent = "+";
  plus.onclick = function (event) {
    stopEntityControlEvent(event);
    callEntityService(entity.entityId, "set_temperature", { temperature: Math.min(max, Number(target) + Number(step)) });
  };

  controls.appendChild(minus);
  controls.appendChild(slider);
  controls.appendChild(plus);
  card.appendChild(controls);
}

function renderEntityCard(entity, variant) {
  var card = document.createElement("article");
  var on = isOnEntity(entity);
  card.className = "dynamic-entity-card " + (variant || "entity-card-normal") + (on ? " is-on" : "");

  var icon = document.createElement("div");
  icon.className = "entity-card-icon";
  icon.innerHTML = getEntityIcon(entity);
  card.appendChild(icon);

  var title = document.createElement("div");
  title.className = "dynamic-entity-title";
  title.textContent = entity.name || entity.entityId;
  card.appendChild(title);

  var value = document.createElement("div");
  value.className = "dynamic-entity-value";
  value.textContent = formatEntityState(entity);
  card.appendChild(value);

  var meta = document.createElement("div");
  meta.className = "dynamic-entity-meta";
  meta.textContent = entity.domain;
  card.appendChild(meta);

  if (entity.domain === "light") {
    appendLightControls(card, entity);
  }

  if (entity.domain === "climate") {
    appendClimateControls(card, entity);
  }

  appendEntityClick(card, entity);

  return card;
}

function renderCompactEntity(entity) {
  var row = document.createElement("article");
  row.className = "compact-entity-row" + (isOnEntity(entity) ? " is-on" : "");

  var name = document.createElement("div");
  name.className = "compact-entity-name";
  name.innerHTML = getEntityIcon(entity) + '<span>' + (entity.name || entity.entityId) + '</span>';
  row.appendChild(name);

  var value = document.createElement("div");
  value.className = "compact-entity-value";
  value.textContent = formatEntityState(entity);
  row.appendChild(value);

  appendEntityClick(row, entity);
  return row;
}

function getBalancedRowSize(remaining) {
  if (remaining === 4) { return 2; }
  if (remaining === 5) { return 3; }
  if (remaining <= 3) { return remaining; }
  return 3;
}

function appendBalancedRows(mount, items, renderItem) {
  var index = 0;
  while (index < items.length) {
    var rowSize = getBalancedRowSize(items.length - index);
    var row = document.createElement("div");
    row.className = "balanced-grid-row count-" + rowSize;
    for (var i = 0; i < rowSize; i++) {
      row.appendChild(renderItem(items[index + i], index + i));
    }
    mount.appendChild(row);
    index += rowSize;
  }
}

function renderDeviceGroup(deviceName, entities) {
  var group = document.createElement("section");
  group.className = "device-entity-group";

  var title = document.createElement("div");
  title.className = "device-group-title";
  title.textContent = deviceName || "Ohne Gerät";
  group.appendChild(title);

  var grid = document.createElement("div");
  grid.className = "control-card-grid";
  entities.sort(sortEntities);
  for (var i = 0; i < entities.length; i++) {
    grid.appendChild(renderEntityCard(entities[i], "entity-card-control"));
  }
  group.appendChild(grid);
  return group;
}

function renderControlCollection(title, entities, mount, groupDevices) {
  var section = makeSection(title, "controls-section");
  var i;

  if (groupDevices && entities.length > 3) {
    var groups = groupByDevice(entities);
    var singles = [];
    for (i = 0; i < groups.length; i++) {
      if (groups[i].entities.length > 1) {
        section.appendChild(renderDeviceGroup(groups[i].name, groups[i].entities));
      } else {
        singles.push(groups[i].entities[0]);
      }
    }
    if (singles.length > 0) {
      var singlesGrid = document.createElement("div");
      singlesGrid.className = "control-card-grid";
      singles.sort(sortEntities);
      for (i = 0; i < singles.length; i++) {
        singlesGrid.appendChild(renderEntityCard(singles[i], "entity-card-control"));
      }
      section.appendChild(singlesGrid);
    }
  } else {
    var grid = document.createElement("div");
    grid.className = "control-card-grid";
    entities.sort(sortEntities);
    for (i = 0; i < entities.length; i++) {
      grid.appendChild(renderEntityCard(entities[i], "entity-card-control"));
    }
    section.appendChild(grid);
  }

  mount.appendChild(section);
}

function groupByDevice(entities) {
  var groups = [];
  var byId = {};
  for (var i = 0; i < entities.length; i++) {
    var entity = entities[i];
    var key = entity.deviceId || "__without_device_" + i;
    if (!byId[key]) {
      byId[key] = {
        name: entity.deviceName || "Ohne Gerät",
        entities: []
      };
      groups.push(byId[key]);
    }
    byId[key].entities.push(entity);
  }
  groups.sort(function (a, b) {
    return String(a.name).localeCompare(String(b.name), "de");
  });
  return groups;
}

function renderSpecialCard(cardId, mount) {
  var card = document.createElement("article");
  card.className = "dynamic-special-card entity-card-control special-card-" + cardId;
  var names = {
    weather: "Wetter",
    datetime: "Uhrzeit",
    gate: "Hoftor",
    waste: "Müll",
    energy: "Energie"
  };
  var dashboard = roomPageState.dashboard || {};
  var now = new Date();
  var specialIcon = typeof iconForSpecialCard === "function" ? iconForSpecialCard(cardId) : (cardId === "weather" ? "°C" : cardId === "waste" ? "BIN" : cardId === "gate" ? "TOR" : cardId === "datetime" ? "ZEIT" : "W");
  var html = '<div class="entity-card-icon">' + specialIcon + '</div>' +
    '<div class="dynamic-entity-title">' + (names[cardId] || cardId) + '</div>';

  if (cardId === "weather" && dashboard.weather) {
    html += '<div class="dynamic-entity-value">' + formatValue(dashboard.weather.temperature, " °C") + '</div>' +
      '<div class="dynamic-entity-meta">' + (dashboard.weather.stateLabel || dashboard.weather.state || "unavailable") + '</div>';
  } else if (cardId === "datetime") {
    html += '<div class="dynamic-entity-value">' + now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + '</div>' +
      '<div class="dynamic-entity-meta">' + now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" }) + '</div>';
  } else if (cardId === "energy") {
    var energy = dashboard.energy && dashboard.energy.summary ? dashboard.energy.summary : {};
    html += '<div class="dynamic-entity-value">' + (energy.solarPowerDisplay || "unavailable") + '</div>' +
      '<div class="dynamic-entity-meta">IN Solar · OUT ' + (energy.consumptionDisplay || energy.gridPowerDisplay || "unavailable") + '</div>';
  } else if (cardId === "waste") {
    html += '<div class="room-waste-mini">' +
      '<span>Gelb <b>' + (dashboard.gelbeTonneNaechsteLeerung || "unavailable") + '</b></span>' +
      '<span>Papier <b>' + (dashboard.blaueTonneNaechsteLeerung || "unavailable") + '</b></span>' +
      '<span>Rest <b>' + (dashboard.restmuellNaechsteLeerung || "unavailable") + '</b></span>' +
      '</div>';
  } else if (cardId === "gate") {
    html += '<div class="dynamic-entity-value">' + (dashboard.torStatus || "unavailable") + '</div>' +
      '<div class="dynamic-entity-meta">' + (dashboard.torVisualText || "Hoftor") + '</div>';
  } else {
    html += '<div class="dynamic-entity-value">aktiv</div><div class="dynamic-entity-meta">Spezialkarte</div>';
  }
  card.innerHTML = html;
  card.onclick = function () {
    openSpecialCardModal(cardId);
  };
  card.className += " is-clickable";
  mount.appendChild(card);
}

function ensureSpecialCardModal() {
  var existing = document.getElementById("roomSpecialModal");
  if (existing) { return existing; }

  var backdrop = document.createElement("div");
  backdrop.id = "roomSpecialModalBackdrop";
  backdrop.className = "modal-backdrop";
  backdrop.onclick = closeSpecialCardModal;
  document.body.appendChild(backdrop);

  var modal = document.createElement("div");
  modal.id = "roomSpecialModal";
  modal.className = "dashboard-modal";
  modal.innerHTML = '<div class="modal-card"><div class="modal-header"><div><div class="panel-kicker" id="roomSpecialKicker">Info</div><div class="modal-title" id="roomSpecialTitle">Details</div></div><button class="modal-close" type="button" onclick="closeSpecialCardModal()">×</button></div><div id="roomSpecialContent" class="modal-content"></div></div>';
  document.body.appendChild(modal);
  return modal;
}

function infoBox(label, value) {
  return '<div class="modal-info-box"><div class="modal-info-label">' + label + '</div><div class="modal-info-value">' + (value || "unavailable") + '</div></div>';
}

function openSpecialCardModal(cardId) {
  ensureSpecialCardModal();
  var dashboard = roomPageState.dashboard || {};
  var title = {
    weather: "Wetterdetails",
    datetime: "Uhrzeit und Datum",
    energy: "Energie",
    gate: "Torsteuerung",
    waste: "Abholungen"
  }[cardId] || "Details";
  var content = "";

  if (cardId === "weather") {
    var weather = dashboard.weather || {};
    content = '<div class="modal-grid two-columns">' +
      infoBox("Temperatur", formatValue(weather.temperature, " °C")) +
      infoBox("Wetterlage", weather.stateLabel || weather.state) +
      infoBox("Luftfeuchte", formatValue(weather.humidity, " %")) +
      infoBox("Wind", formatValue(weather.windSpeed, " km/h")) +
      infoBox("Bewölkung", formatValue(weather.cloudCoverage, " %")) +
      infoBox("Luftdruck", formatValue(weather.pressure, " hPa")) +
      infoBox("Taupunkt", formatValue(weather.dewPoint, " °C")) +
      infoBox("UV-Index", formatValue(weather.uvIndex, "")) +
      '</div>';
  } else if (cardId === "datetime") {
    var now = new Date();
    content = '<div class="modal-grid two-columns">' +
      infoBox("Uhrzeit", now.toLocaleTimeString("de-DE")) +
      infoBox("Datum", now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })) +
      '</div>';
  } else if (cardId === "energy") {
    var energy = dashboard.energy && dashboard.energy.summary ? dashboard.energy.summary : {};
    content = '<div class="modal-grid two-columns">' +
      infoBox("Solar aktuell", energy.solarPowerDisplay) +
      infoBox("Netzleistung", energy.gridPowerDisplay) +
      infoBox("Verbrauch", energy.consumptionDisplay) +
      infoBox("Delta2 Akku", energy.deltaBatteryDisplay) +
      infoBox("Powerstream Akku", energy.powerstreamBatteryDisplay) +
      infoBox("Einspeisung", energy.feedInDisplay) +
      '</div>';
  } else if (cardId === "gate") {
    content = '<div class="modal-grid two-columns">' +
      infoBox("Status", dashboard.torStatus) +
      infoBox("Schließzeit", formatValue(dashboard.schliessZeit, " s")) +
      infoBox("Fahrzeit", formatValue(dashboard.fahrZeit, " s")) +
      infoBox("Automatik", dashboard.torAutomatik ? "Ein" : "Aus") +
      '</div><div class="gate-action-buttons modal-actions-row">' +
      '<button class="pill-button pill-button-large active" type="button" onclick="apiPost(\'api/tor/auto-open\', {}, function(){ setTimeout(loadRoomPage, 500); })">AutoÖffnen</button>' +
      '<button class="pill-button pill-button-large" type="button" onclick="apiPost(\'api/tor/impulse\', {}, function(){ setTimeout(loadRoomPage, 500); })">Impuls</button>' +
      '<button class="pill-button pill-button-large" type="button" onclick="apiPost(\'api/tor/wait60\', {}, function(){ setTimeout(loadRoomPage, 500); })">+60s</button>' +
      '</div>';
  } else if (cardId === "waste") {
    content = '<div class="waste-list modal-waste-list">' +
      '<div class="waste-item yellow"><div><div class="waste-title">Gelbe Tonne</div><div class="waste-date">' + (dashboard.gelbeTonneNaechsteLeerung || "unavailable") + '</div></div></div>' +
      '<div class="waste-item blue"><div><div class="waste-title">Blaue Tonne</div><div class="waste-date">' + (dashboard.blaueTonneNaechsteLeerung || "unavailable") + '</div></div></div>' +
      '<div class="waste-item dark"><div><div class="waste-title">Restmüll</div><div class="waste-date">' + (dashboard.restmuellNaechsteLeerung || "unavailable") + '</div></div></div>' +
      '</div>';
  }

  document.getElementById("roomSpecialKicker").textContent = "Direktzugriff";
  document.getElementById("roomSpecialTitle").textContent = title;
  document.getElementById("roomSpecialContent").innerHTML = content;
  document.getElementById("roomSpecialModalBackdrop").className = "modal-backdrop open";
  document.getElementById("roomSpecialModal").className = "dashboard-modal open";
}

function closeSpecialCardModal() {
  var backdrop = document.getElementById("roomSpecialModalBackdrop");
  var modal = document.getElementById("roomSpecialModal");
  if (backdrop) { backdrop.className = "modal-backdrop"; }
  if (modal) { modal.className = "dashboard-modal"; }
}

function normalizeSpecialCards(cards) {
  var allowed = ["weather", "datetime", "energy", "gate", "waste"];
  var defaults = ["weather", "datetime", "energy"];
  var result = [];
  var i;

  for (i = 0; i < (cards || []).length; i++) {
    if (allowed.indexOf(cards[i]) !== -1 && result.indexOf(cards[i]) === -1) {
      result.push(cards[i]);
    }
  }
  for (i = 0; result.length < 3 && i < defaults.length; i++) {
    if (result.indexOf(defaults[i]) === -1) {
      result.push(defaults[i]);
    }
  }
  return result.slice(0, 3);
}

function renderPinnedStatus(entities) {
  var mount = document.getElementById("roomPinnedStatus");
  if (!mount) { return; }
  mount.innerHTML = "";

  var candidates = [];
  for (var i = 0; i < entities.length; i++) {
    var entity = entities[i];
    if (entity.domain === "binary_sensor" || entity.deviceClass === "temperature" || entity.deviceClass === "humidity" || entity.deviceClass === "battery") {
      candidates.push(entity);
    }
  }

  candidates.sort(function (a, b) {
    var aActive = a.state === "on" || a.deviceClass === "temperature" || a.deviceClass === "humidity" ? 0 : 1;
    var bActive = b.state === "on" || b.deviceClass === "temperature" || b.deviceClass === "humidity" ? 0 : 1;
    if (aActive !== bActive) { return aActive - bActive; }
    return sortEntities(a, b);
  });

  for (i = 0; i < Math.min(candidates.length, 5); i++) {
    var pill = document.createElement("div");
    pill.className = "room-status-pill" + (isOnEntity(candidates[i]) ? " is-on" : "");
    pill.innerHTML = '<span>' + getEntityIcon(candidates[i]) + '</span><b>' + (candidates[i].name || candidates[i].entityId) + '</b><em>' + formatEntityState(candidates[i]) + '</em>';
    mount.appendChild(pill);
  }
}

function renderEntityLayout(cards, entities, mount) {
  var controls = [];
  var lights = [];
  var switches = [];
  var actionEntities = [];
  var climateEntities = [];
  var binaryEntities = [];
  var sensorEntities = [];
  var otherEntities = [];
  var i;

  for (i = 0; i < entities.length; i++) {
    var kind = getEntityKind(entities[i]);
    if (kind === "control") {
      controls.push(entities[i]);
      if (entities[i].domain === "light") { lights.push(entities[i]); }
      else { switches.push(entities[i]); }
    }
    else if (kind === "action") { actionEntities.push(entities[i]); }
    else if (kind === "climate") { climateEntities.push(entities[i]); }
    else if (kind === "binary") { binaryEntities.push(entities[i]); }
    else if (kind === "sensor") { sensorEntities.push(entities[i]); }
    else { otherEntities.push(entities[i]); }
  }

  cards = normalizeSpecialCards(cards);

  if (cards.length > 0) {
    var quick = makeSection("Direktzugriff", "quick-section");
    var quickGrid = document.createElement("div");
    quickGrid.className = "balanced-grid-stack special-card-stack";
    appendBalancedRows(quickGrid, cards, function (cardId) {
      var rowMount = document.createElement("div");
      renderSpecialCard(cardId, rowMount);
      return rowMount.firstChild;
    });
    quick.appendChild(quickGrid);
    mount.appendChild(quick);
  }

  if (actionEntities.length > 0) {
    renderControlCollection("Aktionen", actionEntities, mount, false);
  }

  if (lights.length > 0) {
    renderControlCollection("Lampen", lights, mount, false);
  }

  if (switches.length > 0 || climateEntities.length > 0) {
    renderControlCollection("Schalter & Geräte", switches.concat(climateEntities), mount, true);
  }

  if (binaryEntities.length > 0) {
    var binarySection = makeSection("Status", "status-section");
    var binaryGrid = document.createElement("div");
    binaryGrid.className = "balanced-grid-stack compact-entity-stack";
    binaryEntities.sort(sortEntities);
    appendBalancedRows(binaryGrid, binaryEntities, renderCompactEntity);
    binarySection.appendChild(binaryGrid);
    mount.appendChild(binarySection);
  }

  if (sensorEntities.length > 0) {
    var sensorSection = makeDetailsSection("Sensoren", "sensor-section", sensorEntities.length <= 8);
    var sensorGrid = document.createElement("div");
    sensorGrid.className = "balanced-grid-stack compact-entity-stack";
    sensorEntities.sort(sortEntities);
    appendBalancedRows(sensorGrid, sensorEntities, renderCompactEntity);
    sensorSection.appendChild(sensorGrid);
    mount.appendChild(sensorSection);
  }

  if (otherEntities.length > 0) {
    var otherSection = makeDetailsSection("Weitere Entitäten", "other-section", false);
    var otherGrid = document.createElement("div");
    otherGrid.className = "balanced-grid-stack compact-entity-stack";
    otherEntities.sort(sortEntities);
    appendBalancedRows(otherGrid, otherEntities, renderCompactEntity);
    otherSection.appendChild(otherGrid);
    mount.appendChild(otherSection);
  }
}

function renderRoomPayload(payload) {
  var title = document.getElementById("roomTitle");
  if (title && payload.page) { title.innerHTML = payload.page.title || payload.pageId; }

  var mount = document.getElementById("roomCardsMount");
  if (!mount) { return; }
  mount.innerHTML = "";

  var cards = payload.cards || [];
  var entities = payload.entities || [];
  renderPinnedStatus(entities);
  renderEntityLayout(cards, entities, mount);

  var status = document.getElementById("roomUpdateState");
  if (status) {
    status.innerHTML = "Letztes Update: " + formatGermanDateTime(new Date());
    setRetryStatus(status, false);
  }
}

function loadRoomPage() {
  if (roomPageRequestActive) {
    roomPageReloadQueued = true;
    return;
  }
  roomPageRequestActive = true;
  document.body.setAttribute("data-room", roomPageState.pageId);
  if (roomPageState.structure && typeof refreshRoomNavigation === "function") {
    refreshRoomNavigation(roomPageState.structure, roomPageState.pageId);
  }
  apiGet("api/page/" + encodeURIComponent(roomPageState.panelId) + "/" + encodeURIComponent(roomPageState.pageId), function (error, payload) {
    roomPageRequestActive = false;
    if (error) {
      var status = document.getElementById("roomUpdateState");
      if (status) {
        status.innerHTML = "Fehler beim Laden";
        setRetryStatus(status, true);
      }
      if (roomPageReloadQueued) {
        roomPageReloadQueued = false;
        loadRoomPage();
      }
      return;
    }
    renderRoomPayload(payload);
    if (roomPageReloadQueued) {
      roomPageReloadQueued = false;
      loadRoomPage();
    }
  });
}

function fillRoomSelect() {
  var select = document.getElementById("roomSelect");
  if (!select || !roomPageState.structure) { return; }
  select.innerHTML = "";
  var areas = roomPageState.structure.areas || [];
  var selectedRoom = getInitialRoomId();
  var foundSelectedRoom = false;
  var tree = roomPageState.structure.tree || [];

  for (var f = 0; f < tree.length; f++) {
    var floor = tree[f];
    var floorAreas = floor.areas || [];
    if (floorAreas.length === 0) { continue; }
    var group = document.createElement("optgroup");
    group.label = floor.floorName || "Ohne Etage";
    for (var a = 0; a < floorAreas.length; a++) {
      if (!floorAreas[a].areaId) { continue; }
      var option = document.createElement("option");
      option.value = floorAreas[a].areaId;
      option.innerHTML = floorAreas[a].name;
      if (floorAreas[a].areaId === selectedRoom) {
        option.selected = true;
        foundSelectedRoom = true;
      }
      group.appendChild(option);
    }
    if (group.children.length > 0) {
      select.appendChild(group);
    }
  }

  if (areas.length > 0 && !foundSelectedRoom) {
    selectedRoom = areas[0].area_id;
    select.value = selectedRoom;
  }
  roomPageState.pageId = selectedRoom;
  document.body.setAttribute("data-room", selectedRoom);
  if (typeof refreshRoomNavigation === "function") {
    refreshRoomNavigation(roomPageState.structure, selectedRoom);
  }
  select.onchange = loadRoomPage;
}

function initRoomPage() {
  roomPageState.panelId = getPanelId();
  roomPageState.pageId = getInitialRoomId();
  var dashboardReady = false;
  var structureReady = false;

  function loadWhenReady() {
    if (dashboardReady && structureReady) {
      loadRoomPage();
    }
  }

  apiGetQuiet("api/dashboard", function (_error, dashboard) {
    if (dashboard) {
      roomPageState.dashboard = dashboard;
    }
    dashboardReady = true;
    loadWhenReady();
  });
  apiGet("api/ha/structure", function (error, structure) {
    if (!error) {
      roomPageState.structure = structure;
      fillRoomSelect();
    }
    structureReady = true;
    loadWhenReady();
  });
  setInterval(loadRoomPage, 10000);
}

initRoomPage();
