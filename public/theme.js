/* Loaded before styles so switching designs does not flash the classic palette. */
function normalizeWallpanelTheme(theme) {
  if(theme==='apartment'){theme='home';}
  return theme === 'home' || theme === 'panel' ? theme : 'classic';
}
function getWallpanelPreviewTheme() {
  try { return window.sessionStorage.getItem('haWallpanel.themePreview') || ''; } catch (_e) { return ''; }
}
function wallpanelUrlWithoutTheme() {
  var parts = window.location.search.replace(/^\?/, '').split('&');
  var retained = [];
  for (var i = 0; i < parts.length; i++) { if (parts[i] && !/^theme=/.test(parts[i])) { retained.push(parts[i]); } }
  return window.location.pathname + (retained.length ? '?' + retained.join('&') : '') + window.location.hash;
}
function endWallpanelPreview() {
  try { window.sessionStorage.removeItem('haWallpanel.themePreview'); } catch (_e) { /* ignore */ }
  window.location.replace(wallpanelUrlWithoutTheme());
}
(function () {
  var theme = 'classic';
  var preview = /[?&]theme=(classic|home)(?:&|$)/.exec(window.location.search);
  try {
    theme = normalizeWallpanelTheme(window.localStorage.getItem('haWallpanel.theme'));
    if (preview) { window.sessionStorage.setItem('haWallpanel.themePreview', preview[1]); }
    if (getWallpanelPreviewTheme()) { theme = normalizeWallpanelTheme(getWallpanelPreviewTheme()); }
  } catch (_e) { if (preview) { theme = preview[1]; } }
  if(theme==='panel'&&!/optionen\.html$/i.test(window.location.pathname)){window.WallpanelDesign.go('panel');return;}
  if(theme==='panel'){theme='classic';}
  if (theme !== 'classic') { document.documentElement.className += ' theme-' + theme; }
  document.addEventListener('DOMContentLoaded', function () {
    if (!getWallpanelPreviewTheme()) { return; }
    var button = document.createElement('button');
    button.className = 'theme-preview-exit';
    button.textContent = 'Design-Vorschau beenden';
    button.onclick = endWallpanelPreview;
    document.body.appendChild(button);
  });
})();
