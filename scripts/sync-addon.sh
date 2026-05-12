#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADDON_DIR="${ROOT_DIR}/wallpanel"

mkdir -p "${ADDON_DIR}"
rm -rf "${ADDON_DIR}/src" "${ADDON_DIR}/public"
cp "${ROOT_DIR}/package.json" "${ROOT_DIR}/package-lock.json" "${ROOT_DIR}/tsconfig.json" "${ADDON_DIR}/"
cp -R "${ROOT_DIR}/src" "${ROOT_DIR}/public" "${ADDON_DIR}/"
