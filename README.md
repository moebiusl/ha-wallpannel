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
