# Arbeitszeit PWA

Dieses Paket enthält deine echte `index.html` mit eingebauten PWA-Dateien.

## Enthalten

- `index.html` – deine Arbeitszeit-App mit PWA-Head-Tags und Service-Worker-Registrierung
- `manifest.webmanifest` – PWA-Manifest für Installation auf dem Homescreen
- `sw.js` – Service Worker für Offline-Cache nach dem ersten Laden
- `ArbeitszeitIcon.png` – Original-Appicon
- `icons/` – erzeugte Icon-Größen für Android/iPhone/Browser

## Wichtig

Zum Installieren als PWA muss die App über `https://` laufen, z. B. GitHub Pages, Render oder ein anderer HTTPS-Host. Lokal per Datei-Doppelklick funktioniert die App zwar, aber PWA-Installation und Service Worker laufen dort meist nicht.

Wenn auf dem Handy noch ein altes Icon erscheint: alte PWA vom Homescreen löschen, Browser-Cache leeren oder die App erneut hinzufügen.
