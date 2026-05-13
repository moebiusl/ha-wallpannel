#!/usr/bin/env bash
set -e

export PORT="${PORT:-3000}"
export HA_URL="${HA_URL:-http://supervisor/core}"
export HA_TOKEN="${HA_TOKEN:-${SUPERVISOR_TOKEN:-${HASSIO_TOKEN:-}}}"

load_token_file() {
  if [ -z "$HA_TOKEN" ] && [ -f "$1" ]; then
    HA_TOKEN="$(cat "$1")"
    export HA_TOKEN
  fi
}

load_token_file /var/run/s6/container_environment/HA_TOKEN
load_token_file /var/run/s6/container_environment/SUPERVISOR_TOKEN
load_token_file /var/run/s6/container_environment/HASSIO_TOKEN
load_token_file /run/s6/container_environment/HA_TOKEN
load_token_file /run/s6/container_environment/SUPERVISOR_TOKEN
load_token_file /run/s6/container_environment/HASSIO_TOKEN

if [ -f /data/options.json ]; then
  node <<'NODE' > /tmp/wallpanel-options-env
const fs = require("fs");
const file = "/data/options.json";

if (!fs.existsSync(file)) {
  process.exit(0);
}

const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
const optionMap = {
  ha_url: "HA_URL",
  ha_token: "HA_TOKEN",
  go2rtc_public_url: "GO2RTC_PUBLIC_URL",
  go2rtc_port: "GO2RTC_PORT",
  settings_pin: "SETTINGS_PIN",
  entity_light_main: "ENTITY_LIGHT_MAIN",
  entity_light_secondary: "ENTITY_LIGHT_SECONDARY",
  entity_light_third: "ENTITY_LIGHT_THIRD",
  camera_einfahrt_name: "CAMERA_EINFAHRT_NAME",
  camera_einfahrt_event_image: "CAMERA_EINFAHRT_EVENT_IMAGE",
  camera_einfahrt_live: "CAMERA_EINFAHRT_LIVE",
  camera_einfahrt_stream: "CAMERA_EINFAHRT_STREAM",
  camera_hof_name: "CAMERA_HOF_NAME",
  camera_hof_event_image: "CAMERA_HOF_EVENT_IMAGE",
  camera_hof_live: "CAMERA_HOF_LIVE",
  camera_hof_stream: "CAMERA_HOF_STREAM",
  camera_hof_von_garage_name: "CAMERA_HOF_VON_GARAGE_NAME",
  camera_hof_von_garage_event_image: "CAMERA_HOF_VON_GARAGE_EVENT_IMAGE",
  camera_hof_von_garage_live: "CAMERA_HOF_VON_GARAGE_LIVE",
  camera_hof_von_garage_stream: "CAMERA_HOF_VON_GARAGE_STREAM",
  camera_werkstatt_garten_name: "CAMERA_WERKSTATT_GARTEN_NAME",
  camera_werkstatt_garten_event_image: "CAMERA_WERKSTATT_GARTEN_EVENT_IMAGE",
  camera_werkstatt_garten_live: "CAMERA_WERKSTATT_GARTEN_LIVE",
  camera_werkstatt_garten_stream: "CAMERA_WERKSTATT_GARTEN_STREAM",
  camera_klingel_name: "CAMERA_KLINGEL_NAME",
  camera_klingel_event_image: "CAMERA_KLINGEL_EVENT_IMAGE",
  camera_klingel_live: "CAMERA_KLINGEL_LIVE",
  camera_klingel_stream: "CAMERA_KLINGEL_STREAM"
};

for (const [optionName, envName] of Object.entries(optionMap)) {
  const value = cfg[optionName];
  if (value === undefined || value === null || String(value).trim() === "") {
    continue;
  }

  const escapedValue = String(value).replace(/'/g, "'\\''");
  console.log("export " + envName + "='" + escapedValue + "'");
}
NODE
  . /tmp/wallpanel-options-env
fi

cd /app
exec node dist/server.js
