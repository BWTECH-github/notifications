# Notifications

Die App `notifications` stellt das Benachrichtigungssystem von
owncloud.online bereit: das Glockensymbol in der Kopfzeile, die Ablage der
Benachrichtigungen in der Datenbank, den optionalen Versand per E-Mail und
die Schnittstelle, über die Desktop- und Mobil-Clients Benachrichtigungen
abrufen. Sie erzeugt selbst keine Meldungen, sondern nimmt die Meldungen
anderer Apps entgegen und stellt sie dar. Ohne diese App bleiben die
Benachrichtigungen der aufsetzenden Apps unsichtbar.

## Was die App tut

- Sie nimmt Benachrichtigungen anderer Apps entgegen und speichert sie in
  der Datenbanktabelle `oc_notifications`.
- Sie zeigt die Benachrichtigungen in der Weboberfläche im Menü hinter dem
  Glockensymbol rechts in der Kopfzeile an, die neueste zuerst. Die Glocke
  nennt die Anzahl (sichtbar als Zähler und im Namen der Schaltfläche) und
  sagt neue Einträge über eine Statusmeldung für Sprachausgaben an.
- Die Oberfläche fragt alle 30 Sekunden nach neuen Einträgen, solange der
  Tab sichtbar ist. In einem unsichtbaren Tab fragt sie nur, wenn im Browser
  Benachrichtigungen erlaubt sind, und dann alle zwei Minuten; neue Einträge
  erscheinen dort als Browser-Benachrichtigung, mehrere als eine
  Sammelmeldung. Ist `session_keepalive` ausgeschaltet, fragt sie nur,
  während jemand die Seite bedient, damit Sitzungen weiter ablaufen. Bei
  Fehlern verlängert sie den Abstand bis auf fünf Minuten.
- Enthält eine Benachrichtigung Aktionen (etwa Annehmen oder Ablehnen),
  werden diese als Schaltflächen im Menü dargestellt.
- Sie versendet Benachrichtigungen zusätzlich per E-Mail. Ob und wann das
  geschieht, entscheidet die persönliche Einstellung der Empfängerin oder
  des Empfängers (siehe Abschnitt „Einstellungen“).
- Sie stellt einen OCS-Endpunkt bereit, über den die Clients
  Benachrichtigungen lesen und löschen, und meldet diese Fähigkeit über den
  Capabilities-Endpunkt.
- Wird ein Benutzerkonto gelöscht, entfernt die App dessen
  Benachrichtigungen aus der Datenbank.

Das Glockensymbol steht immer in der Kopfzeile; ohne Einträge zeigt das Menü
„Keine Benachrichtigungen“. Registriert keine installierte App
Benachrichtigungen, antwortet der Endpunkt mit „204 No Content“, die
Oberfläche stellt die Abfrage ein und entfernt die Glocke.

### Apps, die darauf aufsetzen

Die folgenden Apps erzeugen Benachrichtigungen über die Schnittstelle
dieser App:

| App                    | Anlass                                                        |
| ---------------------- | ------------------------------------------------------------- |
| `announcementcenter`   | Neue Ankündigungen                                            |
| `customgroups`         | Aufnahme in eine eigene Gruppe, Rollenwechsel, Entfernung     |
| `federatedfilesharing` | Eingehende Freigaben von anderen Instanzen                    |
| `files_sharing`        | Freigaben an Benutzer oder Gruppen, die noch offen sind und angenommen oder abgelehnt werden müssen |
| `updatenotification`   | Verfügbare Aktualisierungen                                   |

## Voraussetzungen

- owncloud.online 11.1 oder neuer (Redesign; unterstützt bis Version 11.99).
  Ab Version 1.0.0 nutzt die App den Mailrahmen und den Einstellungsbereich
  „Benachrichtigungen“ des Redesign-Kerns. Für owncloud.online 11.0.x bleibt
  Version 0.7.x (Zweig `main`).
- App 1.0.0 und der Redesign-Kern ohne die früheren Glocken-Sonderregeln
  (CSS-Maske, Leertext-Skript, Umhängen der Glocke) werden nur gemeinsam
  ausgeliefert: Ein älterer Redesign-Kern verschiebt und überzeichnet die
  neue Glocke, ein neuer Kern mit App 0.7.x zeigt die Glocke ohne Leertext
  und an falscher Stelle.
- PHP 8.4
- Für den Versand per E-Mail: eine funktionsfähige E-Mail-Konfiguration der
  Instanz sowie eine hinterlegte, gültige E-Mail-Adresse im jeweiligen
  Benutzerkonto. Fehlt die Adresse, wird die Benachrichtigung weiterhin in
  der Oberfläche angezeigt, aber nicht per E-Mail zugestellt.

Die App bringt Datenbank-Migrationen mit. Die benötigte Tabelle wird beim
Aktivieren beziehungsweise beim Update angelegt.

## Installation

Die App ist als Standard-App gekennzeichnet und in owncloud.online in der
Regel bereits enthalten und aktiviert. Der einfachere Weg für Installation
und Aktualisierung ist der Markt in der Administration. Wenn Sie die App
von Hand einspielen möchten:

    cd /var/www/owncloud.online/apps-external
    git clone https://github.com/BWTECH-github/notifications.git
    cd notifications
    composer install --no-dev
    chown -R www-data:www-data .
    sudo -u www-data php8.4 ../../occ app:enable notifications

## Einstellungen

Die App kennt eine einzige Einstellung, und diese wird je Benutzerkonto
gesetzt. Eine instanzweite Vorgabe gibt es nicht; es gibt auch keinen
Bereich in der Administration.

Zu finden ist sie unter „Einstellungen“ → „Benachrichtigungen“ auf der Karte
„E-Mail-Benachrichtigungen“. Fehlt im Profil eine E-Mail-Adresse, weist die
Karte darauf hin.

| Auswahl                                    | Gespeicherter Wert |
| ------------------------------------------ | ------------------ |
| Nicht per E-Mail benachrichtigen           | `never`            |
| Nur benachrichtigen, wenn eine Aktion nötig ist | `action`      |
| Über alle Ereignisse benachrichtigen       | `always`           |

Der Wert wird als Benutzer-Einstellung unter der App-Kennung
`notifications` im Schlüssel `email_sending_option` abgelegt. Ohne eigene
Auswahl gilt `action`: Es werden nur Benachrichtigungen per E-Mail
verschickt, die eine Aktion enthalten.

Die Sprache der E-Mail richtet sich nach der Spracheinstellung des
Empfängers (Benutzer-Einstellung `lang` der App-Kennung `core`). Hat er keine
gewählt oder bringt die App für seine Sprache keine Übersetzung mit, gilt
`default_language` aus der `config.php` (ebenfalls nur mit Übersetzung);
passt auch die nicht, entscheidet wie bisher die Sprache des auslösenden
Vorgangs.

Betreff und Nachricht stammen aus der App, die die Benachrichtigung erzeugt
hat (etwa `files_sharing`), und folgen derselben Reihenfolge – geprüft wird
aber deren Übersetzung. Ein Konto mit Schwedisch bekommt eine Freigabe also
schwedisch, auch wenn der Rahmen mangels schwedischer Übersetzung dieser App
in `default_language` steht; der Inhalt trägt dann ein eigenes `lang`.

Die Mail nutzt den Mailrahmen der Instanz (Logo eingebettet, Schaltfläche zum
Öffnen) und enthält Betreff, Nachricht und Verweis. Gesperrte Benutzerkonten
erhalten keine Mails.

## Kommandozeile

Beide Befehle werden als Web-Server-Benutzer im Installationsverzeichnis
ausgeführt.

`notifications:generate` erzeugt eine Benachrichtigung, wahlweise für ein
Benutzerkonto oder für alle Mitglieder einer Gruppe. Der Betreff ist auf
255 Zeichen begrenzt, die optionale längere Nachricht auf 4000 Zeichen:

    sudo -u www-data php8.4 occ notifications:generate \
      --user alice "Wartung am Freitag" "Die Instanz ist ab 18 Uhr offline."

    sudo -u www-data php8.4 occ notifications:generate \
      --group buchhaltung --link https://owncloud.online "Neue Richtlinie"

Es muss entweder `--user` (Kurzform `-u`) oder `--group` (`-g`) angegeben
werden, sonst bricht der Befehl ab. Mit `--link` (`-l`) hinterlegen Sie
eine Adresse, die beim Anklicken der Benachrichtigung geöffnet wird.

`notifications:repairNotifications` korrigiert bereits gespeicherte
Benachrichtigungen. Zurzeit ist genau ein Thema zulässig:
`relativeLinks`. Es entfernt die Basisadresse aus absolut gespeicherten
Verweisen und ist nach einem Wechsel der Adresse der Instanz sinnvoll:

    sudo -u www-data php8.4 occ notifications:repairNotifications relativeLinks

Der Befehl gibt aus, wie viele Benachrichtigungen geändert wurden. Ein
anderes Thema als `relativeLinks` wird mit „Invalid subject“ abgewiesen.

## Fehlersuche

| Symptom | Ursache | Abhilfe |
| ------- | ------- | ------- |
| Kein Glockensymbol in der Kopfzeile | Keine installierte App registriert Benachrichtigungen; der Endpunkt antwortet mit 204, die Oberfläche entfernt die Glocke | Die erzeugende App aktivieren, Seite neu laden |
| Menü zeigt „Die Benachrichtigungen konnten nicht geladen werden.“ | Der erste Abruf ist gescheitert (Netz, Wartungsmodus) | „Erneut versuchen“ im Menü; die Oberfläche versucht es zusätzlich selbst in wachsenden Abständen |
| Benachrichtigungen erscheinen verzögert | Die Oberfläche fragt im Abstand von 30 Sekunden ab | Abwarten oder die Seite neu laden |
| Nichts in Oberfläche und Clients | Die App ist deaktiviert; der Endpunkt antwortet mit 404 | `occ app:enable notifications` |
| Keine E-Mail, obwohl die Meldung angezeigt wird | Persönliche Einstellung steht auf `never`, oder auf `action` und die Meldung enthält keine Aktion; oder das Benutzerkonto ist gesperrt | Einstellung unter „Einstellungen“ → „Benachrichtigungen“ prüfen; im Protokoll steht bei gesperrten Konten „the account is disabled“ (Stufe Debug) |
| Keine E-Mail, im Protokoll steht „email for the user isn't set“ oder „isn't valid“ | Im Benutzerkonto fehlt die E-Mail-Adresse oder sie ist ungültig | Gültige Adresse im Benutzerkonto eintragen |
| Verweise zeigen auf die frühere Adresse der Instanz | Die Verweise wurden absolut gespeichert | `occ notifications:repairNotifications relativeLinks` |
| `notifications:generate` bricht mit „Either user or group needs to be given.“ ab | Weder `--user` noch `--group` angegeben | Einen der beiden Schalter setzen |

Meldungen der App stehen im Protokoll der Instanz unter der App-Kennung
`notifications`.

## Herkunft

Diese App ist ein Fork der Upstream-App „notifications“
(ursprüngliche Autoren: Joas Schilling, Thomas Müller und weitere). Sie
wird von der BW-Tech GmbH für owncloud.online und PHP 8.4 gepflegt. Die
Lizenz ist AGPL-3.0.

- Produkt: <https://owncloud.online>
- Dokumentation: <https://docs.owncloud.online>
- Quelltext und Fehlermeldungen:
  <https://github.com/BWTECH-github/notifications>

## Für Entwickler

Andere Apps sprechen die App nicht direkt an, sondern über die
Benachrichtigungs-Schnittstelle des Kerns
(`OCP\Notification\IManager`). Diese App registriert sich darauf als
Verbraucher (Consumer) und speichert und versendet, was andere Apps
melden. Eine sendende App registriert zusätzlich einen Notifier, der die
gespeicherten Kennungen in lesbaren Text übersetzt.

Der Ablauf zum Erzeugen, Übersetzen und Abräumen einer Benachrichtigung
ist in [docs/notification-workflow.md](docs/notification-workflow.md)
beschrieben.

Für Clients stehen diese OCS-Routen bereit:

| Methode  | Route                                                    |
| -------- | -------------------------------------------------------- |
| `GET`    | `/ocs/v2.php/apps/notifications/api/v1/notifications`      |
| `GET`    | `/ocs/v2.php/apps/notifications/api/v1/notifications/{id}` |
| `DELETE` | `/ocs/v2.php/apps/notifications/api/v1/notifications/{id}` |

Ob die App vorhanden ist, lässt sich über
`/ocs/v2.php/cloud/capabilities` feststellen: Der Abschnitt
`notifications` führt dort die unterstützten Endpunkte `list`, `get` und
`delete` auf. Sind keine Notifier registriert, antwortet die Liste mit
„204 No Content“ und der Abruf einer einzelnen Benachrichtigung mit
„404 Not Found“; das Löschen ist davon nicht betroffen. Einzelheiten samt
Beispielantworten enthält
[docs/ocs-endpoint-v1.md](docs/ocs-endpoint-v1.md).
