## 1.5.1

### Fixes
- Assist-Button überlappte den letzten Navigationspunkt (z. B. „Sicherheit“) – die Navigation lässt jetzt Platz für beide Icons
- Uhr im Bildschirmschoner steht jetzt fest in der Bildschirmmitte
- Ausführlichere Log-Meldungen beim Kamera-Live (welcher go2rtc-Stream, ob der Eufy-Livestream angefordert wurde), um Startprobleme leichter einzugrenzen

## 1.5.0

### Neu: Bildschirmschoner
- Pro Tablet in den Optionen einstellbar: an/aus und nach 1, 2, 5 oder 10 Minuten ohne Bedienung
- Schwarzer Bildschirm mit gedimmter Uhr und Datum (wandert jede Minute leicht)
- Ein Tipp weckt das Tablet, ohne dass der Tipp einen Button darunter auslöst
- Solange er läuft, pausiert die Datenabfrage der Startseite; offene Fenster (z. B. Kamera-Live) werden geschlossen
- Der Nachtmodus dimmt auch den Bildschirmschoner

### Fix: Kamera-Live mit Eufy und go2rtc
- Eufy-Kameras haben in go2rtc nur einen Platzhalter als Quelle (`tcp://127.0.0.1:65535 … connection refused`), bis ein P2P-Livestream gestartet wird
- Das Add-on startet den Eufy-P2P-Livestream jetzt selbst, wartet auf das erste Bild und stoppt ihn wieder, wenn niemand mehr zuschaut
- go2rtc-Streams werden automatisch zugeordnet – auch über die Eufy-Seriennummer
- Live läuft über das Add-on als MJPEG, damit auch alte iPads (iOS 9) das Bild anzeigen
- go2rtc-Adresse wird im Add-on automatisch aus der Host-IP ermittelt, wenn `go2rtc_public_url` leer ist

### Neu: Assist-Button
- Mikrofon-Button in der Kopfleiste öffnet ein Assist-Fenster
- Befehle und Fragen gehen an die bevorzugte Assist-Pipeline von Home Assistant (Sprache, Agent und Stimme wie in HA eingestellt)
- Die Antwort erscheint als Text und wird über den Lautsprecher des Tablets vorgelesen (sofern in der Pipeline eine Sprachausgabe eingerichtet ist)
- Folgefragen laufen im selben Gespräch, solange das Fenster offen bleibt
- Alte iPads (iOS 9) erlauben Webseiten keinen Mikrofonzugriff: Gesprochen wird über die Diktierfunktion der iPad-Tastatur (🎤-Taste)

## 1.4.0

### Performance für alte iPads
- Kamerabilder werden nur noch neu geladen, wenn es wirklich ein neues Event gibt – vorher wurden Hauptbild, Modal-Bild und alle Vorschaubilder alle 3 Sekunden komplett neu heruntergeladen
- Die Kamera-Vorschauleiste wird nicht mehr bei jeder Aktualisierung neu aufgebaut, sondern nur noch angepasst
- Das Kamera-Modal lädt sein Bild bzw. seinen Live-Stream nur, solange es geöffnet ist
- Die Startseite rendert nur noch neu, wenn sich die Daten tatsächlich geändert haben, und pausiert im Hintergrund
- Nachtmodus nutzt ein dunkles Overlay statt eines Helligkeitsfilters auf der ganzen Seite (deutlich weniger Rechenlast)
- CSS/JS werden gzip-komprimiert und vom Browser zwischengespeichert (Seitenwechsel schneller)
- Doppelt laufende Uhr auf der Startseite entfernt

### Fix: Offene Kamera-Streams
- Wird die Live-Ansicht geschlossen, beendet der Server jetzt auch die Stream-Verbindung zu Home Assistant – vorher blieb pro Live-Ansicht eine Verbindung offen

## 1.3.9

### Vollbild-Modus vom iPad-Homescreen
- Wird das Wallpanel über „Zum Home-Bildschirm" hinzugefügt, startet es jetzt ohne Safari-Leisten im Vollbild – auch auf alten iPads (`apple-mobile-web-app-capable`) und auf neuen Geräten per Web-App-Manifest (`display: standalone`)
- Eigenes Homescreen-Icon (`apple-touch-icon.png`, 192/512-px-Icons)
- Interne Links (Navigation, Räume, Optionen) bleiben im Homescreen-Modus in der App, statt auf älteren iOS-Versionen Safari zu öffnen
- Hinweis: Bereits vorhandene Homescreen-Verknüpfung entfernen und neu hinzufügen; dafür die direkte Adresse (`http://<HA-IP>:<Port>/`) nutzen, nicht den Ingress-Link

## 1.3.8

### Fix: Home-Sicherheitskachel ignorierte ausgeblendete Entitäten
- Die Sicherheits-Übersicht auf der Home-Seite („Sicher" / „Nicht sicher" / „Offline") zählte bisher alle passenden Entitäten direkt aus HA, unabhängig davon, was auf der Sicherheits-Seite über Optionen ausgeblendet wurde
- Dadurch tauchten z. B. verwaiste Sensoren (nach Rückbau der Wohnzimmer-Thermostate wegen Fußbodenheizung) weiterhin als „Offline" auf der Home-Kachel auf, obwohl sie auf der Sicherheits-Seite bereits ausgeblendet waren
- Home-Kachel respektiert jetzt dieselben `hiddenEntities` wie die Sicherheits-Seite

## 1.3.7

### Fixes für die Wetterseite
- Wetterseite war nicht scrollbar — behoben, ließ sich bei vielen Sektionen nicht mehr vollständig anzeigen
- Messwerte (Fassfüllstand, Wetterstation- und Energie-Metriken) zeigten teils viele Nachkommastellen (z. B. „95.8528747558594 %") — werden jetzt serverseitig auf eine Nachkommastelle gerundet

## 1.3.6

### Neue Wetterseite mit eigener Wetterstation + Wassertank

#### Wetterseite
- Neue Seite „Wetter" (eigener Menüpunkt) mit Live-Daten der Ecowitt-Wetterstation (GW3000A)
- Außentemperatur & -feuchte, Niederschlag (heute/Rate/Monat/Jahr), Luftdruck inkl. 3h-Trend und Barometer-Wetterlage
- Wind (Geschwindigkeit/Richtung) und UV-Index als Ring-Gauge
- DWD-Regenradar als Live-Bild, DWD-Tagesvorhersage
- Alle Kacheln einzeln ausblendbar über Optionen → Inhalte → Wetter

#### Wassertank
- Wassertank-Übersicht direkt in die Wetterseite integriert: Füllstand als Ring-Gauge, Inhalt (Liter), Wasserhöhe
- LED-Matrix-Anzeigepanel: Ein/Aus + Helligkeitsregler direkt auf der Seite
- Kalibrierung (max. Tankvolumen, Abstand bei Voll/Leer) neu unter Optionen → System, PIN-geschützt

#### Home-Seite
- Wetter-Kachel führt jetzt per Klick direkt zur Wetterseite (statt Popup)
- Kachel zeigt zusätzlich kompakt den Fassfüllstand und eine Niederschlags-Kurzprognose („Regen jetzt" / „Regen in X Std." / „Kein Niederschlag in Sicht")

## 1.3.5

### Aktivitätslog — Vollständiges Tor-Tracking + Redesign

#### Neue Entitäten werden jetzt getrackt
- **Automatik-Öffnen** (`button.esp_tor_automatik_offnen`) — zeigt wer ausgelöst hat: Nutzer, Automatisierung oder API
- **Endschalter Auf / Zu** (`binary_sensor.esp_tor_endschalter_tor_auf/zu`) — ausgelöst & freigegeben
- **Lichtschranke** (`binary_sensor.esp_tor_lichtschranke_tor`) — unterbrochen & frei
- **Schließzeit** (`sensor.esp_tor_countdown_bis_schliessung`) — nur bei Sprüngen ≥ 10 s (nicht jede Sekunde)
- **Fahrzeit** (`sensor.esp_tor_fahrzeit_tor`) — ebenso nur bei Sprüngen ≥ 10

#### Redesign des Aktivitätslogs
- **Icons** vor jedem Eintrag: 🚪 ⬆ ⬇ ⚡ ⏱ 📐 ⚙ 🔁 🔒 …
- **Datums-Trenner**: „Heute" / „Gestern" / Datum trennt die Tage
- **Farbige Akzentlinie** links: Blau = Statusänderung, Teal = manuelle Aktion, Orange = Sensor
- **Badge** zeigt jetzt `Status` / `Aktion` / `Sensor` / `Fehler` statt generischem `OK`
- **Trigger-Tag**: kleines Label `Nutzer` / `Automatisierung` bei button-Einträgen
- **Vorheriger Zustand** als Sub-Zeile bei Statusänderungen (z. B. „vorher: geschlossen")
- Uhrzeit kompakt (nur HH:MM)

#### Technisch
- HA-WebSocket-Subscription gibt jetzt `user_id` und `origin` weiter
- `ActivityEntry` um `kind` (action/state/sensor) und `trigger` erweitert

## 1.3.4
### Personenerkennung in Kameraansicht
- Neues Badge unter dem Kameranamen: zeigt die erkannte Person (z. B. „👤 Lucas")
- Sensor `sensor.hof_person_name` wird für die Hof-Kamera ausgewertet
- Klingel-Kamera bekommt **keine** Personeninfo (Datenschutz)
- „No Person" / „unavailable" / „unknown" → Badge wird ausgeblendet
- „Unknown Person" → wird angezeigt (jemand erkannt, aber nicht bekannt)
- Anzeige sowohl im Haupt-Kamerabild als auch in den Strip-Thumbnails

### Aktivitätslog — HA-Logbuch jetzt wirklich geladen
- Falscher Query-Parameter `entity` → korrigiert zu `entity_id` beim Logbuch-API-Aufruf
- Ohne diese Korrektur lieferte HA entweder alle Einträge oder einen Fehler zurück
- Fehlermeldungen im Logbuch-Abruf werden jetzt im Server-Log sichtbar gemacht

### Kamera-Bildabruf — Log-Spam unterdrückt
- Bildfehler (z. B. HTTP 500 für `image.werkstatt_richtung_garten_event_image`) werden max. 1× alle 5 Minuten geloggt
- Nach erfolgreichem Abruf wird der Throttle zurückgesetzt

### Startmeldung erweitert
- Zeigt jetzt HA-URL, Token-Status, Supervisor-Token-Status und Tor-Sensor-ID

## 1.3.3

### Add-on-Seite — HTTP 403 behoben
- `hassio_role: manager` in `config.yaml` ergänzt
- Ohne diese Role liefert der Supervisor `GET /addons` einen 403-Fehler, auch wenn der Token korrekt ist

## 1.3.2

- Boiler-Timer: `[boiler-timer] state changed` wird nicht mehr ins Server-Protokoll geschrieben

## 1.3.1

### Add-on-Seite — 401-Fehler behoben
- `SUPERVISOR_TOKEN` wird jetzt separat vom `HA_TOKEN` gelesen
- Supervisor-API-Aufrufe (`http://supervisor/addons`) nutzen nun immer den korrekten Add-on-Token, nicht den ggf. konfigurierten Nutzer-Token
- Behebt HTTP 401 beim Laden der Add-on-Liste, wenn ein eigener `ha_token` konfiguriert ist

### Raumseite — Nicht verfügbare Kacheln ausblenden
- Entitäten mit Status `unknown` oder `unavailable` werden auf der Raumseite nicht mehr als Kacheln angezeigt
- Reduziert Rauschen bei Geräten, die offline oder temporär nicht verfügbar sind

## 1.3.0

### Adminseite — Tab-Navigation
- Einstellungsseite in vier Tabs unterteilt: **Dieses Tablet**, **Inhalte**, **Automationen**, **System**
- Nachtmodus aus dem bisherigen Hauptbereich in den Tablet-Tab verschoben
- Speichern-Button nur noch im Inhalte-Tab sichtbar (server-seitige Einstellungen)

### Nachtmodus
- Konfigurierbarer Nachtmodus: Startzeit, Endzeit und Helligkeit einstellbar
- Einstellung wird lokal auf dem Tablet gespeichert (localStorage)
- Nachtmodus wird jede Minute automatisch geprüft und angewendet

### HA-Automationen im Adminbereich
- Neuer Tab "Automationen": alle HA-Automationen mit Name und letztem Ausführungszeitpunkt
- Automationen direkt per Knopfdruck aktivieren und deaktivieren
- Aktualisieren-Button zum manuellen Neuladen der Liste

### Aktivitäts-Log (System-Tab)
- Serverseitiger Ringpuffer: alle Tor-Befehle werden mit Zeitstempel, Torstatus und Ergebnis protokolliert
- Log bleibt auch ohne offenes Tablet erhalten (bis zum nächsten Add-on-Neustart, max. 500 Einträge)
- Filter-Ansichten: Tor | Automationen (live aus HA-Logbuch) | Alle
- Fehlgeschlagene Befehle werden rot hervorgehoben

### Mitteilungs-Schwellwerte (System-Tab)
- Batterie-Warnschwelle konfigurierbar (Standard: unter 20 %)
- Abfall-Ankündigungszeitraum konfigurierbar (Standard: 1 Tag vorher)
- Abfall-Mitteilung zeigt jetzt auch "Leerung in X Tagen" bei mehrtägigem Vorlauf

### HA-Offlinebanner
- Fixierter roter Banner auf allen Seiten wenn Home Assistant nicht erreichbar ist
- Zeigt an wie lange HA bereits offline ist ("nicht erreichbar seit X Minuten")

### Schnellere Reaktionszeit
- Optimistisches UI: Kacheln wechseln den Zustand sofort beim Antippen
- Ladeanimation (Pulsieren) blockiert Doppeltippen während der Server antwortet
- Echter Zustand wird nach 1 Sekunde von HA abgerufen (Zeit für HA-Verarbeitung)

### Sicherheitskachel — Zuverlässige Aktualisierung
- Struktur/Sensordaten werden auf der Homeseite jetzt alle 10 Sekunden neu geladen (vorher nur einmal beim Start)
- Sicherheitskachel zeigt nun denselben Stand wie der Sicherheitsreiter

### Boiler-Timer-Mitteilung
- `api.js` fehlte in `index.html` — Boiler-Timer-Mitteilung wurde daher nie angezeigt (behoben)
- Timer-Countdown läuft clientseitig sekündlich weiter ohne Server-Polling

### Sicherheit
- Kameraname wird jetzt korrekt mit `escapeHtml()` escaped (XSS-Fix)

## 1.2.1

- Klimaübersicht: Layout auf iOS 9 (iPad 2) repariert — CSS Grid wird dort nicht unterstützt, alle Layouts auf flexbox umgestellt
- Klimaübersicht: `gap`-Eigenschaft durch Margins ersetzt (gap in flexbox erst ab Safari 14.1)
- Alle flex-Container mit `-webkit-`-Prefixen versehen für ältere Safari-Versionen

## 1.2.0

- Wettervorhersage (5 Tage) im Dashboard und Wetter-Modal
- Sicherheitsseite mit Offline-Warnung bei fehlender HA-Verbindung

## 1.1.0

- Media Player Integration
- Energieseite: Delta2 und Powerstream Detailansicht

## 1.0.0

- Erstes Release
