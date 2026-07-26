var HA_ICON_PATHS = {
  "alarm-light": "M12 2A7 7 0 0 0 5 9V13.17L3.59 14.59L5 16L6.41 14.59L7.83 16L9.24 14.59L10.66 16L12.07 14.59L13.49 16L14.9 14.59L16.31 16L17.73 14.59L19.14 16L20.55 14.59L19 13.04V9A7 7 0 0 0 12 2M12 4A5 5 0 0 1 17 9V12.2L16.31 11.5L14.9 12.91L13.49 11.5L12.07 12.91L10.66 11.5L9.24 12.91L7.83 11.5L7 12.33V9A5 5 0 0 1 12 4M10 8A1 1 0 1 0 10 10A1 1 0 0 0 10 8M14 8A1 1 0 1 0 14 10A1 1 0 0 0 14 8M8 18H16V20H8V18Z",
  "alert": "M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z",
  "battery": "M16.67 4H15V2H9V4H7.33C6.6 4 6 4.6 6 5.33V20.67C6 21.4 6.6 22 7.33 22H16.67C17.4 22 18 21.4 18 20.67V5.33C18 4.6 17.4 4 16.67 4M16 20H8V6H16V20Z",
  "battery-low": "M16.67 4H15V2H9V4H7.33C6.6 4 6 4.6 6 5.33V20.67C6 21.4 6.6 22 7.33 22H16.67C17.4 22 18 21.4 18 20.67V5.33C18 4.6 17.4 4 16.67 4M16 20H8V17H16V20Z",
  "calendar-clock": "M19 3H18V1H16V3H8V1H6V3H5C3.89 3 3 3.9 3 5V19A2 2 0 0 0 5 21H11.1C10.68 20.39 10.35 19.72 10.16 19H5V8H19V10.16C19.72 10.35 20.39 10.68 21 11.1V5A2 2 0 0 0 19 3M18 12A6 6 0 1 0 18 24A6 6 0 0 0 18 12M20.5 19.5L17 18V14H18.5V17.1L21.1 18.2L20.5 19.5Z",
  "camera": "M4 4H7L9 2H15L17 4H20A2 2 0 0 1 22 6V18A2 2 0 0 1 20 20H4A2 2 0 0 1 2 18V6A2 2 0 0 1 4 4M12 7A5 5 0 1 0 12 17A5 5 0 0 0 12 7M12 9A3 3 0 1 1 12 15A3 3 0 0 1 12 9Z",
  "cctv": "M17 10.5V6C17 4.9 16.1 4 15 4H5C3.9 4 3 4.9 3 6V14C3 15.1 3.9 16 5 16H15C16.1 16 17 15.1 17 14V13.5L21 17.5V6.5L17 10.5Z",
  "fan": "M12 11A1 1 0 1 1 12 13A1 1 0 0 1 12 11M6.5 5C8.5 3 11 2 13 2C15 2 16 3 16 4.5C16 7 13.5 8.5 12.6 10.2C13.7 9.7 15 9.5 16.5 10C19 10.8 21 12.5 21 14.5C21 16.5 19.5 18 17.5 18C15 18 13.8 15.2 12.4 14.1C12.6 15.4 12.4 16.9 11.5 18.1C10 20.1 7.5 21.5 5.5 20.5C3.8 19.7 3.3 17.5 4.4 15.9C5.8 13.8 8.9 14.2 10.5 13.3C9.3 12.9 8.1 12.1 7.3 10.8C6 8.6 5.2 6.3 6.5 5Z",
  "garage": "M2 20V10L12 4L22 10V20H20V11.2L12 6.4L4 11.2V20H2M6 19H18V17H6V19M6 15H18V13H6V15M6 11H18V9H6V11Z",
  "gate": "M3 21V9L12 3L21 9V21H19V10.1L12 5.4L5 10.1V21H3M7 21V12H17V21H15V14H9V21H7Z",
  "home": "M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z",
  "humidity": "M12 3.25C12 3.25 6 10 6 14A6 6 0 0 0 18 14C18 10 12 3.25 12 3.25M12 20A4 4 0 0 1 8 16H10A2 2 0 0 0 12 18V20Z",
  "lightbulb": "M9 21H15V19H9V21M12 2C8.14 2 5 5.14 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.14 15.86 2 12 2Z",
  "lock": "M12 17A2 2 0 0 0 14 15A2 2 0 0 0 12 13A2 2 0 0 0 10 15A2 2 0 0 0 12 17M18 8H17V6A5 5 0 0 0 7 6V8H6A2 2 0 0 0 4 10V20A2 2 0 0 0 6 22H18A2 2 0 0 0 20 20V10A2 2 0 0 0 18 8M9 8V6A3 3 0 0 1 15 6V8H9Z",
  "motion": "M13.5 5.5C14.6 5.5 15.5 4.6 15.5 3.5S14.6 1.5 13.5 1.5S11.5 2.4 11.5 3.5S12.4 5.5 13.5 5.5M9.8 8.9L7 23H9.1L10.9 15L13 17V23H15V15.5L12.9 13.5L13.5 10.5C14.8 12 16.6 13 19 13V11C17 11 15.6 9.9 14.7 8.4L13.7 6.8C13.3 6.2 12.7 6 12 6C11.7 6 11.4 6.1 11.1 6.2L6 8.3V13H8V9.6L9.8 8.9Z",
  "music": "M12 3V13.55A4 4 0 1 0 14 17V7H18V3H12Z",
  "pause": "M14 19H18V5H14M6 19H10V5H6V19Z",
  "play": "M8 5.14V19.14L19 12.14L8 5.14Z",
  "power": "M13 3H11V13H13V3M17.83 5.17L16.41 6.59C17.99 7.86 19 9.81 19 12A7 7 0 1 1 7.59 6.59L6.17 5.17A9 9 0 1 0 17.83 5.17Z",
  "shield": "M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1Z",
  "smoke-detector": "M12 3C16.42 3 20 5.69 20 9H4C4 5.69 7.58 3 12 3M4 11H20V13H4V11M6 15H18V17H6V15M8 19H16V21H8V19Z",
  "solar-power": "M3 13H21L19 21H5L3 13M12 2L14.39 6.84L19.73 7.64L15.86 11.39L16.78 16.7L12 14.19L7.22 16.7L8.14 11.39L4.27 7.64L9.61 6.84L12 2Z",
  "stop": "M6 6H18V18H6V6Z",
  "thermometer": "M17 14.5C17 16.14 16.21 17.59 15 18.5V5A3 3 0 0 0 9 5V18.5C7.79 17.59 7 16.14 7 14.5C7 12.86 7.79 11.41 9 10.5V5A3 3 0 0 1 15 5V10.5C16.21 11.41 17 12.86 17 14.5Z",
  "trash-can": "M9 3V4H4V6H5V19A2 2 0 0 0 7 21H17A2 2 0 0 0 19 19V6H20V4H15V3H9M7 6H17V19H7V6M9 8V17H11V8H9M13 8V17H15V8H13Z",
  "weather-partly-cloudy": "M6.76 4.84L4.96 3.05L3.55 4.46L5.34 6.25L6.76 4.84M1 10.5H4V8.5H1V10.5M11 1H9V4H11V1M20.5 15.5C20.5 12.46 18.04 10 15 10C14.72 10 14.45 10.03 14.18 10.07C13.47 8.25 11.7 7 9.65 7C7 7 4.85 9.15 4.85 11.8C4.85 12.09 4.88 12.38 4.93 12.65C3.23 13.24 2 14.86 2 16.75C2 19.1 3.9 21 6.25 21H19.5C21.43 21 23 19.43 23 17.5C23 15.9 21.93 14.55 20.5 14.13V15.5Z",
  "weather-cloudy": "M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14A6 6 0 0 0 6 20H19A5 5 0 0 0 19.35 10.04Z",
  "weather-fog": "M3 15H21V17H3V15M3 19H17V21H3V19M6 11H21V13H6V11M19.35 6.04C18.67 2.59 15.64 0 12 0C9.11 0 6.6 1.64 5.35 4.04C2.34 4.36 0 6.91 0 10H2C2 7.79 3.79 6 6 6H6.71C7.37 3.69 9.5 2 12 2C15.04 2 17.5 4.46 17.5 7.5V8H19A3 3 0 0 1 22 11H24A5 5 0 0 0 19.35 6.04Z",
  "weather-lightning": "M7 2V13H10V22L17 10H13L17 2H7Z",
  "weather-pouring": "M6 14H8L6 20H4L6 14M11 14H13L11 20H9L11 14M16 14H18L16 20H14L16 14M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14H2A4 4 0 0 1 6 10H6.71C7.37 7.69 9.5 6 12 6A5.5 5.5 0 0 1 17.5 11.5V12H19A3 3 0 0 1 22 15H24A5 5 0 0 0 19.35 10.04Z",
  "weather-rainy": "M7 14H9L7 18H5L7 14M12 14H14L12 18H10L12 14M17 14H19L17 18H15L17 14M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14H2A4 4 0 0 1 6 10H6.71C7.37 7.69 9.5 6 12 6A5.5 5.5 0 0 1 17.5 11.5V12H19A3 3 0 0 1 22 15H24A5 5 0 0 0 19.35 10.04Z",
  "weather-snowy": "M12 2L13.09 8.26L19 5.5L16.24 11.41L22.5 12.5L16.24 13.59L19 19.5L13.09 16.74L12 23L10.91 16.74L5 19.5L7.76 13.59L1.5 12.5L7.76 11.41L5 5.5L10.91 8.26L12 2Z",
  "weather-sunny": "M12 7A5 5 0 1 0 12 17A5 5 0 0 0 12 7M12 1V4M12 20V23M4.22 4.22L6.34 6.34M17.66 17.66L19.78 19.78M1 12H4M20 12H23M4.22 19.78L6.34 17.66M17.66 6.34L19.78 4.22",
  "weather-windy": "M4 10H2V12H4V13.5A2.5 2.5 0 0 0 6.5 16A2.5 2.5 0 0 0 9 13.5H7A0.5 0.5 0 0 1 6.5 14A0.5 0.5 0 0 1 6 13.5V12H14A3 3 0 0 0 17 9A3 3 0 0 0 14 6A3 3 0 0 0 11.03 8.45L12.94 9.11A1 1 0 0 1 14 8A1 1 0 0 1 15 9A1 1 0 0 1 14 10H4M4 16H2V18H4V19.5A2.5 2.5 0 0 0 6.5 22A2.5 2.5 0 0 0 9 19.5H7A0.5 0.5 0 0 1 6.5 20A0.5 0.5 0 0 1 6 19.5V18H18A3 3 0 0 0 21 15A3 3 0 0 0 18 12A3 3 0 0 0 15.03 14.45L16.94 15.11A1 1 0 0 1 18 14A1 1 0 0 1 19 15A1 1 0 0 1 18 16H4Z",
  "water-tank": "M7 4H17L16 7V19A2 2 0 0 1 14 21H10A2 2 0 0 1 8 19V7L7 4Z",
  "window": "M4 3H20V21H4V3M6 5V19H11V5H6M13 5V19H18V5H13Z"
};

function haIcon(name, className) {
  var path = HA_ICON_PATHS[name] || HA_ICON_PATHS.home;
  return '<svg class="ha-icon ' + (className || "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + path + '"></path></svg>';
}

function iconNameForEntity(entity) {
  if (!entity) { return "home"; }
  if (entity.domain === "light") { return "lightbulb"; }
  if (entity.domain === "switch" || entity.domain === "input_boolean") { return "power"; }
  if (entity.domain === "fan") { return "fan"; }
  if (entity.domain === "cover") { return entity.deviceClass === "garage" || entity.deviceClass === "garage_door" ? "garage" : "window"; }
  if (entity.domain === "lock") { return "lock"; }
  if (entity.domain === "camera") { return "camera"; }
  if (entity.domain === "climate") { return "thermometer"; }
  if (entity.domain === "media_player") { return "music"; }
  if (entity.domain === "button" || entity.domain === "scene" || entity.domain === "script") { return "play"; }
  if (entity.domain === "alarm_control_panel") { return "shield"; }
  if (entity.domain === "binary_sensor") {
    if (entity.deviceClass === "window") { return "window"; }
    if (entity.deviceClass === "door" || entity.deviceClass === "opening") { return "gate"; }
    if (entity.deviceClass === "garage_door") { return "garage"; }
    if (entity.deviceClass === "motion" || entity.deviceClass === "occupancy") { return "motion"; }
    if (entity.deviceClass === "smoke" || entity.deviceClass === "gas" || entity.deviceClass === "carbon_monoxide" || entity.deviceClass === "carbon_dioxide") { return "smoke-detector"; }
    if (entity.deviceClass === "problem" || entity.deviceClass === "safety") { return "alert"; }
    if (entity.deviceClass === "lock") { return "lock"; }
    return "shield";
  }
  if (entity.deviceClass === "temperature") { return "thermometer"; }
  if (entity.deviceClass === "humidity") { return "humidity"; }
  if (entity.deviceClass === "battery") {
    var level = Number(entity.state);
    return !Number.isNaN(level) && level <= 20 ? "battery-low" : "battery";
  }
  if (entity.domain === "sensor") { return "shield"; }
  return "home";
}

function iconForEntity(entity, className) {
  return haIcon(iconNameForEntity(entity), className);
}

function iconForSpecialCard(cardId, className) {
  var names = {
    weather: "weather-partly-cloudy",
    datetime: "calendar-clock",
    gate: "gate",
    waste: "trash-can",
    energy: "solar-power",
    battery: "battery",
    camera: "camera",
    security: "shield",
    light: "lightbulb",
    wassertank: "water-tank"
  };
  return haIcon(names[cardId] || "home", className);
}

function iconForWeatherState(state, className) {
  var names = {
    clear: "weather-sunny",
    "clear-night": "weather-sunny",
    cloudy: "weather-cloudy",
    fog: "weather-fog",
    hail: "weather-snowy",
    lightning: "weather-lightning",
    "lightning-rainy": "weather-lightning",
    partlycloudy: "weather-partly-cloudy",
    pouring: "weather-pouring",
    rainy: "weather-rainy",
    snowy: "weather-snowy",
    "snowy-rainy": "weather-snowy",
    sunny: "weather-sunny",
    windy: "weather-windy",
    "windy-variant": "weather-windy"
  };
  return haIcon(names[state] || "weather-partly-cloudy", className);
}
