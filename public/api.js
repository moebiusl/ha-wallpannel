function apiGet(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          callback(null, JSON.parse(xhr.responseText));
        } catch (error) {
          callback(error);
        }
      } else {
        callback(new Error("HTTP " + xhr.status));
      }
    }
  };
  xhr.send();
}

function apiPost(url, data, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && callback) {
      if (xhr.status >= 200 && xhr.status < 300) {
        callback(null);
      } else {
        callback(new Error("HTTP " + xhr.status));
      }
    }
  };
  xhr.send(JSON.stringify(data || {}));
}

function getPanelId() {
  var key = "haWallpanel.panelId";
  var existing = window.localStorage ? window.localStorage.getItem(key) : "";
  if (existing) {
    return existing;
  }
  if (window.localStorage) {
    window.localStorage.setItem(key, "default");
  }
  return "default";
}

function setPanelId(panelId) {
  if (window.localStorage) {
    window.localStorage.setItem("haWallpanel.panelId", panelId || "default");
  }
}
