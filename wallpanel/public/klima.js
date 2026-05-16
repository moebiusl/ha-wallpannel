var climateEntities = [];
var climateRequestActive = false;
var climatePageConfig = null;

function getClimatePageConfig() {
  var panelId = typeof getPanelId === "function" ? getPanelId() : "default";
  var panel = climatePageConfig && climatePageConfig.panels && climatePageConfig.panels[panelId] ? climatePageConfig.panels[panelId] : null;
  if (!panel && climatePageConfig && climatePageConfig.panels) {
    panel = climatePageConfig.panels.default || null;
  }
  return panel && panel.pages ? panel.pages.klima : null;
}

function isClimateEntityVisible(entity) {
  var page = getClimatePageConfig();
  if (!page || !entity) { return true; }
  if (page.hiddenEntities && page.hiddenEntities.indexOf(entity.entityId) !== -1) { return false; }
  return true;
}

function climateNumberAttribute(entity, key, fallback) {
  var value = entity && entity.attributes ? entity.attributes[key] : null;
  var parsed;
  if (typeof value === "number") { return value; }
  if (typeof value === "string") {
    parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function climateAreaLabel(entity) {
  return entity.areaName && entity.areaName !== "Ohne Raum" ? entity.areaName : "Ohne Raum";
}

function climateStateLabel(entity) {
  if (!entity) { return "unavailable"; }
  if (entity.state === "off") { return "aus"; }
  if (entity.state === "heat") { return "heizen"; }
  if (entity.state === "auto") { return "auto"; }
  return entity.state || "unavailable";
}

function setClimateStatus(text, retry) {
  var el = document.getElementById("climateUpdateState");
  if (!el) { return; }
  el.textContent = text;
  el.className = retry ? "panel-meta climate-update-meta retry-status" : "panel-meta climate-update-meta";
  el.title = retry ? "Zum Neuladen tippen" : "";
  el.onclick = retry ? function () { window.location.reload(); } : null;
}

function callClimate(entityId, service, data, callback) {
  apiPost("api/entity/" + encodeURIComponent(entityId) + "/service", {
    service: service,
    data: data || {}
  }, callback);
}

function setClimateTemperature(entityId, temperature) {
  callClimate(entityId, "set_temperature", { temperature: Number(temperature) }, function () {
    setTimeout(loadClimatePage, 600);
  });
}

function turnOffClimate(entityId) {
  callClimate(entityId, "turn_off", {}, function () {
    setTimeout(loadClimatePage, 600);
  });
}

function runClimateBatch(service, dataFactory) {
  var index = 0;
  function next() {
    if (index >= climateEntities.length) {
      setTimeout(loadClimatePage, 800);
      return;
    }
    var entity = climateEntities[index++];
    callClimate(entity.entityId, service, dataFactory ? dataFactory(entity) : {}, next);
  }
  next();
}

function turnOffAllClimate() {
  if (climateEntities.length === 0) { return; }
  setClimateStatus("Schalte alle aus...", false);
  runClimateBatch("turn_off");
}

function setAllClimateTemperature() {
  var input = document.getElementById("climateBulkTemperature");
  var temperature = input ? Number(input.value) : 20;
  if (!Number.isFinite(temperature) || climateEntities.length === 0) { return; }
  setClimateStatus("Setze alle Heizungen...", false);
  runClimateBatch("set_temperature", function () {
    return { temperature: temperature };
  });
}

function renderClimateCard(entity) {
  var card = document.createElement("article");
  var current = climateNumberAttribute(entity, "current_temperature", null);
  var target = climateNumberAttribute(entity, "temperature", current !== null ? current : 20);
  var min = climateNumberAttribute(entity, "min_temp", 5);
  var max = climateNumberAttribute(entity, "max_temp", 30);
  var step = climateNumberAttribute(entity, "target_temp_step", 0.5);
  var hvacModes = entity.attributes && Array.isArray(entity.attributes.hvac_modes) ? entity.attributes.hvac_modes : [];

  card.className = "climate-overview-card" + (entity.state !== "off" ? " is-active" : "");
  card.innerHTML = '<div class="climate-card-top">' +
    '<div><div class="climate-card-title">' + escapeHtml(entity.name || entity.entityId) + '</div>' +
    '<div class="climate-card-area">' + escapeHtml(climateAreaLabel(entity)) + '</div></div>' +
    '<div class="climate-card-state">' + escapeHtml(climateStateLabel(entity)) + '</div>' +
    '</div>' +
    '<div class="climate-card-values">' +
    '<span><b>' + (target !== null ? target + " °C" : "--") + '</b><em>Soll</em></span>' +
    '<span><b>' + (current !== null ? current + " °C" : "--") + '</b><em>Ist</em></span>' +
    '</div>';

  var controls = document.createElement("div");
  controls.className = "climate-card-controls";

  var minus = document.createElement("button");
  minus.className = "entity-step-button";
  minus.type = "button";
  minus.textContent = "-";
  minus.onclick = function () {
    setClimateTemperature(entity.entityId, Math.max(min, Number(target) - Number(step)));
  };
  controls.appendChild(minus);

  var slider = document.createElement("input");
  slider.className = "entity-range";
  slider.type = "range";
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(target);
  slider.onchange = function () {
    setClimateTemperature(entity.entityId, Number(slider.value));
  };
  controls.appendChild(slider);

  var plus = document.createElement("button");
  plus.className = "entity-step-button";
  plus.type = "button";
  plus.textContent = "+";
  plus.onclick = function () {
    setClimateTemperature(entity.entityId, Math.min(max, Number(target) + Number(step)));
  };
  controls.appendChild(plus);

  var actions = document.createElement("div");
  actions.className = "climate-card-actions";
  if (hvacModes.indexOf("heat") !== -1 || entity.state === "off") {
    var heat = document.createElement("button");
    heat.className = "pill-button";
    heat.type = "button";
    heat.textContent = "Heizen";
    heat.onclick = function () {
      callClimate(entity.entityId, "set_hvac_mode", { hvac_mode: "heat" }, function () {
        setTimeout(loadClimatePage, 600);
      });
    };
    actions.appendChild(heat);
  }
  var off = document.createElement("button");
  off.className = "pill-button";
  off.type = "button";
  off.textContent = "Aus";
  off.onclick = function () { turnOffClimate(entity.entityId); };
  actions.appendChild(off);

  card.appendChild(controls);
  card.appendChild(actions);
  return card;
}

function renderClimatePage() {
  var mount = document.getElementById("climateOverview");
  if (!mount) { return; }
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  mount.innerHTML = "";

  if (climateEntities.length === 0) {
    var empty = document.createElement("div");
    empty.className = "home-notification-empty";
    empty.textContent = "Keine Heizungen gefunden";
    mount.appendChild(empty);
    return;
  }

  for (var i = 0; i < climateEntities.length; i++) {
    mount.appendChild(renderClimateCard(climateEntities[i]));
  }

  if (scrollY > 0 && window.requestAnimationFrame) {
    window.requestAnimationFrame(function () {
      window.scrollTo(0, Math.min(scrollY, Math.max(0, document.documentElement.scrollHeight - window.innerHeight)));
    });
  }
}

function loadClimatePage() {
  if (climateRequestActive) { return; }
  climateRequestActive = true;
  apiGet("api/ha/structure", function (error, structure) {
    climateRequestActive = false;
    if (error) {
      setClimateStatus("Fehler beim Laden", true);
      return;
    }
    var entities = structure && structure.entities ? structure.entities : [];
    climateEntities = entities.filter(function (entity) {
      return entity.domain === "climate" && isClimateEntityVisible(entity);
    }).sort(function (a, b) {
      var areaCompare = String(a.areaName || "").localeCompare(String(b.areaName || ""), "de");
      if (areaCompare !== 0) { return areaCompare; }
      return String(a.name || a.entityId).localeCompare(String(b.name || b.entityId), "de");
    });
    renderClimatePage();
    setClimateStatus("Letztes Update: " + formatGermanDateTime(new Date()), false);
  });
}

apiGet("api/panel-config", function (_configError, payload) {
  climatePageConfig = payload && payload.config ? payload.config : null;
  loadClimatePage();
});
setInterval(loadClimatePage, 10000);
