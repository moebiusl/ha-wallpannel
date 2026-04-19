function buildHeader(activePage) {
  function navLink(label, href, key) {
    var activeClass = activePage === key ? "topnav-link active" : "topnav-link";
    return '<a class="' + activeClass + '" href="' + href + '">' + label + '</a>';
  }

  return '' +
    '<header class="topbar">' +
      '<div class="topbar-inner">' +
        '<nav class="topnav topnav-main">' +
          navLink('Home', '/index.html', 'home') +
          navLink('Energie', '/energie.html', 'energie') +
          navLink('Sicherheit', '/sicherheit.html', 'sicherheit') +
          navLink('Hof', '/raum.html', 'raum') +
        '</nav>' +
        '<div class="topnav-options">' +
          '<a class="' + (activePage === 'optionen' ? 'topnav-link topnav-link-icon active' : 'topnav-link topnav-link-icon') + '" href="/optionen.html" aria-label="Optionen" title="Optionen">⚙</a>' +
        '</div>' +
      '</div>' +
    '</header>';
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
  var activeRoom = body.getAttribute('data-room') || 'hof';

  var headerMount = document.getElementById('headerMount');
  var footerMount = document.getElementById('footerMount');

  if (headerMount) {
    headerMount.innerHTML = buildHeader(activePage);
  }

  if (footerMount) {
    footerMount.innerHTML = buildFooter(activeRoom);
  }

  updateClockTime();
  setInterval(updateClockTime, 1000);
}

document.addEventListener('DOMContentLoaded', renderSharedLayout);