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
- `go2rtc_public_url` – go2rtc-Adresse, z.B. `http://192.168.178.10:1984`. Normalerweise leer lassen: Das Add-on nutzt dann automatisch die IP des HA-Hosts mit `go2rtc_port`.
- `go2rtc_port` – Port fuer automatische go2rtc-Ableitung, Standard `1984`
- `settings_pin` – PIN fuer die Optionen im Wallpanel
- `entity_light_main`, `entity_light_secondary`, `entity_light_third` – Licht-Entities fuer die Home-Kacheln. `entity_light_third` leer lassen, wenn es keine dritte Lampe gibt.
- `camera_*_name` – Anzeigename der Kamera
- `camera_*_event_image` – Event-Bild-Entity, z.B. `image.hof_event_image`
- `camera_*_live` – Home-Assistant-Kamera-Entity, z.B. `camera.hof`
- `camera_*_stream` – optionaler go2rtc-Streamname. Normalerweise leer lassen: Das Add-on erkennt den Stream automatisch (gleicher Name wie die Entity, Kurzname wie `hof` oder – bei Eufy – die Seriennummer des Geräts).

Live-Ansicht: Das Add-on holt den Stream selbst von go2rtc und reicht ihn als MJPEG an das Tablet weiter – das funktioniert auch auf alten iPads (iOS 9), das Tablet muss go2rtc nicht direkt erreichen. Bei Eufy-Kameras (Integration `eufy_security`) startet das Add-on dafür automatisch den P2P-Livestream und stoppt ihn wieder, wenn niemand mehr zuschaut. Der Start kann einige Sekunden dauern; kommt nach 25 Sekunden kein Bild, wird das Event-Bild angezeigt.

## Direkter Zugriff

Neben Ingress wird Port `3000` nach aussen angeboten. Das ist praktisch fuer alte iPads, die du direkt aufrufen kannst:

`http://homeassistant.local:3000`
