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

## Tablets verwalten

Jedes iPad, das das Wallpanel als Web-App vom Homescreen öffnet, meldet sich mit einer eigenen Kennung an. Unter **Optionen → Tablets** (z. B. vom Mac über `http://<HA-IP>:3000/optionen.html`) kannst du für jedes Tablet Name, Raum, Panel, Bildschirmschoner, Nachtmodus und das Klingel-Popup einstellen. Änderungen kommen innerhalb weniger Sekunden auf dem Tablet an. Dort gibt es auch „Identifizieren“ (zeigt den Namen groß auf dem Tablet), „Mitteilung senden“ und „Neu laden“.

Nach einem Add-on-Update laden sich die Tablets automatisch neu, sobald sie kurz nicht bedient werden.

### Design

Neben dem klassischen Design gibt es das Test-Design **„Home“** im Stil von Apple Home: graue Flächen, eingeschaltete Geräte hell mit gelbem Symbol, Navigation als Segment-Schalter. Umschalten pro Tablet unter Optionen → Dieses Tablet → Design oder aus der Ferne unter Optionen → Tablets. Zum Anschauen ohne Umstellen: `?theme=home` an die Adresse hängen.

### Klingel

Klingelt es, zeigen die Tablets ein großes Popup mit dem Live-Bild der Klingelkamera und Buttons für „Hoftor auto öffnen“ und Licht. Klingel-Signal, Kamera und Licht-Buttons werden automatisch erkannt und lassen sich unter **Optionen → Tablets → Klingel** anpassen. Mit „Klingel testen“ lässt sich das Popup ausprobieren.

### Mitteilungen aus Home Assistant

In einer Automation ein Event auslösen – `tablet` ist der Tablet-Name oder `all`:

```yaml
action: event
event: wallpanel_notify
event_data:
  tablet: Flur
  title: Hoftor
  message: Das Tor ist seit 10 Minuten offen.
  duration: 60
```

Statt `message` geht auch `command: doorbell`, `command: reload` oder `command: identify`.

Mit `sound` spielt das Tablet einen Ton: `gong`, `glocke`, `ping`, `hinweis`, `alarm` oder `none`. Ohne `sound` gilt der Mitteilungston aus Optionen → Tablets → Töne. Nur `sound` ohne `message` spielt den Ton ohne Mitteilung.

Mit `speak: true` wird die Mitteilung nach dem Ton vorgelesen – mit der Stimme der bevorzugten Assist-Pipeline in HA.

### Durchsagen

Über das Megafon oben rechts kann jedes Tablet eine Durchsage an alle oder an ein bestimmtes Tablet schicken, wahlweise vorgelesen. Die Schnell-Durchsagen (Buttons) legst du unter Optionen → Tablets → Schnell-Durchsagen fest.

### Töne zuverlässig abspielen

iOS spielt Töne erst ab, nachdem das Tablet seit dem Laden der Seite einmal berührt wurde, und jeder Seitenwechsel setzt das zurück. Damit z. B. die Klingel auch im Bildschirmschoner zu hören ist, das Wallpanel über `http://<HA-IP>:3000/start.html` zum Homescreen hinzufügen. Diese Rahmenseite bleibt dauerhaft geladen und muss nur einmal nach dem Start berührt werden.

## Direkter Zugriff

Neben Ingress wird Port `3000` nach aussen angeboten. Das ist praktisch fuer alte iPads, die du direkt aufrufen kannst:

`http://homeassistant.local:3000`
