/* Interactive design prototype. ES5 only; no network calls or HA device commands. */
(function () {
  'use strict';
  var paths = {
    announce: '<path d="m3 10 14-6v16L3 14ZM7 15l2 6h4l-2-5M20 8l2-2M20 16l2 2"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
    energy: '<path d="m13 2-8 12h7l-1 8 8-12h-7Z"/>',
    waste: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    home: '<path d="M3 10.5 12 3l9 7.5M5 9v12h5v-7h4v7h5V9"/>',
    rooms: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    scenes: '<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z"/>',
    camera: '<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="4"/><path d="m8 6 2-3h4l2 3"/>',
    weather: '<path d="M6 16a4 4 0 1 1 2-7.5A5 5 0 0 1 18 10a3 3 0 1 1 0 6Z"/><path d="M7 4V2M2 8H0M2 3l2 2M19 19v3M13 19v3M7 19v3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2"/>',
    cloud: '<path d="M6 18a5 5 0 1 1 2.3-9.5A6 6 0 0 1 20 10a4 4 0 0 1-1 8ZM4 22h16"/>',
    moon: '<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/>',
    leaf: '<path d="M20 3c0 11-4 17-11 17a6 6 0 0 1-6-6c0-7 7-11 17-11ZM3 21l12-12"/>',
    light: '<path d="M8 15a7 7 0 1 1 8 0l-1 3H9ZM9 21h6M9 18h6"/>',
    climate: '<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0ZM12 7v10"/><circle cx="12" cy="18" r="1"/>',
    music: '<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="5.5" cy="18" rx="3.5" ry="3"/><ellipse cx="17.5" cy="16" rx="3.5" ry="3"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    motion: '<circle cx="14" cy="4" r="2"/><path d="m7 11 4-4 5 3 4 1M12 8l-2 7-5 6m5-6 5 2 1 5M3 5a10 10 0 0 0 0 12"/>',
    battery: '<rect x="3" y="6" width="17" height="12" rx="2"/><path d="M22 10v4M7 10v4M11 10v4M15 10v4"/>',
    apps: '<g fill="currentColor" stroke="none"><circle cx="5" cy="5" r="1.7"/><circle cx="12" cy="5" r="1.7"/><circle cx="19" cy="5" r="1.7"/><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/><circle cx="5" cy="19" r="1.7"/><circle cx="12" cy="19" r="1.7"/><circle cx="19" cy="19" r="1.7"/></g>',
    sound: '<path d="M3 9h4l5-4v14l-5-4H3Z"/><path d="M16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/>',
    play: '<path d="m8 5 12 7-12 7Z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
    next: '<path d="m5 5 10 7L5 19Z" fill="currentColor" stroke="none"/><path d="M19 5v14" stroke-width="2"/>',
    previous: '<path d="m19 5-10 7 10 7Z" fill="currentColor" stroke="none"/><path d="M5 5v14" stroke-width="2"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    settings: '<path d="M9.78 4.73 L10.30 2.35 L13.70 2.35 L14.22 4.73 L15.57 5.29 L17.62 3.97 L20.03 6.38 L18.71 8.43 L19.27 9.78 L21.65 10.30 L21.65 13.70 L19.27 14.22 L18.71 15.57 L20.03 17.62 L17.62 20.03 L15.57 18.71 L14.22 19.27 L13.70 21.65 L10.30 21.65 L9.78 19.27 L8.43 18.71 L6.38 20.03 L3.97 17.62 L5.29 15.57 L4.73 14.22 L2.35 13.70 L2.35 10.30 L4.73 9.78 L5.29 8.43 L3.97 6.38 L6.38 3.97 L8.43 5.29Z"/><circle cx="12" cy="12" r="3.2"/>',
    shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
    tablet: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 19h2"/>',
    exit: '<path d="M14 3H4v18h10M10 12h12m-5-5 5 5-5 5"/>',
    power: '<path d="M12 2v10M6 5a9 9 0 1 0 12 0"/>',
    drop: '<path d="M12 2S5 11 5 15a7 7 0 0 0 14 0c0-4-7-13-7-13Z"/>'
  };
  function icon(name, cls) { return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[name] || paths.home) + '</svg>'; }
  function esc(value) { return String(value === undefined || value === null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function byId(id) { return document.getElementById(id); }
  function action(name, id) { return ' data-action="' + name + '"' + (id ? ' data-id="' + esc(id) + '"' : ''); }
  function find(list, id) { for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } } return null; }
  function roomVisible(room) { return !/^\s*#/.test(room.name); }
  var model = {
    gateOpen: false,
    livePreviewActive: null,
    rooms: [
      { id: 'living', name: 'Wohnzimmer', temperature: 21.3, target: 22, humidity: 46, socket: false },
      { id: 'kitchen', name: 'Küche', temperature: 20.8, target: 21, humidity: 49, socket: false },
      { id: 'hall', name: 'Flur', temperature: 19.7, target: 20, humidity: 43, socket: false },
      { id: 'bedroom', name: 'Schlafzimmer', temperature: 18.8, target: 19, humidity: 48, socket: false },
      { id: 'technical', name: '#Technik', temperature: 18, target: 18, humidity: 45, socket: false }
    ],
    lights: [
      { id: 'sofa', room: 'living', name: 'Stehlampe', on: true, brightness: 65, color: 'warm', dim: true },
      { id: 'table', room: 'living', name: 'Esstisch', on: true, brightness: 45, color: 'warm', dim: true },
      { id: 'ceiling', room: 'living', name: 'Deckenlicht', on: false, brightness: 80, color: 'warm', dim: false },
      { id: 'counter', room: 'kitchen', name: 'Arbeitsplatte', on: true, brightness: 80, color: 'warm', dim: true },
      { id: 'kitchentable', room: 'kitchen', name: 'Küchentisch', on: false, brightness: 75, color: 'warm', dim: true },
      { id: 'halllight', room: 'hall', name: 'Flurlicht', on: false, brightness: 70, color: 'warm', dim: false },
      { id: 'bedlight', room: 'bedroom', name: 'Nachttisch', on: false, brightness: 35, color: 'warm', dim: true },
      { id: 'techlight', room: 'technical', name: 'Techniklicht', on: true, brightness: 100, color: 'warm', dim: false }
    ],
    players: [
      { id: 'living-player', room: 'living', title: 'Entspannt durch den Tag', subtitle: 'Deine Musik · Wohnzimmer', playing: false, volume: 35 },
      { id: 'kitchen-player', room: 'kitchen', title: 'Lieblingslieder', subtitle: 'Deine Musik · Küche', playing: false, volume: 30 }
    ],
    scenes: [],
    announcements: [],
    cameras: [
      { id: 'driveway', name: 'Einfahrt', state: 'idle', platform: 'camera', drawing: 'driveway', lastMotionMinutes: 2, motion: 'Person erkannt' },
      { id: 'courtyard', name: 'Hof', state: 'idle', platform: 'camera', drawing: 'courtyard', lastMotionMinutes: 12, motion: 'Bewegung erkannt' },
      { id: 'workshop', name: 'Werkstatt', state: 'unavailable', platform: 'camera' },
      { id: 'dwd', name: 'DWD Wetterkarte', state: 'Radar', platform: 'dwd_weather' }
    ],
    tablets: [
      { id: 'this', name: 'Wohnzimmer-iPad', room: 'living', rooms: ['living', 'kitchen'], quickLights: ['sofa', 'table'], online: true, saver: '5', night: true, sounds: false, large: false },
      { id: 'hall-tablet', name: 'Flur-iPad', room: 'hall', rooms: ['hall', 'living'], quickLights: ['halllight', 'sofa'], online: true, saver: '5', night: true, sounds: true, large: false },
      { id: 'kitchen-tablet', name: 'Küchen-iPad', room: 'kitchen', rooms: ['kitchen', 'living'], quickLights: ['counter', 'kitchentable'], online: false, saver: '10', night: false, sounds: true, large: false }
    ]
  };
  var runtime = window.WallpanelRuntime || null;
  if (runtime) { model = runtime.model; }
  var settingsKey = 'haWallpanel.mockup.v3.tablet';
  try { var stored = !runtime && JSON.parse(window.localStorage.getItem(settingsKey) || 'null'); if (stored && typeof stored.name === 'string' && find(model.rooms, stored.room) && roomVisible(find(model.rooms, stored.room))) { model.tablets[0] = stored; model.tablets[0].id = 'this'; model.tablets[0].online = true; } } catch (_error) { /* Storage is optional. */ }
  var state = { view: 'home', roomId: model.tablets[0].room, settingsTab: 'this', toastTimer: null, dialog: null, returnFocus: null, scrolls: {}, activeCameraId: null, cameraPinnedUntil: 0, settingsUnlockedUntil: 0, pin: '', wasteExpanded: false };
  function visibleRooms() { return model.rooms.filter(roomVisible); }
  function currentRoom() { var room = find(model.rooms, state.roomId); return room && roomVisible(room) ? room : null; }
  function roomLights(roomId) { var room = find(model.rooms, roomId); return room && roomVisible(room) ? model.lights.filter(function (light) { return light.room === roomId && !light.unavailable; }) : []; }
  function roomPlayer(roomId) { for (var i = 0; i < model.players.length; i++) { if (model.players[i].room === roomId) { return model.players[i]; } } return null; }
  function visibleCameras() { return model.cameras.filter(function (camera) { return camera.platform !== 'dwd_weather' && camera.platform !== 'dwd_weather_maps' && ['unavailable', 'unknown', 'off'].indexOf(camera.state) === -1; }); }
  function number(value) { return value === null || value === undefined || !isFinite(value) ? '–' : String(Math.round(value * 10) / 10).replace('.', ','); }
  function toast(message) { clearTimeout(state.toastTimer); var node = byId('toast'); node.textContent = message; node.style.display = 'block'; state.toastTimer = setTimeout(function () { node.style.display = 'none'; }, 4000); }
  function lightTile(light) {
    return '<button type="button" class="light-tile home-light-card' + (light.on ? ' is-on' : '') + '"' + action('light',light.id) + ' aria-pressed="' + !!light.on + '" aria-label="' + esc(light.name + (light.on ? ' ausschalten' : ' einschalten')) + '"><span class="light-card-content"><span class="tile-emblem">' + icon('light') + '</span><strong class="light-name">' + esc(light.name) + '</strong></span></button>';
  }
  function climateCard(climate) {
    var id = climate.id, min = climate.min === undefined ? 5 : climate.min, max = climate.max === undefined ? 30 : climate.max, step = climate.step || .5;
    var value = climate.target === undefined || climate.target === null ? min : climate.target;
    var p = window.WallpanelThermostat.point(value, min, max);
    var off = climate.mode === 'off';
    var syncButton = runtime && model.climates.filter(function(c){return c.room === climate.room && c.id !== id;}).length ? '<button type="button" class="button climate-sync"' + action('climate-sync',id) + (climate.unavailable ? ' disabled' : '') + '>Mit anderen synchronisieren</button>' : '';
    var html = '<div class="climate-info"><span class="thermostat-emblem">' + icon('climate') + '</span><div class="climate-copy"><h3>' + esc(climate.name || 'Raumklima') + '</h3><p>' + (climate.unavailable ? 'Nicht erreichbar' : off ? 'Heizung aus' : climate.heating ? 'Heizbetrieb' : 'Bereit') + '</p></div>' + syncButton + '</div><div class="thermostat-controls"><div class="thermostat-dial" data-thermostat="' + esc(id) + '" data-step="' + step + '" role="slider" tabindex="0" aria-label="' + esc(climate.name || 'Heizung') + ' Solltemperatur" aria-valuemin="' + min + '" aria-valuemax="' + max + '" aria-valuenow="' + value + '" aria-disabled="' + !!(climate.unavailable || off) + '"><svg viewBox="0 0 200 130" width="200" height="130" aria-hidden="true"><path class="dial-track" d="M18 110 A82 82 0 0 1 182 110"/><path class="dial-fill" d="M18 110 A82 82 0 0 1 182 110" stroke-dasharray="' + (off ? 0 : p.fraction * 257.61) + ' 258"/><circle class="dial-knob" cx="' + p.x + '" cy="' + p.y + '" r="8"/></svg><div class="dial-reading"><span>Solltemperatur</span><strong class="dial-value">' + (off ? 'Aus' : number(climate.target) + '°') + '</strong><small>Ist ' + number(climate.temperature) + ' °C</small></div><div class="dial-extents"><span>' + min + '°</span><span>' + max + '°</span></div></div><div class="climate-actions"><div class="climate-modes" role="group" aria-label="Betriebsart">';
    var modes = climate.modes || ['off', 'heat'];
    for (var i = 0; i < modes.length; i++) { html += '<button class="button' + (climate.mode === modes[i] ? ' primary' : '') + '" type="button"' + action('climate-mode', id) + ' data-mode="' + esc(modes[i]) + '" aria-pressed="' + (climate.mode === modes[i]) + '"' + (climate.unavailable ? ' disabled' : '') + '>' + esc(({off:'Aus',heat:'Heizen',auto:'Auto',cool:'Kühlen',heat_cool:'Automatik'})[modes[i]] || modes[i]) + '</button>'; }
    // Solltemperatur nur über den Halbkreis; Aus/Heizen stehen untereinander.
    return html + '</div></div></div>';

  }
  function musicCard(player) {
    if (!player) { return '<h2>Musik</h2><p class="card-description">Kein Musikgerät in diesem Raum.</p>'; }
    return '<div class="player-row" data-action="music-details" data-id="' + esc(player.id) + '" data-player="' + esc(player.id) + '"><button type="button" class="album"' + action('music-details', player.id) + ' aria-label="' + esc(player.name || 'Musik') + ' einstellen">' + (player.artwork ? '<img src="' + esc(player.artwork) + '" alt="">' : icon('music')) + '</button><div class="music-title"><small>' + esc(player.name || 'HomePod') + '</small><strong>' + esc(player.title || 'Keine Wiedergabe') + '</strong><small>' + esc(player.unavailable ? 'Nicht erreichbar' : player.subtitle || '') + '</small></div><button type="button" class="icon-button player-play"' + action('music-play', player.id) + ' aria-label="' + (player.playing ? 'Musik pausieren' : 'Musik abspielen') + '"' + (player.unavailable ? ' disabled' : '') + '>' + icon(player.playing ? 'pause' : 'play') + '</button></div><label class="inline-range player-volume"><span>Lautstärke</span><span data-range-value="' + esc(player.id) + '">' + player.volume + ' %</span><input type="range" class="range" min="0" max="100" value="' + player.volume + '" data-volume="' + esc(player.id) + '" aria-label="' + esc(player.name || 'HomePod') + ' Lautstärke"' + (player.unavailable ? ' disabled' : '') + '></label>';
  }
  function shortcut(id, shortName) { var scene = find(model.scenes, id); return '<button type="button" class="scene-shortcut"' + action('scene', id) + '>' + icon(scene.icon) + '<span>' + esc(shortName || scene.name) + '</span>' + icon('arrow', 'shortcut-arrow') + '</button>'; }
  function assignedRooms(tablet) {
    var ids = Array.isArray(tablet.rooms) ? tablet.rooms : [tablet.room];
    return ids.map(function (id) { return find(model.rooms,id); }).filter(function (room) { return room && roomVisible(room); });
  }
  function homeRoomButtons() {
    var rooms=assignedRooms(model.tablets[0]),html='';if(!rooms.length){return '';}
    html='<nav class="assigned-room-buttons" aria-label="Räume dieses Tablets">';
    for(var i=0;i<rooms.length;i++){html+='<button type="button" class="room-shortcut"'+action('open-room',rooms[i].id)+'>'+esc(rooms[i].name)+'</button>';}
    return html+'</nav>';
  }
  function latestCamera(cameras) {
    var latest = null;
    for (var i = 0; i < cameras.length; i++) { if (!latest || cameras[i].lastMotionMinutes < latest.lastMotionMinutes) { latest = cameras[i]; } }
    return latest;
  }
  function motionAge(camera) {
    if (typeof camera.lastMotionMinutes !== 'number') { return 'Kein Ereignis'; }
    return camera.lastMotionMinutes === 0 ? 'Gerade eben' : 'vor ' + camera.lastMotionMinutes + ' Min.';
  }
  function homeCamera() {
    var cameras = visibleCameras();
    var selected = find(cameras, state.activeCameraId);
    if (!selected || Date.now() >= state.cameraPinnedUntil) { selected = latestCamera(cameras); }
    state.activeCameraId = selected ? selected.id : null;
    var html = '<section class="card home-camera" data-render-key="' + esc(JSON.stringify([cameras,state.activeCameraId])) + '"><div class="home-camera-head"><div><span class="home-kicker">KAMERA · LETZTE BEWEGUNG</span><h2 id="homeCameraName">' + esc(selected ? selected.name : 'Keine Kamera erreichbar') + '</h2></div></div>';
    if (!selected) { return html + '<div class="camera-empty">Aktuell ist keine Kamera erreichbar.</div></section>'; }
    html += '<button type="button" class="home-camera-image"' + action('camera', selected.id) + ' aria-label="Kamera ' + esc(selected.name) + ' öffnen">' + (runtime ? runtime.cameraImage(selected, false) : cameraPicture(selected.drawing) + '<span class="image-label">BEISPIELBILD</span>') + '<span class="motion-label">' + esc(selected.motion || 'Letzte Bewegung') + ' · ' + motionAge(selected) + '</span></button><div class="home-camera-footer"><div class="camera-switcher" aria-label="Kamera auswählen">';
    for (var i = 0; i < cameras.length; i++) {
      html += '<button type="button" class="camera-switch' + (selected.id === cameras[i].id ? ' selected' : '') + '"' + action('camera-select', cameras[i].id) + ' aria-pressed="' + (selected.id === cameras[i].id ? 'true' : 'false') + '"><span>' + esc(cameras[i].name) + '</span><small>' + motionAge(cameras[i]) + '</small></button>';
    }
    return html + '</div></div></section>';
  }
  function wasteContents() {
    var list=[{name:'Papiertonne',due:'Morgen',color:'blue'},{name:'Gelbe Tonne',due:'In 4 Tagen',color:'yellow'},{name:'Restmüll',due:'In 6 Tagen',color:'brown'}],shown=state.wasteExpanded?list:list.slice(0,1),html='<span class="waste-content"><span class="home-kicker">ABFALL</span><span class="waste-items'+(state.wasteExpanded?' waste-inline-list':'')+'">';
    for(var i=0;i<shown.length;i++){html+='<span class="waste-item bin-'+shown[i].color+'"><span class="bin-mark">'+icon('waste')+'</span><span class="bin-copy"><strong class="waste-name">'+shown[i].name+'</strong><em class="waste-due">'+shown[i].due+'</em></span></span>';}
    return html+'</span></span>';
  }
  function wasteSummary() {
    return '<button type="button" class="card overview-side waste-summary' + (state.wasteExpanded ? ' is-expanded' : '') + '"' + action('waste') + ' aria-expanded="' + (state.wasteExpanded ? 'true' : 'false') + '" aria-label="' + (state.wasteExpanded ? 'Nächste Abholung anzeigen' : 'Alle Abholungen anzeigen') + '">' + wasteContents() + '</button>';
  }
  function toggleWasteSummary() {
    state.wasteExpanded = !state.wasteExpanded;
    var tile = document.querySelector('.waste-summary');
    if (!tile) { return; }
    tile.className = 'card overview-side waste-summary' + (state.wasteExpanded ? ' is-expanded' : '');
    tile.setAttribute('aria-expanded', state.wasteExpanded ? 'true' : 'false');
    tile.setAttribute('aria-label', state.wasteExpanded ? 'Nächste Abholung anzeigen' : 'Alle Abholungen anzeigen');
    tile.innerHTML = wasteContents();
  }
  function homeView() {
    var tablet = model.tablets[0];
    var html = '<div class="general-home"><div class="general-metrics">';
    html += '<button type="button" class="card overview-metric weather-metric" data-view="weather"><span class="home-kicker">WETTER</span><div class="overview-value">8 °C ' + icon('cloud') + '</div><span class="metric-detail">Wolkig · Kein Regen in Sicht</span></button>';
    html += '<button type="button" class="card overview-metric"' + action('energy') + '><span class="home-kicker">ENERGIE</span><div class="overview-value">420 W ' + icon('energy') + '</div><span class="metric-detail">Solar 680 W · Akku 72 %</span></button>';
    html += '<button type="button" class="card overview-metric gate-metric" data-action="gate-request" aria-label="Torsteuerung öffnen"><div><span class="home-kicker">HOFTOR</span><div class="overview-value">' + (model.gateOpen ? 'Offen' : 'Zu') + '</div><span class="metric-detail">' + (model.gateOpen ? 'Tor ist geöffnet' : 'Tor ist geschlossen') + '</span></div></button></div>';
    html += '<div class="general-main">' + homeCamera() + '<div class="general-side">';
    html += '<div class="home-room-stack">'+wasteSummary()+homeRoomButtons()+'</div>';
    html += '<section class="card overview-side status-summary"><h2 class="home-kicker">STATUS &amp; HINWEISE</h2><div class="notice-list" role="list"><article class="notice-item" role="listitem">'+icon('shield')+'<p>Thermostat Flur · Batterie 12 %</p></article></div></section>';
    return html + '</div></div></div>';
  }
  function missingRoom() { return '<section class="card"><h2>Bitte einen Raum wählen</h2><p class="card-description">Der bisherige Raum wurde entfernt oder ausgeblendet.</p><button type="button" class="button primary"' + action('rooms') + '>Raum auswählen</button></section>'; }
  function roomView() {
    var room = currentRoom(); if (!room) { return missingRoom(); }
    var lights = roomLights(room.id), players = model.players.filter(function (p) { return p.room === room.id; });
    var climates = runtime ? model.climates.filter(function (c) { return c.room === room.id; }) : [room];
    var switches = runtime ? model.switches.filter(function (c) { return c.room === room.id; }) : [{id:room.id,name:'Steckdose',on:room.socket}];
    var scenes = model.scenes.filter(function (c) { return c.room === room.id; });
    var climateSummary = runtime && runtime.roomClimate ? runtime.roomClimate(room.id) : '';
    var boilerCard = runtime && runtime.roomBoiler ? runtime.roomBoiler(room.id) : '';
    var html = scenes.length ? '<div class="room-scenes" aria-label="Szenen für diesen Raum">' : '';
    for (var sc=0;sc<scenes.length;sc++) { html += '<button type="button" class="scene-shortcut"' + action('scene',scenes[sc].id) + '>' + icon('scenes') + '<span>' + esc(scenes[sc].name) + '</span></button>'; }
    if (scenes.length) { html += '</div>'; }
    html += climateSummary + boilerCard;
    if (players.length || lights.length) {
      html += '<div class="room-columns' + (!players.length || !lights.length ? ' single-section' : '') + '">';
      if (players.length) {
        var playingArtwork = '';
        for (var ai=0;ai<players.length;ai++) { if (players[ai].playing && !players[ai].unavailable && players[ai].artwork) { playingArtwork = players[ai].artwork; break; } }
        html += '<section class="card room-music' + (playingArtwork ? ' has-playing-artwork' : '') + '">' + (playingArtwork ? '<span class="music-artwork-background" data-artwork="' + esc(playingArtwork) + '" aria-hidden="true"><img src="' + esc(playingArtwork) + '" alt=""></span>' : '') + '<h2 class="section-label">Musik &amp; HomePods</h2>';
        for (var pi=0;pi<players.length;pi++) { html += '<div class="room-player">' + musicCard(players[pi]) + '</div>'; }
        html += '</section>';
      }
      if (lights.length) {
        html += '<section class="card room-lights"><h2 class="section-label">Licht</h2><div class="device-grid">';
        for (var i=0;i<lights.length;i++) { html += '<div class="device-wrap">' + lightTile(lights[i]) + '</div>'; }
        html += '</div></section>';
      }
      html += '</div>';
    }
    if (climates.length) {
      html += '<h2 class="section-label">Raumklima</h2><div class="room-climates">';
      for (var ci=0;ci<climates.length;ci++) { var c=climates[ci];html += '<section class="card thermostat-card' + (c.mode === 'off' ? ' is-off' : !c.unavailable && (c.mode === 'heat' || c.heating) ? ' is-heating' : '') + '">' + climateCard(c) + '</section>'; }
      html += '</div>';
    }
    if (switches.length) { html += '<h2 class="section-label">Weitere Geräte</h2><div class="room-switches">'; }
    for (var si=0;si<switches.length;si++) { html += '<div class="card switch-card"><button type="button" class="light-toggle"' + action('socket',switches[si].id) + ' aria-pressed="' + !!switches[si].on + '"' + (switches[si].unavailable ? ' disabled' : '') + '>' + icon('power') + '<span class="light-copy">' + esc(switches[si].name) + '<small class="light-state">' + (switches[si].unavailable ? 'Nicht erreichbar' : switches[si].on ? 'An' : 'Aus') + '</small></span><span class="apple-switch"><i></i></span></button></div>'; }
    if (switches.length) { html += '</div>'; }
    return html || '<section class="card"><p class="muted">Keine Geräte für diesen Raum vorhanden.</p></section>';
  }
  function scenesView() { if (!model.scenes.length) { return '<section class="card"><h2>Noch keine Szenen</h2><p class="card-description">Die normalen Schaltflächen funktionieren unabhängig von Szenen. Sobald Szenen in Home Assistant angelegt sind, können sie ergänzt werden.</p></section>'; } var html = '<div class="section-intro"><p class="muted">Ein Fingertipp für die passende Stimmung.</p><span class="pill">Szenen</span></div><div class="scene-grid">'; for (var i = 0; i < model.scenes.length; i++) { var scene = model.scenes[i]; html += '<div class="scene-cell"><button type="button" class="scene-card"' + action('scene', scene.id) + '>' + icon(scene.icon) + '<strong>' + esc(scene.name) + '</strong><small>' + esc(scene.description) + '</small></button></div>'; } return html + '</div>'; }
  function cameraPicture(kind) {
    var common = '<rect width="520" height="300" fill="#718079"/><path d="M0 210 520 160v140H0Z" fill="#9a9e8e"/><path d="M180 300 245 170h80l85 130" fill="#b1afa0"/><path d="M0 260h520M0 280h520" stroke="#929a89" stroke-width="2"/>';
    var building = kind === 'courtyard' ? '<path d="M30 180V85l120-50 115 50v95Z" fill="#b8b4a1"/><path d="M18 88 150 22l130 66" fill="#5e6664"/><rect x="62" y="102" width="50" height="70" fill="#606c69"/><rect x="171" y="102" width="50" height="70" fill="#727e77"/><path d="M340 150h160v80H340Z" fill="#5f7565"/>' : '<path d="M280 150V60h190v90Z" fill="#b4b2a4"/><path d="M265 62 375 12l110 50" fill="#596360"/><rect x="304" y="83" width="52" height="65" fill="#5d706c"/><rect x="388" y="83" width="52" height="65" fill="#5d706c"/><path d="M0 198h210v22H0" fill="#5b6c61"/><path d="M20 168v90m55-96v96m55-101v101m55-106v106" stroke="#455a50" stroke-width="7"/>';
    return '<svg viewBox="0 0 520 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + common + building + '<circle cx="45" cy="88" r="50" fill="#516d59"/><circle cx="494" cy="130" r="54" fill="#4c6856"/><rect width="520" height="300" fill="#182323" opacity=".18"/></svg>';
  }
  function camerasView() { var cameras = visibleCameras(); var html = '<div class="section-intro"><p class="muted">Ein Blick nach draußen.</p><span class="pill">' + cameras.length + ' erreichbar</span></div><div class="camera-grid">'; for (var i = 0; i < cameras.length; i++) { var camera = cameras[i]; html += '<div class="camera-cell"><button type="button" class="camera-card"' + action('camera', camera.id) + ' aria-label="Kamera ' + esc(camera.name) + ' öffnen"><div class="camera-picture">' + (runtime ? runtime.cameraImage(camera,false) : cameraPicture(camera.drawing) + '<span class="image-label">ILLUSTRIERTE VORSCHAU</span>') + '</div><div class="camera-meta"><strong>' + esc(camera.name) + '</strong><small><span class="status-dot"></span>Erreichbar</small></div></button></div>'; } if (!cameras.length) { html += '<p class="empty-state">Momentan ist keine Kamera erreichbar.</p>'; } return html + '</div><p class="info-note">Nicht erreichbare Kameras werden ausgeblendet. Die DWD-Wetterkarte findest du unter Wetter.</p>'; }
  function weatherMap() { return '<svg viewBox="0 0 500 360" aria-label="Schematische Regenkarte mit Beispielwerten"><rect width="500" height="360" fill="#303a3c"/><path d="m0 60 110 10 55-42 90 50 80-20 100 45 65-15M0 260l80-10 80 55 80-35 75 30 90-40 95 5M120 0l15 80-20 85 50 70-5 125M350 0l-25 90 35 90-25 90 20 90" stroke="#46524e" stroke-width="2" fill="none"/><path d="m215 30 58 18 25 44 38 23-12 53 24 44-35 23-16 65-53 21-30-37-44 7-23-52 16-41-22-46 27-45 2-50Z" fill="#45564e" stroke="#768675" stroke-width="2"/><path d="M33 210c20-70 80-95 150-82s65 65 38 90S95 294 52 260Z" fill="#79998e" opacity=".6"/><path d="M47 202c15-35 59-50 96-36s20 48-7 57S46 242 47 202Z" fill="#88b5a1" opacity=".8"/><path d="m290 148-25 12 17 16" stroke="#98b4b4" stroke-width="2" fill="none"/><circle cx="282" cy="176" r="6" fill="#f1d5a8" stroke="#f6eee1" stroke-width="3"/><text x="298" y="181" fill="#e8e5db" font-size="13" font-family="Arial">Zuhause</text><text x="202" y="136" fill="#a0b09f" font-size="11" font-family="Arial">Leipzig</text><text x="245" y="249" fill="#a0b09f" font-size="11" font-family="Arial">Dresden</text></svg>'; }
  function weatherView() { return '<div class="weather-page"><section class="weather-sidebar"><div class="card weather-large"><div class="card-head"><h2>Heute</h2>' + icon('cloud') + '</div><div class="weather-reading"><div><span class="temperature">8°</span><div class="weather-condition">Wolkig</div></div></div><p class="card-description">Kein Regen in Sicht.<br>Am Nachmittag lockert es auf.</p><div class="forecast"><div class="forecast-row"><span>Heute</span>' + icon('cloud') + '<span>5° / 11°</span></div><div class="forecast-row"><span>Morgen</span>' + icon('sun') + '<span>4° / 12°</span></div><div class="forecast-row"><span>Samstag</span>' + icon('weather') + '<span>6° / 10°</span></div></div><p class="info-note">Wind 8 km/h<br>Luftfeuchte 76 %</p></div></section><section class="weather-map-section"><div class="card"><div class="card-head"><h2>Regenkarte</h2><span class="pill">DWD</span></div><p class="card-description">Wetterübersicht für deine Umgebung</p><div class="weather-map">' + weatherMap() + '</div><div class="map-key"><span>Regen</span><span>Schematische Beispielkarte</span></div></div></section></div>'; }
  function optionsForRooms(selected) { var rooms = visibleRooms(); var html = ''; for (var i = 0; i < rooms.length; i++) { html += '<option value="' + esc(rooms[i].id) + '"' + (rooms[i].id === selected ? ' selected' : '') + '>' + esc(rooms[i].name) + '</option>'; } return html; }
  function tabletFields(tablet) {
    var durations = ['1', '2', '5', '10']; var saverOptions = '<option value="0"' + (tablet.saver === '0' ? ' selected' : '') + '>Aus</option>';
    for (var i = 0; i < durations.length; i++) { saverOptions += '<option value="' + durations[i] + '"' + (tablet.saver === durations[i] ? ' selected' : '') + '>Nach ' + durations[i] + (durations[i] === '1' ? ' Minute' : ' Minuten') + '</option>'; }
    var roomChecks = '<div class="field wide"><fieldset class="room-shortcut-fields"><legend>Räume dieses Tablets</legend>';
    var assigned = assignedRooms(tablet);
    var rooms = visibleRooms();
    for (var r = 0; r < rooms.length; r++) { var checked = false; for (var a = 0; a < assigned.length; a++) { if (assigned[a].id === rooms[r].id) { checked = true; } } roomChecks += '<label class="checkbox-line"><input type="checkbox" name="assignedRoom" value="' + esc(rooms[r].id) + '"' + (checked ? ' checked' : '') + '>' + esc(rooms[r].name) + '</label>'; }
    roomChecks += '</fieldset></div>';
    var quickFields = '';
    for (var q = 0; q < 2; q++) {
      var selectedLight = (tablet.quickLights || [])[q] || '';
      var lightOptions = '<option value="">Kein Schnelllicht</option>';
      for (var li = 0; li < model.lights.length; li++) { var lightRoom = find(model.rooms, model.lights[li].room); if (!lightRoom || !roomVisible(lightRoom)) { continue; } lightOptions += '<option value="' + esc(model.lights[li].id) + '"' + (selectedLight === model.lights[li].id ? ' selected' : '') + '>' + esc(lightRoom.name + ' · ' + model.lights[li].name) + '</option>'; }
      quickFields += '<div class="field"><label for="tabletQuick' + q + '">Schnelllicht ' + (q + 1) + '</label><select id="tabletQuick' + q + '">' + lightOptions + '</select></div>';
    }

    var design=tablet.theme || 'panel',designOptions=window.WallpanelDesign?window.WallpanelDesign.options(design):'<option value="panel">Neues Wallpanel</option>';designOptions=designOptions.replace('value="'+design+'"','value="'+design+'" selected');
    return '<div class="form-grid"><div class="field"><label for="tabletTheme">Design</label><select id="tabletTheme">'+designOptions+'</select></div>' + roomChecks + quickFields + '<div class="field"><label for="tabletName">Name des Tablets</label><input id="tabletName" type="text" maxlength="40" value="' + esc(tablet.name) + '"></div><div class="field"><label for="tabletRoom">Hauptraum</label><select id="tabletRoom">' + optionsForRooms(tablet.room) + '</select></div><div class="field"><label for="tabletSaver">Bildschirmschoner</label><select id="tabletSaver">' + saverOptions + '</select></div><div class="field"><label for="tabletSize">Schrift</label><select id="tabletSize"><option value="normal"' + (!tablet.large ? ' selected' : '') + '>Normal</option><option value="large"' + (tablet.large ? ' selected' : '') + '>Größer</option></select></div><div class="field"><label class="checkbox-line"><input id="tabletNight" type="checkbox"' + (tablet.night ? ' checked' : '') + '>Nachts automatisch abdunkeln</label></div><div class="field"><label class="checkbox-line"><input id="tabletSounds" type="checkbox"' + (tablet.sounds ? ' checked' : '') + '>Hinweistöne erlauben</label></div></div>';
  }
  function settingsView() {
    var footer = '<div class="settings-footer"><button type="button" class="button" data-action="reload-fresh">Neu laden ohne Cache</button></div>';
    var html = '<div class="settings-tabs" aria-label="Verwaltungsbereich"><button type="button" class="settings-tab' + (state.settingsTab === 'this' ? ' active' : '') + '"' + action('settings-this') + '>Dieses Tablet</button><button type="button" class="settings-tab' + (state.settingsTab === 'all' ? ' active' : '') + '"' + action('settings-all') + '>Alle Tablets</button></div>';
    if (state.settingsTab === 'this') { return html + '<section class="card settings-card"><h2>Einstellungen für dieses Tablet</h2><p class="card-description">Direkt hier einstellen – dieselben Optionen gibt es auch in der zentralen Verwaltung.</p><form id="tabletSettings" data-tablet-id="this" class="settings-form">' + tabletFields(model.tablets[0]) + '<div class="settings-actions"><button type="submit" class="button primary">Einstellungen speichern</button></div></form><p class="info-note">Diese Vorschau speichert Einstellungen nur in diesem Browser. Ton und Bildschirmschoner werden hier nicht aktiviert.</p></section>' + footer; }
    html += '<section class="card settings-card"><div class="card-head"><h2>Deine Wandtablets</h2><span class="pill">' + model.tablets.length + ' Geräte</span></div><div class="tablet-list">';
    for (var i = 0; i < model.tablets.length; i++) { var tablet = model.tablets[i]; var room = find(model.rooms, tablet.room); html += '<div class="tablet-row">' + icon('tablet', 'tablet-emblem') + '<div class="tablet-name"><strong>' + esc(tablet.name) + '</strong><small>' + esc(room && roomVisible(room) ? room.name : 'Kein sichtbarer Raum') + ' · ' + (tablet.online ? 'Online' : 'Offline') + (tablet.statusText ? ' · ' + esc(tablet.statusText) : '') + '</small></div><button type="button" class="button"' + action('tablet-edit', tablet.id) + '>Bearbeiten</button>' + (runtime ? '<button type="button" class="button"' + action('reload-tablet',tablet.id) + '>iPad neu laden</button>' : '') + '</div>'; }
    return html + '</div><p class="info-note">Beispielgeräte. Die Verwaltung des laufenden Wallpanels bleibt unter /verwaltung erreichbar.</p></section>' + footer;
  }
  var navigation = [ ['home', 'home', 'Übersicht'], ['room', 'rooms', 'Räume'], ['scenes', 'scenes', 'Szenen'], ['cameras', 'camera', 'Kameras'], ['weather', 'weather', 'Wetter'] ];
  function updateClock() { if(document.hidden){return;}var d = new Date(); var pad = function (n) { return n < 10 ? '0' + n : String(n); }; var time=pad(d.getHours())+':'+pad(d.getMinutes()),date=pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear();if(byId('clockTime').textContent!==time){byId('clockTime').textContent=time;}if(byId('clockDate').textContent!==date){byId('clockDate').textContent=date;} }
  var lastContentHTML='',lastContentView='';
  function setMarkup(node,html){if(node && node.getAttribute('data-markup')!==html){node.innerHTML=html;node.setAttribute('data-markup',html);}}
  function retainPart(holder,old,selector,key){var next=holder.querySelector(selector);if(old&&next&&old.getAttribute(key)!==null&&old.getAttribute(key)===next.getAttribute(key)){next.parentNode.replaceChild(old,next);}}
  function appsView(){return '<div id="appsUpdate" class="apps-update"'+(state.updateAvailable?'':' style="display:none"')+'><span><strong>Neue Version verfügbar</strong><small>Das Wallpanel wurde aktualisiert. Neu laden, um sie zu nutzen.</small></span><button type="button" class="button primary" data-action="reload-fresh">Jetzt neu laden</button></div><div class="apps-grid"><button type="button" id="settingsNav" class="apps-tile app-settings" data-action="settings-request" aria-label="Tablet-Einstellungen"><span class="app-tile-content"><span class="apps-emblem">'+icon('settings')+'</span><strong>Einstellungen</strong></span></button><button type="button" class="apps-tile app-inbox" data-action="'+(runtime?'inbox-open':'house-status')+'"><span class="app-tile-content"><span class="apps-emblem">'+icon('shield')+'</span><strong>Posteingang</strong></span></button><button type="button" class="apps-tile app-security" data-view="security"><span class="app-tile-content"><span class="apps-emblem">'+icon('shield')+'</span><strong>Sicherheit</strong></span></button><button type="button" class="apps-tile app-energy" data-view="energy"><span class="app-tile-content"><span class="apps-emblem">'+icon('energy')+'</span><strong>Energie</strong></span></button></div>';}

  function render() {
    var room = currentRoom(); var d = new Date(); var day = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][d.getDay()];
    var month = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][d.getMonth()];
    var title = { home: 'Home', room: room ? room.name : 'Dein Raum', scenes: 'Einfach passend.', cameras: 'Rund ums Haus.', weather: 'Draußen im Blick.', settings: 'Deine Tablets.', apps: 'Apps', security: 'Sicherheit', energy: 'Energie' };
    var eyebrow = { home: day + ', ' + d.getDate() + '. ' + month, room: 'Deine Räume', scenes: 'Szenen', cameras: 'Kameras', weather: 'Wetter', settings: 'Verwaltung' };
    var bodyClass=(model.tablets[0].large ? 'large-type ' : '') + (runtime && runtime.lowPower ? 'legacy-ipad' : '');bodyClass=bodyClass.replace(/^\s+|\s+$/g,'');if(document.body.className!==bodyClass){document.body.className=bodyClass;}
    if(byId('pageTitle').textContent!==title[state.view]){byId('pageTitle').textContent=title[state.view];}if(byId('pageEyebrow').textContent!==eyebrow[state.view]){byId('pageEyebrow').textContent=eyebrow[state.view];}
    setMarkup(byId('roomPicker'),esc(room ? room.name : 'Raum wählen') + icon('down'));
    if(byId('brandIcon')){byId('brandIcon').innerHTML = icon('home');}
    var nav = '<a href="#home" data-view="home" class="nav-item' + (state.view === 'home' ? ' active' : '') + '"' + (state.view === 'home' ? ' aria-current="page"' : '') + '>Home</a>';
    var rooms = assignedRooms(model.tablets[0]);
    for (var i = 0; i < rooms.length; i++) { nav += '<button type="button" class="nav-item' + (state.view === 'room' && state.roomId === rooms[i].id ? ' active' : '') + '"' + action('open-room', rooms[i].id) + (state.view === 'room' && state.roomId === rooms[i].id ? ' aria-current="page"' : '') + '>' + esc(rooms[i].name) + '</button>'; }
    nav += '<button type="button" class="nav-item all-rooms" data-action="rooms">' + icon('rooms') + '<span>Räume</span></button>';
    nav += '<button type="button" id="appsNav" aria-label="Apps" class="nav-item apps-nav' + (state.view === 'apps' ? ' active' : '') + '" data-view="apps">' + icon('apps') + '<span>Apps</span></button>';
    var activeAssigned = false;
    for (var ai = 0; ai < rooms.length; ai++) { if (state.view === 'room' && state.roomId === rooms[ai].id) { activeAssigned = true; } }
    if (state.view === 'room' && !activeAssigned && room) { nav += '<span class="nav-item active current-page" aria-current="page">' + esc(room.name) + '</span>'; }
    if (state.view === 'settings' || state.view === 'cameras' || state.view === 'scenes' || state.view === 'security' || state.view === 'energy') { nav += '<span class="nav-item active current-page" aria-current="page">' + (state.view === 'settings' ? 'Einstellungen' : state.view === 'cameras' ? 'Kameras' : state.view === 'security' ? 'Sicherheit' : state.view === 'energy' ? 'Energie' : 'Szenen') + '</span>'; }
    setMarkup(byId('mainNav'),nav);
    setMarkup(byId('announceIcon'),icon('announce')); setMarkup(byId('assistIcon'),icon('mic'));
    byId('roomPicker').style.display = 'none';
    var views = { home: homeView, room: roomView, scenes: scenesView, cameras: camerasView, weather: weatherView, settings: settingsView, apps: appsView, security:camerasView, energy:function(){return '<section class="card"><h2>Energie</h2><p class="card-description">Live-Energiedaten sind unter /panel/ verfügbar.</p></section>';} };
    var content=byId('content'),html=(runtime && runtime.view(state.view) || views[state.view]());
    content.setAttribute('aria-label',title[state.view]);
    if(html!==lastContentHTML || state.view!==lastContentView){
      var scrollTop=content.scrollTop,oldCamera=content.querySelector('.home-camera'),oldArt=content.querySelector('.music-artwork-background');
      var holder=document.createElement('div');holder.innerHTML=html;
      retainPart(holder,oldCamera,'.home-camera','data-render-key');
      retainPart(holder,oldArt,'.music-artwork-background','data-artwork');
      var pictures=content.querySelectorAll('.security-camera');for(var ci=0;ci<pictures.length;ci++){var fresh=holder.querySelectorAll('.security-camera');for(var cj=0;cj<fresh.length;cj++){if(pictures[ci].getAttribute('data-camera-key')===fresh[cj].getAttribute('data-camera-key')){fresh[cj].parentNode.replaceChild(pictures[ci],fresh[cj]);break;}}}
      while(content.firstChild){content.removeChild(content.firstChild);}
      while(holder.firstChild){content.appendChild(holder.firstChild);}
      content.scrollTop=scrollTop;lastContentHTML=html;lastContentView=state.view;
    }

    if(runtime){runtime.afterRender();}
    updateClock();
  }
  function go(view) { if (view === 'weather') { openWeather(); return; } if (view === 'settings' && Date.now() >= state.settingsUnlockedUntil) { openSettingsPin(); return; } if (['home', 'room', 'scenes', 'cameras', 'weather', 'settings', 'apps', 'security', 'energy'].indexOf(view) === -1) { view = 'home'; } state.scrolls[state.view] = byId('content').scrollTop; state.view = view; render(); byId('content').scrollTop = state.scrolls[view] || 0; try { var route=window.WallpanelNavigation?window.WallpanelNavigation.hash(view,state.roomId):'#'+view;window.history.replaceState(null, '', route);if(runtime){window.sessionStorage.setItem('haWallpanel.panel.location',route);} } catch (_e) { /* no history support needed */ } }
  var modalBackground=null,modalTouch=null;
  function lockModalBackground(){
    if(modalBackground){return;}
    modalBackground=[];var nodes=byId('app').querySelectorAll('#content, #mainNav, .camera-switcher, .notice-list, .assigned-room-buttons');
    for(var i=0;i<nodes.length;i++){modalBackground.push({node:nodes[i],top:nodes[i].scrollTop,left:nodes[i].scrollLeft});}
    byId('app').className+=' is-modal-open';
  }
  function unlockModalBackground(){
    var saved=modalBackground;modalBackground=null;modalTouch=null;
    byId('app').className=byId('app').className.replace(/\s*\bis-modal-open\b/g,'');
    if(saved){for(var i=0;i<saved.length;i++){if(document.documentElement.contains(saved[i].node)){saved[i].node.scrollTop=saved[i].top;saved[i].node.scrollLeft=saved[i].left;}}}
  }
  function modalCanScroll(target,dx,dy){
    var horizontal=Math.abs(dx)>Math.abs(dy),delta=horizontal?dx:dy,node=target;
    while(node&&node!==byId('dialogRoot')){
      if(node.nodeType===1){var style=window.getComputedStyle(node),overflow=horizontal?style.overflowX:style.overflowY,max=horizontal?node.scrollWidth-node.clientWidth:node.scrollHeight-node.clientHeight,position=horizontal?node.scrollLeft:node.scrollTop;
        if(/auto|scroll/.test(overflow)&&max>1&&((delta>0&&position<max-1)||(delta<0&&position>0))){return true;}}
      node=node.parentNode;
    }
    return false;
  }
  function modalDragControl(target){while(target&&target!==byId('dialogRoot')){if(target.getAttribute&&(target.hasAttribute('data-power-fader')||target.hasAttribute('data-thermostat')||target.hasAttribute('data-color-wheel'))){return true;}target=target.parentNode;}return false;}
  function stopModalGesture(event){if(event.cancelable){event.preventDefault();}}
  byId('app').addEventListener('touchmove',function(event){if(state.dialog){stopModalGesture(event);}},false);
  byId('dialogRoot').addEventListener('touchstart',function(event){if(!state.dialog){return;}modalTouch=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;},false);
  byId('dialogRoot').addEventListener('touchmove',function(event){
    if(!state.dialog||event.defaultPrevented){return;}
    if(event.touches.length!==1||!modalTouch){stopModalGesture(event);return;}
    var point=event.touches[0],dx=modalTouch.x-point.clientX,dy=modalTouch.y-point.clientY;modalTouch={x:point.clientX,y:point.clientY};
    if(modalDragControl(event.target)){stopModalGesture(event);return;}
    if(event.target.tagName==='INPUT'&&event.target.type==='range'&&Math.abs(dx)>=Math.abs(dy)){return;}
    if(!modalCanScroll(event.target,dx,dy)){stopModalGesture(event);}
  },false);
  byId('dialogRoot').addEventListener('touchend',function(){modalTouch=null;},false);
  byId('dialogRoot').addEventListener('touchcancel',function(){modalTouch=null;},false);
  byId('dialogRoot').addEventListener('wheel',function(event){if(state.dialog&&!event.defaultPrevented&&!modalCanScroll(event.target,event.deltaX||0,event.deltaY||0)){stopModalGesture(event);}},false);
  function closeDialog(force, reason) {
    if(force!==true && runtime && runtime.canCloseDialog && !runtime.canCloseDialog()){return;}
    var focus=state.returnFocus;
    try { if(runtime){if(runtime.dialogClosed){runtime.dialogClosed(state.dialog,reason || 'user');}runtime.releaseDialog();} }
    finally {
      clearTimeout(holdTimer);holdTimer=null;held=false;holdTarget=null;blockedClick=null;
      model.livePreviewActive=null;byId('dialogRoot').innerHTML='';state.dialog=null;state.returnFocus=null;
      try{if(focus&&document.documentElement.contains(focus)){focus.focus();}}finally{unlockModalBackground();}
    }
  }
  function openDialog(title,content,type,id) {
    if(runtime){runtime.releaseDialog();}model.livePreviewActive=null;
    state.returnFocus=state.dialog?state.returnFocus:document.activeElement;state.dialog={type:type,id:id};lockModalBackground();
    var cls=type==='light'?' dialog-light':type==='energy'?' dialog-energy':type==='gate'?' dialog-gate':type==='camera'||type==='doorbell'?' dialog-camera':type==='weather'?' dialog-weather':type==='pin'?' dialog-pin':type==='tablet'?' dialog-tablet':type==='rooms'?' dialog-rooms':'';
    byId('dialogRoot').innerHTML='<div class="dialog-backdrop'+(type==='camera'||type==='doorbell'?' camera-backdrop':'')+'" data-action="backdrop-close"><section class="dialog'+cls+'" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><div class="dialog-head"><h2 id="dialogTitle">'+esc(title)+'</h2><button class="dialog-close" type="button" data-action="dialog-close" aria-label="Schließen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><div class="dialog-body">'+content+'</div></section></div>';
    var close=byId('dialogRoot').querySelector('.dialog-close');if(close){close.focus();}if(runtime){runtime.afterDialog();}
  }
  function openRooms() { var rooms=visibleRooms(),html='<input id="roomSearch" class="dialog-input room-search" type="search" placeholder="Raum suchen" aria-label="Raum suchen"><div class="room-options">';for(var i=0;i<rooms.length;i++){var selected=rooms[i].id===state.roomId;html+='<div class="room-option-wrap" data-room-name="'+esc(rooms[i].name.toLowerCase())+'"><button type="button" class="room-option'+(selected?' selected':'')+'"'+action('select-room',rooms[i].id)+' aria-pressed="'+selected+'"><span class="room-option-content"><span class="room-option-emblem">'+icon('rooms')+'</span><span class="room-option-copy"><strong>'+esc(rooms[i].name)+'</strong><small>'+roomLights(rooms[i].id).length+' Lampen</small></span><span class="room-option-arrow">'+icon('arrow')+'</span></span></button></div>'; }openDialog('Räume',html+'</div><p id="roomSearchEmpty" class="muted" style="display:none">Kein passender Raum.</p>'+(model.scenes.length?'<button type="button" class="button room-scenes-button" data-action="open-scenes">Szenen</button>':''),'rooms'); }

  function openLight(id) {
    var light = find(model.lights,id); if (!light) { return; }
    var room = find(model.rooms,light.room), value = light.on ? light.brightness : 0;
    var html = '<div class="home-light-details"><strong class="home-power-level" data-power-level>' + (light.unavailable ? 'Nicht erreichbar' : light.dim && light.on ? light.brightness + ' %' : light.on ? 'An' : 'Aus') + '</strong><p class="light-room">' + esc(room && room.name) + '</p>';
    if (light.dim) {
      html += '<div class="home-power-fader' + (light.on ? ' is-on' : '') + '" data-power-fader="' + esc(id) + '" role="slider" tabindex="0" aria-label="' + esc(light.name) + ' Helligkeit" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + value + '" aria-disabled="' + !!light.unavailable + '"><div class="home-fader-fill" style="height:' + value + '%"></div>' + icon('light') + '</div>';
    } else {
      html += '<button type="button" class="home-power-switch' + (light.on ? ' is-on' : '') + '"' + action('light-dialog-toggle',id) + ' aria-label="' + esc(light.name) + ' schalten" aria-pressed="' + !!light.on + '"' + (light.unavailable ? ' disabled' : '') + '><span>' + icon('light') + '</span></button>';
    }
    html += '</div>';
    if(runtime&&runtime.lightControls){html+=runtime.lightControls(id);}else if (light.colorCapable) { html += '<div class="color-swatches">'; var colors=[['warm','Warm','#ebc58f'],['white','Weiß','#e9e4dd'],['blue','Blau','#8eb6c7'],['green','Grün','#a8c6a2']];for(var i=0;i<colors.length;i++){html+='<button type="button" class="color-swatch" style="background:'+colors[i][2]+'"'+action('color',colors[i][0])+'>'+colors[i][1]+'</button>';}html+='</div>'; }
    openDialog(light.name,html,'light',id);
  }
  var playlists = [ ['Entspannt durch den Tag', 'Ruhige Lieblingsmusik'], ['Lieblingslieder', 'Ein bisschen von allem'], ['Klassik am Morgen', 'Ein ruhiger Start'], ['Radio', 'Dein Lieblingssender'] ];
  function playlistButtons(query) { var html = ''; for (var i = 0; i < playlists.length; i++) { if (playlists[i][0].toLowerCase().indexOf((query || '').toLowerCase()) === -1) { continue; } html += '<button type="button" class="playlist"' + action('playlist', String(i)) + '>' + icon('music') + '<span><strong>' + playlists[i][0] + '</strong><small>' + playlists[i][1] + '</small></span></button>'; } return html || '<p>Keine passende Musik gefunden.</p>'; }
  function openMusic(id) {var player=find(model.players,id)||roomPlayer(state.roomId);if(!player){toast('Kein Musikgerät in diesem Raum.');return;}var html='<div class="music-now-playing"><span class="album">'+(player.artwork?'<img src="'+esc(player.artwork)+'" alt="">':icon('music'))+'</span><div class="music-title"><strong id="musicNowTitle">'+esc(player.title || 'Keine Wiedergabe')+'</strong><small id="musicNowSubtitle">'+esc(player.subtitle || player.name || '')+'</small></div></div><div class="transport music-dialog-transport"><button type="button" class="icon-button"'+action('music-previous',player.id)+' aria-label="Vorheriger Titel">'+icon('previous')+'</button><button type="button" class="icon-button music-dialog-play"'+action('music-play',player.id)+' aria-label="'+(player.playing?'Musik pausieren':'Musik abspielen')+'">'+icon(player.playing?'pause':'play')+'</button><button type="button" class="icon-button"'+action('music-next',player.id)+' aria-label="Nächster Titel">'+icon('next')+'</button></div><label class="range-label" for="musicVolume"><span>Lautstärke</span><span id="musicVolumeValue">'+player.volume+' %</span></label><input id="musicVolume" type="range" class="range" min="0" max="100" value="'+player.volume+'"><section class="radio-selection"><h3>Radio</h3><div class="radio-stations"><button type="button" class="radio-station station-ffh" data-action="live-radio" data-id="'+esc(player.id)+'" data-station="ffh"><span class="radio-emblem">FFH</span><strong>HIT RADIO FFH</strong>'+icon('play')+'</button><button type="button" class="radio-station station-rtl" data-action="live-radio" data-id="'+esc(player.id)+'" data-station="rtl"><span class="radio-emblem">RTL</span><strong>HITRADIO RTL</strong>'+icon('play')+'</button></div></section><h3 class="playlist-section-title">Apple Music &amp; Playlists</h3><input id="playlistSearch" class="playlist-search" type="search" maxlength="200" placeholder="Playlist suchen" aria-label="Musik suchen"><p id="musicLibraryStatus" class="muted" role="status"></p><div id="playlistResults" class="playlist-list playlist-grid">'+playlistButtons('')+'</div><button id="playlistMore" class="button" type="button" data-action="music-more" data-id="'+esc(player.id)+'" style="display:none">Weitere Playlists laden</button>';openDialog(player.name || 'HomePod',html,'music',player.id);}

  function runScene(id) { var scene = find(model.scenes, id); if (!scene) { return; } if (id === 'off' || id === 'night' || id === 'away') { for (var i = 0; i < model.lights.length; i++) { var room = find(model.rooms, model.lights[i].room); if (room && roomVisible(room)) { model.lights[i].on = false; } } if (id !== 'off') { for (var p = 0; p < model.players.length; p++) { model.players[p].playing = false; } } } else { var target = id === 'cooking' ? 'kitchen' : 'living'; var lights = roomLights(target); for (var l = 0; l < lights.length; l++) { lights[l].on = true; lights[l].brightness = id === 'cozy' ? 35 : 80; } } render(); toast('„' + scene.name + '“ ausgeführt · Simulation'); }
  function editTablet(id) { var tablet = find(model.tablets, id); if (!tablet) { return; } openDialog(tablet.name, '<form id="tabletSettings" data-tablet-id="' + esc(id) + '">' + tabletFields(tablet) + '<div class="settings-actions"><button type="submit" class="button primary">Speichern</button></div></form><button type="button" class="button"' + action('identify', id) + '>Tablet identifizieren</button>' + (runtime && id !== 'this' ? '<button type="button" class="button tablet-remove"' + action('tablet-remove', id) + '>Tablet entfernen</button>' : '') + '<p class="info-note">Änderungen in dieser Ansicht sind simuliert.</p>', 'tablet', id); }
  function actionNode(target) { while (target && target !== document) { if (target.getAttribute && (target.getAttribute('data-action') || target.getAttribute('data-view'))) { return target; } target = target.parentNode; } return null; }
  function dispatch(name, id, node) {
    if (runtime && runtime.action(name, id, node)) { return; }
    var room = currentRoom(); var player = room && roomPlayer(room.id); var light;
    if (name === 'dialog-close') { closeDialog(); }
    else if (name === 'rooms') { openRooms(); }
    else if (name === 'open-scenes') { closeDialog(); go('scenes'); }
    else if (name === 'open-room') { var targetRoom = find(model.rooms, id); if (targetRoom && roomVisible(targetRoom)) { state.roomId = id; go('room'); } }
    else if (name === 'select-room') { var selected = find(model.rooms, id); if (selected && roomVisible(selected)) { state.roomId = id; closeDialog(); go('room'); byId('content').scrollTop = 0; } }
    else if (name === 'light') { light = find(model.lights, id); if (light) { light.on = !light.on; render(); } }
    else if (name === 'light-details') { openLight(id); }
    else if (name === 'light-dialog-toggle') { light=find(model.lights,id);if(light){light.on=!light.on;openLight(id);render();} }
    else if (name === 'color' && state.dialog) { light = find(model.lights, state.dialog.id); if (light) { light.color = id; light.on = true; var swatches = byId('dialogRoot').querySelectorAll('.color-swatch'); for (var i = 0; i < swatches.length; i++) { swatches[i].className = 'color-swatch' + (swatches[i] === node ? ' selected' : ''); } render(); } }
    else if (name === 'temperature-up' || name === 'temperature-down') { if (room) { room.target = Math.max(5, Math.min(30, room.target + (name === 'temperature-up' ? .5 : -.5))); render(); } }
    else if (name === 'music-play' && player) { player.playing = !player.playing; render(); }
    else if ((name === 'music-next' || name === 'music-previous') && player) { player.title = name === 'music-next' ? 'Lieblingslieder' : 'Entspannt durch den Tag'; render(); toast('Titel gewechselt · Simulation'); }
    else if (name === 'music-library' || name === 'music-details') { openMusic(id); }
    else if (name === 'climate-mode' && room) { room.mode = node.getAttribute('data-mode'); render(); }
    else if (name === 'playlist' && player && playlists[Number(id)]) { player.title = playlists[Number(id)][0]; player.playing = true; closeDialog(); render(); toast('Musik startet in ' + room.name + ' · Simulation'); }
    else if (name === 'scene') { if (['off', 'away', 'night'].indexOf(id) !== -1) { openDialog(find(model.scenes, id).name, '<p>Diese Szene für das ganze Haus ausführen?</p><button type="button" class="button primary"' + action('confirm-scene', id) + '>Szene ausführen</button><button type="button" class="button" data-action="dialog-close">Abbrechen</button>', 'scene', id); } else { runScene(id); } }
    else if (name === 'confirm-scene') { closeDialog(); runScene(id); }
    else if (name === 'socket' && room) { room.socket = !room.socket; render(); toast('Steckdose ' + (room.socket ? 'eingeschaltet' : 'ausgeschaltet') + ' · Simulation'); }
    else if (name === 'camera-select') { if (find(visibleCameras(), id)) { state.activeCameraId = id; state.cameraPinnedUntil = Date.now() + 30000; render(); } }
    else if (name === 'camera-latest') { state.cameraPinnedUntil = 0; render(); }
    else if (name === 'settings-request') { state.settingsTab = 'this'; go('settings'); }
    else if (name === 'announce') { openAnnouncement(); }
    else if (name === 'assist') { openAssist(); }
    else if (name === 'announcement-preset') { byId('announcementText').value = id; }
    else if (name === 'pin-digit') { if (state.pin.length < 4) { state.pin += id; updatePin(); if (state.pin.length === 4) { unlockSettings(); } } }
    else if (name === 'pin-clear') { state.pin = ''; updatePin(); }
    else if (name === 'pin-backspace') { state.pin = state.pin.slice(0, -1); updatePin(); }
    else if (name === 'energy') { openDialog('Energie im Überblick', '<p>Solar: 680 W<br>Hausverbrauch: 420 W<br>Speicher: 72 %</p><p class="info-note">Beispielwerte – dieselbe Übersicht wie bisher, mit ruhigerer Gestaltung.</p>', 'energy'); }
    else if (name === 'waste') { toggleWasteSummary(); }
    else if (name === 'camera') { openCamera(id, 'event'); }
    else if (name === 'camera-mode' && state.dialog && state.dialog.type === 'camera') { openCamera(state.dialog.id, id === 'live' ? 'live' : 'event'); }
    else if (name === 'house-status') { openDialog('Status & Hinweise', '<p>Haustür: geschlossen<br>Fenster: geschlossen</p><div class="notice-warning"><strong>Batterie prüfen</strong><p>Thermostat im Flur: 12 %</p></div><p class="info-note">Dies sind ausschließlich Beispielzustände.</p>', 'status'); }
    else if (name === 'reload-fresh') { reloadWithoutCache(); }
    else if (name === 'notice-demo') { receiveAnnouncement('Essen ist fertig!', 'Küche'); }
    else if (name === 'gate-request') { openDialog('Hoftor öffnen?', '<p>Das Tor würde jetzt eine Öffnungsanforderung erhalten.</p><button type="button" class="button primary" data-action="gate-confirm">Öffnen simulieren</button><button type="button" class="button" data-action="dialog-close">Abbrechen</button>', 'gate'); }
    else if (name === 'gate-confirm') { model.gateOpen = true; closeDialog(); render(); toast('Hoftor geöffnet · Nur Simulation'); }
    else if (name === 'doorbell-demo') { receiveDoorbell(); }
    else if (name === 'settings-this' || name === 'settings-all') { state.settingsTab = name === 'settings-this' ? 'this' : 'all'; render(); }
    else if (name === 'tablet-edit') { editTablet(id); }
    else if (name === 'identify') { toast('„' + find(model.tablets, id).name + '“ würde sich jetzt melden · Simulation'); }
  }
  function openWeather() {
    if (runtime) { runtime.weather(); return; }
    openDialog('Wetter & Regenkarte', weatherView(), 'weather');
  }
  function fullCameraPicture(camera, caption) {
    if (runtime) { return runtime.cameraImage(camera, true, caption); }
    var width = Math.min(900, (window.innerWidth || document.documentElement.clientWidth) - 100);
    var height = Math.max(130, Math.min(width * 300 / 520, (window.innerHeight || document.documentElement.clientHeight) - 300));
    return '<div class="camera-full-image" style="height:' + Math.round(height) + 'px">' + cameraPicture(camera.drawing).replace('xMidYMid slice', 'xMidYMid slice') + '<span class="image-label">' + esc(caption) + '</span></div>';
  }
  function openCamera(id, mode) {
    var camera = find(visibleCameras(), id);
    if (!camera) { return; }
    var live = mode === 'live';
    var html = '<div class="camera-mode-tabs" role="group" aria-label="Kamerabild wählen"><button type="button" class="camera-mode' + (!live ? ' selected' : '') + '"' + action('camera-mode', 'event') + ' aria-pressed="' + (!live ? 'true' : 'false') + '">Event</button><button type="button" class="camera-mode' + (live ? ' selected' : '') + '"' + action('camera-mode', 'live') + ' aria-pressed="' + (live ? 'true' : 'false') + '">Live</button></div>';
    html += fullCameraPicture(camera, live ? 'LIVE · SIMULATION' : 'EVENTBILD · ' + motionAge(camera));
    openDialog(camera.name, html, 'camera', id);
    state.dialog.mode = live ? 'live' : 'event';
    model.livePreviewActive = live ? id : null;
  }
  function receiveAnnouncement(message, sender) {
    openDialog('Durchsage', '<div class="incoming-notice"><span class="incoming-emblem">' + icon('announce') + '</span><p class="incoming-sender">Von ' + esc(sender || 'einem anderen Tablet') + '</p><p class="incoming-message">' + esc(message) + '</p></div><button class="button primary" type="button" data-action="dialog-close">Gelesen</button><p class="info-note">Simulierter Empfang. Kein Ton wird abgespielt.</p>', 'notice');
  }
  function receiveDoorbell() {
    var camera = find(visibleCameras(), 'driveway') || visibleCameras()[0];
    var picture = camera ? fullCameraPicture(camera, 'KLINGEL · BEISPIELBILD') : '<p>Aktuell ist keine Kamera erreichbar.</p>';
    openDialog('Es hat geklingelt.', picture + '<p class="info-note">Jemand steht an der Einfahrt. Diese Klingel ist simuliert und spielt keinen Ton ab.</p><button type="button" class="button primary" data-action="gate-request">Hoftor öffnen</button><button type="button" class="button" data-action="dialog-close">Erledigt</button>', 'doorbell');
  }
  function reloadWithoutCache() {
    var parts = window.location.search.replace(/^\?/, '').split('&');
    var retained = [];
    for (var i = 0; i < parts.length; i++) { if (parts[i] && !/^_reload(?:Job)?=/.test(parts[i])) { retained.push(parts[i]); } }
    retained.push('_reload=' + Date.now());
    var hash = window.WallpanelNavigation?window.WallpanelNavigation.hash(state.view,state.roomId):'#'+state.view;
    window.location.replace(window.location.pathname + '?' + retained.join('&') + hash);
  }
  function openSettingsPin() {
    state.pin = '';
    var html = '<p class="pin-intro">Tablet-Einstellungen direkt hier ändern.</p><div id="pinDots" class="pin-dots" aria-live="polite" aria-label="Keine Ziffer eingegeben">○ ○ ○ ○</div><div class="pin-pad" aria-label="PIN-Zahlenfeld">';
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];
    for (var i = 0; i < keys.length; i++) {
      html += '<button type="button" class="pin-key" data-action="' + (keys[i] === 'C' ? 'pin-clear' : keys[i] === '⌫' ? 'pin-backspace' : 'pin-digit') + '" data-id="' + keys[i] + '" aria-label="' + (keys[i] === 'C' ? 'PIN löschen' : keys[i] === '⌫' ? 'Letzte Ziffer löschen' : keys[i]) + '">' + keys[i] + '</button>';
    }
    html += '</div><p id="pinStatus" class="pin-status" role="status"></p><div class="pin-footer"><button type="button" class="button reload-fresh" data-action="reload-fresh">Neu laden ohne Cache</button>' + (runtime?'<button type="button" class="button reload-all" data-action="reload-all">Alle iPads neu laden</button>':'') + '</div>' + (runtime ? '' : '<p class="info-note">Vorschau-PIN: <strong>1310</strong></p>');
    openDialog('Einstellungen entsperren', html, 'pin');
  }
  function updatePin() {
    var dots = []; for (var i = 0; i < 4; i++) { dots.push(i < state.pin.length ? '●' : '○'); }
    byId('pinDots').textContent = dots.join(' ');
    byId('pinDots').setAttribute('aria-label', state.pin.length + ' von 4 Ziffern eingegeben');
  }
  function unlockSettings() {
    if (runtime) { runtime.unlock(state.pin); return; }
    if (state.pin !== '1310') { state.pin = ''; updatePin(); byId('pinStatus').textContent = 'PIN stimmt nicht. Bitte erneut versuchen.'; return; }
    state.settingsUnlockedUntil = Date.now() + 10 * 60000;
    state.pin = ''; closeDialog(); go('settings');
  }
  function openAnnouncement() {
    var options = '<option value="all">Alle Tablets</option>';
    for (var i = 0; i < model.tablets.length; i++) { options += '<option value="' + esc(model.tablets[i].id) + '">' + esc(model.tablets[i].name) + (model.tablets[i].online ? '' : ' (offline)') + '</option>'; }
    openDialog('Durchsage', '<form id="announcementForm"><label class="dialog-field-label" for="announcementTarget">An wen?</label><select id="announcementTarget" class="dialog-input">' + options + '</select><label class="dialog-field-label" for="announcementText">Deine Nachricht</label><textarea id="announcementText" class="dialog-input" rows="3" maxlength="300" required placeholder="Zum Beispiel: Essen ist fertig"></textarea><div class="announcement-presets"><button type="button" class="button"' + action('announcement-preset', 'Essen ist fertig!') + '>Essen ist fertig</button><button type="button" class="button"' + action('announcement-preset', 'Bitte nach unten kommen.') + '>Nach unten kommen</button></div><label class="checkbox-line"><input id="announcementSpeak" type="checkbox" checked>Nachricht vorlesen</label><button type="submit" class="button primary">Durchsage senden</button></form>' + (runtime ? '' : '<p class="info-note">Vorschau · keine Nachricht wird verschickt.</p>') + '', 'announcement');
  }
  function submitAnnouncement() { if (runtime) { runtime.announce(); return; }
    var text = byId('announcementText').value.replace(/^\s+|\s+$/g, ''); if (!text) { return; }
    var target = byId('announcementTarget').value;
    model.announcements.push({ target: target, message: text, speak: byId('announcementSpeak').checked });
    var receiver = target === 'all' ? 'alle Tablets' : find(model.tablets, target).name;
    closeDialog(); toast('Durchsage an ' + receiver + ' · Nur Simulation');
  }
  function openAssist() {
    var room = find(model.rooms, model.tablets[0].room);
    openDialog('Assist fragen', '<p class="card-description">Für dieses Tablet' + (room ? ' im ' + esc(room.name) : '') + '</p><form id="assistForm"><label class="dialog-field-label" for="assistQuestion">Was möchtest du wissen?</label><input id="assistQuestion" class="dialog-input" type="text" maxlength="300" required placeholder="Wie warm ist es hier?"><button type="submit" class="button primary">Frage stellen</button></form><div id="assistAnswer" class="assist-answer" role="status" aria-live="polite"></div>', 'assist');
  }
  function submitAssist() { if (runtime) { runtime.assist(); return; }
    var question = byId('assistQuestion').value.replace(/^\s+|\s+$/g, ''); if (!question) { return; }
    var room = find(model.rooms, model.tablets[0].room);
    var answer;
    if (/warm|temperatur/i.test(question) && room) { answer = 'Im ' + room.name + ' sind es ' + number(room.temperature) + ' °C. Gewünscht sind ' + number(room.target) + ' °C.'; }
    else if (/licht|lampe/i.test(question) && room) { var lights = roomLights(room.id); answer = 'Im ' + room.name + ' sind ' + lights.filter(function (light) { return light.on; }).length + ' von ' + lights.length + ' Lampen an.'; }
    else { answer = 'Hier würde Assist über Home Assistant auf deine Frage antworten. Diese Vorschau führt keine Befehle aus.'; }
    byId('assistAnswer').textContent = answer + ' (Beispieldaten)';
  }
  var holdTimer=null,held=false,holdTarget=null,blockedClick=null,holdX=0,holdY=0,lastTouch=0;
  function runAction(event,target){
    var node=actionNode(target);if(!node){return;}var name=node.getAttribute('data-action');
    if(blockedClick&&Date.now()<blockedClick.until&&node===blockedClick.node){blockedClick=null;event.preventDefault();return;}
    if(name==='backdrop-close'){if(target===node){closeDialog();}return;}
    if(node.getAttribute('data-view')){event.preventDefault();go(node.getAttribute('data-view'));return;}
    event.preventDefault();dispatch(name,node.getAttribute('data-id'),node);
  }
  document.addEventListener('click',function(event){runAction(event,event.target);},false);
  // Old iOS Safari delays or drops synthesized clicks on quick taps; act on touchend like the classic PIN pad.
  var fastTap=null,lastScrollAt=0;
  document.addEventListener('scroll',function(){lastScrollAt=Date.now();},true);
  function fastTapTarget(target){
    var node=actionNode(target);if(!node||node.disabled||(node.tagName!=='BUTTON'&&node.tagName!=='A')||node.getAttribute('type')==='submit'){return null;}
    while(target&&target!==node){if(/^(INPUT|SELECT|TEXTAREA|LABEL)$/.test(target.tagName)||target.hasAttribute('data-power-fader')||target.hasAttribute('data-thermostat')||target.hasAttribute('data-color-wheel')){return null;}target=target.parentNode;}
    return node;
  }
  function beginHold(event){
    if(event.type==='mousedown'&&Date.now()-lastTouch<1000){return;}
    if(event.type==='touchstart'){lastTouch=Date.now();var tapNode=event.touches.length===1&&Date.now()-lastScrollAt>150?fastTapTarget(event.target):null;fastTap=tapNode?{node:tapNode,target:event.target,x:event.touches[0].clientX,y:event.touches[0].clientY}:null;}
    clearTimeout(holdTimer);holdTimer=null;held=false;holdTarget=null;
    var node=actionNode(event.target);if(!node||node.disabled||['light','music-details','music-play'].indexOf(node.getAttribute('data-action'))===-1){return;}
    if(event.touches&&event.touches.length!==1){return;}
    var point=event.touches?event.touches[0]:event;holdX=point.clientX;holdY=point.clientY;holdTarget=node;
    holdTimer=setTimeout(function(){holdTimer=null;held=true;try{window.getSelection().removeAllRanges();}catch(_e){}blockedClick={node:node,until:Date.now()+1500};if(node.getAttribute('data-action')==='light'){openLight(node.getAttribute('data-id'));}else{dispatch('music-details',node.getAttribute('data-id'),node);}},600);
  }
  function moveHold(event){var point=event.touches?event.touches[0]:event;if(fastTap&&(!point||Math.abs(point.clientX-fastTap.x)>10||Math.abs(point.clientY-fastTap.y)>10)){fastTap=null;}if(!point||Math.abs(point.clientX-holdX)>10||Math.abs(point.clientY-holdY)>10){clearTimeout(holdTimer);holdTimer=null;}}
  function endHold(event){clearTimeout(holdTimer);holdTimer=null;var tap=event.type==='touchend'&&!held&&event.cancelable?fastTap:null;fastTap=null;if(holdTarget&&held&&event.type==='touchend'){if(event.cancelable){event.preventDefault();}}holdTarget=null;held=false;
    if(tap&&document.documentElement.contains(tap.node)){var focused=document.activeElement;if(focused&&/^(INPUT|SELECT|TEXTAREA)$/.test(focused.tagName)){focused.blur();}event.preventDefault();runAction(event,tap.target);}}
  document.addEventListener('mousedown',beginHold,false);document.addEventListener('touchstart',beginHold,false);document.addEventListener('mousemove',moveHold,false);document.addEventListener('touchmove',moveHold,false);document.addEventListener('mouseup',endHold,false);document.addEventListener('touchend',endHold,false);document.addEventListener('touchcancel',endHold,false);
  document.addEventListener('input', function (event) { var rid = event.target.getAttribute('data-brightness') || event.target.getAttribute('data-volume'); if (rid) { var label = event.target.parentNode.querySelector('[data-range-value]'); if (label) { label.textContent = event.target.value + ' %'; } } if (runtime && runtime.input(event)) { return; } if (event.target.id === 'brightness') { byId('brightnessValue').textContent = event.target.value + ' %'; } if (event.target.id === 'musicVolume') { byId('musicVolumeValue').textContent = event.target.value + ' %'; } if (event.target.id === 'playlistSearch') { byId('playlistResults').innerHTML = playlistButtons(event.target.value); } }, false);
  document.addEventListener('input',function(event){if(event.target.id!=='roomSearch'){return;}var term=event.target.value.toLowerCase(),nodes=byId('dialogRoot').querySelectorAll('[data-room-name]'),count=0;for(var i=0;i<nodes.length;i++){var show=nodes[i].getAttribute('data-room-name').indexOf(term)>=0;nodes[i].style.display=show?'':'none';if(show){count++;}}for(var j=0;j<nodes.length;j++){nodes[j].style.width=count===1&&nodes[j].style.display!=='none'?'100%':'';}byId('roomSearchEmpty').style.display=count?'none':'block';},false);
  document.addEventListener('change', function (event) { if (runtime && runtime.change(event)) { return; } var bid = event.target.getAttribute('data-brightness'), vid = event.target.getAttribute('data-volume'), device = find(bid ? model.lights : model.players, bid || vid); if (device) { if (bid) { device.brightness = Number(event.target.value); device.on = true; } else { device.volume = Number(event.target.value); } render(); return; } if (event.target.id === 'musicVolume') { var player = roomPlayer(state.roomId); if (player) { player.volume = Number(event.target.value); } } if (event.target.id === 'brightness') { var light = find(model.lights, event.target.getAttribute('data-light')); if (light) { light.brightness = Number(event.target.value); light.on = true; render(); } } }, false);
  document.addEventListener('submit', function (event) { if (runtime && event.target.id === 'tabletSettings') { event.preventDefault(); runtime.saveTablet(event.target); return; } if (event.target.id === 'announcementForm') { event.preventDefault(); submitAnnouncement(); return; } if (event.target.id === 'assistForm') { event.preventDefault(); submitAssist(); return; } if (event.target.id !== 'tabletSettings') { return; } event.preventDefault(); var tablet = find(model.tablets, event.target.getAttribute('data-tablet-id')); if (!tablet) { return; } var form = event.target; tablet.name = form.querySelector('#tabletName').value.replace(/^\s+|\s+$/g, '') || 'Mein iPad'; tablet.room = form.querySelector('#tabletRoom').value; tablet.rooms = []; var roomInputs = form.querySelectorAll('input[name=assignedRoom]'); for (var ri = 0; ri < roomInputs.length; ri++) { if (roomInputs[ri].checked) { tablet.rooms.push(roomInputs[ri].value); } }  tablet.quickLights = []; for (var qi = 0; qi < 2; qi++) { var quickValue = form.querySelector('#tabletQuick' + qi).value; if (quickValue && tablet.quickLights.indexOf(quickValue) === -1) { tablet.quickLights.push(quickValue); } } tablet.saver = form.querySelector('#tabletSaver').value; tablet.large = form.querySelector('#tabletSize').value === 'large'; tablet.night = form.querySelector('#tabletNight').checked; tablet.sounds = form.querySelector('#tabletSounds').checked; if (tablet.id === 'this') { state.roomId = tablet.room; try { window.localStorage.setItem(settingsKey, JSON.stringify(tablet)); } catch (_e) { /* no storage required */ } } closeDialog(); render(); toast('Vorschau-Einstellungen gespeichert'); }, false);
  document.addEventListener('keydown', function (event) { if (state.dialog && state.dialog.type === 'pin') { var digit = event.key; if (!/^[0-9]$/.test(digit || '')) { digit = event.keyCode >= 48 && event.keyCode <= 57 ? String(event.keyCode - 48) : event.keyCode >= 96 && event.keyCode <= 105 ? String(event.keyCode - 96) : ''; } if (digit) { event.preventDefault(); dispatch('pin-digit', digit, null); return; } if (event.key === 'Backspace' || event.keyCode === 8) { event.preventDefault(); dispatch('pin-backspace', '', null); return; } } if (event.key === 'Escape' || event.keyCode === 27) { closeDialog(); } if ((event.key === 'Tab' || event.keyCode === 9) && state.dialog) { var candidates = byId('dialogRoot').querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'),nodes=[];for(var ni=0;ni<candidates.length;ni++){if(candidates[ni].getClientRects().length){nodes.push(candidates[ni]);}} if (!nodes.length) { return; } var first = nodes[0]; var last = nodes[nodes.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }, false);
  byId('roomPicker').onclick = openRooms;
  byId('previewInfo').onclick = function () { openDialog('Ein erster Blick auf Zuhause', '<p>Diese Vorschau zeigt den neuen Aufbau mit Beispieldaten. Kamerawechsel, Schnellaktionen, Durchsage, Assist und Tablet-Einstellungen lassen sich ausprobieren. Es wird kein Gerät bei deinen Eltern geschaltet.</p><p class="info-note">Räume mit # am Anfang bleiben unsichtbar. Offline-Kameras und die DWD-Wetterkarte erscheinen nicht unter Kameras. Die endgültige iOS-9-Prüfung erfolgt später auf einem echten iPad.</p><button type="button" class="button" data-action="doorbell-demo">Klingel ausprobieren</button><button type="button" class="button" data-action="notice-demo">Durchsage empfangen</button>', 'info'); };
  window.WallpanelPowerFader.install(document,function(id,value){ if(runtime){runtime.brightness(id,value);}else{var light=find(model.lights,id);if(light){light.brightness=value;light.on=value>0;render();}} });
  window.WallpanelThermostat.install(document, function (id, value) { if (runtime) { runtime.temperature(id, value); } else { var r = find(model.rooms, id); if (r) { r.target = value; render(); } } });
  window.WallpanelMockup = { model: model, state: state, visibleRooms: visibleRooms, visibleCameras: visibleCameras, render: render, go: go, closeDialog: closeDialog, receiveAnnouncement: receiveAnnouncement, receiveDoorbell: receiveDoorbell, homeCamera:homeCamera,homeRoomButtons:homeRoomButtons, lightTile:lightTile, tabletFields:tabletFields, settingsView:settingsView, openDialog:openDialog, openMusic:openMusic, openCamera:openCamera, openSettingsPin:openSettingsPin,openLight:openLight, updatePin:updatePin, toast:toast, esc:esc, icon:icon };
  var initialHash=window.location.hash;
  if(runtime&&!initialHash){try{initialHash=window.sessionStorage.getItem('haWallpanel.panel.location') || '';}catch(_e){}}
  var route=window.WallpanelNavigation?window.WallpanelNavigation.parse(initialHash):{view:initialHash.replace('#','') || 'home',roomId:''};
  if(['home','room','scenes','cameras','weather','settings','apps','security','energy'].indexOf(route.view)!==-1){state.view=route.view;}
  if(route.roomId){state.roomId=route.roomId;}
  var requestedWeather=state.view==='weather';if(requestedWeather){state.view='home';}
  var requestedSettings=state.view==='settings';if(requestedSettings){state.view='apps';}
  if(runtime){runtime.attach(window.WallpanelMockup);}
  render();if(requestedSettings&&runtime&&runtime.restoreSettings){runtime.restoreSettings();}if(requestedWeather){openWeather();}setInterval(updateClock,30000);
})();
