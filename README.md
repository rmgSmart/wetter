# Wetter

Eine kleine Wetterseite fürs iPhone, gedacht als Web App am Home Bildschirm.

Die Seite holt die Daten selbst für den aktuellen Standort des Geräts. Wird der Standort nicht freigegeben, zeigt sie Wien 1010.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html` | Seite, Darstellung, Himmelsanimation |
| `daten.js` | Standort, Abruf und Aufbereitung der Wetterdaten |
| `gigio.js` | Gigio, die Katze im Katzenmodus |
| `sprites/` | Posen von Gigio |
| `manifest.webmanifest`, `icon-*.png` | Web App für den Home Bildschirm |

## Datenquellen

* GeoSphere Austria, Dataset API: stündliche Vorhersage (`nwp-v2-1h-1km`), Unsicherheit (`ensemble-v2-1h-1km`) und Regen in 15 Minuten Schritten (`nowcast-v1-15min-1km`). Lizenz CC BY 4.0.
* Open-Meteo: Tage nach den rund 60 Stunden von GeoSphere, außerhalb des GeoSphere Gebiets alle Werte. Lizenz CC BY 4.0.
* OpenStreetMap Nominatim: Ortsname zum Standort. © OpenStreetMap Mitwirkende, ODbL.

## Veröffentlichen

GitHub Pages, Quelle `main`, Ordner `/`. Ein Build Schritt ist nicht nötig.
