# HA Wallpanel

## Installation

1. Dieses GitHub-Repository in Home Assistant als Add-on-Repository hinzufuegen.
2. Add-on-Store neu laden.
3. "HA Wallpanel" installieren.
4. Add-on starten.
5. Die Oberflaeche ueber "Web UI" oder Ingress oeffnen.

## Konfiguration

Es ist keine manuelle Token-Konfiguration noetig. Das Add-on setzt:

- `HA_URL=http://supervisor/core`
- `HA_TOKEN=$SUPERVISOR_TOKEN`

Damit spricht die App intern mit Home Assistant.

## Direkter Zugriff

Neben Ingress wird Port `3000` nach aussen angeboten. Das ist praktisch fuer alte iPads, die du direkt aufrufen kannst:

`http://homeassistant.local:3000`
