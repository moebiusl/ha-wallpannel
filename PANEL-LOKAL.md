# Neue lokale Live-Oberfläche

Branch: `codex/ipad-wallpanel-neuaufbau`. Lokaler Arbeitsstand, keine Commits oder Pushes und kein Rollout auf den Server der Eltern.

## Test auf dem iPad

1. Mac und iPad im gleichen WLAN, Mac eingeschaltet und wach lassen.
2. `http://192.168.178.150:3000/panel/` öffnen. Bei einer anderen lokalen Mac-IP die Adresse anpassen.
3. Oben „Räume“ wählen; unter Zahnrad mit der bestehenden Verwaltungs-PIN Tabletname, Hauptzimmer und Zimmerknöpfe festlegen. Die Demo-PIN gilt ausschließlich unter `/mockup/`.
4. „Alle Tablets“ verwaltet dieselben Profile aus der Ferne.

Die Oberfläche ist mit dem HA-Server aus `.env` verbunden. Schalten, Heizen, Musik, Tor und Assist sind echte Aktionen. Das bisherige Wallpanel unter `/start.html` und die isolierte Vorschau unter `/mockup/` bleiben erreichbar. Eine Browserkennung wird in Local Storage gespeichert und für die vorhandene Tabletverwaltung verwendet.

## Bedienung

- Allgemein: vollständige Wetter-/Energie-Popups, separates Hoftor mit Steuerungs-Popup, Kamera mit letztem Ereignis, inline wechselnde Abfalltermine, konkrete Batterie-/Tür-/Alarmhinweise und eine Liste einzelner Hinweiskarten.
- Kamera: Im Überblick Ereignisbild; Antippen öffnet das Bild über die gesamte verfügbare Popup-Fläche; dabei darf es zugeschnitten werden. Live wird nur im Popup gewählt. Schließen, Event-Auswahl, ein anderes Popup oder Hintergrundwechsel entfernen den Stream. Eine Ladeanimation bleibt bis zum ersten dekodierten Livebild sichtbar. Ein Fehler bietet eine erneute Verbindung an; ein Eventbild wird im Live-Modus nicht als laufender Stream ausgegeben. Nicht erreichbare Bilder werden für eine Minute ausgeblendet und erneut versucht. DWD-Karten bleiben außerhalb der Kameraliste.
- Musik: Cover, Titel, Play/Pause und Lautstärke unmittelbar auf der Karte. Halten auf dem Musikbereich oder Antippen des Covers öffnet weitere Funktionen inklusive Music-Assistant-Bibliothek und vorhandener Quellen.
- Heizung: Halbkreis mit HA-Minimum, Maximum und Schrittweite, Ist-/Solltemperatur, unterstützten Betriebsarten und Plus/Minus.
- Licht: Die ganze Kachel schaltet beim kurzen Antippen. Keine Helligkeitsanzeige, kein Slider und kein Switch auf der Lichtkachel. Halten öffnet den senkrechten Apple-artigen Helligkeitsregler; reine Ein/Aus-Lampen erhalten stattdessen einen großen senkrechten Schalter. Unterstützte Farboptionen stehen darunter.
- Durchsage und Klingel: Popups, Töne abhängig vom Tabletprofil; Safari benötigt eine erste Berührung zur Audiofreigabe. Assist verwendet den vorhandenen HA-Konversations-/Audio-Proxy. Auf iOS 9 wird Assist per Text bedient.
- Einstellungen: Bestehende serverseitige PIN-Sitzung; Neuladen mit neuen Asset-URLs bereits bei der PIN-Eingabe. Profile speichern zentral und dauerhaft; Raumknöpfe, Schnelllichter, Schrift, Bildschirmschoner, Nachtmodus und Hinweistöne sind lokal und zentral bearbeitbar. Nachtzeiten entsprechen der bisherigen Konfiguration, bei neuen Profilen 22–7 Uhr.

## Daten und Leistung

Räume, Geräte, Namen und Zuordnungen kommen aus HA. Führendes `#` blendet Räume aus. Die globale Wetterkarte bleibt auch bei Zuordnung zu einem ausgeblendeten Verwaltungsraum wie `#Status` verfügbar; explizit in HA versteckte Wettergeräte bleiben verborgen. Mehrere Heizungen und Musikgeräte pro Raum werden übernommen; fehlende Raumzuordnungen werden in HA gepflegt. Die neue `/api/panel/state`-Antwort enthält nur benötigte Attribute und keine Bild-Tokens. Cover werden serverseitig über eine begrenzte Bild-Cache-Route geladen. Die Sonderkarten für Tor, Energie und Müll verwenden weiterhin die vorhandenen installationsbezogenen Serverfunktionen.

Gerätezustände werden alle 5 Sekunden, Dashboard/Kameras alle 15 Sekunden, Tabletbefehle alle 3 Sekunden nachgeladen. Unveränderte Daten bauen die Oberfläche nicht neu auf. Während Reglerbedienung, Dialogen oder Einstellungsformularen wird der Hintergrund nicht ersetzt. Gerätebefehle sperren weitere identische Aktionen bis zur HA-Bestätigung; nach 15 Sekunden ohne Bestätigung erscheint eine Meldung. Keine automatische Wiederholung eines Schaltbefehls. Im Bildschirmschoner pausieren Geräte-/Dashboardabfragen, Tablet- und Klingelbefehle bleiben aktiv.

## Prüfung

- `npm test`: serverseitige Rechte und Gerätebefehle, dynamische HA-Zuordnung, kompakte Datenausgabe, dauerhafte Tabletprofile, Reglermathematik und ES5-Parserprüfung für Live-/Vorschau-/Start-/Regler-Skripte.
- `npm run build`: TypeScript.
- `scripts/check-mockup.cjs`: isolierte Vorschau in Chromium/WebKit, fünf Größen, kein API-Zugriff.
- `scripts/check-panel.cjs`: Live-Oberfläche in Chromium/WebKit mit vollständig abgefangener API. Licht/Helligkeit, Heizung, Musik/Lautstärke, HA-Umbenennen/Entfernen, PIN, lokale/zentrale Profile, Kamera Event/Live, Wetter, Durchsage, Klingel und Assist. Keine echten HA-Schaltbefehle beim Test.
- Browsermodule bei Bedarf über `WALLPANEL_PLAYWRIGHT_MODULE` angeben. Screenshots liegen unter `data/mockup-preview/` und sind ignoriert.

Modernes WebKit und ES5-Prüfung ersetzen keinen Test auf iOS 9.3.6. Offen ist die Abnahme auf echten iPad-2/3-Geräten: Touch, Audiofreigabe, Standby, Speicher und Kamerastream im Dauerbetrieb.

## Detailumfang und Rückmeldungen

- Wetter verwendet zusätzlich `/api/wetterstation` und `/api/wassertank`: Außenwerte, Tages-/Monats-/Jahresregen, Regenrate, Druck/Trend, Wind/Kompass, UV, Tankinhalt/-höhe und vorhandene LED-Bedienung. DWD-Vorhersage und Radar mit Zeitleiste, Einzelbildern, Abspielen/Pause und Niederschlagsverlauf sind im selben Popup erreichbar.
- Energie übernimmt die komplette bestehende `/api/energy`-Antwort: Zusammenfassung inklusive Lade-/Restzeit und Tageswerten, Powerstream, Haus/Netz, Delta2 sowie sichtbare Batterien.
- Das Tor-Popup enthält Status, Schließ-/Fahrzeit, smarte Steuerung, Automatik, Dauer-Auf, AutoÖffnen, Impuls und +60 Sekunden. Das Öffnen des Popups löst keinen Torbefehl aus.
- Schaltende Geräte pulsieren bis zur HA-Bestätigung. Ein/Aus-Bestätigung wurde korrigiert; ausstehende Aktionen sperren weitere identische Befehle. Hintergrundaktualisierungen ersetzen während einer Berührung keine Kacheln.
- Live-Verbindungen bekommen eine eigene URL je Start. Abgebrochene Starts werden freigegeben; ein abgebrochener Browser wartet serverseitig nicht weiter auf die HA-Verbindung. MJPEG aus go2rtc und dem nativen HA-Proxy wird auf maximal vier Bilder pro Sekunde begrenzt und verwirft bei Rückstau Bilder.

Ein echter Stream wurde lokal bis zu mehreren vollständigen JPEG-Frames gelesen und zusätzlich in WebKit mit dekodierten Bildern geprüft (je nach Kamera 1448 × 1080 beziehungsweise 552 × 416); der Wechsel auf Event entfernte das Stream-Element. Licht-, Heizungs- und Toraktionen bleiben in den Browserprüfungen vollständig abgefangen. Echte iOS-9-Hardware ist weiterhin separat zu prüfen.

Die MJPEG-Ausgabe liefert die nachfolgende Multipart-Grenze bereits mit dem ersten Bild. Dadurch kann Safari auch bei ruhiger Szene das erste Bild sofort dekodieren, statt auf eine weitere Bildänderung zu warten. Der abschließende echte WebKit-Test nach dieser Korrektur zeigte das Livebild und entfernte beim Wechsel auf Event alle Stream-Elemente.

## Übersicht und Popup-Größen

Die Schnellzugriff-Karte und das Haus-Icon in der Navigation entfallen. Hinweise stehen als einzelne Karten in einer scrollbaren Liste. Abfall wechselt beim Tippen zwischen nächster Abholung und drei nebeneinander angeordneten Terminen; die äußere Kartengröße bleibt unverändert. Papier ist blau, die gelbe Tonne gelb und Restmüll braun markiert.

Die Kameragroßansicht nutzt die verfügbare Breite und Höhe bildfüllend, einschließlich Zuschnitt. Schließen und Einstellungen haben feste runde 44-Pixel-Flächen mit zentrierten Symbolen. Die Navigationsuhr ist größer. Das Hoftor öffnet seine Steuerung durch Antippen der gesamten Karte ohne zusätzlichen Steuern-Knopf; AutoÖffnen ist im Popup hervorgehoben.

## Kompakte Räume und zuverlässiges Schließen

Die Touch-Sperre nach einer Haltegeste gilt nur für den zugehörigen ursprünglichen Tipp. Der nächste Tipp auf Schließen wird nicht mehr unterdrückt. Alle Popups besitzen einen festen Kopf mit Schließen-Knopf und einen getrennt scrollbaren Inhalt. Neuladen ohne Cache steht unten links im PIN-Fenster.

Lichtkacheln zeigen nur Symbol und Namen; Raum und An/Aus-Text entfallen, unerreichbare Lampen werden ausgeblendet. Leere Musik-/Licht-/Heizungsbereiche werden nicht als Platzhalter gerendert. Musik und Licht stehen kompakt nebeneinander, ohne künstlich gleiche Höhe. Zugeordnete Szenen stehen darüber; eine einzelne Szene nutzt die ganze Breite. Eine einzelne Heizung belegt ebenfalls die ganze Breite und verteilt ihre Bedienelemente horizontal. Heizen erhält auch bei momentan ruhendem Heizventil einen warmen Verlauf.

Prüfung: `scripts/check-popup-touch.cjs` testet Halten und anschließendes Schließen mit echten Touch-Ereignissen in Chromium und WebKit sowie lange scrollbare Popups und die PIN-Fußzeile. Die Live-Prüfung deckt ausgeblendete Offline-Lampen, minimale Lampenbeschriftungen, Heizungsverlauf, einzelne und mehrere Heizungen/Szenen sowie die Szenenaktivierung ab. Szenen werden nach erfolgreicher API-Anfrage bestätigt; ihr HA-Zustand ist ein Zeitstempel und kein Ein/Aus-Zustand.

## Kartenabstimmung in den Räumen

Musik und Licht bilden auf breiten Ansichten eine gemeinsame Zeile mit identischer Kartenhöhe. Die Lautstärke sitzt unten in der Musik-Karte, Cover/Titel oben; im Hochformat mit schmaler Breite stehen die Gruppen untereinander. Bei ungerader Lampenzahl füllt die letzte Lampe die gesamte letzte Zeile. Symbole und Namen sind innerhalb der Lichtkacheln zusammen zentriert.

Heizungen verwenden eine kompakte Kopfzeile und eine zusammengehörende Bediengruppe: Betriebsarten als segmentierte Auswahl, darunter Plus/Minus als gemeinsamer Regler. Der einzelne Status unter dem Namen ersetzt die wiederholte Statuszeile zwischen den Temperaturknöpfen. Eine einzelne Heizung bleibt über die ganze Breite mit horizontal verteilter Information und Bedienung. Der warme Heizungsverlauf bleibt erhalten. Bei ausgeschalteter Heizung sind direkte Temperaturänderungen wie der Halbkreis deaktiviert; die Betriebsart lässt sich weiterhin umstellen.

## Gemeinsame Tablet-Funktionen (01.11.2026)

Alle folgenden Funktionen sind lokal umgesetzt. Es werden keine zusätzlichen HA-Helfer benötigt; Räume, Gerätezuordnung und Sichtbarkeit kommen weiterhin aus HA.

- **Heizungen:** Bei mehreren Heizungen im Raum erscheint „Mit anderen synchronisieren“. Einmalige Übernahme der aktuellen Betriebsart und Solltemperatur; Aus verändert keine gespeicherte Zieltemperatur. Der Server prüft alle erreichbaren Ziele vor dem ersten Befehl (Raum, Sichtbarkeit, Betriebsart, Wertebereich und Schrittweite). Nicht erreichbare Ziele werden übersprungen, Teilfehler gemeldet. Parallelbefehle auf betroffene Heizungen werden während des Schreibens abgewiesen. Zielkarten warten auf eine nach der Befehlsantwort gestartete HA-Abfrage, die beide Werte bestätigt.
- **Gerätehinweise:** Batteriewarnungen werden nach HA-Geräte-ID gebündelt. Ungültige/unbekannte Batteriewerte sind keine Entwarnung. Offline-Hinweise entstehen erst nach mindestens zehn Minuten fortlaufender erfolgreicher Beobachtung; ein Serverneustart oder eine längere HA-Verbindungsunterbrechung beginnt die Beobachtungszeit erneut.
- **Posteingang:** „Posteingang“ unter Status & Hinweise öffnet alle gemeinsamen Meldungen. „Ausblenden“ entfernt nur die Karte von der Übersicht, „Erledigt“ archiviert gemeinsam. Aktive erledigte Probleme bleiben erledigt, bis sie nach bestätigter Erholung erneut auftreten; sie lassen sich auch manuell wieder öffnen. Unbekannte Sensorzustände lösen keine falsche Entwarnung aus. Die offene Liste aktualisiert sich auch bei Änderungen von einem anderen Tablet. Erledigte/behobene Einträge bleiben bis zu 90 Tage erhalten.
- **Ton und Updates:** Der Kopf zeigt „Ton aktivieren“, „Ton bereit“ oder „Ton aus“. Freigabe wird ausschließlich durch ein tatsächliches Audio-Playing-Ereignis bestätigt; auch das alte iOS-Verhalten ohne Promise-Rückgabe wird unterstützt. Ein Start kann mit stummer WAV-Datei freigegeben werden; ein ausdrücklicher Tastendruck spielt den Testton. Hardwarelautstärke/Stummschalter werden damit nicht gemessen. Der Server verankert die geladene Asset-Version im HTML; neue Versionen markieren Einstellungen mit einer roten 1. Einstellungen zeigen geladenen/verfügbaren Stand, Tonstatus und Update-/Reload-Taste.
- **Fern-Reload:** In Einstellungen alle Tablets, im jeweiligen Tablet-Editor ein einzelnes Tablet. Die bisherige zentrale Verwaltung bietet ebenfalls Einzel-/Sammel-Reload und gemeldeten Ton-/Versionsstatus. Aufträge werden vor der Bestätigung atomar gespeichert, gelten 24 Stunden und werden bei jedem Sync erneut angeboten. Erst das neue Browserdokument quittiert seine passende Auftrags-ID; verlorene Antworten verursachen keine Neustartschleife. Offene Popups, Einstellungen/Eingaben, Gerätebefehle, Gesten und laufendes Audio verschieben den Reload. Offline-Tablets holen ihren Auftrag beim nächsten Kontakt innerhalb der Frist ab. Die alte Oberfläche versteht ebenfalls die Boot-Quittierung.
- **Raumklima:** Kompakte Temperatur-/Luftfeuchtewerte über Musik und Licht, nur bei verfügbaren plausiblen Messwerten. HA-Raumsensoren werden bevorzugt; ansonsten tatsächliche Thermostat-Messwerte. Mehrere Messwerte werden gemittelt, Fahrenheit wird umgerechnet. Solltemperaturen sind keine Raumtemperaturmessung.

Gemeinsame Meldungen und Reload-Aufträge liegen in `data/panel-features.json` (bzw. neben der eingestellten Panel-Konfigurationsdatei). Die Datei gehört zusammen mit `tablets.json` zur Datensicherung. Atomare Speicherung mit privaten Dateirechten; keine zusätzlichen Cloud-Zugänge. Tonstatus ist eine aktuelle Browsermeldung und wird nach Serverstart beim nächsten Sync erneut erfasst.

Prüfung: `npm test` (33 Tests), `npm run build`, ES5-Prüfung im Testsatz; `scripts/check-panel-features.cjs` prüft zwei getrennte Tablet-Sitzungen in Chromium und WebKit einschließlich gemeinsamem Posteingang, Heizungssynchronisierung, altem Audio-Start ohne Promise, blockiertem Ton, Update-Markierung, Dialog-/Audio-/Eingabeschutz und bestätigtem Neustart ohne Schleife. Die vorhandene Live-Prüfung und die Raumzuordnungsprüfung laufen weiterhin. Alle Browser-Schreibrequests werden abgefangen; keine echten Heizungen, Lampen oder Tore für Tests geschaltet, keine Durchsage verschickt. Echter Ton und Dauerbetrieb auf dem iPad 3 bleiben der Hardwaretest.

## Mac-Verwaltung und Wartung (01.11.2026)

`/verwaltung` öffnet nach der vorhandenen PIN-Anmeldung die zentrale Tabletverwaltung. Je registriertem Tablet lassen sich Name, Hauptraum und alle Raum-Schnelltasten (auch eine leere Auswahl), größere Schrift, Klingel-Popup, Tonprofil, Bildschirmschoner sowie Nachtzeiten und Abdunkelung speichern. Die bisherigen Panel-/Designfelder gelten ausdrücklich für die klassische Oberfläche. Das neue Panel verwendet seinen eigenen Aufbau. Die Mac-Verwaltung selbst registriert sich nicht als Wandtablet.

Die Wartungsübersicht zeigt HA-Verbindung, aktuelle Serverversion, Online-/Letzter-Kontakt-Angaben, Tabletadresse, gemeldete UI-/Tonstände, verfügbare Updates und vorgemerkte Reloads. Gemeinsame Gerätehinweise lassen sich dort ebenfalls ausblenden, erledigen, wieder anzeigen und mit erledigten Hinweisen einsehen. Statusabfragen laufen alle zehn Sekunden; ungespeicherte bzw. fokussierte Tabletformulare werden dabei nicht ersetzt, globale Durchsage-/Klingeleingaben beim Hintergrundabgleich ebenfalls nicht.

„Alle Tablets neu laden“ oben auf der Verwaltungsseite verwendet denselben dauerhaften, quittierten Reload-Ablauf wie die Einzelsteuerung und die Tablet-Einstellungen. Ein gespeicherter Auftrag ist keine Bestätigung eines bereits erfolgten Neustarts. Bedienung und Audiowiedergabe werden berücksichtigt, Offline-Aufträge bleiben bis zu 24 Stunden verfügbar. Tonfreigabe bleibt eine Nutzerberührung am jeweiligen iPad.

Zusätzlich korrigiert: Ein aus der Ferne ausgeschaltetes Klingel-Popup wird im neuen Panel berücksichtigt; Durchsage-Vorlagen werden aus der zentral gespeicherten Liste übernommen. Die größere Schrift vergrößert auch die neuen Musik-, Licht- und Heizungsfelder.

Geprüft mit `scripts/check-tablet-admin.cjs` in Chromium/WebKit: vollständige Profile speichern, Räume einschließlich Hauptraum entfernen, Eingaben bei Hintergrundabfrage erhalten, Hinweise gemeinsam bearbeiten, Einzel-/Sammel-Reload und Identifizieren sowie Übernahme von Schrift, Klingel-Einstellung und Durchsage-Vorlagen in einem zweiten Browserfenster. Sämtliche API-Aufrufe im Test simuliert, keine echten Tablets neu geladen oder Mitteilungen gesendet.

## Home, Apps, Startbestätigung und iPad-Performance (01.11.2026)

Die Übersicht heißt jetzt **Home**. Direkt neben Räume steht **Apps** mit Einstellungen und Posteingang. Der Einstellungszugang bleibt PIN-geschützt; ein Update-Badge erscheint nun auch am Apps-Knopf. Der Tonzugang im Kopf ist ein runder 44-Pixel-Button mit einem zentrierten Symbol, zugänglichem Namen und Statusfarbe.

Nach jedem vollständigen Laden zeigt das Panel Gerätename und tatsächlich geladene Version. Bei einer neu verfügbaren Serverversion bietet das Fenster das Laden der aktuellen Version an. „Bestätigen & Ton aktivieren“ wartet auf das echte Audio-Playing-Ereignis; eine erfolgreiche Promise-Rückgabe oder eine bloß verstrichene Wartezeit reichen nicht. Fehler erlauben Wiederholung oder ausdrücklich vorerst ohne Ton fortzufahren. Bei im Profil ausgeschalteten Tönen reicht Bestätigen. Hintergrund, Escape und Schließen können das Startfenster nicht umgehen. Mitteilungen warten bis nach der Bestätigung; der Bildschirmschoner und automatische Fern-Reload warten ebenfalls. Tonfreigabe und echte Hardwarelautstärke bleiben getrennte Dinge.

Performance-Anpassungen:

- Identische Inhalte werden nicht mehr als neuer DOM-Baum eingesetzt. Navigation, Symbole, Uhr und Status werden nur bei tatsächlichen Änderungen geschrieben.
- Beim Ersetzen anderer Inhalte bleiben unveränderte Kamera- und Cover-Hintergründe als bestehende Elemente erhalten. Das verhindert den Verlust bereits geladener/decodierter Bilder.
- Auf Raum-/Apps-Seiten wird der große Home-Dashboardabruf ausgelassen. Die Geräte-/Befehlsabfragen laufen weiter; beim Zurückkehren auf Home werden veraltete Dashboarddaten nachgeladen.
- Die regelmäßige Panel-Abfrage nutzt `compact=1`: Steuergeräte und für die Energiedetails benötigte Batteriewerte, ergänzt um die bestehenden Raumklima-/Posteingangsdaten. Die vollständige Zustandsroute bleibt ohne den Parameter verfügbar.
- Nach einem Gerätebefehl wird bis zur Bestätigung zeitweise im Abstand von 500 ms nachgefragt. Die normale Abfragerate im Leerlauf bleibt unverändert, Doppelbefehle bleiben gesperrt.
- Auf iOS 9/10 ersetzt ein einmalig erzeugtes, interpoliert vergrößertes 12×12-Canvas den laufenden CSS-Blur des Musikhintergrunds. Das Cover bleibt weich im Hintergrund, ohne die große Filterfläche ständig zusammensetzen zu müssen.

Messbarer Rendering-Vergleich (`scripts/check-panel-performance.cjs`, synthetische API-Daten, jeweils Chromium/WebKit): Acht Änderungen an nicht sichtbaren Sensoren lösten vorher acht vollständige Inhaltsersetzungen aus, danach **null**. Bei einer sichtbaren Energieänderung ging das Kameraelement vorher verloren; danach bleibt dasselbe Element bestehen. Das ist eine Rendering-Regressionsprüfung, keine gemessene Bildrate auf dem echten iPad 3.

Zusätzlich geprüft: `scripts/check-panel-startup.cjs` für Startfenster, Escape/Hintergrund, Audiostart ohne Promise, Fehler/Wiederholung, stummes Profil, Apps/PIN und den iOS-9-Canvas-Pfad. Die vorhandenen Live-, Mehrtablet-, Raumzuordnungs- und Mac-Verwaltungsprüfungen sind an die neue Navigation angepasst. Alle Test-Schreibzugriffe werden simuliert.

Lokaler HA-Lesevergleich beim Abschluss: vollständige Antwort 278 Entitäten / 96.853 Bytes, kompakte Antwort 124 Entitäten / 52.686 Bytes; alle 16 Batteriewerte bleiben für die Energiedetails erhalten. Größen beziehen sich auf unkomprimiertes JSON dieses Messzeitpunkts. Die Tonfreigabe erfolgt jetzt ausdrücklich im Startfenster oder über das Ton-Icon; beliebige andere Klicks lösen keinen Freigabeversuch aus.

## Update-Badges und eindeutige Reload-Auswahl

Bei abweichender Server-/Browserversion zeigen Apps und die Einstellungskachel jeweils eine rote **1**; nach Laden des aktuellen Stands verschwinden beide. Einstellungen bieten ausdrücklich „Dieses iPad neu laden“ (frische Asset-URLs, danach Home und Startbestätigung) und „Alle iPads neu laden“ (gemeinsamer dauerhafter Auftrag). Unter Alle Tablets gibt es zusätzlich direkt je Gerät „iPad neu laden“. Auch in der Mac-Verwaltung heißt die gemeinsame Aktion „Alle iPads neu laden“.

Die Mehrtablet-Browserprüfung kontrolliert beide tatsächlichen CSS-Badges und prüft zusätzlich den ausdrücklichen Eigen-Reload einschließlich erneutem Startfenster. Für die gemeinsame Aktion bleiben Dialog-, Eingabe- und Audiowarten sowie Boot-Quittierung erhalten.

## Apps Sicherheit und Energie (01.11.2026)

Unter Apps gibt es zwei zusätzliche große, farbige Kacheln:

- **Sicherheit** (`#security`): erreichbare Kameras mit Ereignisbild und letzter Bewegung, Übersicht aktiver Bewegung/Anwesenheit und offener Kontakte, alle in HA sichtbaren Bewegungs-/Anwesenheitsmelder sowie Tür-/Fenster-/Öffnungskontakte. Vorhandene Rauch-, Gas-, CO-, Feuchte- und Sicherheitsmelder erscheinen zusätzlich als Warnmelder. Unbekannte und nicht erreichbare Zustände bleiben ausdrücklich erkennbar. HA-Raum und letzter Zustandswechsel stehen direkt am Sensor. Kamera antippen öffnet den bestehenden Event-/Live-Dialog; Live wird erst nach ausdrücklicher Auswahl gestartet. Unveränderte Kameraelemente bleiben bei Sensoränderungen erhalten.
- **Energie** (`#energy`): farbige Kennzahlen für Solar, Hausverbrauch, Netz und Einspeisung; Powerstream/Delta2 mit geprüftem Akkufüllstand, sämtlichen vorhandenen Gerätemesswerten, Ertrag, Lade-/Entladeinformationen, Temperaturen und Zyklen. Darunter Haus-/Netzwerte, nach HA-Gerät gebündelte Batterien/Akkus sowie die weiteren sichtbaren Leistungs-, Energie-, Spannungs- und Stromsensoren nach Gerät. Fehlende Werte sind „–“/„Unbekannt“, keine angenommenen Nullwerte. Ein Fehler erhält die geladenen Werte als ausdrücklich letzten bekannten Stand.

Die Apps sind reine Anzeigen; es werden weder neue HA-Gerätezuordnungen fest eingetragen noch Steuerbefehle für Sensoren oder Energiemessgeräte eingebaut. Explizit ausgeblendete/deaktivierte HA-Entitäten und die bestehende Raum-Sichtbarkeit werden respektiert. Die bereits vorhandene globale Solar-/Speicherübersicht nutzt weiterhin dieselben Quellen wie die Home-Energiekarte.

Die kompakte Zustandsabfrage ergänzt Sicherheitssensoren ausschließlich bei geöffneter Sicherheitsseite. `/api/panel/energy` liefert die vorhandene Energieübersicht plus sichtbare Messgeräte; die App lädt sie nur während ihrer Anzeige, maximal alle zehn Sekunden bzw. auf ausdrückliche Aktualisierung. Kameras bleiben standardmäßig bei Ereignisbildern. Datenneuzeichnungen warten auch auf das Ende des Scrollens, damit längere Sensor-/Energielisten nicht mitten im Scrollen ersetzt werden.

Validierung: 37 Node-Tests einschließlich ES5-Prüfung des neuen `public/panel/apps.js`. `scripts/check-security-energy-apps.cjs` prüft Chromium und WebKit mit vollständig simulierten APIs: Sensorzustände, Änderungen/Unverfügbarkeit, Event/Live und Freigabe beim Schließen, unveränderte Kamerabilder, Batterieduplikate/unklare Füllstände, zusätzliche Messgeräte/Einheiten, Fehleranzeige/letzter Stand, keine Abfragen auf anderen Seiten sowie kein horizontaler Überlauf bei 1024×768, 768×1024, 1024×600 und 640×480. `scripts/check-panel-performance.cjs` bleibt erfolgreich. Keine echten Kameras live gestartet, Geräte geschaltet oder Durchsagen gesendet.

## Kompakte Raumsteuerung, Farben und HomePod-Musik (01.11.2026)

Bei mehreren Heizungen steht „Mit anderen synchronisieren“ rechts neben Name/Status in derselben Kopfzeile. Die Lampensymbole und Namen werden als gemeinsame Gruppe über die volle tatsächliche Höhe ihrer Kachel zentriert, auch wenn die benachbarte HomePod-Karte höher ist. Lange Lampennamen sind auf zwei Zeilen begrenzt; der vollständige Name bleibt im zugänglichen Namen und im Einstellungsdialog verfügbar.

Die Raumauswahl verwendet größere Icon-Karten mit erkennbarem ausgewähltem Raum und ein Suchfeld. Räume mit führendem # bleiben ausgeblendet. Ein einzelner Suchtreffer nutzt die Breite des Fensters. Es wird nur die Liste gefiltert, ohne den Dialog bei jedem Tastendruck neu aufzubauen.

Farblampen bekommen die Bedienelemente des Apartment-Wallpanels: Farb-Vorauswahlen, Bearbeiten/Löschen, speicherbare eigene Farben, Weißtemperatur innerhalb der von HA gemeldeten Kelvin-Grenzen sowie einen aufklappbaren Farbkreis mit Farbton-/Sättigungsreglern. Die bestehende vertikale Helligkeitssteuerung bleibt erhalten und übernimmt die Farbdarstellung. Der Farbkreis wird erst beim Öffnen gezeichnet (kleinere Canvas-Auflösung auf alten iPads). Farbänderungen beim Ziehen sind Vorschauen; erst Loslassen/Change sendet einen einzelnen gezielten Befehl. Native Schalterlampen behalten ihren einfachen Ein/Aus-Regler. Alle Fähigkeiten, RGB-/HS-Werte und Kelvin-Grenzen werden serverseitig geprüft. Es wird nur ein Farbmodus pro Befehl akzeptiert; die Karte wartet auf die passende frische HA-Rückmeldung.

Farb-Vorauswahlen liegen atomar und mit privaten Dateirechten in `data/light-presets.json` neben den bestehenden Tablet-/Panel-Dateien. Diese Datei gehört zur Datensicherung. Die Vorauswahlen sind je HA-Lampe gespeichert und werden beim Öffnen des Dialogs geladen; keine zusätzlichen HA-Helfer oder feste Gerätelisten.

HomePod-Details zeigen aktuellen Titel, Play/Pause, vorherigen/nächsten Titel und Lautstärke, danach die Radio-Vorauswahlen **HIT RADIO FFH** und **HITRADIO RTL**, anschließend **Apple Music & Playlists** mit Suche und weiteren Seiten. Es werden ausschließlich vorhandene Music-Assistant-Playlists angeboten; Apple-Music-Inhalte müssen dort angebunden/verfügbar sein. Herkunft wird nur als Apple Music markiert, wenn die Antwort entsprechende Providerdaten enthält, andernfalls als Bibliothek. Die bestehende Bibliothek lieferte beim lesenden Abgleich bereits 20 Einträge und weitere Seiten. Playlist-Kacheln verwenden die tatsächlichen Titel, keine erfundenen Albumcover.

Radio startet über Music Assistant auf dem im Raum gewählten Lautsprecher. Der Browser sendet nur den festen Sendernamen ffh/rtl; die URL wird serverseitig aus einer festen Liste gewählt, keine beliebigen URLs aus dem Browser. Keine Audio-Streams auf dem alten iPad. Die offiziellen Direktadressen stammen aus [FFH Stream-Adressen](https://www.ffh.de/musik/webradio/stream-adressen.html) und [HITRADIO RTL Direktlinks](https://www.hitradio-rtl.de/programm/empfang/HITRADIO-RTL-Livestreams-Direktlinks-id679340.html). Zielbindung und Bibliothekszugriff verwenden die vorhandene [Music-Assistant-HA-Integration](https://www.home-assistant.io/integrations/music_assistant/).

Validierung: `npm run build`, 39 Node-Tests einschließlich Farbvalidierung, dauerhafter Vorauswahl-Speicherung und ES5-Parser für beide neuen Farbscripte. `scripts/check-room-controls.cjs` prüft Chromium/WebKit mit iOS-9-User-Agent: zwei nebeneinander liegende Heizungsüberschriften, mittige Lampen neben künstlich hoher Musikkarte, große Schrift bei 1024×768 und 768×1024, Raumsuche, Farbkreis mit genau einem Befehl pro Maus-/Touch-Geste, Kelvin-Regelung, Speichern/Löschen, zwei Radioziele, Playlist-Paginierung und gezielte Wiedergabe. Alle Schreibaufrufe sind simuliert. Die bisherige vollständige Live-Browserprüfung bleibt erfolgreich. Keine echten Lampen umgestellt und keine Musik auf den Geräten gestartet; hörbare Wiedergabe bleibt der Gerätetest.


## 01.11.2026 – Drei Designs und Abgleich eingehender Popups

Die Designwahl bietet Klassisch, Apartment und Neues Wallpanel, sowohl unter Apps → Einstellungen als auch unter `/verwaltung`. Bestehende experimentelle Home-Profile bleiben lesbar. Ein Rendererwechsel navigiert zwischen `/start.html` und `/panel/`; die Tabletkennung bleibt erhalten. Die Wahl wird im zentralen Profil gespeichert. Eine serverseitige Designrevision erkennt auch die ausdrückliche erneute Wahl eines bereits gespeicherten Designs. Laufende Eingaben, Popups, Geräteaktionen und Audio verzögern den Wechsel. Der direkte Einstieg unter `/panel/` bleibt zum Ausprobieren möglich, ohne beim ersten Sync sofort auf das alte Profil zurückzuspringen.

Das neue Klingel-Popup enthält nach Codeabgleich mit `layout.js` den Livestream mit Lade-/Fehlerzustand, die konfigurierten Lichtschalter und „Hoftor auto öffnen“. Nach drei Minuten ohne Popupbedienung schließt es lokal. Nur ausdrückliches Schließen auf dem Tablet meldet die Erledigung an die anderen Tablets. Remote-Schließen, Ablauf und bloßer Popupwechsel senden keine weitere Erledigung. Remote-Schließen entfernt auch vorgemerkte Klingel-Popups während der Startbestätigung. Streams werden beim Verlassen/Hintergrundwechsel beendet.

Durchsagen erhalten Dringlichkeit, Uhrzeit, Dauer/Fortschritt und automatisches Schließen. Hinweiston und Sprache laufen nacheinander; wartende Durchsagen überschreiben keine geöffneten Dialoge. Vorlesen wird gespeichert, Vorlagen senden wie im bisherigen UI direkt, das Versandfenster bleibt für weitere Nachrichten offen. Die Tonfreigabe bleibt ausdrücklich erforderlich.

Performance: HA-Registries werden regulär höchstens einmal pro Minute geladen; Strukturereignisse invalidieren sofort. Registry-Cache und Geräteaktions-Invalidierung sind getrennt. Der Titelbildcache hält maximal 32 MiB/40 Bilder, zuletzt benutzte Bilder bleiben bevorzugt erhalten. Farbkreise verwenden einmal berechnete Pixel erneut. Der sekündliche UI-Takt und weitere Verwaltungspolls pausieren im Hintergrund; Gerätebestätigungsfristen werden um die Hintergrundzeit verlängert.

**Prüfumfang dieser Änderung:** TypeScript-Build und ES5-Syntaxprüfung aller 27 Browser-/Inline-Skripte sowie Dateiprüfung des Panel-Loaders. Auf ausdrücklichen Wunsch keine Klingel-, Durchsage-, Ton-, Alarm- oder Popup-Funktionstests, auch keine simulierten Browser-Suites. Es wurden keine Geräteaktionen gesendet. Bedienung, Streamaufbau und Tonfolge sind damit für diesen Änderungsstand nur anhand des Codes abgeglichen, nicht funktional verifiziert.


## 01.11.2026 – Update 1.11.0, Navigation und PIN-Wartung

Add-on-Version in `wallpanel/config.yaml` auf 1.11.0 angehoben und Änderungen in `wallpanel/CHANGELOG.md` ergänzt. Weiterhin kein Commit, Push oder Deployment.

Der automatische 60-Sekunden-Rücksprung der klassischen/Apartment-Oberfläche ist entfernt. Das neue Panel behält beim normalen, Cache- und Fern-Reload die Seite bei; Raum-URLs enthalten nun auch die Raumkennung. Ohne expliziten URL-Abschnitt wird die letzte Seite derselben Browser-Sitzung wiederhergestellt. Ein nicht mehr vorhandener Raum fällt auf einen verfügbaren Raum zurück.

Cache-Reload aus dem PIN-Fenster lädt dessen darunterliegende Seite. Reload aus Einstellungen prüft die bestehende serverseitige Verwaltungssitzung: bei gültiger Sitzung Einstellungen, sonst Apps ohne automatisch geöffnetes Keypad. Die Startbestätigung zur Version/Tonfreigabe bleibt erhalten.

Unter dem PIN-Zahlenfeld stehen „Neu laden ohne Cache“ und „Alle iPads neu laden“. Der Sammelauftrag bleibt serverseitig PIN-geschützt: mit gültiger Sitzung direkt, sonst PIN eingeben; nach erfolgreicher PIN wird der vorgemerkte Sammelauftrag ausgeführt statt die Einstellungen zu öffnen. Das aktuelle Tablet wartet anschließend wie bisher auf den sicheren Leerlauf. Die Tasten sind 72 px groß, bei schmalen/niedrigen Ansichten 64 px, jeweils rund und in drei Spalten.

Prüfung: TypeScript-Build, ES5-Syntax aller 28 Browser-/Inline-Skripte und Dateiprüfung des Loaders; zehn isolierte Node-Prüfungen für Navigation und PIN-/Reload-Entscheidungen. Diese laufen ohne Browser, Netzwerk, Ton oder Geräteaktionen. Keine Klingel-, Durchsage-, Alarm- oder realen Sammelreload-Tests.


### Korrektur der Designauswahl

Die drei gewünschten Designs sind **Klassisch, Apple und Neues Wallpanel**. Apple verwendet das bereits vorhandene Home-Design (`home`, `theme-home.css`). Die irrtümlich angebotene Apartment-Auswahl entfällt. Frühere Apartment-Werte werden beim Lesen als Apple interpretiert; bestehende Home-Auswahlen bleiben erhalten. Das gilt für die gemeinsame Auswahl auf dem Tablet und in der Verwaltung. Keine Veröffentlichung oder Geräteaktionen.
