function buildHeader(activePage) {
  function navLink(label, href, key) {
    var activeClass = activePage === key ? "topnav-link active" : "topnav-link";
    return '<a class="' + activeClass + '" href="' + href + '">' + label + '</a>';
  }

  return '' +
    '<header class="topbar">' +
      '<div class="topbar-inner">' +
        '<nav class="topnav topnav-main">' +
          navLink('Home', 'index.html', 'home') +
          navLink('Energie', 'energie.html', 'energie') +
          navLink('Sicherheit', 'sicherheit.html', 'sicherheit') +
          navLink('Hof', 'raum.html', 'raum') +
        '</nav>' +
        '<div class="topnav-options">' +
          '<a class="' + (activePage === 'optionen' ? 'topnav-link topnav-link-icon active' : 'topnav-link topnav-link-icon') + '" href="optionen.html" aria-label="Optionen" title="Optionen">⚙</a>' +
        '</div>' +
      '</div>' +
    '</header>';
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

function buildFooter(activeRoom) {
  var rooms = [
    ['Hof', 'hof'],
    ['Küche', 'kueche'],
    ['Wohnzimmer', 'wohnzimmer'],
    ['Bad', 'badezimmer'],
    ['Schlafen', 'schlafzimmer'],
    ['Garage', 'garage'],
    ['Büro', 'buero'],
    ['Garten', 'garten']
  ];
  var links = '';
  var i;

  for (i = 0; i < rooms.length; i++) {
    links += '<a class="' + (activeRoom === rooms[i][1] ? 'room-button active' : 'room-button') + '" href="raum.html?room=' + rooms[i][1] + '">' + rooms[i][0] + '</a>';
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

function renderSharedLayout() {
  var body = document.body;
  var activePage = body.getAttribute('data-page') || 'home';
  var activeRoom = getActiveRoom(body.getAttribute('data-room'));

  var headerMount = document.getElementById('headerMount');
  var footerMount = document.getElementById('footerMount');
  var roomSelect = document.getElementById('roomSelect');

  body.setAttribute('data-room', activeRoom);

  if (headerMount) {
    headerMount.innerHTML = buildHeader(activePage);
  }

  if (footerMount) {
    footerMount.innerHTML = buildFooter(activeRoom);
  }

  if (roomSelect) {
    roomSelect.value = activeRoom;
    roomSelect.onchange = function () {
      window.location.href = 'raum.html?room=' + roomSelect.value;
    };
  }

  updateClockTime();
  setInterval(updateClockTime, 1000);
}

document.addEventListener('DOMContentLoaded', renderSharedLayout);
