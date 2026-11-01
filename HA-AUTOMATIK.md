# Home Assistant verwaltet die Geräte

Home Assistant ist die Quelle für Räume, Etagen, Gerätenamen, Entitätstypen, Raumzuordnungen, Sichtbarkeit und unterstützte Funktionen. Im normalen Betrieb wird keine zweite Geräteliste im Wallpanel gepflegt.

## Im Alltag

1. Ein neues Gerät in Home Assistant hinzufügen und dort einem Raum zuordnen.
2. Den gewünschten Namen in Home Assistant vergeben.
3. Das Wallpanel übernimmt die unterstützten Entitäten in den passenden Raum. Lampen, Heizung und Musik werden anhand ihrer HA-Typen eingeordnet.
4. Ein Gerät in HA umbenennen, einem anderen Raum zuordnen, ausblenden, deaktivieren oder entfernen: Das Wallpanel übernimmt die Änderung automatisch.

Ein kurzzeitig nicht erreichbares Gerät bleibt als „Nicht erreichbar“ sichtbar, seine Bedienelemente sind gesperrt. Ein entferntes Gerät verschwindet. Wird der Raum selbst gelöscht, zeigt das Tablet einen Hinweis und keine Geräte eines Ersatzraums.

Ohne Raum zugeordnete Geräte werden nicht anhand ähnlich klingender Namen in einen Raum geraten. Die Zuordnung erfolgt in HA. Eine Entitätszuordnung hat Vorrang vor der Raumzuordnung des Geräts. Bei eindeutig identischen AirPlay-/Music-Assistant-Geräten kann die Zuordnung des Originalgeräts übernommen werden.

Im Wallpanel verbleiben die Tablet-Einstellungen: Name des Tablets, zugehöriger HA-Raum, Design, Bildschirmschoner, Nachtmodus und Töne. Die erweiterten Inhaltsoptionen bleiben als bewusste Ausnahme verfügbar; sie sind keine Voraussetzung für neue Geräte. Eine alte explizite Panelauswahl kann eine in HA ausgeblendete oder deaktivierte Entität nicht wieder sichtbar machen.

## Was automatisch arbeitet

- Raumansichten verwenden aktuelle HA-Raumtitel und nehmen neue unterstützte Geräte automatisch auf.
- Die normale Geräteanzeige berücksichtigt HA-Sichtbarkeit sowie Diagnose-/Konfigurationskategorien. Gerätemodelle und Textteile in Namen bestimmen nicht, ob beispielsweise eine Lampe ausgeblendet wird.
- Die Startseiten-Lichtdaten und der Lichtdialog sind dynamisch und bedienen die tatsächlichen aktuellen Entitäten des Tablet-Raums.
- Die Kameraliste kommt aus HA. Ein Eventbild wird über dieselbe HA-Gerätekennung zugeordnet, wenn die Zuordnung eindeutig ist. Sonst wird das normale HA-Kamerabild verwendet. Bestehende go2rtc-Streamüberschreibungen bleiben als optionale technische Ausnahme erhalten.
- Wetter auf der Startseite wird aus den verfügbaren sichtbaren HA-Wetterentitäten gewählt. Bei mehreren Quellen wird derzeit nach Anzeigename sortiert; eine fachliche Priorisierung mehrerer Wetterstationen ist noch nicht vorhanden.
- Sicherheits- und Batterieanzeigen verwenden HA-Metadaten statt fester Ausschlusslisten für Herstellernamen oder bestimmte Gerätekennungen.
- Änderungen an den HA-Registries leeren den Strukturcache. Die Navigation prüft zusätzlich alle 30 Sekunden die aktuelle Struktur; Raumansichten laden ihre Daten alle 10 Sekunden. Ein Cache mit standardmäßig 15 Sekunden begrenzt die HA-Abfragen, auch wenn mehrere Tablets verbunden sind. Daher ist dies keine garantierte sofortige Echtzeitsynchronisation; ohne passendes HA-Ereignis kann eine Navigationsänderung bis etwa 45 Sekunden benötigen.

## Bewusst noch vorhandener Altbestand

Die bisherigen Sonderkarten für die konkrete Torsteuerung, Müllabholung, Energiegeräte, Wetterstationsdetails und Wassertank enthalten weiterhin installationsbezogene Zuordnungen. Die Bedeutung solcher Werte lässt sich aus einem generischen Sensor oder seinem Namen nicht zuverlässig ableiten. Beispielsweise darf das Wallpanel nicht alle Watt-Sensoren addieren und dadurch Verbrauch doppelt zählen.

Für diese Bereiche soll künftig ebenfalls HA die fachliche Bedeutung liefern: standardisierte Entitäten, HA-Gruppen, Szenen und Skripte bzw. gezielt in HA gepflegte Kennzeichnungen. Ein Skript für eine bestimmte Toraktion wird in HA an die Hardware angepasst; das Wallpanel stellt dessen Bedienung dar. Diese Sonderbereiche sind noch nicht vollständig auf dieses Modell umgestellt. Es wurden keine Gruppen, Skripte, Labels oder Zuordnungen in HA verändert.

Die alten festen Licht-Service-URLs bleiben vorerst für Kompatibilität bestehen. Die aktuelle automatische Oberfläche benutzt generische Befehle an die von HA gelieferten Entitäten.

## Prüfung

Automatisierte Tests simulieren Hinzufügen, Löschen, Umbenennen, Raumwechsel, HA-Ausblenden, Deaktivieren und Offline-Zustände. Kamerazuordnung und fehlende Räume werden separat geprüft. Browserprüfungen mit Chromium und WebKit testen geänderte Geräte- und Raumnamen sowie neue Entitätskennungen während einer geöffneten Seite. Geräteaktionen werden dabei abgefangen; es werden keine echten Geräte geschaltet.

## Ergänzung zum neuen Entwurf

HA-Räume mit führendem `#` werden ausgeblendet. Kameras benötigen einen erreichbaren HA-Status und gegebenenfalls einen positiven Verbindungssensor. DWD-Wetterkarten werden aus der Kameraliste ausgeschlossen und bleiben Wetterinhalte. Die Erreichbarkeit folgt den HA-Meldungen und ist noch kein vollständiger Bild-/Livestream-Test. Details zum separaten, ausschließlich simulierten Entwurf: [MOCKUP.md](MOCKUP.md).
