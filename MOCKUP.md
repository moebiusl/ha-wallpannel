# Wallpanel – ursprünglicher Aufbau mit moderneren Gerätekarten

Arbeitsbranch: `codex/ipad-wallpanel-neuaufbau`. Der Arbeitsstand bleibt lokal und uncommittet. Kein Push, Deployment oder Eingriff in Home Assistant. Ohne Commit sind Änderungen weiterhin Arbeitsverzeichnis-Inhalte, kein eigener Sicherungs-Commit.

## Öffnen

**Aktuell:** Die echte Anbindung ist unter `/panel/` umgesetzt. Siehe [PANEL-LOKAL.md](PANEL-LOKAL.md). Die folgenden Vorschauangaben beziehen sich ausschließlich auf `/mockup/`.

- Entwurf: **http://192.168.178.150:3000/mockup/**
- Auf dem Mac: **http://localhost:3000/mockup/**
- Bisheriges, mit HA verbundenes Wallpanel: `/start.html`.

Die neue Richtung behält die bewährte Bedienstruktur des ursprünglichen Wallpanels bei. Aus dem Apartment-Wallpanel übernehmen wir vor allem die Gestaltung der Lampen, Schalter, Heizungen und Musikgeräte in den Räumen sowie eine ruhigere Farbgebung. Der Entwurf ist keine Ablösung der bestehenden HA-/Tablet-Anbindung.

Die gesamte Vorschau benutzt Beispieldaten und führt keine Netzwerk-, HA-, Durchsage-, Assist-, Tor- oder Musikbefehle aus. Kameraansichten sind gekennzeichnete Illustrationen und Bewegungszeiten sind Beispielwerte. Der Mac muss für den lokalen Netzwerkzugriff eingeschaltet und wach bleiben; die IP kann sich bei einem Netzwerkwechsel ändern.

## Allgemeine Übersicht wie bisher

- **Eine kompakte Kopfzeile:** Navigation, Uhr/Datum, Durchsage, Assist und Einstellungen teilen sich eine Zeile. Der doppelte Seiten-/Datums-/Vorschaukopf entfällt. Die aktive vollständige Seite wird in der Navigation markiert; Wetterdetails sind ein Popup über der bisherigen Seite.
- **Obere Navigation:** Allgemein, direkt die dem Tablet zugeordneten Zimmer und die zusätzliche Raumwahl. Die Zimmerknöpfe sind Tabletprofil-Einstellungen; ein Tablet darf mehrere Zimmer verlinken.
- **Immer erreichbar:** Durchsage, Assist und die Einstellungen stehen unabhängig von der geöffneten Ansicht oben rechts. Auf schmalen Geräten bleiben beschriftete bzw. zugänglich benannte Symbole mit großen Touch-Flächen.
- **Obere Karten:** Wetter, Energie und Hoftor. Die Toraktion ist direkt erreichbar und wird vor der simulierten Ausführung bestätigt.
- **Große Kamera auf dem Homescreen:** Zeigt die letzte Bewegung mit Ereignisart und Zeit. Kameraknöpfe wechseln das Bild; „Neueste“ springt zum jüngsten Ereignis zurück. Antippen des Bildes öffnet ein großes Popup mit einem bildfüllend vergrößerten Eventbild; Zuschnitt ist zugelassen. Nur dort gibt es die Auswahl Event/Live. Auf dem Homescreen gibt es keinen direkten Live-Schalter. Beim Schließen, Zurückschalten auf Event oder Ersetzen des Popups durch eine Mitteilung endet der simulierte Live-Zustand. Eine manuelle Kameraauswahl wird bei Datenänderungen für 30 Sekunden beibehalten, statt sofort wieder umzuschalten.
- **Daneben:** Müllabholung, Status/Hinweise und direkt schaltbare Schnelllichter. Antippen der Müllkachel wechselt direkt zwischen nächster Abholung und allen drei Terminen; es öffnet sich kein Dialog und die Kamera wird dabei nicht neu aufgebaut. Status/Hinweise zeigt Fenster-, Tür- und Batteriehinweise. Das Hoftor steht ausschließlich in seiner eigenen Kachel bzw. in der Klingelbedienung. Die Schnelllichter lassen sich ebenfalls pro Tablet festlegen.
- **Keine Szenen-Voraussetzung:** Das Beispielmodell startet ohne Szenen. Raumlicht, Tor, Kameras, Durchsage und Assist sind unabhängig davon bedienbar. Szenen können später als Ergänzung aus HA hinzukommen.

Auf 1024×768, 1024×600 und 800×600 bleibt die allgemeine Übersicht vollständig sichtbar. Im Hochformat 768×1024 steht die Kamera oberhalb der ergänzenden Statuskarten. Bei 640×480 ist vertikales Scrollen vorgesehen. Die Hauptnavigation und die beiden Kommunikationsfunktionen bleiben oben.

## Räume und Geräte

Die Zimmer werden über ihre direkten Knöpfe geöffnet. Musik und Heizung stehen links, Licht und weitere Geräte rechts. Die Raumansicht darf bei vielen Geräten scrollen.

- Lampen: Die Kachel schaltet beim kurzen Tippen. Halten öffnet den großen senkrechten Regler beziehungsweise einen senkrechten Ein/Aus-Schalter. Auf der Kachel stehen keine Helligkeitsregler oder Switches. Ein/Aus-Lampen bekommen keine erfundenen Helligkeits-/Farbregler.
- Heizung: Halbkreisregler, Ist-/Solltemperatur, Betriebsarten und Plus/Minus.
- Musik/HomePods: Cover, Titel, Wiedergabe/Pause und Lautstärke. Halten oder Cover-Tipp öffnet weitere Funktionen.
- Schalter/Steckdosen: klarer Zustand und direkte Bedienung.

Die visuellen Verbesserungen sollen anschließend in die bestehenden Raumkomponenten übertragen werden. Das bewährte Home-Dashboard und die vorhandenen Integrationen bleiben die Grundlage.

## Durchsage und Assist

„Durchsage“ öffnet direkt ein Popup mit Zielauswahl, Texteingabe, vorbereiteten Sätzen und der Option zum Vorlesen. Auch eine empfangene Durchsage erscheint als eigenes, gut lesbares Popup. Über „Demo“ lassen sich „Durchsage empfangen“ und „Klingel ausprobieren“ auslösen; die Klingel zeigt ebenfalls ein Popup mit Bild und Toraktion. Im Mockup landet die Eingabe nur im Beispielmodell; es gibt keine echte Zustellung und keinen Ton.

„Assist“ öffnet direkt einen Textdialog. Fragen nach Temperatur oder Licht erhalten eine Antwort aus dem Beispielmodell des diesem Tablet zugeordneten Hauptraums. Andere Fragen bekommen eine entsprechend gekennzeichnete Vorschau-Antwort. Es wird keine browserseitige Mikrofonaufnahme oder Spracherkennung vorausgesetzt, damit der Weg auch für alte iPads geeignet bleibt. In der echten Anwendung soll die bestehende HA-Assist-Anbindung weiterverwendet werden.

## Einstellungen vor Ort und zentral

Über das Zahnrad lassen sich die Einstellungen direkt am Tablet entsperren. **Demo-PIN: `1310`.** Es gibt eine große Zahlentastatur und Unterstützung für die normale Tastatur. „Neu laden ohne Cache“ ist schon vor der PIN-Freigabe erreichbar. Dieser Knopf lädt die Seite sowie CSS und JavaScript über neue URLs und führt zurück zur PIN-Eingabe. Das gespeicherte Profil bleibt erhalten. Die Funktion löscht nicht den gesamten Safari-Speicher oder fremde Website-Caches. Nach einem Neuladen ist die Demo wieder gesperrt; die simulierte Freigabe gilt ansonsten zehn Minuten. Ein Direktlink auf die Einstellungen umgeht die PIN-Ansicht nicht.

Nach der Freigabe stehen zwei Ansichten zur Verfügung:

1. **Dieses Tablet:** Name, Hauptraum, Zimmer-Schaltflächen, zwei Schnelllichter, Schriftgröße, Bildschirmschoner, Nachtmodus und Töne.
2. **Alle Tablets:** Die identischen Profilfelder für jedes Beispieltablet und eine simulierte Identifizierung.

Beide Ansichten benutzen dieselbe Formularfunktion und dieselben Profilobjekte. Änderungen am aktuellen Tablet aus der zentralen Ansicht erscheinen daher auch unter „Dieses Tablet“. Das aktuelle Beispielprofil wird in einem eigenen Browser-Speicherschlüssel gesichert; die übrigen Beispielprofile leben nur in der geöffneten Sitzung. Nachtmodus, Bildschirmschoner und Audio werden hier nicht tatsächlich aktiviert.

Die PIN des Mockups ist nur eine UI-Demonstration, keine Produktionsauthentifizierung. Bei der späteren Übernahme muss die bereits bestehende serverseitige PIN-Sitzung der echten Anwendung verwendet werden. Die lokalen Einstellungen sollen dabei keine komplette Geräte-/Registry- oder Verwaltungsseite laden müssen: kleines Profil, zwischengespeicherte Auswahlmöglichkeiten und derselbe bestehende Speicher-/Sync-Weg wie in der zentralen Verwaltung.

## HA-Regeln bleiben bestehen

HA verwaltet Namen, Gerätetypen, Fähigkeiten, Räume und Sichtbarkeit. Im Entwurf gibt es keine Pflicht zu einer zweiten Geräteliste.

- Räume mit führendem `#` bleiben ausgeblendet, einschließlich führender Leerzeichen vor `#`.
- Nicht erreichbare Kameras werden ausgeblendet; die DWD-Wetterkarte gehört zum Wetter.
- Bei der bestehenden Live-Anbindung beschreibt ein HA-Status bzw. Verbindungssensor die gemeldete Erreichbarkeit. Ein Status wie `idle` beweist noch keinen erfolgreichen Bildabruf. Bildfehler mit begrenzter Wiederholung/Ausblendung müssen vor der echten Kameraübernahme behandelt werden.
- Ein ausgeblendeter oder entfernter Raum wird nicht durch einen fremden Raum ersetzt.

## Alte iPads und Leistung

Der Entwurf bleibt bei ES5-JavaScript, klassischem CSS mit `-webkit-flex`, Systemschriften und kleinen lokalen SVGs. Keine Framework-Laufzeit, kein Grid, keine CSS-Variablen, kein `fetch` und keine erforderlichen modernen Browser-APIs. Die Uhr wird alle 30 Sekunden aktualisiert. Es gibt keinen Polling-Takt, der die gesamte Oberfläche oder alle Profile laufend neu aufbaut.

Auf der Startseite wird nur ein Kamerabild gezeigt. Die Kamerawechsel-Knöpfe brauchen keine zusätzlichen Vorschaubild-Downloads. Ein Live-Stream soll erst nach ausdrücklicher Auswahl starten. Wetter-/Geräte-/Tabletlisten sollen in der späteren Integration weiterhin die vorhandenen Caches und gezielten Aktualisierungen nutzen. Das ist eine Weiterentwicklung des alten Systems, kein Grund, die bisherigen Leistungsverbesserungen zu ersetzen.

Sichtbare Schaltflächen haben mindestens ungefähr 44 CSS-Pixel große Touch-Ziele. Größere Schrift ist pro Tablet wählbar. CSS-Pixel und physische Display-Auflösung sind unterschiedlich; die Testgrößen sind verfügbare Browser-Viewports, keine Zusage über ein bestimmtes iPad-Modell.

## Prüfung und offene Abnahme

- `npm test`: Regressionstests einschließlich ES5-Parserprüfung, fehlender Netzwerk-/Gerätebefehle im Mockup und der HA-Filterregeln.
- `scripts/check-mockup.cjs`: optionale Chromium-/WebKit-Prüfung. `WALLPANEL_PLAYWRIGHT_MODULE` kann auf eine vorhandene Playwright-Installation zeigen, `WALLPANEL_PREVIEW_URL` auf eine abweichende Vorschauadresse.
- Fünf Bildschirmgrößen, Touch-Ziele, größere Schrift, Kamerawechsel und Neueste-Auswahl, unbeschnittenes Eventbild und explizite Live-Auswahl im Popup, Beenden des Live-Zustands, Müllwechsel ohne Popup, Wetter-Popup ohne Verlust der Navigationsposition, Empfang von Durchsage/Klingel als Popup, Cache-Neuladen schon bei der PIN-Eingabe, Zimmerverknüpfungen, Schnelllichter, Torbestätigung, Durchsage, Assist, falsche/richtige PIN, lokale/zentral identische Einstellungen und moderne Raumkarten werden geprüft. Jeder API-Aufruf aus der Vorschau wäre ein Testfehler.
- Screenshots und JSON-Bericht: `data/mockup-preview/` (von Git ausgeschlossen).

Noch offen bleiben die Prüfung auf den echten iPads mit iOS 9.3.6, Touch-/Audiofreigabe, Safari-/Homescreen-Höhe, Speicherverhalten der neuen Live-Oberfläche unter `/panel/`. Aktuelles WebKit und ES5-Syntaxprüfung ersetzen keine echte iOS-9-Abnahme.
