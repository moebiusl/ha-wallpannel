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

Diese Werte kannst du im Add-on unter **Konfiguration** setzen:

- `ha_url` – normalerweise leer lassen. Optional eine eigene Home-Assistant-URL setzen.
- `ha_token` – normalerweise leer lassen. Nur als Fallback nutzen, falls dein HA-System dem Add-on keinen Supervisor-Token bereitstellt.
- `go2rtc_public_url` – externe go2rtc-Adresse, die das iPad erreichen kann, z.B. `http://homeassistant.local:1984` oder `http://192.168.178.10:1984`
- `go2rtc_port` – Port fuer automatische go2rtc-Ableitung, Standard `1984`
- `settings_pin` – PIN fuer die Optionen im Wallpanel
- `entity_light_main`, `entity_light_secondary`, `entity_light_third` – Licht-Entities fuer die Home-Kacheln. `entity_light_third` leer lassen, wenn es keine dritte Lampe gibt.
- `camera_*_name` – Anzeigename der Kamera
- `camera_*_event_image` – Event-Bild-Entity, z.B. `image.hof_event_image`
- `camera_*_live` – Home-Assistant-Kamera-Entity, z.B. `camera.hof`
- `camera_*_stream` – optionaler go2rtc-Streamname. Leer lassen, wenn go2rtc denselben Namen wie die Kamera-Entity nutzt. Wenn go2rtc kurze Namen nutzt, hier z.B. `hof` eintragen.

Wichtig fuer alte iPads: Die Live-Ansicht laeuft im Browser des iPads. `go2rtc_public_url` muss deshalb eine LAN-Adresse sein, die das iPad ohne VPN erreichen kann. Wenn die Option leer bleibt, versucht die App eine URL aus `HA_URL` abzuleiten; im Add-on ist das fuer externe Tablets meistens nicht ausreichend.

## Direkter Zugriff

Neben Ingress wird Port `3000` nach aussen angeboten. Das ist praktisch fuer alte iPads, die du direkt aufrufen kannst:

`http://homeassistant.local:3000`
