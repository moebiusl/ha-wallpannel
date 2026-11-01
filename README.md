# HA Wallpanel

Touch-optimiertes Wallpanel fuer Home Assistant.

## Als Home-Assistant-Add-on installieren

1. Dieses Repository nach GitHub pushen.
2. In Home Assistant zu **Einstellungen > Add-ons > Add-on Store** gehen.
3. Oben rechts **Repositories** oeffnen.
4. Die Repository-URL hinzufuegen:

   `https://github.com/moebiusl/ha-wallpannel`

5. Store neu laden, **HA Wallpanel** installieren und starten.

Das Add-on nutzt automatisch die interne Home-Assistant-API ueber `SUPERVISOR_TOKEN`; du musst im Add-on keinen Long-Lived Access Token eintragen.

## Auf alten iPads

Am zuverlaessigsten ist der direkte Zugriff ueber den freigegebenen Port:

`http://homeassistant.local:3000`

Ingress ueber die Home-Assistant-Weboberflaeche ist ebenfalls aktiviert.

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Lokal werden `HA_URL` und `HA_TOKEN` aus `.env` genutzt.

## Designs und Tabletverwaltung

Unter **Optionen → Dieses Tablet → Design** stehen Klassisch, Apple (`home`) und Neues Wallpanel (`panel`, öffnet `/panel/`) zur Auswahl. Über **Optionen → Tablets** lässt sich das Design auch aus der Ferne pro Tablet einstellen. Die Verwaltung ist direkt über `/verwaltung` erreichbar. Das frühere Test-Design Apartment wurde entfernt; gespeicherte Apartment-Profile werden als Apple gelesen.

Lokale Änderungen, behobene Fehler, Prüfungen und weitere Verbesserungen: [LOCAL-REVIEW.md](LOCAL-REVIEW.md).

## Geräte automatisch aus Home Assistant

Geräte, Räume, Namen und Sichtbarkeit werden in Home Assistant gepflegt. Neue unterstützte Geräte erscheinen automatisch im zugewiesenen Raum; Änderungen werden während des Betriebs nachgeladen. Im Wallpanel genügt normalerweise die Zuordnung des Tablets zu einem HA-Raum.

Verhalten, Aktualisierungsintervalle und noch installationsbezogene Sonderkarten: [HA-AUTOMATIK.md](HA-AUTOMATIK.md).

## Neuer Entwurf für alte iPads

Der bedienbare Entwurf unter [`/mockup/`](http://localhost:3000/mockup/) behält die ursprüngliche Übersicht mit Kamera, Wetter und Schnellaktionen bei und übernimmt modernere Raumkarten aus dem Apartment-Wallpanel. Er verwendet ausschließlich Beispieldaten und ist auf iOS 9 als Ziel ausgerichtet. Die Tablet-Einstellungen sind direkt per Demo-PIN `1310` und ebenso zentral erreichbar. Konzept, Filterregeln, Testgrößen und offene Geräteprüfung: [MOCKUP.md](MOCKUP.md).

## Neue Live-Oberfläche lokal testen

Unter **[http://localhost:3000/panel/](http://localhost:3000/panel/)** läuft die neue Oberfläche mit echten HA-Daten. Auf dem iPad im selben WLAN: **http://192.168.178.150:3000/panel/** (Mac eingeschaltet lassen). Geräteaktionen werden wirklich ausgeführt.

Die Übersicht behält Kamera, Wetter, Energie, Tor, Abfall und Schnelllichter. Raumkarten zeigen HomePod-Cover/Titel/Play/Lautstärke, weitere Musikoptionen per Halten oder Cover-Tipp, Halbkreis-Heizungsregler und Lichtkacheln mit senkrechtem Regler beziehungsweise Schalter beim langen Drücken. Einstellungen sind mit der bestehenden Verwaltungs-PIN geschützt; „Dieses Tablet“ und „Alle Tablets“ speichern dieselben zentralen Profile.

Die isolierte Beispieldaten-Vorschau bleibt unter `/mockup/`, die bisherige Oberfläche unter `/start.html`. Details und Testgrenzen: [PANEL-LOKAL.md](PANEL-LOKAL.md). Es wurde nichts committed, gepusht oder ausgerollt.
