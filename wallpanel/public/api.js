function apiRequest(method, url, data, callback) {
  var xhr = new XMLHttpRequest();
  var finished = false;
  function finish(error, payload) {
    if (finished) { return; }
    finished = true;
    if (callback) { callback(error, payload); }
  }
  xhr.open(method, url, true);
  xhr.timeout = 30000;
  if (method !== 'GET') {
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-Wallpanel-Admin', '1');
  }
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) { return; }
    if (xhr.status < 200 || xhr.status >= 300) { finish(new Error('HTTP ' + xhr.status)); return; }
    var payload;
    try { payload = xhr.responseText ? JSON.parse(xhr.responseText) : null; }
    catch (error) { finish(error); return; }
    // Run callbacks outside the parse catch: a UI error must not invoke a callback twice.
    finish(null, payload);
  };
  xhr.onerror = function () { finish(new Error('Verbindung unterbrochen')); };
  xhr.ontimeout = function () { finish(new Error('Zeitüberschreitung')); };
  xhr.send(method === 'GET' ? null : JSON.stringify(data || {}));
}
function apiGet(url, callback) { apiRequest('GET', url, null, callback); }
function apiPost(url, data, callback) { apiRequest('POST', url, data, callback); }
function getPanelId() {
  try { return window.localStorage.getItem('haWallpanel.panelId') || 'default'; } catch (_e) { return 'default'; }
}
function setPanelId(panelId) {
  try { window.localStorage.setItem('haWallpanel.panelId', panelId || 'default'); } catch (_e) { /* ignore */ }
}
