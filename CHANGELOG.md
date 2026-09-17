# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-09-17

Erste Fassung für die Redesign-Oberfläche von owncloud.online 11.1.

Ausrollen: nur zusammen mit dem Redesign-Kern, der die Glocken-Sonderregeln
(CSS-Maske, Leertext-Skript, Umhängen der Glocke) nicht mehr enthält. Ein
älterer Redesign-Kern verschiebt und überzeichnet die neue Glocke; ein neuer
Kern mit App 0.7.x zeigt sie ohne Leertext und an falscher Stelle.

### Changed

- Glocke und Liste für die neue Kopfzeile neu gebaut: Glocke als eingebettete
  Grafik rechts in den Kopfleisten-Aktionen, Zähler mit der Anzahl, Überschrift,
  neueste Meldung zuerst, Zeitangabe je Meldung, Standardsymbol für Meldungen
  ohne eigenes. Die Glocken-Sonderregeln im Kern (CSS-Maske, Leertext-Skript,
  Umhängen der Glocke) sind damit entfallen.
- Benachrichtigungsmail im Mailrahmen der Instanz: eingebettetes Logo,
  Betreff, Nachricht mit Zeilenumbrüchen, Schaltfläche zum Öffnen.
- Mails in der Sprache des Empfängers; ohne eigene Sprache oder ohne
  Übersetzung dafür in `default_language`. Betreff und Nachricht folgen der
  Übersetzung der auslösenden App und tragen ein eigenes `lang`, wenn sie
  vom Rahmen abweichen.
- Browser-Benachrichtigungen nur für unsichtbare Tabs, mehrere neue Meldungen
  als eine Sammelmeldung. Ein unsichtbarer Tab fragt nur mit erteilter
  Erlaubnis ab, dann alle zwei Minuten.
- Die offene Liste liegt über dem Upload-Panel.
- Einstellungskarte: Hinweis auf die E-Mail-Adresse nur, wenn keine
  eingetragen ist; er verweist auf das Profil.
- Übersetzungen: veraltete Einträge aus allen 37 Katalogen entfernt, die
  neuen Texte in 27 Sprachen übersetzt. In eu, ia, is, mk, sq und ug
  erscheinen die neuen Texte vorerst englisch. Knopfnamen setzen sich aus
  bereits übersetzten Texten zusammen („Ausblenden: <Betreff>“). In bg_BG,
  cs_CZ, el, he, hu_HU, is, it, mk, pl, pt_PT, th_TH und tr hieß „Dismiss“
  Ablehnen, Abbrechen oder Freigeben – direkt neben „Ablehnen“ einer Freigabe
  irreführend; jetzt Ausblenden bzw. Schließen.
- Deutsche Texte überarbeitet (geduzt in de, de_AT, de_CH; gesiezt in de_DE),
  de_AT neu.
- Auf schmalen Fenstern sind Glocke und „Ausblenden“ mindestens 44 × 44 px
  groß.
- Auf Fehler- und OAuth-Seiten (Gastvorlage) erscheint wie bisher keine
  Glocke.
- Voraussetzung owncloud.online 11.1.
- Zwölf ungenutzte Bilder entfernt.

### Fixed

- Die Liste ließ sich bei mehr als zwei Meldungen nicht rollen.
- Die Glocke hatte keinen sichtbaren Tastaturfokus.
- `aria-expanded` blieb nach dem ersten Öffnen dauerhaft auf „true“.
- „Ausblenden“ war nur beim Überfahren mit der Maus sichtbar, trug keinen
  Bezug zur Meldung, und danach fiel der Tastaturfokus auf die Seite. Jetzt
  immer sichtbar, mit Betreff im Namen; der Fokus wandert zur nächsten Meldung.
- Neue Meldungen und das Ausblenden werden Sprachausgaben angesagt.
- Scheiterte der Abruf, erschien alle 30 Sekunden ein Fehler-Hinweis. Jetzt
  steht in der Liste ein Hinweis mit „Erneut versuchen“, und der Abruf wartet
  bei wiederholten Fehlern länger (bis 5 Minuten).
- „Annehmen“/„Ablehnen“ meldete Erfolg, auch wenn die Freigabe scheiterte
  (OCS v1 antwortet dort mit HTTP 200).
- Ein kurzer Netzausfall beim Abruf lud die ganze Seite neu.
- Die Abfrage alle 30 Sekunden hielt Sitzungen trotz `session_keepalive=false`
  am Leben und lief auch in Hintergrund-Tabs.
- Die Browser-Benachrichtigung fragte ohne Nutzeraktion nach der Erlaubnis.
- Meldungen ohne Link verlinkten die Startseite.
- Lief beim Ausblenden gerade ein Abruf, kam die Meldung zurück und wurde
  als neu angesagt.
- Scheiterte das Laden der Einstellungskarte, endete jedes Speichern mit
  HTTP 405, und das Feld zeigte den nicht gespeicherten Wert.
- Gesperrte Benutzerkonten erhielten weiter Benachrichtigungsmails.
- Fehlermeldungen der Oberfläche waren nicht übersetzt.
- Feste Breiten schnitten lange Texte ab; auf schmalen Fenstern verschwanden
  die letzten Meldungen unter der Reiterleiste.

## [0.7.3] - 2026-08-13

### Changed

- README als Betriebsdokumentation neu geschrieben: Installation, Einstellungen,
  Kommandozeile und Fehlersuche; tote und fremde Verweise entfernt.

## [0.7.2] - 2026-08-13

### Changed

- Produktname, Beschreibung und uebersetzte Zeichenketten nennen owncloud.online;
  Verweise auf Fehlerbereich, Repository und Dokumentation zeigen auf das eigene
  Repository. Screenshots aus fremden Repositories entfernt.

## [0.6.0] - 2023-07-10

### Changed

- [#376](https://github.com/owncloud/notifications/pull/376) -  Always return an int from Symfony Command execute method #376 


## [0.5.4] - 2021-06-30

### Fixed

- Provide get/list api link resource as absolute url - [#342](https://github.com/owncloud/notifications/issues/342)

## [0.5.3] - 2021-06-21

### Added

- Add command to repair notifications and properly handle mail sending … - [#333](https://github.com/owncloud/notifications/issues/333)
- Add Mail sender name - [#338](https://github.com/owncloud/notifications/issues/338)

## [0.5.2] - 2020-07-15

### Fixed

- Use language code to correctly translate mail body of notifications - [#322](https://github.com/owncloud/notifications/issues/322)

### Added

- Add `Hello` as translatable string to the mail templates - [#320](https://github.com/owncloud/notifications/issues/320)

### Changed

- Bump libraries

## [0.5.0] - 2019-04-25

### Added

- Added bell icon in black - [#185](https://github.com/owncloud/notifications/pull/185)

### Changed

- Drop php 5.6 - [#267](https://github.com/owncloud/notifications/issues/267)

### Fixes

- Only set icon in case an icon is available - [#275](https://github.com/owncloud/notifications/issues/275)

## [0.4.1]

### Added

- Notifications can now have an icon - [#104](https://github.com/owncloud/notifications/issues/104)
- Added occ command to send notification to a user or a group - [#104](https://github.com/owncloud/notifications/issues/104)

### Fixed

- Make sure buttons stays in place even with long messages - [#114](https://github.com/owncloud/notifications/issues/114)
- Don't escape link text title - [#111](https://github.com/owncloud/notifications/issues/111)
- Fix actions and escaping - [#109](https://github.com/owncloud/notifications/issues/109)
- Move OCS calls to app framework - consumes less resources - [#98](https://github.com/owncloud/notifications/pull/98)
- Don't use escaped message for browser notification - [#100](https://github.com/owncloud/notifications/pull/100)

[Unreleased]: https://github.com/owncloud/notifications/compare/v0.6.0...master
[0.6.0]: https://github.com/owncloud/notifications/compare/v0.5.4...v0.6.0
[0.5.4]: https://github.com/owncloud/notifications/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/owncloud/notifications/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/owncloud/notifications/compare/v0.5.0...v0.5.2
[0.5.0]: https://github.com/owncloud/notifications/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/owncloud/notifications/compare/v0.4.0...v0.4.1
