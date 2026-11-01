var roomPageState = {
  panelId: "default",
  pageId: "hof",
  structure: null,
  dashboard: null,
  lastRenderedPageId: null
};
var roomPageRequestSerial = 0;

function setRoomLoading(active, roomName, clearContent) {
  var panel = document.querySelector(".room-page-panel");
  var overlay = document.getElementById("roomLoadingOverlay");
  var title = document.getElementById("roomTitle");
  var pinned = document.getElementById("roomPinnedStatus");
  var cards = document.getElementById("roomCardsMount");
  var status = document.getElementById("roomUpdateState");

  if (panel) {
    panel.className = active ? "panel large-page-panel room-page-panel dynamic-room-panel is-loading-room" : "panel large-page-panel room-page-panel dynamic-room-panel";
  }
  if (overlay) {
    overlay.style.display = active ? "-webkit-flex" : "none";
    overlay.style.display = active ? "flex" : "none";
    var loadingTitle = overlay.querySelector(".room-loading-title");
    if (loadingTitle) {
      loadingTitle.textContent = roomName ? "Lade " + roomName + "..." : "Lade Raum...";
    }
  }
  if (title && active) {
    title.textContent = roomName || "Raum";
  }
  if (pinned && active && clearContent) {
    pinned.innerHTML = "";
  }
  if (cards && active && clearContent) {
    cards.innerHTML = "";
  }
  if (status && active) {
    status.innerHTML = "Lade...";
    status.className = "panel-meta retry-status is-loading";
  }
}

function getRoomLabel(roomId) {
  if (roomPageState.structure && typeof findAreaName === "function") {
    return findAreaName(roomPageState.structure, roomId);
  }
  return roomId || "Raum";
}

function getInitialRoomId() {
  if (typeof getActiveRoom === "function") {
    return getActiveRoom(typeof getTabletRoom === "function" ? getTabletRoom() : document.body.getAttribute("data-room"));
  }
  return document.body.getAttribute("data-room") || "hof";
}

function apiGetQuiet(url, callback) { apiGet(url, callback); }

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
  if (entity.state === "unavailable" || entity.state === "unknown") { return "Nicht erreichbar"; }
  if (entity.domain === "light" || entity.domain === "switch") { return entity.state === "on" ? "An" : "Aus"; }
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
  if (entity.domain === "media_player") {
    return getMediaPlayerSummary(entity);
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
  return entity && (entity.state === "on" || entity.state === "open" || entity.state === "unlocked" || entity.state === "playing");
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
  if (entity.domain === "media_player") {
    return "media";
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
    media_player: 65,
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
  if (entity.domain === "media_player") { return "MEDIA"; }
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
  if (!entityCanToggle(entity) || isUnavailableState(entity.state)) { return; }
  card.className += " is-clickable";
  card.onclick = function () {
    if (card.className.indexOf("is-loading") !== -1) { return; }
    var hasOn = card.className.indexOf(" is-on") !== -1;
    card.className = (hasOn
      ? card.className.replace(/\s*\bis-on\b/g, "")
      : card.className + " is-on") + " is-loading";
    apiPost("api/entity/" + encodeURIComponent(entity.entityId) + "/toggle", {}, function (error) {
      card.className = card.className.replace(/\s*is-loading/g, "");
      if (error) { window.alert("Gerät konnte nicht geschaltet werden. Bitte erneut versuchen."); }
      setTimeout(loadRoomPage, 1000);
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
  }, function (error) {
    if (error) { window.alert("Der Gerätebefehl ist fehlgeschlagen. Bitte erneut versuchen."); }
    setTimeout(loadRoomPage, 1000);
  });
}

function getMediaPlayerSummary(entity) {
  var title = getAttribute(entity, "media_title", "");
  var artist = getAttribute(entity, "media_artist", "");
  var source = getAttribute(entity, "source", "") || getAttribute(entity, "app_name", "");
  if (title && artist) { return title + " · " + artist; }
  if (title) { return title; }
  if (source) { return source; }
  if (entity.state === "playing") { return "läuft"; }
  if (entity.state === "paused") { return "pausiert"; }
  if (entity.state === "idle") { return "bereit"; }
  if (entity.state === "off") { return "aus"; }
  return entity.state || "unavailable";
}

function mediaPlayerStateLabel(entity) {
  if (!entity) { return "unavailable"; }
  if (entity.state === "playing") { return "Wiedergabe"; }
  if (entity.state === "paused") { return "Pausiert"; }
  if (entity.state === "idle") { return "Bereit"; }
  if (entity.state === "off") { return "Aus"; }
  return entity.state || "unavailable";
}

function appendMediaPlayerControls(card, entity) {
  var controls = document.createElement("div");
  var detail = document.createElement("div");
  var actions = document.createElement("div");
  var volume = getNumberAttribute(entity, "volume_level", null);

  controls.className = "entity-inline-controls media-inline-controls";
  controls.onclick = function (event) { event.stopPropagation(); };

  detail.className = "media-player-detail";
  detail.textContent = "Musik · " + mediaPlayerStateLabel(entity) + (volume !== null ? " · " + Math.round(volume * 100) + " %" : "");
  controls.appendChild(detail);

  actions.className = "media-player-actions";
  var features = getNumberAttribute(entity, "supported_features", 0);
  if (features & 16) { appendMediaPlayerButton(actions, entity, "media_previous_track", "Vorheriger Titel", "previous"); }
  if (entity.state === "playing" && (features & 1)) { appendMediaPlayerButton(actions, entity, "media_pause", "Pause", "pause"); }
  else if (features & 16384) { appendMediaPlayerButton(actions, entity, "media_play", "Play", "play"); }
  if (features & 32) { appendMediaPlayerButton(actions, entity, "media_next_track", "Nächster Titel", "next"); }
  if (entity.musicAssistant) {
    var choose = document.createElement("button");
    choose.className = "pill-button";
    choose.type = "button";
    choose.textContent = "Musik wählen";
    choose.onclick = function (event) { stopEntityControlEvent(event); openMusicLibrary(entity); };
    actions.appendChild(choose);
  }
  controls.appendChild(actions);
  if (volume !== null && (features & 4)) {
    var volumeSlider = document.createElement("input");
    volumeSlider.className = "entity-range media-volume-control";
    volumeSlider.type = "range";
    volumeSlider.min = "0"; volumeSlider.max = "100"; volumeSlider.step = "1";
    volumeSlider.value = String(Math.round(volume * 100));
    volumeSlider.setAttribute("aria-label", "Lautstärke " + (entity.name || ""));
    volumeSlider.onchange = function () { callEntityService(entity.entityId, "volume_set", { volume_level: Number(volumeSlider.value) / 100 }); };
    controls.appendChild(volumeSlider);
  }
  var sources = getArrayAttribute(entity, "source_list");
  if (sources.length && (features & 2048)) {
    var sourceSelect = document.createElement("select");
    sourceSelect.className = "room-select media-source-select";
    sourceSelect.setAttribute("aria-label", "Musikquelle " + (entity.name || ""));
    for (var i = 0; i < sources.length; i++) {
      var option = document.createElement("option"); option.value = sources[i]; option.textContent = sources[i];
      option.selected = sources[i] === getAttribute(entity, "source", ""); sourceSelect.appendChild(option);
    }
    sourceSelect.onchange = function () { callEntityService(entity.entityId, "select_source", { source: sourceSelect.value }); };
    controls.appendChild(sourceSelect);
  }
  card.appendChild(controls);
}

function appendMediaPlayerButton(mount, entity, service, label, iconName) {
  var button = document.createElement("button");
  button.className = "media-control-button";
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = typeof haIcon === "function" ? haIcon(iconName) : label;
  button.onclick = function (event) {
    stopEntityControlEvent(event);
    callEntityService(entity.entityId, service, {});
  };
  mount.appendChild(button);
}

function appendLightControls(card, entity) {
  var supportedModes = getArrayAttribute(entity, "supported_color_modes");
  var brightness = getNumberAttribute(entity, "brightness", null);
  var colorMode = String(getAttribute(entity, "color_mode", ""));
  var canDim = brightness !== null || supportedModes.indexOf("brightness") !== -1 || supportedModes.indexOf("color_temp") !== -1 || supportedModes.indexOf("hs") !== -1 || supportedModes.indexOf("rgb") !== -1 || supportedModes.indexOf("xy") !== -1 || supportedModes.indexOf("rgbw") !== -1 || supportedModes.indexOf("rgbww") !== -1 || supportedModes.indexOf("white") !== -1;
  var canColor = supportedModes.indexOf("hs") !== -1 || supportedModes.indexOf("rgb") !== -1 || supportedModes.indexOf("xy") !== -1 || colorMode === "hs" || colorMode === "rgb" || colorMode === "xy" || supportedModes.indexOf("rgbw") !== -1 || supportedModes.indexOf("rgbww") !== -1;
  var brightnessPct = brightness === null ? 100 : Math.max(1, Math.round(brightness / 255 * 100));
  var controls;
  var slider;
  var colors;
  var swatches;
  var i;

  if (!canDim && !canColor) { return; }

  controls = document.createElement("div");
  controls.className = "entity-inline-controls light-inline-controls";
  controls.onclick = function (event) { event.stopPropagation(); };

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
  controls.onclick = function (event) { event.stopPropagation(); };

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

function isUnavailableState(state) {
  return state === "unavailable" || state === "unknown";
}

function renderEntityCard(entity, variant) {
  var card = document.createElement("article");
  var on = isOnEntity(entity);
  var unavailable = isUnavailableState(entity.state);
  card.className = "dynamic-entity-card " + (variant || "entity-card-normal") + (on ? " is-on" : "") + (unavailable ? " is-unavailable" : "");
  if (entity.domain === "media_player") {
    card.className += " media-player-card";
  }

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
  meta.textContent = entity.domain === "media_player" ? "Musik" : entity.domain === "climate" ? "Heizung" : entity.domain === "light" ? "Licht" : entity.domain;
  card.appendChild(meta);

  if (entity.domain === "light") {
    card.className += " light-device-card";
    appendLightControls(card, entity);
  }

  if (entity.domain === "climate") {
    appendClimateControls(card, entity);
  }

  if (entity.domain === "media_player") {
    appendMediaPlayerControls(card, entity);
  }

  appendEntityClick(card, entity);
  if (unavailable) {
    var inputs = card.querySelectorAll("button, input, select");
    for (var i = 0; i < inputs.length; i++) { inputs[i].disabled = true; }
    card.setAttribute("aria-disabled", "true");
  }
  return card;
}

function renderCompactEntity(entity) {
  var row = document.createElement("article");
  row.className = "compact-entity-row" + (isOnEntity(entity) ? " is-on" : "") + (isUnavailableState(entity.state) ? " is-unavailable" : "");

  var name = document.createElement("div");
  name.className = "compact-entity-name";
  name.innerHTML = getEntityIcon(entity) + '<span>' + escapeHtml(entity.name || entity.entityId) + '</span>';
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
      infoBox("Powerstream Akku", energy.powerstreamBatteryDisplay) +
      infoBox("Bis voll", energy.chargeTimeDisplay) +
      infoBox("Bis leer", energy.dischargeTimeDisplay) +
      infoBox("Akku heute", energy.fromBatteryTodayDisplay) +
      infoBox("Einspeisung", energy.feedInDisplay) +
      '</div>';
  } else if (cardId === "gate") {
    content = '<div class="modal-grid two-columns">' +
      infoBox("Status", dashboard.torStatus) +
      infoBox("Schließzeit", formatValue(dashboard.schliessZeit, " s")) +
      infoBox("Fahrzeit", formatValue(dashboard.fahrZeit, " s")) +
      infoBox("Automatik", dashboard.torAutomatik ? "Ein" : "Aus") +
      '</div><div class="gate-action-buttons modal-actions-row">' +
      '<button class="pill-button pill-button-large active" type="button" onclick="apiPost(\'api/tor/auto-open\', {}, function(){ setTimeout(loadRoomPage, 1000); })">AutoÖffnen</button>' +
      '<button class="pill-button pill-button-large" type="button" onclick="apiPost(\'api/tor/impulse\', {}, function(){ setTimeout(loadRoomPage, 1000); })">Impuls</button>' +
      '<button class="pill-button pill-button-large" type="button" onclick="apiPost(\'api/tor/wait60\', {}, function(){ setTimeout(loadRoomPage, 1000); })">+60s</button>' +
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
  var mediaEntities = [];
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
    else if (kind === "media") { mediaEntities.push(entities[i]); }
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

  var primary = document.createElement("div");
  primary.className = "room-primary-controls";
  if (mediaEntities.length > 0) {
    renderControlCollection("Musik", mediaEntities, primary, false);
    primary.lastChild.className += " room-music-section";
  }
  if (lights.length > 0) {
    renderControlCollection("Lampen", lights, primary, false);
    primary.lastChild.className += " room-lights-section";
  }
  if (primary.children.length) { mount.appendChild(primary); }
  if (climateEntities.length > 0) {
    renderControlCollection("Raumklima · Heizung", climateEntities, mount, false);
  }
  if (switches.length > 0) {
    renderControlCollection("Schalter & Geräte", switches, mount, false);
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

function renderRoomPayload(payload, preserveScroll) {
  setRoomLoading(false);
  var title = document.getElementById("roomTitle");
  if (title && payload.page) { title.textContent = payload.page.title || payload.pageId; }

  var mount = document.getElementById("roomCardsMount");
  if (!mount) { return; }
  var scrollPanel = document.querySelector(".room-page-panel");
  var panelScrollTop = scrollPanel ? scrollPanel.scrollTop : 0;
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  mount.innerHTML = "";

  var cards = payload.cards || [];
  var entities = payload.entities || [];
  renderPinnedStatus(entities);
  if (payload.roomAvailable === false) {
    var message = document.createElement("p");
    message.className = "settings-hint";
    message.textContent = "Dieser Raum ist ausgeblendet oder nicht mehr in Home Assistant vorhanden. Bitte über Räume einen sichtbaren Raum wählen oder die Tablet-Zuordnung ändern.";
    mount.appendChild(message);
  } else {
    renderEntityLayout(cards, entities, mount);
  }
  roomPageState.lastRenderedPageId = payload.pageId;
  if (preserveScroll && scrollPanel) { scrollPanel.scrollTop = panelScrollTop; }

  if (preserveScroll && scrollY > 0 && window.requestAnimationFrame) {
    window.requestAnimationFrame(function () {
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(0, Math.min(scrollY, maxScroll));
    });
  }

  var status = document.getElementById("roomUpdateState");
  if (status) {
    status.innerHTML = "Letztes Update: " + formatGermanDateTime(new Date());
    setRetryStatus(status, false);
  }
}

function loadRoomPage() {
  if (document.querySelector(".dynamic-entity-card.is-loading")) { return; }
  if (window.wallpanelControlDragUntil > Date.now()) { return; }
  var select = document.getElementById("roomSelect");
  if (select && select.value && select.value !== roomPageState.pageId) {
    roomPageState.pageId = select.value;
    if (typeof setTabletRoom === "function") {
      setTabletRoom(roomPageState.pageId);
    }
  }
  document.body.setAttribute("data-room", roomPageState.pageId);
  if (roomPageState.structure && typeof refreshRoomNavigation === "function") {
    refreshRoomNavigation(roomPageState.structure, roomPageState.pageId);
  }
  var requestedPageId = roomPageState.pageId;
  var requestSerial = ++roomPageRequestSerial;
  var shouldClearContent = roomPageState.lastRenderedPageId !== requestedPageId;
  if (shouldClearContent) {
    setRoomLoading(true, getRoomLabel(requestedPageId), true);
  } else {
    var refreshStatus = document.getElementById("roomUpdateState");
    if (refreshStatus) {
      refreshStatus.innerHTML = "Aktualisiere...";
      refreshStatus.className = "panel-meta";
    }
  }
  apiGet("api/page/" + encodeURIComponent(roomPageState.panelId) + "/" + encodeURIComponent(requestedPageId), function (error, payload) {
    if (requestSerial !== roomPageRequestSerial || requestedPageId !== roomPageState.pageId) {
      return;
    }
    if (error) {
      setRoomLoading(false);
      var status = document.getElementById("roomUpdateState");
      if (status) {
        status.innerHTML = "Fehler beim Laden";
        setRetryStatus(status, true);
      }
      return;
    }
    renderRoomPayload(payload, !shouldClearContent);
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
      option.textContent = floorAreas[a].name;
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
  if (select.value !== selectedRoom) {
    select.value = selectedRoom;
  }
  document.body.setAttribute("data-room", selectedRoom);
  if (typeof refreshRoomNavigation === "function") {
    refreshRoomNavigation(roomPageState.structure, selectedRoom);
  }
  select.onchange = function () {
    roomPageState.pageId = select.value;
    if (typeof setTabletRoom === "function") {
      setTabletRoom(roomPageState.pageId);
    }
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "raum.html?room=" + encodeURIComponent(roomPageState.pageId));
    }
    loadRoomPage();
  };
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

// Background refresh must not replace a range control during a touch gesture.
window.wallpanelControlDragUntil = 0;
function trackRoomRangeGesture(event) {
  if (event.target && event.target.type === "range") { window.wallpanelControlDragUntil = Date.now() + 30000; }
}
document.addEventListener("touchstart", trackRoomRangeGesture, true);
document.addEventListener("mousedown", trackRoomRangeGesture, true);
function finishRoomRangeGesture() { window.wallpanelControlDragUntil = Date.now() + 1200; }
document.addEventListener("touchend", finishRoomRangeGesture, true);
document.addEventListener("touchcancel", finishRoomRangeGesture, true);
document.addEventListener("mouseup", finishRoomRangeGesture, true);

var musicLibraryState = null;
function closeMusicLibrary() {
  var modal = document.getElementById("musicLibraryModal");
  if (modal) { modal.parentNode.removeChild(modal); }
  musicLibraryState = null;
}
function openMusicLibrary(entity) {
  closeMusicLibrary();
  musicLibraryState = { entityId: entity.entityId, offset: 0, query: "", serial: 0 };
  var modal = document.createElement("div");
  modal.id = "musicLibraryModal";
  modal.className = "music-library-backdrop";
  modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-label", "Musik wählen");
  modal.innerHTML = '<section class="modal-card music-library-card"><div class="panel-header"><h2>Musik wählen</h2><button type="button" class="modal-close" aria-label="Schließen" onclick="closeMusicLibrary()">×</button></div><p id="musicLibraryTarget"></p><form id="musicLibrarySearch"><input id="musicLibraryQuery" class="assist-input" maxlength="200" placeholder="Playlist suchen" aria-label="Playlist suchen"><button type="submit" class="pill-button">Suchen</button></form><div id="musicLibraryItems"></div><div class="music-library-pages"><button id="musicLibraryPrevious" class="pill-button" type="button">Zurück</button><button id="musicLibraryNext" class="pill-button" type="button">Weiter</button></div></section>';
  modal.onclick = function (event) { if (event.target === modal) { closeMusicLibrary(); } };
  document.body.appendChild(modal);
  document.getElementById("musicLibraryTarget").textContent = "Wiedergabe auf " + (entity.name || entity.entityId);
  document.getElementById("musicLibrarySearch").onsubmit = function (event) {
    event.preventDefault(); musicLibraryState.offset = 0;
    musicLibraryState.query = document.getElementById("musicLibraryQuery").value; loadMusicLibrary();
  };
  document.getElementById("musicLibraryPrevious").onclick = function () { musicLibraryState.offset = Math.max(0, musicLibraryState.offset - 20); loadMusicLibrary(); };
  document.getElementById("musicLibraryNext").onclick = function () { musicLibraryState.offset += 20; loadMusicLibrary(); };
  loadMusicLibrary();
}
function loadMusicLibrary() {
  var state = musicLibraryState;
  if (!state) { return; }
  var serial = ++state.serial;
  var mount = document.getElementById("musicLibraryItems");
  mount.textContent = "Playlists werden geladen …";
  document.getElementById("musicLibraryNext").disabled = true;
  document.getElementById("musicLibraryPrevious").disabled = state.offset === 0 || !!state.query;
  apiGet("api/music/" + encodeURIComponent(state.entityId) + "/playlists?q=" + encodeURIComponent(state.query) + "&offset=" + state.offset, function (error, payload) {
    if (musicLibraryState !== state || serial !== state.serial) { return; }
    mount.innerHTML = "";
    if (error) { mount.textContent = "Die Musikbibliothek konnte nicht geladen werden. Music Assistant und Verbindung prüfen."; return; }
    var items = payload.items || [];
    if (!items.length) { mount.textContent = "Keine Playlists gefunden."; }
    for (var i = 0; i < items.length; i++) {
      (function (item) {
        var button = document.createElement("button"); button.type = "button"; button.className = "pill-button music-library-item";
        button.textContent = item.name;
        button.onclick = function () {
          button.disabled = true;
          apiPost("api/music/" + encodeURIComponent(state.entityId) + "/play", { uri: item.uri }, function (playError) {
            if (musicLibraryState !== state) { return; }
            if (playError) { button.disabled = false; window.alert("Playlist konnte nicht gestartet werden."); return; }
            closeMusicLibrary(); setTimeout(loadRoomPage, 1000);
          });
        };
        mount.appendChild(button);
      })(items[i]);
    }
    document.getElementById("musicLibraryNext").disabled = !payload.more;
  });
}
document.addEventListener("keydown", function (event) { if (event.key === "Escape") { closeMusicLibrary(); } });

// HA metadata changes also refresh room names and device/area assignments without a reload.
document.addEventListener("wallpanelstructurechanged", function () {
  roomPageState.structure = window.wallpanelStructure;
  if (roomPageState.lastRenderedPageId !== null) { loadRoomPage(); }
});
