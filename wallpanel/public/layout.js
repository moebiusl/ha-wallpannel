if (!Number.isNaN) {
  Number.isNaN = function (value) {
    return typeof value === 'number' && isNaN(value);
  };
}

if (!Number.isFinite) {
  Number.isFinite = function (value) {
    return typeof value === 'number' && isFinite(value);
  };
}

function getTabletRoom() {
  var key = 'haWallpanel.tabletRoom';
  var existing = window.localStorage ? window.localStorage.getItem(key) : '';
  return existing || document.body.getAttribute('data-room') || 'hof';
}

function setTabletRoom(roomId) {
  if (window.localStorage) {
    window.localStorage.setItem('haWallpanel.tabletRoom', roomId || 'hof');
  }
}

function findAreaName(structure, areaId) {
  var areas = structure && structure.areas ? structure.areas : [];
  for (var i = 0; i < areas.length; i++) {
    if (areas[i].area_id === areaId) {
      return areas[i].name || areaId;
    }
  }
  return areaId || 'Raum';
}

function buildHeader(activePage, roomLabel, roomId, visiblePages) {
  function navLink(label, href, key) {
    var activeClass = activePage === key ? "topnav-link active" : "topnav-link";
    return '<a class="' + activeClass + '" href="' + href + '">' + label + '</a>';
  }
  function pageVisible(key) {
    return !visiblePages || visiblePages.indexOf(key) !== -1;
  }

  var roomHref = 'raum.html?room=' + encodeURIComponent(roomId || 'hof');
  var links = '';
  if (pageVisible('raum')) {
    links += navLink(escapeHtml(roomLabel || 'Raum'), roomHref, 'raum');
  }
  if (pageVisible('home')) {
    links += navLink('Home', 'index.html', 'home');
  }
  if (pageVisible('raum')) {
    links += '<a class="topnav-link" href="#" onclick="openRoomsModal(); return false;">Räume</a>';
  }
  if (pageVisible('energie')) {
    links += navLink('Energie', 'energie.html', 'energie');
  }
  if (pageVisible('klima')) {
    links += navLink('Klima', 'klima.html', 'klima');
  }
  if (pageVisible('wetter')) {
    links += navLink('Wetter', 'wetter.html', 'wetter');
  }
  if (pageVisible('sicherheit')) {
    links += navLink('Sicherheit', 'sicherheit.html', 'sicherheit');
  }

  return '' +
    '<header class="topbar">' +
      '<div class="topbar-inner">' +
        '<nav class="topnav topnav-main">' +
          links +
        '</nav>' +
        '<div class="topnav-options">' +
          '<a class="topnav-link topnav-link-icon assist-open-button" href="#" onclick="openAssistModal(); return false;" aria-label="Assist" title="Assist">' + assistMicIcon() + '</a>' +
          '<a class="' + (activePage === 'optionen' ? 'topnav-link topnav-link-icon active' : 'topnav-link topnav-link-icon') + '" href="optionen.html" aria-label="Optionen" title="Optionen">⚙</a>' +
        '</div>' +
      '</div>' +
    '</header>';
}

function ensureRoomsModal() {
  var existing = document.getElementById('roomsModal');
  if (existing) {
    return existing;
  }

  var backdrop = document.createElement('div');
  backdrop.id = 'roomsModalBackdrop';
  backdrop.className = 'rooms-modal-backdrop';
  backdrop.onclick = closeRoomsModal;
  document.body.appendChild(backdrop);

  var modal = document.createElement('div');
  modal.id = 'roomsModal';
  modal.className = 'rooms-modal';
  modal.innerHTML = '' +
    '<div class="rooms-modal-card">' +
      '<div class="rooms-modal-header">' +
        '<div><div class="panel-kicker">Räume</div><div class="rooms-modal-title">Dashboard wählen</div></div>' +
        '<button class="modal-close" type="button" onclick="closeRoomsModal()">×</button>' +
      '</div>' +
      '<div id="roomsModalList" class="rooms-modal-list"></div>' +
    '</div>';
  document.body.appendChild(modal);
  return modal;
}

function renderRoomsModal(structure) {
  ensureRoomsModal();
  var mount = document.getElementById('roomsModalList');
  if (!mount || !structure) { return; }
  var tree = structure.tree || [];
  mount.innerHTML = '';

  for (var f = 0; f < tree.length; f++) {
    var floor = tree[f];
    var areas = floor.areas || [];
    if (areas.length === 0) { continue; }

    var group = document.createElement('section');
    group.className = 'rooms-modal-group';
    var title = document.createElement('div');
    title.className = 'rooms-modal-floor';
    title.textContent = floor.floorName || 'Ohne Etage';
    group.appendChild(title);

    var grid = document.createElement('div');
    grid.className = 'rooms-modal-grid';
    for (var a = 0; a < areas.length; a++) {
      if (!areas[a].areaId) { continue; }
      var link = document.createElement('a');
      link.className = 'rooms-modal-tile';
      link.href = 'raum.html?room=' + encodeURIComponent(areas[a].areaId);
      link.innerHTML = '<span>' + escapeHtml(areas[a].name) + '</span><em>' + (areas[a].entityCount || 0) + ' Entitäten</em>';
      grid.appendChild(link);
    }
    group.appendChild(grid);
    mount.appendChild(group);
  }
}

function openRoomsModal() {
  ensureRoomsModal();
  document.getElementById('roomsModalBackdrop').className = 'rooms-modal-backdrop open';
  document.getElementById('roomsModal').className = 'rooms-modal open';
}

function closeRoomsModal() {
  var backdrop = document.getElementById('roomsModalBackdrop');
  var modal = document.getElementById('roomsModal');
  if (backdrop) { backdrop.className = 'rooms-modal-backdrop'; }
  if (modal) { modal.className = 'rooms-modal'; }
}

// ── Assist ─────────────────────────────────────────────────────────
// iOS 9 erlaubt Webseiten keinen Mikrofonzugriff. Gesprochen wird deshalb über die
// Diktierfunktion der iPad-Tastatur; die Antwort kommt als Text und über den Lautsprecher.
var assistConversationId = null;
var assistBusy = false;
var assistAudio = null;
var ASSIST_SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

function assistMicIcon() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/>' +
    '</svg>';
}

function ensureAssistModal() {
  var existing = document.getElementById('assistModal');
  if (existing) {
    return existing;
  }

  var backdrop = document.createElement('div');
  backdrop.id = 'assistModalBackdrop';
  backdrop.className = 'rooms-modal-backdrop';
  backdrop.onclick = closeAssistModal;
  document.body.appendChild(backdrop);

  var modal = document.createElement('div');
  modal.id = 'assistModal';
  modal.className = 'assist-modal';
  modal.innerHTML = '' +
    '<div class="rooms-modal-card assist-card">' +
      '<div class="rooms-modal-header">' +
        '<div><div class="panel-kicker">Assist</div><div class="rooms-modal-title">Was kann ich tun?</div></div>' +
        '<button class="modal-close" type="button" onclick="closeAssistModal()">×</button>' +
      '</div>' +
      '<div id="assistLog" class="assist-log"><div class="assist-hint">Tippe auf der Tastatur auf 🎤 und sprich, z.&nbsp;B. „Schalte das Licht im Hof an“.</div></div>' +
      '<form id="assistForm" class="assist-form" onsubmit="submitAssist(); return false;">' +
        '<input id="assistInput" class="assist-input" type="text" autocomplete="off" autocorrect="on" placeholder="Frage oder Befehl …">' +
        '<button id="assistSend" class="pill-button pill-button-large active assist-send" type="submit">Senden</button>' +
      '</form>' +
    '</div>';
  document.body.appendChild(modal);
  return modal;
}

function unlockAssistAudio() {
  // iOS spielt Ton nur nach einem Fingertipp ab. Ein einmal per Tipp gestartetes
  // Audio-Element darf danach auch später (nach der HA-Antwort) abspielen.
  if (!assistAudio) {
    assistAudio = document.createElement('audio');
    assistAudio.setAttribute('preload', 'auto');
    document.body.appendChild(assistAudio);
  }
  try {
    assistAudio.src = ASSIST_SILENCE;
    var played = assistAudio.play();
    if (played && played.catch) { played.catch(function () { /* ignore */ }); }
  } catch (_e) { /* ignore */ }
}

function openAssistModal() {
  ensureAssistModal();
  unlockAssistAudio();
  document.getElementById('assistModalBackdrop').className = 'rooms-modal-backdrop open';
  document.getElementById('assistModal').className = 'assist-modal open';
  var input = document.getElementById('assistInput');
  // Fokus direkt im Tipp-Handler, sonst öffnet iOS die Tastatur nicht.
  if (input) { input.focus(); }
}

function closeAssistModal() {
  var backdrop = document.getElementById('assistModalBackdrop');
  var modal = document.getElementById('assistModal');
  var input = document.getElementById('assistInput');
  if (input) { input.blur(); }
  if (backdrop) { backdrop.className = 'rooms-modal-backdrop'; }
  if (modal) { modal.className = 'assist-modal'; }
  if (assistAudio) { try { assistAudio.pause(); } catch (_e) { /* ignore */ } }
  assistConversationId = null;
}

function appendAssistMessage(text, kind) {
  var log = document.getElementById('assistLog');
  if (!log) { return null; }
  var hint = log.getElementsByClassName('assist-hint')[0];
  if (hint) { log.removeChild(hint); }
  var bubble = document.createElement('div');
  bubble.className = 'assist-message assist-message-' + kind;
  bubble.textContent = text;
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
  return bubble;
}

function submitAssist() {
  var input = document.getElementById('assistInput');
  var text = input ? input.value.replace(/^\s+|\s+$/g, '') : '';
  if (!text || assistBusy) { return; }

  unlockAssistAudio();
  assistBusy = true;
  input.value = '';
  appendAssistMessage(text, 'user');
  var pending = appendAssistMessage('…', 'assist');
  var sendButton = document.getElementById('assistSend');
  if (sendButton) { sendButton.disabled = true; }

  var xhr = new XMLHttpRequest();
  xhr.open('POST', 'api/assist', true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) { return; }
    assistBusy = false;
    if (sendButton) { sendButton.disabled = false; }
    var payload = null;
    try { payload = JSON.parse(xhr.responseText); } catch (_e) { payload = null; }

    if (xhr.status !== 200 || !payload || !payload.ok) {
      if (pending) {
        pending.textContent = 'Assist ist gerade nicht erreichbar.';
        pending.className = 'assist-message assist-message-error';
      }
      return;
    }

    assistConversationId = payload.conversationId || null;
    if (pending) { pending.textContent = payload.speech || 'Erledigt.'; }
    if (payload.audioUrl && assistAudio) {
      try {
        assistAudio.src = payload.audioUrl;
        var played = assistAudio.play();
        if (played && played.catch) { played.catch(function () { /* ignore */ }); }
      } catch (_e) { /* ignore */ }
    }
  };
  xhr.send(JSON.stringify({ text: text, conversationId: assistConversationId }));
}

function getActiveRoom(defaultRoom) {
  var query = window.location.search ? window.location.search.substring(1).split('&') : [];
  var i;
  var parts;

  for (i = 0; i < query.length; i++) {
    parts = query[i].split('=');
    if (decodeURIComponent(parts[0] || '') === 'room') {
      return decodeURIComponent((parts[1] || '').replace(/\+/g, ' ')) || defaultRoom || 'hof';
    }
  }

  return defaultRoom || 'hof';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getFallbackRooms() {
  return [
    ['Hof', 'hof'],
    ['Küche', 'kueche'],
    ['Wohnzimmer', 'wohnzimmer'],
    ['Bad', 'badezimmer'],
    ['Schlafen', 'schlafzimmer'],
    ['Garage', 'garage'],
    ['Büro', 'buero'],
    ['Garten', 'garten']
  ];
}

function buildRoomLinksFromAreas(areas, activeRoom) {
  var links = '';
  var i;

  for (i = 0; i < areas.length; i++) {
    links += '<a class="' + (activeRoom === areas[i].area_id ? 'room-button active' : 'room-button') + '" href="raum.html?room=' + encodeURIComponent(areas[i].area_id) + '" title="' + escapeHtml(areas[i].floorName || '') + '">' + escapeHtml(areas[i].name) + '</a>';
  }

  return links;
}

function buildFooter(activeRoom, structure) {
  var fallbackRooms;
  var links = '';
  var i;
  var areas = structure && structure.areas ? structure.areas : [];

  if (areas.length > 0) {
    links = buildRoomLinksFromAreas(areas, activeRoom);
  } else {
    fallbackRooms = getFallbackRooms();
    for (i = 0; i < fallbackRooms.length; i++) {
      links += '<a class="' + (activeRoom === fallbackRooms[i][1] ? 'room-button active' : 'room-button') + '" href="raum.html?room=' + fallbackRooms[i][1] + '">' + fallbackRooms[i][0] + '</a>';
    }
  }

  return '' +
    '<aside class="room-sidebar">' +
      '<div class="sidebar-card">' +
        '<div class="sidebar-title">Räume</div>' +
        '<nav class="room-list">' +
          links +
        '</nav>' +
      '</div>' +
    '</aside>';
}

function loadSharedStructure(callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'api/ha/structure', true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) {
      return;
    }
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        callback(null, JSON.parse(xhr.responseText));
      } catch (error) {
        callback(error);
      }
    } else {
      callback(new Error('HTTP ' + xhr.status));
    }
  };
  xhr.send();
}

function loadPanelConfig(callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'api/panel-config', true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) { return; }
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        callback(null, JSON.parse(xhr.responseText));
      } catch (error) {
        callback(error);
      }
    } else {
      callback(new Error('HTTP ' + xhr.status));
    }
  };
  xhr.send();
}

function getVisiblePagesFromConfig(payload) {
  var config = payload && payload.config ? payload.config : null;
  var panelId = typeof getPanelId === 'function' ? getPanelId() : 'default';
  var panel = config && config.panels ? config.panels[panelId] : null;
  if (!panel && config && config.panels) {
    panel = config.panels.default || null;
  }
  return panel && panel.visiblePages && panel.visiblePages.length ? panel.visiblePages : null;
}

function updateClockTime() {
  var el = document.getElementById('clockTime');
  if (!el) {
    return;
  }

  var now = new Date();
  var h = now.getHours();
  var m = now.getMinutes();
  var s = now.getSeconds();

  if (h < 10) h = '0' + h;
  if (m < 10) m = '0' + m;
  if (s < 10) s = '0' + s;

  el.innerHTML = h + ':' + m + ':' + s;
}

function formatGermanDateTime(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'unavailable';
  }

  var day = date.getDate();
  var month = date.getMonth() + 1;
  var year = date.getFullYear();
  var hour = date.getHours();
  var minute = date.getMinutes();

  if (day < 10) { day = '0' + day; }
  if (month < 10) { month = '0' + month; }
  if (hour < 10) { hour = '0' + hour; }
  if (minute < 10) { minute = '0' + minute; }

  return day + '.' + month + '.' + year + ' ' + hour + ':' + minute + ' Uhr';
}

function renderSharedLayout() {
  var body = document.body;
  var activePage = body.getAttribute('data-page') || 'home';
  var tabletRoom = getTabletRoom();
  var activeRoom = activePage === 'raum' ? getActiveRoom(tabletRoom) : tabletRoom;

  var headerMount = document.getElementById('headerMount');
  var footerMount = document.getElementById('footerMount');
  var roomSelect = document.getElementById('roomSelect');

  body.setAttribute('data-room', activeRoom);

  if (headerMount) {
    headerMount.innerHTML = buildHeader(activePage, activeRoom, activeRoom);
    loadSharedStructure(function (error, structure) {
      if (!error && structure) {
        loadPanelConfig(function (_configError, payload) {
          headerMount.innerHTML = buildHeader(activePage, findAreaName(structure, activeRoom), activeRoom, getVisiblePagesFromConfig(payload));
          renderRoomsModal(structure);
          checkAddonUpdate();
        });
      }
    });
  }

  if (footerMount) {
    footerMount.innerHTML = '';
  }

  if (roomSelect) {
    roomSelect.value = activeRoom;
    roomSelect.onchange = function () {
      window.location.href = 'raum.html?room=' + roomSelect.value;
    };
  }

  updateClockTime();
  setInterval(updateClockTime, 1000);
  setupIdleHomeRedirect();
}

window.refreshRoomNavigation = function (structure, activeRoom) {
  if (structure) { renderRoomsModal(structure); }
};

function setupIdleHomeRedirect() {
  var timeout;
  var events = ['click', 'touchstart', 'mousemove', 'keydown', 'scroll'];

  function resetTimer() {
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      if ((document.body.getAttribute('data-page') || 'home') !== 'home') {
        window.location.href = 'index.html';
      }
    }, 60000);
  }

  for (var i = 0; i < events.length; i++) {
    document.addEventListener(events[i], resetTimer, { passive: true });
  }
  resetTimer();
}

/* ── Add-on Update-Check ─────────────────────────────────────────── */
var _addonInfo = null;

function checkAddonUpdate() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'api/addon-info', true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4 || xhr.status !== 200) { return; }
    try {
      var info = JSON.parse(xhr.responseText);
      _addonInfo = info;
      if (info.update_available) {
        var link = document.querySelector('a[href="optionen.html"]');
        if (link && link.className.indexOf('update-badge') === -1) {
          link.className += ' has-update';
          link.title = 'Update verfügbar: v' + info.version_latest;
        }
      }
    } catch (_e) { /* ignore */ }
  };
  xhr.send();
}

window.getAddonInfo = function () { return _addonInfo; };

/* ── Offline-Banner ──────────────────────────────────────────────── */
function ensureOfflineBanner() {
  var existing = document.getElementById('haOfflineBanner');
  if (existing) { return existing; }
  var banner = document.createElement('div');
  banner.id = 'haOfflineBanner';
  banner.className = 'ha-offline-banner';
  banner.textContent = 'Home Assistant nicht erreichbar';
  document.body.insertBefore(banner, document.body.firstChild);
  return banner;
}

var _haOfflineSince = null;
window.setHaOnlineStatus = function (online) {
  var banner = ensureOfflineBanner();
  if (online) {
    _haOfflineSince = null;
    banner.className = 'ha-offline-banner';
  } else {
    if (!_haOfflineSince) { _haOfflineSince = new Date(); }
    var minAgo = Math.round((new Date() - _haOfflineSince) / 60000);
    banner.textContent = minAgo >= 1
      ? 'Home Assistant nicht erreichbar seit ' + minAgo + ' Minute' + (minAgo !== 1 ? 'n' : '')
      : 'Home Assistant nicht erreichbar';
    banner.className = 'ha-offline-banner is-visible';
  }
};

/* ── Nachtmodus ──────────────────────────────────────────────────── */
function getNightModeSettings() {
  var defaults = { enabled: false, startHour: 22, startMinute: 0, endHour: 7, endMinute: 0, brightness: 15 };
  if (!window.localStorage) { return defaults; }
  try {
    var stored = window.localStorage.getItem('haWallpanel.nightMode');
    return stored ? JSON.parse(stored) : defaults;
  } catch (_e) { return defaults; }
}

function setNightOverlay(opacity) {
  // Halbtransparentes schwarzes Overlay statt filter: brightness() auf body.
  // Der Filter zwingt alte iPads, die komplette Seite bei jeder Änderung neu zu berechnen.
  var overlay = document.getElementById('nightModeOverlay');
  if (opacity <= 0) {
    if (overlay) { overlay.style.display = 'none'; }
    document.body.className = document.body.className.replace(/\bnight-mode-active\b/g, '').replace(/  +/g, ' ').replace(/^ | $/g, '');
    return;
  }
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'nightModeOverlay';
    overlay.className = 'night-mode-overlay';
    document.body.appendChild(overlay);
  }
  overlay.style.opacity = String(opacity);
  overlay.style.display = 'block';
  if (document.body.className.indexOf('night-mode-active') === -1) {
    document.body.className = (document.body.className ? document.body.className + ' ' : '') + 'night-mode-active';
  }
}

function applyNightMode() {
  var settings = getNightModeSettings();
  if (!settings.enabled) {
    setNightOverlay(0);
    return;
  }
  var now = new Date();
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var startMin = settings.startHour * 60 + settings.startMinute;
  var endMin = settings.endHour * 60 + settings.endMinute;
  var isNight = startMin > endMin
    ? (nowMin >= startMin || nowMin < endMin)
    : (nowMin >= startMin && nowMin < endMin);
  var fraction = Math.min(1, Math.max(0.01, (settings.brightness || 15) / 100));
  setNightOverlay(isNight ? 1 - fraction : 0);
}

/* ── Bildschirmschoner ───────────────────────────────────────────── */
// Pro Tablet einstellbar (localStorage). Ein Tipp weckt das Tablet, ohne dass der Tipp
// darunterliegende Buttons auslöst. Solange er läuft, pausiert die Datenabfrage der Startseite.
var SCREENSAVER_ALLOWED_MINUTES = [1, 2, 5, 10];
var screensaverTimer = null;
var screensaverClockTimer = null;
var screensaverLastStore = 0;
window.wallpanelScreensaverActive = false;

function getScreensaverSettings() {
  var settings = { enabled: false, minutes: 5 };
  try {
    var stored = JSON.parse(window.localStorage.getItem('haWallpanel.screensaver') || 'null');
    if (stored) {
      settings.enabled = !!stored.enabled;
      if (SCREENSAVER_ALLOWED_MINUTES.indexOf(stored.minutes) !== -1) { settings.minutes = stored.minutes; }
    }
  } catch (_e) { /* ignore */ }
  return settings;
}

function readLastActivity() {
  try {
    var value = parseInt(window.localStorage.getItem('haWallpanel.lastActivity') || '0', 10);
    return value > 0 ? value : 0;
  } catch (_e) { return 0; }
}

function storeLastActivity(now) {
  // Über Seitenwechsel hinweg merken (z. B. Rücksprung zur Startseite), gedrosselt.
  if (now - screensaverLastStore < 5000) { return; }
  screensaverLastStore = now;
  try { window.localStorage.setItem('haWallpanel.lastActivity', String(now)); } catch (_e) { /* ignore */ }
}

function ensureScreensaver() {
  var existing = document.getElementById('screensaver');
  if (existing) { return existing; }
  var el = document.createElement('div');
  el.id = 'screensaver';
  el.className = 'screensaver';
  el.innerHTML = '<div id="screensaverClock" class="screensaver-clock"><div class="screensaver-time"></div><div class="screensaver-date"></div></div>';
  // touchend + preventDefault: verhindert den nachfolgenden Klick auf das Element darunter.
  el.addEventListener('touchend', function (event) {
    event.preventDefault();
    hideScreensaver();
  }, false);
  el.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    hideScreensaver();
  }, false);
  document.body.appendChild(el);
  return el;
}

function updateScreensaverClock() {
  var clock = document.getElementById('screensaverClock');
  if (!clock) { return; }
  var now = new Date();
  var h = now.getHours();
  var m = now.getMinutes();
  var days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  clock.children[0].textContent = (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
  clock.children[1].textContent = days[now.getDay()] + ', ' + now.getDate() + '. ' + months[now.getMonth()];
}

function showScreensaver() {
  if (window.wallpanelScreensaverActive) { return; }
  if (window.wallpanelPopupOpen) {
    screensaverLastActivity = 0;
    registerScreensaverActivity();
    return;
  }
  // Offene Fenster schließen – v. a. Kamera-Live, damit kein Stream im Hintergrund weiterläuft.
  if (typeof closeModal === 'function') { closeModal(); }
  if (typeof closeAssistModal === 'function') { closeAssistModal(); }
  if (typeof closeRoomsModal === 'function') { closeRoomsModal(); }
  var el = ensureScreensaver();
  window.wallpanelScreensaverActive = true;
  updateScreensaverClock();
  el.style.display = 'block';
  screensaverClockTimer = setInterval(updateScreensaverClock, 60000);
}

function hideScreensaver() {
  var el = document.getElementById('screensaver');
  if (el) { el.style.display = 'none'; }
  if (screensaverClockTimer) {
    clearInterval(screensaverClockTimer);
    screensaverClockTimer = null;
  }
  var wasActive = window.wallpanelScreensaverActive;
  window.wallpanelScreensaverActive = false;
  registerScreensaverActivity();
  if (wasActive && typeof loadDashboard === 'function') { loadDashboard(); }
}

function scheduleScreensaver(delayMs) {
  if (screensaverTimer) { clearTimeout(screensaverTimer); }
  screensaverTimer = null;
  var settings = getScreensaverSettings();
  if (!settings.enabled || document.body.getAttribute('data-page') === 'optionen') { return; }
  screensaverTimer = setTimeout(showScreensaver, Math.max(1000, delayMs));
}

var screensaverLastActivity = 0;

function registerScreensaverActivity() {
  if (window.wallpanelScreensaverActive) { return; }
  // Scrollen feuert sehr oft: höchstens einmal pro Sekunde neu planen.
  var now = new Date().getTime();
  if (now - screensaverLastActivity < 1000) { return; }
  screensaverLastActivity = now;
  storeLastActivity(now);
  scheduleScreensaver(getScreensaverSettings().minutes * 60000);
}

function restartScreensaverTimer() {
  screensaverLastStore = 0;
  screensaverLastActivity = 0;
  registerScreensaverActivity();
}

function setupScreensaver() {
  var settings = getScreensaverSettings();
  var events = ['touchstart', 'click', 'mousemove', 'keydown', 'scroll'];
  for (var i = 0; i < events.length; i++) {
    document.addEventListener(events[i], registerScreensaverActivity, true);
  }
  // Restzeit seit der letzten Bedienung (auch auf einer anderen Seite) berücksichtigen.
  var last = readLastActivity();
  var elapsed = last ? new Date().getTime() - last : 0;
  scheduleScreensaver(settings.minutes * 60000 - elapsed);
}

/* ── Tablet-Verwaltung: Sync, Fernkonfiguration, Mitteilungen, Klingel ── */
// Jedes Wandtablet hat eine eigene Kennung und meldet sich alle paar Sekunden beim Server.
// Darüber kommen zentral gepflegte Einstellungen, Mitteilungen, die Klingel und Update-Hinweise.
var TABLET_SYNC_MS = 3000;
var tabletAssetVersion = null;
var tabletConfigLockUntil = 0;
var tabletSyncBusy = false;
window.wallpanelPopupOpen = false;

function readStoredJson(key) {
  try { return JSON.parse(window.localStorage.getItem(key) || 'null'); } catch (_e) { return null; }
}

function writeStored(key, value) {
  try { window.localStorage.setItem(key, value); } catch (_e) { /* ignore */ }
}

function shouldRegisterAsTablet() {
  // Der Mac zur Verwaltung soll nicht als Tablet auftauchen.
  return !!window.navigator.standalone || /iPad|iPhone|Android/.test(navigator.userAgent || '') ||
    (readStoredJson('haWallpanel.forceTablet') === true);
}

function getTabletId() {
  var id = '';
  try { id = window.localStorage.getItem('haWallpanel.tabletId') || ''; } catch (_e) { id = ''; }
  if (!/^[a-z0-9]{8,40}$/.test(id)) {
    id = '';
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 16; i++) { id += chars.charAt(Math.floor(Math.random() * chars.length)); }
    writeStored('haWallpanel.tabletId', id);
  }
  return id;
}

function getLocalTabletConfig() {
  return {
    room: typeof getTabletRoom === 'function' ? getTabletRoom() : '',
    panelId: typeof getPanelId === 'function' ? getPanelId() : 'default',
    screensaver: getScreensaverSettings(),
    nightMode: getNightModeSettings()
  };
}

/** Am Tablet geänderte Einstellungen an den Server melden (Optionen-Seite). */
function reportTabletConfig(partial) {
  if (!shouldRegisterAsTablet()) { return; }
  tabletConfigLockUntil = new Date().getTime() + 6000;
  var xhr = new XMLHttpRequest();
  xhr.open('POST', 'api/tablet/report', true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify({ id: getTabletId(), config: partial }));
}

function applyTabletConfig(config) {
  if (!config || new Date().getTime() < tabletConfigLockUntil) { return; }
  if (typeof config.name === 'string') { writeStored('haWallpanel.tabletName', config.name); }

  if (config.screensaver && JSON.stringify(config.screensaver) !== JSON.stringify(readStoredJson('haWallpanel.screensaver'))) {
    writeStored('haWallpanel.screensaver', JSON.stringify(config.screensaver));
    restartScreensaverTimer();
  }
  if (config.nightMode && JSON.stringify(config.nightMode) !== JSON.stringify(readStoredJson('haWallpanel.nightMode'))) {
    writeStored('haWallpanel.nightMode', JSON.stringify(config.nightMode));
    applyNightMode();
  }
  if (config.room && typeof getTabletRoom === 'function' && config.room !== getTabletRoom()) {
    setTabletRoom(config.room);
    document.body.setAttribute('data-room', config.room);
    if (typeof renderSharedLayout === 'function') { renderSharedLayout(); }
  }
  if (config.panelId && typeof getPanelId === 'function' && config.panelId !== getPanelId()) {
    // Anderes Anzeigeprofil: Seiten und Navigation neu aufbauen.
    setPanelId(config.panelId);
    if (document.body.getAttribute('data-page') !== 'optionen') { window.location.reload(); }
  }
}

function isTabletIdle(ms) {
  if (window.wallpanelScreensaverActive) { return true; }
  return new Date().getTime() - (screensaverLastActivity || readLastActivity() || 0) > ms;
}

function handleAssetVersion(version) {
  if (!version) { return; }
  if (tabletAssetVersion === null) { tabletAssetVersion = version; return; }
  // Nach einem Add-on-Update neu laden – aber nicht mitten in der Bedienung.
  if (version !== tabletAssetVersion && !window.wallpanelPopupOpen && isTabletIdle(20000)) {
    reloadWallpanel();
  }
}

// ── Töne ──
// In der Rahmenseite (start.html) spielt die dauerhaft entsperrte Rahmenseite den Ton.
// Ohne Rahmen klappt es nur, wenn das Tablet seit dem Laden der Seite berührt wurde.
var wallpanelSoundAudio = null;
var wallpanelSoundUnlocked = false;

function getShellWindow() {
  try {
    if (window.parent && window.parent !== window && window.parent.wallpanelShell) { return window.parent; }
  } catch (_e) { /* ignore */ }
  return null;
}

function playLocalAudio(src) {
  if (!wallpanelSoundAudio) {
    wallpanelSoundAudio = document.createElement('audio');
    wallpanelSoundAudio.setAttribute('preload', 'auto');
    document.body.appendChild(wallpanelSoundAudio);
  }
  try {
    wallpanelSoundAudio.src = src;
    var played = wallpanelSoundAudio.play();
    if (played && played.catch) { played.catch(function () { /* ignore */ }); }
  } catch (_e) { /* ignore */ }
}

function unlockLocalSound() {
  if (wallpanelSoundUnlocked || getShellWindow()) { return; }
  wallpanelSoundUnlocked = true;
  playLocalAudio(ASSIST_SILENCE);
}

function playWallpanelSound(name) {
  if (!name || name === 'none' || !/^[a-z]+$/.test(name)) { return; }
  var shell = getShellWindow();
  if (shell && typeof shell.wallpanelPlaySound === 'function') {
    shell.wallpanelPlaySound(name);
    return;
  }
  playLocalAudio('sounds/' + name + '.mp3');
}

document.addEventListener('touchend', unlockLocalSound, true);
document.addEventListener('click', unlockLocalSound, true);

function runTabletCommand(command) {
  if (!command || !command.type) { return; }
  if (command.type === 'reload') { reloadWallpanel(); return; }
  if (command.type === 'identify') { showTabletIdentify(); return; }
  if (command.type === 'sound') { playWallpanelSound(command.sound); return; }
  if (command.type === 'notify') {
    showTabletNotice(command.title, command.message, command.duration, command.level);
    playWallpanelSound(command.sound);
    return;
  }
  if (command.type === 'doorbell') {
    showDoorbellPopup();
    playWallpanelSound(command.sound);
    return;
  }
  if (command.type === 'doorbell-close') { closeDoorbellPopup(true); }
}

function reloadWallpanel() {
  // In der Rahmenseite alles neu laden, damit auch start.html aktuell ist.
  var shell = getShellWindow();
  if (shell) { shell.location.reload(); } else { window.location.reload(); }
}

function syncTablet() {
  if (tabletSyncBusy || document.hidden) { return; }
  tabletSyncBusy = true;
  var xhr = new XMLHttpRequest();
  xhr.open('POST', 'api/tablet/sync', true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.timeout = 10000;
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) { return; }
    tabletSyncBusy = false;
    if (xhr.status !== 200) { return; }
    var payload = null;
    try { payload = JSON.parse(xhr.responseText); } catch (_e) { return; }
    applyTabletConfig(payload.config);
    var commands = payload.commands || [];
    for (var i = 0; i < commands.length; i++) { runTabletCommand(commands[i]); }
    handleAssetVersion(payload.assetVersion);
  };
  xhr.send(JSON.stringify({
    id: getTabletId(),
    page: document.body.getAttribute('data-page') || '',
    local: getLocalTabletConfig()
  }));
}

function wakeForPopup() {
  if (window.wallpanelScreensaverActive) { hideScreensaver(); }
  if (typeof closeAssistModal === 'function') { closeAssistModal(); }
  if (typeof closeRoomsModal === 'function') { closeRoomsModal(); }
}

// ── Mitteilung ──
var tabletNoticeTimer = null;

function tabletNoticeIcon() {
  return '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2z"/></svg>';
}

function showTabletNotice(title, message, duration, level) {
  wakeForPopup();
  var el = document.getElementById('tabletNotice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tabletNotice';
    el.className = 'tablet-notice';
    el.innerHTML = '<div id="tabletNoticeCard" class="tablet-notice-card">' +
      '<div class="tablet-notice-head">' +
        '<span class="tablet-notice-icon">' + tabletNoticeIcon() + '</span>' +
        '<span id="tabletNoticeKicker" class="tablet-notice-kicker">Mitteilung</span>' +
        '<span id="tabletNoticeTime" class="tablet-notice-time"></span>' +
      '</div>' +
      '<div id="tabletNoticeTitle" class="tablet-notice-title"></div>' +
      '<div id="tabletNoticeMessage" class="tablet-notice-message"></div>' +
      '<button class="tablet-notice-ok" type="button" onclick="hideTabletNotice()">OK</button>' +
      '<div class="tablet-notice-progress"><span id="tabletNoticeProgress"></span></div>' +
      '</div>';
    document.body.appendChild(el);
  }

  // Farbe nach Dringlichkeit (Server leitet sie aus dem Ton ab): Alarm rot, Hinweis/Glocke gelb, sonst türkis.
  if (level !== 'urgent' && level !== 'warning') { level = 'info'; }
  var kickers = { urgent: 'Dringend', warning: 'Hinweis', info: 'Mitteilung' };
  document.getElementById('tabletNoticeCard').className = 'tablet-notice-card is-' + level;
  document.getElementById('tabletNoticeKicker').textContent = kickers[level];

  var now = new Date();
  var minutes = now.getMinutes();
  document.getElementById('tabletNoticeTime').textContent = now.getHours() + ':' + (minutes < 10 ? '0' + minutes : minutes) + ' Uhr';

  // Ohne Titel wird der Text selbst zur Überschrift.
  var titleEl = document.getElementById('tabletNoticeTitle');
  var messageEl = document.getElementById('tabletNoticeMessage');
  titleEl.textContent = title || message || '';
  messageEl.textContent = title ? (message || '') : '';
  messageEl.style.display = title && message ? 'block' : 'none';

  var seconds = Math.max(5, duration || 30);
  var progress = document.getElementById('tabletNoticeProgress');
  progress.style.webkitTransition = 'none';
  progress.style.transition = 'none';
  progress.style.width = '100%';

  el.style.display = 'block';
  el.className = 'tablet-notice';
  // Reflow erzwingen, dann Einblenden und Countdown-Balken starten.
  void el.offsetWidth;
  el.className = 'tablet-notice is-visible';
  progress.style.webkitTransition = 'width ' + seconds + 's linear';
  progress.style.transition = 'width ' + seconds + 's linear';
  progress.style.width = '0%';

  if (tabletNoticeTimer) { clearTimeout(tabletNoticeTimer); }
  tabletNoticeTimer = setTimeout(hideTabletNotice, seconds * 1000);
}

function hideTabletNotice() {
  var el = document.getElementById('tabletNotice');
  if (el) {
    el.style.display = 'none';
    el.className = 'tablet-notice';
  }
  if (tabletNoticeTimer) { clearTimeout(tabletNoticeTimer); tabletNoticeTimer = null; }
}

// ── Identifizieren ──
function showTabletIdentify() {
  wakeForPopup();
  var el = document.getElementById('tabletIdentify');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tabletIdentify';
    el.className = 'tablet-identify';
    el.onclick = function () { el.style.display = 'none'; };
    document.body.appendChild(el);
  }
  var name = '';
  try { name = window.localStorage.getItem('haWallpanel.tabletName') || ''; } catch (_e) { name = ''; }
  el.innerHTML = '<div class="tablet-identify-name">' + escapeHtml(name || 'Tablet ohne Namen') + '</div>' +
    '<div class="tablet-identify-id">' + escapeHtml(getTabletId()) + '</div>';
  el.style.display = 'block';
  setTimeout(function () { el.style.display = 'none'; }, 8000);
}

// ── Klingel-Popup ──
var DOORBELL_AUTO_CLOSE_MS = 3 * 60 * 1000;
var doorbellCloseTimer = null;
var doorbellRefreshTimer = null;

function ensureDoorbellPopup() {
  var existing = document.getElementById('doorbellPopup');
  if (existing) { return existing; }
  var el = document.createElement('div');
  el.id = 'doorbellPopup';
  el.className = 'doorbell-popup';
  el.innerHTML = '<div class="doorbell-card">' +
    '<div class="doorbell-header">' +
      '<div><div class="panel-kicker">Klingel</div><div class="doorbell-title">Es hat geklingelt <span id="doorbellTime"></span></div></div>' +
      '<button class="modal-close" type="button" onclick="closeDoorbellPopup(false, true)">×</button>' +
    '</div>' +
    '<div class="doorbell-stage">' +
      '<img id="doorbellImage" class="doorbell-image" alt="Klingel live">' +
      '<div id="doorbellLoading" class="camera-live-loading" style="display:block"><span class="camera-live-spinner"></span><span class="camera-live-loading-text">Live wird gestartet …</span></div>' +
    '</div>' +
    '<div id="doorbellActions" class="doorbell-actions">' +
      '<button id="doorbellGate" class="doorbell-action doorbell-action-gate" type="button" onclick="doorbellOpenGate()">Hoftor auto öffnen</button>' +
      '<span id="doorbellLights"></span>' +
    '</div>' +
  '</div>';
  // Jede Berührung im Popup verlängert die Anzeige.
  el.addEventListener('touchstart', resetDoorbellCloseTimer, false);
  el.addEventListener('click', resetDoorbellCloseTimer, false);
  document.body.appendChild(el);
  return el;
}

function resetDoorbellCloseTimer() {
  if (doorbellCloseTimer) { clearTimeout(doorbellCloseTimer); }
  doorbellCloseTimer = setTimeout(closeDoorbellPopup, DOORBELL_AUTO_CLOSE_MS);
}

function renderDoorbellLights(lights) {
  var mount = document.getElementById('doorbellLights');
  if (!mount) { return; }
  var html = '';
  for (var i = 0; i < lights.length; i++) {
    var isOn = lights[i].state === 'on';
    html += '<button class="doorbell-action' + (isOn ? ' is-on' : '') + '" type="button" data-entity="' + escapeHtml(lights[i].entityId) + '" onclick="doorbellToggleLight(this)">' +
      escapeHtml(lights[i].name) + '<small>' + (isOn ? 'an' : 'aus') + '</small></button>';
  }
  mount.innerHTML = html;
}

function loadDoorbellInfo(setStream) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'api/doorbell', true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4 || xhr.status !== 200) { return; }
    var info = null;
    try { info = JSON.parse(xhr.responseText); } catch (_e) { return; }
    renderDoorbellLights(info.lights || []);
    if (setStream) {
      var image = document.getElementById('doorbellImage');
      var loading = document.getElementById('doorbellLoading');
      if (image && info.streamUrl) {
        image.onload = function () { if (loading) { loading.style.display = 'none'; } };
        image.onerror = function () { if (loading) { loading.style.display = 'none'; } };
        image.src = info.streamUrl;
      }
    }
  };
  xhr.send();
}

function showDoorbellPopup() {
  wakeForPopup();
  // Kamera-Modal der Startseite schließen, damit nicht zwei Live-Streams laufen.
  if (typeof closeModal === 'function') { closeModal(); }
  var el = ensureDoorbellPopup();
  var now = new Date();
  var m = now.getMinutes();
  document.getElementById('doorbellTime').textContent = '· ' + now.getHours() + ':' + (m < 10 ? '0' + m : m) + ' Uhr';
  var gate = document.getElementById('doorbellGate');
  if (gate) { gate.className = 'doorbell-action doorbell-action-gate'; gate.textContent = 'Hoftor auto öffnen'; }
  var alreadyOpen = window.wallpanelPopupOpen;
  window.wallpanelPopupOpen = true;
  el.style.display = 'block';
  if (!alreadyOpen) {
    document.getElementById('doorbellLoading').style.display = 'block';
    loadDoorbellInfo(true);
  }
  if (doorbellRefreshTimer) { clearInterval(doorbellRefreshTimer); }
  doorbellRefreshTimer = setInterval(function () { loadDoorbellInfo(false); }, 5000);
  resetDoorbellCloseTimer();
}

/**
 * fromRemote: Schließen kam von einem anderen Tablet (nicht weitermelden).
 * byUser: Jemand hat auf diesem Tablet geschlossen – dann auf allen Tablets schließen.
 */
function closeDoorbellPopup(fromRemote, byUser) {
  var el = document.getElementById('doorbellPopup');
  var wasOpen = window.wallpanelPopupOpen;
  if (el) { el.style.display = 'none'; }
  if (byUser && !fromRemote && wasOpen && shouldRegisterAsTablet()) {
    apiPost('api/tablets/doorbell-close', { id: getTabletId() });
  }
  var image = document.getElementById('doorbellImage');
  // src entfernen beendet den Live-Stream (und damit den Eufy-P2P-Stream auf dem Server).
  if (image) { image.onload = null; image.removeAttribute('src'); }
  if (doorbellCloseTimer) { clearTimeout(doorbellCloseTimer); doorbellCloseTimer = null; }
  if (doorbellRefreshTimer) { clearInterval(doorbellRefreshTimer); doorbellRefreshTimer = null; }
  window.wallpanelPopupOpen = false;
  registerScreensaverActivity();
}

function doorbellOpenGate() {
  var gate = document.getElementById('doorbellGate');
  if (!gate || gate.className.indexOf('is-busy') !== -1) { return; }
  gate.className = 'doorbell-action doorbell-action-gate is-busy';
  gate.textContent = 'Tor öffnet …';
  apiPost('api/tor/auto-open', {}, function (error) {
    gate.className = 'doorbell-action doorbell-action-gate' + (error ? ' is-error' : ' is-on');
    gate.textContent = error ? 'Fehler – nochmal tippen' : 'Tor wird geöffnet';
  });
}

function doorbellToggleLight(button) {
  var entityId = button.getAttribute('data-entity');
  if (!entityId) { return; }
  button.className += ' is-busy';
  apiPost('api/entity/' + encodeURIComponent(entityId) + '/toggle', {}, function () {
    setTimeout(function () { loadDoorbellInfo(false); }, 800);
  });
}

function setupTabletSync() {
  if (!shouldRegisterAsTablet()) { return; }
  syncTablet();
  setInterval(syncTablet, TABLET_SYNC_MS);
}

document.addEventListener('DOMContentLoaded', setupTabletSync);
document.addEventListener('DOMContentLoaded', setupScreensaver);
document.addEventListener('DOMContentLoaded', renderSharedLayout);
document.addEventListener('DOMContentLoaded', function () {
  applyNightMode();
  setInterval(applyNightMode, 60000);
});

// iOS-Homescreen-Modus: Auf älteren iOS-Versionen öffnen normale Links Safari.
// Interne Links daher per location.href navigieren, damit die App im Vollbild bleibt.
if (window.navigator.standalone) {
  document.addEventListener('click', function (event) {
    var el = event.target;
    while (el && el.nodeName !== 'A') { el = el.parentNode; }
    if (!el || event.defaultPrevented) { return; }
    var href = el.getAttribute('href');
    if (!href || href.charAt(0) === '#' || el.target === '_blank') { return; }
    if (el.host && el.host !== window.location.host) { return; }
    event.preventDefault();
    window.location.href = el.href;
  }, false);
}
