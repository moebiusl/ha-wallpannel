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

  var rawParts = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  var parts = {};
  for (var i = 0; i < rawParts.length; i++) {
    if (rawParts[i].type !== 'literal') {
      parts[rawParts[i].type] = rawParts[i].value;
    }
  }

  return parts.day + '.' + parts.month + '.' + parts.year + ' ' + parts.hour + ':' + parts.minute + ' Uhr';
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
    headerMount.innerHTML = buildHeader(activePage, tabletRoom, tabletRoom);
    loadSharedStructure(function (error, structure) {
      if (!error && structure) {
        loadPanelConfig(function (_configError, payload) {
          headerMount.innerHTML = buildHeader(activePage, findAreaName(structure, tabletRoom), tabletRoom, getVisiblePagesFromConfig(payload));
          renderRoomsModal(structure);
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

document.addEventListener('DOMContentLoaded', renderSharedLayout);
