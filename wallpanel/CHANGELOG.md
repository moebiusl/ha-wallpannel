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
