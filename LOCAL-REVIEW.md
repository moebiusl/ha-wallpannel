# Lokaler Umbau und Codeprüfung – 29.10.2026

Die Änderungen liegen ausschließlich lokal. Kein Commit, Push, Deployment oder Home-Assistant-Konfigurationswechsel wurde durchgeführt. Die lokalen Add-on-Quellkopien werden synchron gehalten; das installiert kein Update bei den Eltern.

## Ausprobieren

- Normal: `http://192.168.178.150:3000/start.html`
- Apartment-Vorschau: `http://192.168.178.150:3000/start.html?theme=apartment`
- Verwaltung: `http://192.168.178.150:3000/verwaltung`

Die IP gilt für den aktuellen WLAN-Anschluss des Macs. Der lokale Server muss laufen, der Mac wach bleiben. Gerätebefehle wirken auf den verbundenen echten HA-Server.

Das Vorschau-Design bleibt während der Browser-Sitzung auch bei Seitenwechseln aktiv, ändert aber kein Tabletprofil. „Design-Vorschau beenden“ kehrt zum gespeicherten Design zurück. Dauerhaft wechseln: Optionen → Dieses Tablet → Design oder zentral Optionen → Tablets → Design → Speichern. Klassisch bleibt die Voreinstellung, Home bleibt verfügbar.

Die Apartment-Variante verwendet warme dunkle Flächen, helle aktive Kacheln, goldene Akzente und im Querformat ab 960 px eine Seitenleiste. In der Raumansicht stehen Musik und Lampen nebeneinander, darunter die Heizung. Licht: Tippen schaltet, Halten für 600 ms oder „•••“ öffnet die unterstützten Lichtregler. Auf schmalen Bildschirmen passt sich die Anordnung an. Music Assistant bietet Playlist-Suche, Seitenwechsel und Wiedergabe auf dem jeweiligen Raumgerät; andere Mediengeräte zeigen ihre unterstützten Wiedergabefunktionen, Quellen und Lautstärke.

Alle Tablets müssen dieselbe Wallpanel-Instanz öffnen, um gemeinsam verwaltet zu werden. Die Mac-Instanz übernimmt keine Tabletprofile aus dem bereits laufenden Add-on. Namen, Räume, Design, Nachtmodus, Töne, Bildschirmschoner und Fernbefehle lassen sich über die Website verwalten. Neuere iPads mit Macintosh-Browserkennung werden jetzt ebenfalls erkannt.

## Behobene Fehler und Einschränkungen der bisherigen Umsetzung

- Die PIN-Freigabe war nur eine UI-Sperre. Änderungen an Panelkonfiguration, Tabletprofilen, zentralen Tablet-Einstellungen, Fernbefehlen und Add-on-Updates benötigen jetzt eine serverseitig geprüfte, signierte HttpOnly-Sitzung und einen eigenen Request-Header. Die Sitzung gilt acht Stunden; fünf falsche PIN-Versuche sperren die IP für eine Minute. POST benötigt JSON, sodass einfache fremde HTML-Formulare keine Geräteaktionen auslösen können. Das gesamte Wallpanel bleibt ein Dienst für das vertrauenswürdige lokale Netz, ohne eigenständige Benutzer-/Tablet-Anmeldung.
- Der allgemeine Service-Endpunkt erlaubte beliebige HA-Servicenamen und zusätzliche Zielbereiche. Jetzt werden nur freigegebene Geräteoperationen und ihre jeweiligen Datenfelder weitergegeben; Lautstärke, Helligkeit und Farbwerte werden geprüft.
- Moderne iPads mit Desktop-Browserkennung konnten in der Tabletverwaltung fehlen.
- Offline-Geräte verschwanden in der Raumansicht. Jetzt bleiben sie mit „Nicht erreichbar“ sichtbar, ihre Bedienelemente sind gesperrt. Auch auf der Klimaseite sind Offline-Regler gesperrt.
- Raumüberschreitend ausdrücklich ausgewählte Entitäten wurden vom Backend trotzdem ausgefiltert. Explizite Auswahl wird jetzt berücksichtigt.
- Physisch identische AirPlay-/Music-Assistant-Geräte wurden doppelt angezeigt. Music Assistant wird bei eindeutiger physischer Kennung bevorzugt und kann die HA-Raumzuordnung des Originalgeräts übernehmen. Unbekannte Zuordnungen werden nicht anhand ähnlicher Namen geraten.
- Mediengeräte wurden pauschal als HomePod bezeichnet und bekamen auch nicht unterstützte Schaltflächen. Die Anzeige verwendet jetzt Musik und berücksichtigt unterstützte Funktionen.
- API-Aufrufe hatten keinen Timeout; Fehler blieben teilweise unsichtbar. Es gibt jetzt begrenzte Wartezeiten und Rückmeldungen bei fehlgeschlagenen Raumaktionen. Ein geworfener UI-Callback konnte zuvor irrtümlich ein zweites Mal aufgerufen werden.
- Die Verwaltungsoberfläche wartete nacheinander auf Energie-, Wetter- und Wassertankdaten. Sie ist jetzt nach dem Laden der Struktur und Konfiguration bedienbar; Zusatzdaten werden parallel nachgeladen, ohne laufende Tablet-Eingaben erneut zu zeichnen.
- Eine Aktualisierung konnte während einer Reglergeste das Bedienelement ersetzen. Gesten werden berücksichtigt; beim Raum-Refresh wird die Scrollposition des Panels wiederhergestellt.
- HA-Namen wurden an einzelnen Stellen als HTML eingesetzt. Diese Stellen verwenden jetzt Text oder maskiertes HTML.
- Der Changelog wurde zweimal angefordert, einmal fälschlich als JSON.
- Versionsdatei und Changelog fehlten im Docker-Image. Das Dockerfile kopiert die benötigten Dateien jetzt mit.
- Konfigurations- und Tabletdateien werden atomar über temporäre Dateien gespeichert. Der Zeitpunkt „zuletzt gesehen“ wird auch bei durchgehend verbundenen Tablets regelmäßig gespeichert.

## Verifikation

- TypeScript ohne Ausgabe: `npx tsc --noEmit`.
- Automatisierte Regressionstests: `npm test` – PIN-Sitzung, unberechtigte Schreibzugriffe, Headerprüfung, manipulierte Cookies, PIN-Limit, Geräte-Servicefreigaben, Playlistkennungen, physische Medienkennung, Netzwerk-/Callback-Fehler.
- Browserprüfung mit Chromium und WebKit in 1024 × 768 und 768 × 1024: Vorschau und gespeicherter Designwechsel, Raumstruktur, Offline-Sperren, Lichtdialog per Taste und Haltegeste, Musikdialog und Verwaltungsformular. Keine JavaScript-Seitenfehler. Gerätebefehle und Verwaltungsänderungen wurden dabei abgefangen und mit Testantworten beantwortet.
- Echte HA-Verbindung lesend geprüft, einschließlich Laden von 20 Playlists aus Music Assistant. Keine echte Wiedergabe und keine Licht-/Heizungsbefehle für die Tests ausgelöst.
- Das ist kein vollständiger Dauertest auf iOS 9/12. WebKit auf dem Mac ersetzt die Abnahme auf den alten iPads nicht.

## Sinnvolle nächste Verbesserungen

1. **Raumzuordnungen in HA aufräumen.** Mehrere Musikgeräte haben keinen Raum. Die UI übernimmt vorhandene HA-Zuordnungen; ein fehlender Raum muss explizit festgelegt werden.
2. **Zustandsbestätigung nach Gerätebefehlen.** Aktuell wird nach erfolgreicher API-Anfrage erneut geladen. Als nächster Schritt sollten Bedienelemente erst nach passender HA-Zustandsmeldung Erfolg anzeigen und fehlende Bestätigung nach einer Frist melden.
3. **Server aufteilen.** `src/server.ts` enthält weiterhin sehr viele fachliche Bereiche. Tablet-, Musik-, Kamera-, Wetter- und Geräte-Routen sollten getrennte Module bekommen. Die neuen Authentifizierungs-, Medien- und Serviceprüfungen sind bereits separat.
4. **Zentrale dauerhafte Instanz.** Nach erfolgreichem Test das Add-on aktualisieren und alle Tablets darauf verwenden. Die aktuell lokale Website hängt am Mac; ein späterer Rollout braucht einen gesonderten Auftrag.
5. **Geräteanmeldung und Rollen.** Vor einem Zugriff über das Internet sollten individuelle Tablet-Sitzungen, Widerruf und getrennte Verwaltungsrechte eingeführt werden. Die neue PIN-Sitzung schützt Verwaltungsänderungen, ersetzt aber keine vollständige Zugriffskontrolle für HA-Daten und normale Gerätebefehle.
6. **Dauerbetrieb testen.** Insbesondere Tonfreigabe nach Neustart, Klingel, Kamera-Fallback, Netzwerkausfälle und Akku-/Speicherverhalten auf den echten alten iPads.

## Ergänzung: HA als zentrale Gerätequelle

Die automatische Übernahme wurde für Räume, Geräte, Lichtdaten und Kameralisten erweitert. Hersteller-/Namensfilter wurden durch HA-Metadaten ersetzt, Änderungen an der HA-Struktur werden im laufenden Betrieb nachgeladen, und ein gelöschter Raum fällt nicht mehr auf einen anderen Raum zurück. Ein veralteter expliziter Eintrag kann HA-Ausblenden/Deaktivieren nicht umgehen. Der Lichtdialog verwendet dynamische Entitätskennungen; dabei wurden auch doppelte IDs und fehlerhafte Verschachtelungen des alten Lichtdialog-Markups entfernt.

Die neuen Regressionstests decken die Geräte- und Raumänderungen ohne feste Panel-Geräteliste ab. Details und ehrliche Grenzen des automatischen Betriebs stehen in [HA-AUTOMATIK.md](HA-AUTOMATIK.md), insbesondere die noch nicht umgestellten Sonderkarten für Tor, Müll, Energie und Wassertank.

## Entwurfsrichtung korrigiert: ursprüngliche Abläufe bewahren

Der Entwurf behält wieder die allgemeine Übersicht mit Wetter/Energie/Tor, großer Kamera samt letzter Bewegung und Kamerawechsel, Abfall/Status/Schnelllichtern und direkten Zimmerknöpfen pro Tablet. Durchsage und Assist sind ständig erreichbar. Szenen sind keine Voraussetzung. Lokal per Demo-PIN und zentral werden dieselben Tabletprofil-Felder bearbeitet. Aus dem Apartment-Projekt kommen vor allem die modernisierten Gerätekarten und die Farbgebung; das bestehende Wallpanel bleibt die technische Grundlage. Der interaktive Entwurf bleibt vollständig simuliert. Details: [MOCKUP.md](MOCKUP.md).


## Weitere Bedienkorrekturen am Entwurf

Der Kopf ist auf eine gemeinsame Navigations-/Uhr-/Aktionszeile verdichtet. Das Hoftor wird in Status/Hinweisen nicht mehr doppelt angezeigt. Die Müllkachel wechselt ihre Inhalte direkt und baut dabei das Kamerabild nicht neu auf. Wetterdetails, eingehende Durchsagen und Klingeln erscheinen als Popups. Das Kamera-Popup zeigt das ganze Eventbild und bietet erst dort die Live-Auswahl; Schließen oder Wechsel des Popups beendet den simulierten Live-Zustand. Bereits auf der PIN-Eingabe ist ein Neuladen mit neuen HTML-/CSS-/JS-URLs möglich, ohne das Beispielprofil zu löschen.

## Neue Live-Oberfläche `/panel/`

Die beschriebenen Bedienkorrekturen und Apartment-Gerätekarten sind jetzt mit der bestehenden HA-API, Music Assistant, Assist, Kamera-/Bildproxy und Tablet-Befehlswarteschlange verbunden. Die Vorschau bleibt separat. Der Live-Einstieg verwendet serverseitig geschützte PIN-Sitzungen und zentrale Profile. Konkrete Batteriehinweise stehen unmittelbar in der Übersicht.

Zusätzlich behoben: Wetterauswahl ignoriert nicht verfügbare und explizit versteckte Wetterentitäten, erhält aber die globale Wetterkarte bei Zuordnung zum ausgeblendeten Raum `#Status`; Profiländerungen werden vor der Speicherbestätigung atomar geschrieben (Heartbeat-Schreibvorgänge bleiben gebündelt); Geräteaktionen warten auf passende HA-Rückmeldungen und melden eine fehlende Bestätigung nach 15 Sekunden. Die Empfehlung zur Zustandsbestätigung oben ist damit für `/panel/` umgesetzt. Details und Prüfungen: [PANEL-LOKAL.md](PANEL-LOKAL.md).

## Funktionsabgleich mit dem bisherigen Wallpanel

Die verkürzten Wetter-, Energie- und Tor-Popups wurden durch vollständige Ansichten der bestehenden Serverdaten und Torfunktionen ersetzt. Wetter umfasst Wetterstation, Tank/LED, Vorhersage und bedienbares DWD-Radar; Energie umfasst Powerstream, Netz, Delta2, Tages-/Restzeitwerte und Batterien. Die Tor-Kachel öffnet die Steuerung, statt unmittelbar eine Öffnung anzufordern.

Die Raumansicht folgt der Apartment-Vorlage: Musik und Licht nebeneinander, darunter Raumklima-Karten. Lichtkacheln enthalten keine direkten Regler mehr; kurzes Tippen schaltet und Halten öffnet den senkrechten Dimmer beziehungsweise Schalter.

Gefundene Fehler: Aus-Befehle wurden irrtümlich mit Zustand `0` statt `off` verglichen; nach dem Schließen eines Popups konnte ein bereits vorgemerkter Render die neue Oberfläche nochmals ersetzen. Beides ist korrigiert. Schaltfeedback pulsiert bis zur Bestätigung. Live hat Lade-/Fehler-/Wiederholungszustände und eine frische URL je Verbindung, sodass alte dekodierte Bilder nicht irrtümlich als neu gestarteter Stream erscheinen. Abbrüche während des Streamaufbaus sowie native HA-MJPEG-Verbindungen werden serverseitig aufgeräumt und gedrosselt.

Die Prüfungen enthalten zusätzlich geteilte MJPEG-Frames, Startabbrüche, Licht-Ausschalten, Dimmen bis 0, binäre Licht-Popups, Pulsieren, Radarsteuerung, alle Detailbereiche sowie Live-Fehler und Wiederholen. Ein echter Livestream wurde gelesen und in WebKit dekodiert. Keine echten Tor-/Licht-/Heizungsbefehle während der Tests.

Zusätzlich am echten Stream gefunden und behoben: Safari wartete bei einer unveränderten Szene auf die nächste Multipart-Grenze. Die gedrosselte Ausgabe sendet diese bereits hinter dem ersten Frame. Der abschließende WebKit-Test dekodierte den echten Stream erfolgreich.

## Popup-Touch-Sperre und adaptive Raumkarten

Nach langem Drücken blieb das Flag zur Unterdrückung des folgenden Klicks auch für andere Touch-Ziele aktiv. Dadurch konnte insbesondere Safari den nächsten Schließen-Tipp unterdrücken. Die Sperre ist nun an das ursprüngliche Element gebunden; Touch-Ende und neue Berührungen setzen die Haltegeste zurück. Schließen räumt die Oberfläche auch bei einem Fehler in der Ressourcenfreigabe auf. Der Popup-Kopf bleibt außerhalb des getrennt scrollbaren Inhalts.

Die Räume vermeiden leere Gruppen und künstlich gestreckte Karten. Offline-Lampen werden ausgeblendet, Lichtkacheln enthalten nur Namen und Symbol. Einzelne Szenen, Lampen, Heizungen und Schalter können die volle Gruppenbreite nutzen. Eine einzelne Heizung verteilt ihre Inhalte in einer Reihe; Heizen bekommt einen warmen Verlauf. Szenenbefehle warten nicht auf einen unpassenden Zustand `on`, da HA die letzte Aktivierung als Zeitstempel meldet.

## Räume aus Tabletprofilen entfernen

Der Hauptraum wurde beim Speichern erzwungen erneut in die Raum-Schaltflächen aufgenommen. Zudem behandelte die Darstellung eine ausdrücklich leere Liste wie ein altes Profil ohne Raumliste. Beide Ursachen sind behoben: Die Auswahl wird unverändert gespeichert, und eine leere Auswahl bleibt leer. Bestehende ältere Profile ohne `rooms`-Feld behalten ihren bisherigen Hauptraum als Standard. Das gilt für das eigene Tablet und die zentrale Bearbeitung.

Die Einstellungen nutzen die volle Seiten- beziehungsweise Popup-Breite. Das fehlerhafte Zahnrad wurde durch einen zentrierten symmetrischen SVG-Pfad ersetzt. `scripts/check-tablet-rooms.cjs` prüft Haupt-/alle Räume entfernen, Neuladen, erneutes Hinzufügen und zentrale Profile in Chromium und WebKit; der Persistenztest prüft eine gespeicherte leere Liste nach erneutem Laden der Registry.

## Horizontales Scrollen in Dialogen

Wetter- und Energiewerte ragten durch negative Grid-Außenabstände um fünf Pixel aus dem scrollbaren Popup-Inhalt. Die Grid-Abstände liegen jetzt innerhalb der Inhaltsbreite. Derselbe Fehler wurde bei Raumwahl, Formularen, Toraktionen, Farbauswahl und Durchsage-Vorlagen sowie den separaten Szenen-/Kameraansichten korrigiert. Lange Batterie- und Messwertnamen umbrechen; die mehrtägige Vorhersage verteilt sich bei Bedarf auf mehrere Zeilen. Inhalte werden nicht lediglich abgeschnitten oder durch versteckten Overflow verdeckt.

`scripts/check-dialog-layout.cjs` prüft 13 Popup-Arten und die normalen Hauptansichten in fünf Bildschirmgrößen mit Chromium und WebKit: keine horizontale Scrollstrecke, vollständige siebentägige Vorhersage und erreichbares Schließen nach vertikalem Scrollen. Alle API-Antworten sind dabei simuliert; Gerätebefehle sind ausgeschlossen.

## Ausgewogene Musik-/Lichtzeile und Heizungsbedienung

Die unterschiedlich hohen Musik- und Lichtgruppen wurden aufeinander abgestimmt. Musik füllt dieselbe Zeilenhöhe wie die Lichtgruppe, bei der letzten ungeraden Lampe entfällt die halbleere letzte Zeile. Die Lichtinhalte sind gemeinsam zentriert.

Die Heizungsmetadaten bilden einen kompakten Kopf. Betriebsart und Temperaturschritte stehen als zusammengehörige Steuerelemente neben dem Halbkreis; eine doppelte Statusanzeige und separat verstreute Tasten entfallen. Der vorhandene Verlauf bleibt erhalten. Bedienung, Mindest-Touchflächen und Grenzen werden für einzelne und mehrere Heizungen geprüft. Die Browserprüfung prüft jetzt auch gleiche Musik-/Licht-Kartenhöhen und innerhalb der Heizungs-Karte liegende Knöpfe in mehreren Auflösungen.

## Scroll-Sperre für Popup-Hintergründe

Beim Öffnen eines Popups werden die Scrollpositionen der Hintergrundbereiche gesichert und deren Scrollen einschließlich iOS-Momentum deaktiviert. Beim Schließen werden die vorherigen Positionen wiederhergestellt. Der Hintergrund nimmt keine Zeigeraktionen an. Die Sperre bleibt auch bestehen, wenn ein Popup durch eine eingehende Meldung ersetzt wird.

Zusätzlich begrenzt ein ES5-Touch-/Mausrad-Handler Gesten auf tatsächlich scrollbare Popup-Bereiche. Am oberen/unteren Rand sowie auf Kopf und Hintergrundfläche verhindert er das Weiterreichen der Bewegung. Eigene Helligkeits-/Temperaturregler behalten ihre Gesten; native horizontale Schieberegler und scrollbare Textfelder bleiben bedienbar. `overscroll-behavior` ergänzt die Lösung für neuere Browser, ist aber für iOS 9 nicht erforderlich.

`scripts/check-popup-scroll.cjs` prüft Popup-Scrollen, unveränderten Hintergrund, Touch-Randfälle, Popup-Wechsel, Wiederfreigabe und Regler. Die bisherigen Touch-Schließen-Prüfungen laufen ebenfalls weiter in Chromium und WebKit.


## 01.11.2026 – Weiterer statischer Performance-/Popup-Abgleich

Behoben: Dialogwechsel im neuen Panel meldeten irrtümlich eine Klingelerledigung an alle Tablets. Der neue Close-Hook unterscheidet Benutzer, Fernschließen und lokalen Ablauf. Ergänzt wurden die bisherigen Klingel-Lichtschalter, Auto-Torfunktion, Ablauf sowie Durchsagedauer/Dringlichkeit und sequentielles Audio. Keine realen oder simulierten Alarm-/Popupaktionen ausgeführt (ausdrückliche Benutzervorgabe).

Zusätzliche Begrenzungen: Artwork maximal 32 MiB/40 Einträge mit LRU; Registry-Abfragen 60 statt 15 Sekunden, weiterhin unmittelbar bei Registry-Ereignissen invalidiert; Farbkreis-Pixeldaten wiederverwenden; versteckte Dokumente pausieren den sekündlichen UI-Takt und Verwaltungspolls. Es gibt keine neue Messung am alten iPad und keine pauschale Zusage einer bestimmten Beschleunigung. Bereits vorhandene Polling-, DOM-Erhaltungs- und Streambegrenzungen bleiben maßgeblich.

Drei Hauptdesigns sind im Tabletprofil auswählbar. Frühere Home-Vorschauprofile bleiben kompatibel. Build und ES5-Syntaxprüfung bestanden; Funktions-/Browser-Suites wurden in diesem Durchgang bewusst nicht ausgeführt.
