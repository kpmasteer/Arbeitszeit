# Arbeitszeit PWA Paket

Dieses Paket enthält alles, was um deine vorhandene HTML-Datei herum benötigt wird:

- `manifest.webmanifest`
- `sw.js`
- `ArbeitszeitIcon.png`
- `icons/icon-192.png`
- `icons/icon-512.png`
- `icons/apple-touch-icon.png`
- `icons/favicon-32.png`
- `index.html` als PWA-fertige Vorlage

## Wichtig

Wenn deine eigentliche App schon als HTML-Datei existiert:

1. Benenne sie in `index.html` um.
2. Kopiere aus der Vorlage die PWA-Zeilen aus dem `<head>` in deine HTML.
3. Kopiere den Service-Worker-Registrierungsblock kurz vor `</body>`.
4. Lege `manifest.webmanifest`, `sw.js`, `ArbeitszeitIcon.png` und den Ordner `icons` daneben.

## Lokaler Test

Im Ordner starten:

```bash
python3 -m http.server 8080
```

Dann öffnen:

```text
http://localhost:8080
```

Auf dem iPhone muss die Seite über Safari geöffnet werden. Für echtes Installieren auf dem Homescreen ist normalerweise HTTPS oder ein sauber erreichbarer lokaler Server nötig.
