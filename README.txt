ARBEITSZEITEN-PWA v0.4.1
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

v0.3.1 (11.09.2026): Rechenfehler und Bedienungsdetails korrigiert.
- Wochen-/Monatssummen werden ohne Minutenverlust auf passende Tage verteilt.
- Wochen über Monats-/Jahresgrenzen werden einmalig aufgeteilt.
- Urlaub wird erst nach Genehmigung gutgeschrieben. Krankheit hat Vorrang.
- Jahresurlaub zählt nur das ausgewählte Jahr; Überschneidungen zählen einmal.
- Resttage zählen ab heute; frühere unvollständige Tage sind separat ausgewiesen.
- Eingabeprüfung, Duplikatschutz, Heute-Sprung, Datensicherung als JSON.
- Beschriftungen, Farben und Layout für 320 bis 1280 Pixel geprüft.
- Offline-Cache lädt eine zusammengehörige App-Version.

RECHENREGELN
- Stundenkonto im Reiter Monat: Startsaldo plus alle Monatsdifferenzen seit dem
  eingestellten Startzeitraum bis einschließlich des ausgewählten Monats.
  Entspricht dem Zeitkonto der Übersicht; das vollständige Monatssoll zählt mit.
  Anzeige als Dezimalstunden, Plus grün, Minus rot, Null neutral.
- Übertrag im Reiter Monat: ausschließlich Ist minus Soll des direkt vorherigen
  Monats, auch Januar/Dezember. Kein kumuliertes Zeitkonto und kein Startsaldo.
- Monatsstunden immer dezimal: Arbeit, Feiertag, Urlaub, Gesamt. Gesamt enthält
  auch separat genannte Krankheitsgutschriften, aber keinen Vormonatsübertrag.
- Feiertage in Niedersachsen werden jahresabhängig offline berechnet, inklusive
  Reformationstag. Gutschrift an eingestellten Arbeitstagen in Höhe des Tagessolls.
- Sonntage haben immer Soll 0, zählen nie als Urlaub und werden aus Wochen- und
  Monatssummen ausgeschlossen. Nur tägliche Einträge erzeugen Sonntagsarbeit.
- Der bisherige Modus „Kalendertage“ heißt jetzt „Montag bis Samstag“. Das
  Monatsstundensoll wird ohne Sonntage auf die Berechnungstage verteilt.
- Feiertag hat Vorrang vor Krankheit und Urlaub; Krankheit vor Urlaub. Keine
  doppelte Gutschrift. Feiertage verbrauchen keine Urlaubstage.
- Eingaben sind tatsächlich gearbeitete Stunden, ohne Abwesenheitsgutschriften.
- Tageseinträge: Beginn bis Ende minus Pause. Nachtschichten gehören zum Startdatum.
- Wochen: Montag bis Sonntag; Monatssummen: Monat des gewählten Eingabedatums.
- Summen werden auf Berechnungstage verteilt, nach Möglichkeit ohne Feiertage und
  genehmigten Urlaub/Krankheit. Sind alle Tage abwesend, bleiben die Berechnungstage als
  Verteilungsbasis erhalten; solche widersprüchlichen Einträge bitte prüfen.
- Tägliche Arbeit und Abwesenheit am selben Tag: Anrechnung mindestens Tagessoll,
  aber keine doppelte Vollgutschrift zusätzlich zur bereits gebuchten Arbeitszeit.
- Beantragter Urlaub bringt noch keine Zeitgutschrift. „Genehmigen“ im Reiter Urlaub.
- Urlaub/Krankheit zählen nur an eingestellten Arbeitstagen, auch ohne Stundensoll.
- Bei Wochen-/Monatssummen sind gearbeitete Tage rechnerisch verteilt, nicht exakt
  aus einzelnen Anwesenheitsdaten bekannt.
- Das Zeitkonto umfasst das komplette Soll bis zum ausgewählten Monatsende.
- Stunden/Arbeitstage gelten wie bisher global, auch rückwirkend. Unterschiedliche
  Vertragsmodelle je Monat sind nicht implementiert.
- Ein JSON-Export enthält alle gespeicherten Daten; ein Importdialog ist noch nicht
  vorhanden. Die Sicherung kann zur Wiederherstellung durch die Entwicklung dienen.

PRÜFUNG
Im App-Ordner: node --test tests/*.cjs
44 Tests für Berechnungen, Eingabeabläufe, Dateiverknüpfungen und Offline-Verhalten.
UI zusätzlich im Browser mit isolierten Beispieldaten geprüft.
Die Tests enthalten keine echten persönlichen Einträge.

UPDATE-HINWEIS
Korrekturen können berechnete Summen bestehender Einträge ändern. Vor dem Update
nach Möglichkeit Daten sichern. Die gespeicherten Einträge werden nicht gelöscht.
Beim Veröffentlichen dieselbe Webadresse behalten, damit Gerätedaten erreichbar bleiben.

v0.4.0: Vormonatsdifferenz, monatliche Dezimalstunden, Feiertage Niedersachsen,
Sonntagsregel, Schicht-Uhrzeiten im Kalender und Farben:
Feiertag orange / Urlaub gelb / Arbeit grün / Krank rot / Sonntag lila.
Gearbeitete Sonntage sind grün mit lila Sonntagsmarkierung.
Die erste Offline-Installation lädt die Seite nicht mehr mitten in einer Eingabe neu.

FEIERTAGSQUELLE (geprüft 2026)
Deutsche Bundesbank, Feiertage in Deutschland 2026, bundesweite Liste und Länderzusätze:
https://www.bundesbank.de/resource/blob/749314/05f64c15196c20776ae7c22a2739b03c/mL/feiertage-in-deutschland-1-data.pdf
Künftige Jahre nach denselben Feiertagsregeln, Ostern per gregorianischem Algorithmus.

v0.4.1: Kumuliertes Stundenkonto zusätzlich im Reiter Monat, oberhalb des
Vormonatsübertrags. Beim Monatswechsel wird der zugehörige Gesamtsaldo angezeigt.
