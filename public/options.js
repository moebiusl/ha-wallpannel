var optionState = {
  structure: null,
  config: null,
  energyData: null,
  panelId: "default",
  pageId: "hof",
  pickerType: "entities"
};

var SETTINGS_UNLOCK_MS = 60000;
var SETTINGS_UNLOCK_KEY = "haWallpanel.settingsUnlockedUntil";

var SPECIAL_CARDS = [
  { id: "weather", name: "Wetter" },
  { id: "datetime", name: "Uhrzeit und Datum" },
  { id: "energy", name: "Energie" },
  { id: "gate", name: "Hoftor" },
  { id: "waste", name: "Abfall" }
];

var STATIC_PAGES = [
  { id: "home", name: "Home" },
  { id: "raum", name: "Raum" },
  { id: "energie", name: "Energie" },
  { id: "sicherheit", name: "Sicherheit" }
];

function unlockSettings() {
  var input = document.getElementById("settingsPin");
  var status = document.getElementById("settingsPinState");
  if (!input || input.value.length !== 4) {
    if (status) { status.innerHTML = "PIN eingeben"; }
    clearSettingsPin();
    return;
  }
  apiPost("api/settings/unlock", { pin: input.value }, function (error) {
    if (error) {
      if (status) { status.innerHTML = "Falscher PIN"; }
      clearSettingsPin();
      return;
    }
    rememberSettingsAccess();
    showSettingsContent();
  });
}

function rememberSettingsAccess() {
  if (window.sessionStorage) {
    window.sessionStorage.setItem(SETTINGS_UNLOCK_KEY, String(Date.now() + SETTINGS_UNLOCK_MS));
  }
}

function refreshSettingsAccessIfUnlocked() {
  if (isSettingsUnlocked()) {
    rememberSettingsAccess();
  }
}

function isSettingsUnlocked() {
  if (!window.sessionStorage) { return false; }
  return Number(window.sessionStorage.getItem(SETTINGS_UNLOCK_KEY) || "0") > Date.now();
}

function showSettingsContent() {
  var lock = document.getElementById("settingsLock");
  var content = document.getElementById("settingsContent");
  rememberSettingsAccess();
  if (lock) { lock.style.display = "none"; }
  if (content) { content.style.display = "block"; }
}

function updateSettingsPinDots() {
  var input = document.getElementById("settingsPin");
  var dots = document.getElementById("settingsPinDots");
  var value = input ? input.value : "";
  var html = "";
  for (var i = 0; i < 4; i++) {
    html += '<span class="' + (i < value.length ? "filled" : "") + '"></span>';
  }
  if (dots) { dots.innerHTML = html; }
}

function pressSettingsPin(value) {
  var input = document.getElementById("settingsPin");
  if (!input || input.value.length >= 4) { return; }
  input.value += value;
  updateSettingsPinDots();
  if (input.value.length === 4) {
    unlockSettings();
  }
}

function clearSettingsPin() {
  var input = document.getElementById("settingsPin");
  if (input) { input.value = ""; }
  updateSettingsPinDots();
}

function backspaceSettingsPin() {
  var input = document.getElementById("settingsPin");
  if (!input) { return; }
  input.value = input.value.slice(0, -1);
  updateSettingsPinDots();
}

function initSettingsLock() {
  var input = document.getElementById("settingsPin");
  if (isSettingsUnlocked()) {
    showSettingsContent();
  }
  if (input) {
    input.onkeydown = function (event) {
      if (event.key === "Enter") {
        unlockSettings();
      }
    };
  }
  updateSettingsPinDots();
  document.addEventListener("click", refreshSettingsAccessIfUnlocked);
  document.addEventListener("touchstart", refreshSettingsAccessIfUnlocked, { passive: true });
}

function hasItem(list, item) {
  return list && list.indexOf(item) !== -1;
}

function toggleArrayValue(list, value, enabled) {
  var index = list.indexOf(value);
  if (enabled && index === -1) {
    list.push(value);
  }
  if (!enabled && index !== -1) {
    list.splice(index, 1);
  }
}

function findAreaById(areaId) {
  var areas = optionState.structure && optionState.structure.areas ? optionState.structure.areas : [];
  for (var i = 0; i < areas.length; i++) {
    if (areas[i].area_id === areaId) {
      return areas[i];
    }
  }
  return null;
}

function checkboxRow(id, label, checked, onchange) {
  var row = document.createElement("label");
  row.className = "settings-check dynamic-check";
  var input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;
  input.onchange = function () { onchange(input.checked); };
  var span = document.createElement("span");
  span.innerHTML = label;
  row.appendChild(input);
  row.appendChild(span);
  return row;
}

function isStaticEntityPage() {
  return optionState.pageId === "energie" || optionState.pageId === "sicherheit";
}

function findEntityById(entityId) {
  var entities = optionState.structure && optionState.structure.entities ? optionState.structure.entities : [];
  for (var i = 0; i < entities.length; i++) {
    if (entities[i].entityId === entityId) {
      return entities[i];
    }
  }
  return null;
}

function metricEntity(metric, fallbackGroup) {
  var existing = metric && metric.id ? findEntityById(metric.id) : null;
  if (existing) { return existing; }
  return {
    entityId: metric.id,
    name: metric.label || metric.id,
    domain: "sensor",
    state: metric.value || "",
    areaId: "",
    areaName: fallbackGroup || "Energie",
    deviceId: "",
    deviceName: "",
    visibleByDefault: true
  };
}

function pushEnergyMetricEntities(list, metrics, groupName) {
  for (var i = 0; i < (metrics || []).length; i++) {
    if (metrics[i] && metrics[i].id) {
      list.push(metricEntity(metrics[i], groupName));
    }
  }
}

function getEnergyOptionEntities() {
  var data = optionState.energyData;
  var list = [];
  if (!data) { return list; }
  pushEnergyMetricEntities(list, [
    data.delta2.battery,
    data.delta2.status,
    data.delta2.totalInPower,
    data.delta2.totalOutPower,
    data.delta2.solarInPower,
    data.delta2.acInPower,
    data.delta2.acOutPower,
    data.delta2.remainingTime,
    data.delta2.batteryTemperature,
    data.delta2.cycles
  ], "Delta2");
  pushEnergyMetricEntities(list, [
    data.powerstream.batteryCharge,
    data.powerstream.status,
    data.powerstream.solarPower,
    data.powerstream.inverterOutputWatts,
    data.powerstream.batteryInputWatts,
    data.powerstream.smartPlugLoads,
    data.powerstream.otherLoads,
    data.powerstream.batteryStatus,
    data.powerstream.batteryTemperature,
    data.powerstream.inverterTemperature
  ], "Powerstream");
  pushEnergyMetricEntities(list, [
    data.grid.power,
    data.grid.feedIn,
    data.grid.consumption,
    data.grid.feedInTotal
  ], "Haus / Netz");
  return list;
}

function isExcludedOptionsSecurityEntity(entity) {
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

function isOptionsSecurityEntity(entity) {
  if (!entity || isExcludedOptionsSecurityEntity(entity)) { return false; }
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
    "problem",
    "lock"
  ].indexOf(entity.deviceClass) !== -1;
}

function getPageEntities() {
  var page = getCurrentPage();
  var entities = optionState.structure && optionState.structure.entities ? optionState.structure.entities : [];
  if (optionState.pageId === "energie") {
    return getEnergyOptionEntities().sort(sortOptionEntities);
  }
  if (optionState.pageId === "sicherheit") {
    return entities.filter(isOptionsSecurityEntity).sort(sortOptionEntities);
  }
  return entities.filter(function (entity) {
    if (page.areaId && entity.areaId !== page.areaId) { return false; }
    return true;
  }).sort(sortOptionEntities);
}

function sortOptionEntities(a, b) {
  return String(a.name || a.entityId).localeCompare(String(b.name || b.entityId), "de");
}

function getPageDevices() {
  var entities = getPageEntities();
  var byId = {};
  var devices = [];
  for (var i = 0; i < entities.length; i++) {
    if (!entities[i].deviceId) { continue; }
    if (!byId[entities[i].deviceId]) {
      byId[entities[i].deviceId] = {
        id: entities[i].deviceId,
        name: entities[i].deviceName || entities[i].deviceId,
        detail: entities[i].areaName || "",
        count: 0
      };
      devices.push(byId[entities[i].deviceId]);
    }
    byId[entities[i].deviceId].count++;
  }
  return devices.sort(function (a, b) {
    return String(a.name).localeCompare(String(b.name), "de");
  });
}

function getCurrentPanel() {
  if (!optionState.config.panels[optionState.panelId]) {
    optionState.config.panels[optionState.panelId] = {
      name: optionState.panelId,
      defaultPage: optionState.pageId,
      visiblePages: ["home", "raum", "energie", "sicherheit"],
      pages: {}
    };
  }
  return optionState.config.panels[optionState.panelId];
}

function getCurrentPage() {
  var panel = getCurrentPanel();
  if (!panel.pages[optionState.pageId]) {
    var area = findAreaById(optionState.pageId);
    panel.pages[optionState.pageId] = {
      id: optionState.pageId,
      title: area ? area.name : optionState.pageId,
      areaId: area ? area.area_id : "",
      enabledCards: [],
      enabledDevices: [],
      enabledEntities: [],
      hiddenEntities: []
    };
  }
  return panel.pages[optionState.pageId];
}

function fillPanelSelect() {
  var select = document.getElementById("panelSelect");
  if (!select) { return; }
  select.innerHTML = "";
  for (var panelId in optionState.config.panels) {
    var option = document.createElement("option");
    option.value = panelId;
    option.innerHTML = optionState.config.panels[panelId].name || panelId;
    if (panelId === optionState.panelId) { option.selected = true; }
    select.appendChild(option);
  }
  select.onchange = function () {
    optionState.panelId = select.value;
    setPanelId(optionState.panelId);
    renderOptions();
  };
}

function fillTabletRoomSelect() {
  var select = document.getElementById("tabletRoomSelect");
  if (!select || !optionState.structure) { return; }
  select.innerHTML = "";
  var selectedRoom = typeof getTabletRoom === "function" ? getTabletRoom() : "hof";
  var tree = optionState.structure.tree || [];

  for (var floorIndex = 0; floorIndex < tree.length; floorIndex++) {
    var floor = tree[floorIndex];
    var areas = floor.areas || [];
    if (areas.length === 0) { continue; }
    var group = document.createElement("optgroup");
    group.label = floor.floorName || "Ohne Etage";
    for (var areaIndex = 0; areaIndex < areas.length; areaIndex++) {
      if (!areas[areaIndex].areaId) { continue; }
      var option = document.createElement("option");
      option.value = areas[areaIndex].areaId;
      option.innerHTML = areas[areaIndex].name;
      if (areas[areaIndex].areaId === selectedRoom) { option.selected = true; }
      group.appendChild(option);
    }
    if (group.children.length > 0) {
      select.appendChild(group);
    }
  }

  select.onchange = function () {
    if (typeof setTabletRoom === "function") {
      setTabletRoom(select.value);
    }
    document.body.setAttribute("data-room", select.value);
    renderSharedLayout();
  };
}

function fillPageSelect() {
  var select = document.getElementById("pageSelect");
  if (!select) { return; }
  select.innerHTML = "";
  var panel = getCurrentPanel();
  var usedPageIds = {};
  for (var i = 0; i < STATIC_PAGES.length; i++) {
    var page = STATIC_PAGES[i];
    var option = document.createElement("option");
    option.value = page.id === "raum" ? "hof" : page.id;
    option.innerHTML = page.name;
    usedPageIds[option.value] = true;
    if (option.value === optionState.pageId) { option.selected = true; }
    select.appendChild(option);
  }
  var areas = optionState.structure && optionState.structure.areas ? optionState.structure.areas : [];
  if (areas.length > 0) {
    var roomGroup = document.createElement("optgroup");
    roomGroup.label = "Räume aus Home Assistant";
    for (var areaIndex = 0; areaIndex < areas.length; areaIndex++) {
      var area = areas[areaIndex];
      if (usedPageIds[area.area_id]) { continue; }
      var areaOption = document.createElement("option");
      areaOption.value = area.area_id;
      areaOption.innerHTML = area.name;
      usedPageIds[area.area_id] = true;
      if (area.area_id === optionState.pageId) { areaOption.selected = true; }
      roomGroup.appendChild(areaOption);
    }
    if (roomGroup.children.length > 0) {
      select.appendChild(roomGroup);
    }
  }
  for (var customPageId in panel.pages) {
    if (usedPageIds[customPageId]) { continue; }
    var customOption = document.createElement("option");
    customOption.value = customPageId;
    customOption.innerHTML = panel.pages[customPageId].title || customPageId;
    if (customPageId === optionState.pageId) { customOption.selected = true; }
    select.appendChild(customOption);
  }
  select.onchange = function () {
    optionState.pageId = select.value;
    renderOptions();
  };
}

function renderVisiblePages() {
  var mount = document.getElementById("visiblePagesMount");
  if (!mount) { return; }
  mount.innerHTML = "";
  var panel = getCurrentPanel();
  for (var i = 0; i < STATIC_PAGES.length; i++) {
    (function (page) {
      mount.appendChild(checkboxRow(page.id, page.name + " anzeigen", hasItem(panel.visiblePages, page.id), function (checked) {
        toggleArrayValue(panel.visiblePages, page.id, checked);
      }));
    })(STATIC_PAGES[i]);
  }
}

function renderAreaSelect() {
  var select = document.getElementById("areaSelect");
  if (!select) { return; }
  var page = getCurrentPage();
  select.innerHTML = "";
  if (isStaticEntityPage()) {
    var staticOption = document.createElement("option");
    staticOption.value = "";
    staticOption.innerHTML = optionState.pageId === "energie" ? "Energie-Entitäten" : "Sicherheits-Entitäten";
    select.appendChild(staticOption);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  var empty = document.createElement("option");
  empty.value = "";
  empty.innerHTML = "Kein Raum festlegen";
  select.appendChild(empty);
  var tree = optionState.structure.tree || [];
  for (var floorIndex = 0; floorIndex < tree.length; floorIndex++) {
    var floor = tree[floorIndex];
    var areas = floor.areas || [];
    if (areas.length === 0) { continue; }
    var group = document.createElement("optgroup");
    group.label = floor.floorName || "Ohne Etage";
    for (var areaIndex = 0; areaIndex < areas.length; areaIndex++) {
      if (!areas[areaIndex].areaId) { continue; }
      var option = document.createElement("option");
      option.value = areas[areaIndex].areaId;
      option.innerHTML = areas[areaIndex].name;
      if (areas[areaIndex].areaId === page.areaId) { option.selected = true; }
      group.appendChild(option);
    }
    if (group.children.length > 0) {
      select.appendChild(group);
    }
  }
  select.onchange = function () {
    page.areaId = select.value;
    renderDeviceAndEntityLists();
  };
}

function renderCards() {
  var mount = document.getElementById("cardsMount");
  if (!mount) { return; }
  mount.innerHTML = "";
  var page = getCurrentPage();
  page.enabledCards = (page.enabledCards || []).filter(function (cardId, index, list) {
    return ["weather", "datetime", "energy", "gate", "waste"].indexOf(cardId) !== -1 && list.indexOf(cardId) === index;
  }).slice(0, 3);
  for (var i = 0; i < SPECIAL_CARDS.length; i++) {
    (function (card) {
      mount.appendChild(checkboxRow(card.id, card.name, hasItem(page.enabledCards, card.id), function (checked) {
        if (checked && page.enabledCards.length >= 3 && !hasItem(page.enabledCards, card.id)) {
          var status = document.getElementById("settingsSaveState");
          if (status) { status.innerHTML = "Maximal drei Spezialkarten"; }
          renderCards();
          return;
        }
        toggleArrayValue(page.enabledCards, card.id, checked);
        renderCards();
      }));
    })(SPECIAL_CARDS[i]);
  }
}

function renderDeviceAndEntityLists() {
  var deviceMount = document.getElementById("devicesMount");
  var entityMount = document.getElementById("entitiesMount");
  if (!deviceMount || !entityMount) { return; }
  deviceMount.innerHTML = "";
  entityMount.innerHTML = "";
  var page = getCurrentPage();
  var entities = getPageEntities();
  var devices = getPageDevices();
  var shownDevices = 0;
  var shownEntities = 0;

  for (var i = 0; i < devices.length && shownDevices < 8; i++) {
    (function (device) {
      deviceMount.appendChild(checkboxRow(device.id, device.name + " <small>" + device.count + " Entitäten</small>", getDeviceChecked(device.id, page), function (checked) {
        setDeviceVisible(device.id, checked, page);
        renderDeviceAndEntityLists();
      }));
    })(devices[i]);
    shownDevices++;
  }
  if (devices.length === 0) {
    deviceMount.innerHTML = '<div class="settings-empty">Keine Geräte in dieser Auswahl</div>';
  }

  for (var j = 0; j < entities.length && shownEntities < 12; j++) {
    (function (entity) {
      var checked = getEntityChecked(entity, page);
      var label = entity.name + " <small>" + entity.entityId + "</small>";
      entityMount.appendChild(checkboxRow(entity.entityId, label, checked, function (isChecked) {
        setEntityVisible(entity, isChecked, page);
        renderDeviceAndEntityLists();
      }));
    })(entities[j]);
    shownEntities++;
  }
  if (entities.length === 0) {
    entityMount.innerHTML = '<div class="settings-empty">Keine Entitäten in dieser Auswahl</div>';
  }
}

function getEntityChecked(entity, page) {
  if (isStaticEntityPage()) {
    return !hasItem(page.hiddenEntities, entity.entityId);
  }
  return hasItem(page.enabledEntities, entity.entityId) || (!hasItem(page.hiddenEntities, entity.entityId) && entity.visibleByDefault && page.areaId && entity.areaId === page.areaId);
}

function setEntityVisible(entity, isVisible, page) {
  if (isVisible) {
    toggleArrayValue(page.hiddenEntities, entity.entityId, false);
    if (!isStaticEntityPage()) {
      toggleArrayValue(page.enabledEntities, entity.entityId, true);
    } else {
      toggleArrayValue(page.enabledEntities, entity.entityId, false);
    }
  } else {
    toggleArrayValue(page.enabledEntities, entity.entityId, false);
    toggleArrayValue(page.hiddenEntities, entity.entityId, true);
  }
}

function getDeviceEntityIds(deviceId) {
  return getPageEntities().filter(function (entity) {
    return entity.deviceId === deviceId;
  }).map(function (entity) {
    return entity.entityId;
  });
}

function getDeviceChecked(deviceId, page) {
  var ids = getDeviceEntityIds(deviceId);
  if (ids.length === 0) { return false; }
  for (var i = 0; i < ids.length; i++) {
    if (hasItem(page.hiddenEntities, ids[i])) { return false; }
  }
  return isStaticEntityPage() || hasItem(page.enabledDevices, deviceId);
}

function setDeviceVisible(deviceId, isVisible, page) {
  var ids = getDeviceEntityIds(deviceId);
  toggleArrayValue(page.enabledDevices, deviceId, isVisible && !isStaticEntityPage());
  for (var i = 0; i < ids.length; i++) {
    toggleArrayValue(page.hiddenEntities, ids[i], !isVisible);
  }
}

function openOptionsPicker(type) {
  optionState.pickerType = type;
  var title = document.getElementById("optionsPickerTitle");
  var search = document.getElementById("optionsPickerSearch");
  if (title) { title.textContent = type === "devices" ? "Alle Geräte" : "Alle Entitäten"; }
  if (search) { search.value = ""; }
  renderOptionsPickerList();
  document.getElementById("optionsPickerBackdrop").className = "rooms-modal-backdrop open";
  document.getElementById("optionsPickerModal").className = "rooms-modal settings-picker-modal open";
}

function closeOptionsPicker() {
  var backdrop = document.getElementById("optionsPickerBackdrop");
  var modal = document.getElementById("optionsPickerModal");
  if (backdrop) { backdrop.className = "rooms-modal-backdrop"; }
  if (modal) { modal.className = "rooms-modal settings-picker-modal"; }
  renderDeviceAndEntityLists();
}

function renderOptionsPickerList() {
  var mount = document.getElementById("optionsPickerList");
  var search = document.getElementById("optionsPickerSearch");
  var page = getCurrentPage();
  var query = search ? String(search.value || "").toLowerCase() : "";
  var items;
  var i;
  if (!mount) { return; }
  mount.innerHTML = "";

  if (optionState.pickerType === "devices") {
    items = getPageDevices().filter(function (device) {
      return !query || (device.name + " " + device.id).toLowerCase().indexOf(query) !== -1;
    });
    for (i = 0; i < items.length; i++) {
      (function (device) {
        mount.appendChild(checkboxRow(device.id, device.name + " <small>" + device.count + " Entitäten · " + device.id + "</small>", getDeviceChecked(device.id, page), function (checked) {
          setDeviceVisible(device.id, checked, page);
          renderOptionsPickerList();
        }));
      })(items[i]);
    }
  } else {
    items = getPageEntities().filter(function (entity) {
      return !query || ((entity.name || "") + " " + entity.entityId + " " + (entity.domain || "")).toLowerCase().indexOf(query) !== -1;
    });
    for (i = 0; i < items.length; i++) {
      (function (entity) {
        var label = entity.name + " <small>" + entity.entityId + " · " + entity.domain + "</small>";
        mount.appendChild(checkboxRow(entity.entityId, label, getEntityChecked(entity, page), function (isChecked) {
          setEntityVisible(entity, isChecked, page);
          renderOptionsPickerList();
        }));
      })(items[i]);
    }
  }

  if (mount.children.length === 0) {
    mount.innerHTML = '<div class="settings-empty">Nichts gefunden</div>';
  }
}

function renderOptions() {
  fillPanelSelect();
  fillTabletRoomSelect();
  fillPageSelect();
  renderVisiblePages();
  renderAreaSelect();
  renderCards();
  renderDeviceAndEntityLists();
}

function savePanelOptions() {
  apiPost("api/panel-config", optionState.config, function (error) {
    var status = document.getElementById("settingsSaveState");
    if (status) {
      status.innerHTML = error ? "Fehler beim Speichern" : "Gespeichert";
    }
  });
}

function initOptionsPage() {
  optionState.panelId = getPanelId();
  apiGet("api/ha/structure", function (structureError, structure) {
    if (structureError) {
      var err = document.getElementById("settingsSaveState");
      if (err) { err.innerHTML = "HA-Struktur konnte nicht geladen werden"; }
      return;
    }
    optionState.structure = structure;
    apiGet("api/panel-config", function (configError, payload) {
      if (configError) { return; }
      optionState.config = payload.config || { panels: {} };
      apiGet("api/energy", function (_energyError, energyData) {
        optionState.energyData = energyData || null;
        renderOptions();
      });
    });
  });
}

initOptionsPage();
initSettingsLock();
