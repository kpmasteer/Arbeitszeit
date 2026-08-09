ARBEITSZEITEN-PWA v0.3.0
=========================

Dies ist weiterhin eine normale PWA. Es ist keine native iPhone-App.

ORDNERSTRUKTUR
- index.html
- css/app.css
- js/app.js
- icons/
- manifest.webmanifest
- service-worker.js

UPLOAD ZU GITHUB
1. Den Inhalt dieses Ordners in das bestehende GitHub-Repository hochladen.
2. Dabei die vorhandenen Dateien ersetzen.
3. Die bisherige Webadresse unverändert lassen, damit lokale Nutzerdaten erhalten bleiben.
4. Die installierte PWA öffnen und unter Einstellungen auf „Nach Update suchen“ tippen.

WICHTIG
- Arbeitszeiten, Urlaub, Krankheit und Einstellungen liegen lokal im Browser.
- Ein Update des App-Caches löscht diese Daten nicht.
- Beim nächsten Release müssen APP_VERSION in js/app.js und CACHE_NAME in service-worker.js erhöht werden.
- Auf dem iPhone die PWA über Safari installieren.


v0.2.1: Appweite Zeitanzeige wählbar: Stunden:Minuten, Dezimalstunden oder beides.
v0.3.0: Heutiges Datum beim Erfassen vorausgewählt. Monat und Kalender zu einer mobilfreundlichen Monatsübersicht zusammengeführt.
