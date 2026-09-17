<?php
/**
 * HTML-Fassung der Benachrichtigungsmail.
 *
 * @var \OCP\IL10N $l
 * @var array $_
 *
 * @copyright Copyright (c) 2026, BW-Tech GmbH
 *
 * Modified by BW-Tech GmbH on 2026-09-16.
 * Changes:
 *   - use the shared owncloud.online mail frame instead of an own 2018 layout
 *   - subject and line breaks of the message, link as a button (escaped)
 *
 * Die Mail trug bis hierher ihren eigenen Rahmen: 600-Pixel-Tabelle, Verdana
 * in 0,8em, das Logo über eine absolute Adresse der Instanz - außerhalb des
 * Netzes blieb der Bildrahmen leer - und den Link roh im Text. Dieselbe
 * Ankündigung kam so in zwei verschiedenen Rahmen an: über activity im
 * Kernrahmen, über diese App im alten. Rahmen, Schrift und Logo (per
 * Content-ID) kommen jetzt aus dem Kern; hier steht nur der Inhalt.
 *
 * 'app' => 'core' ist Pflicht: inc() lädt das Blatt im Template-Objekt dieser
 * App und sucht die Bausteine sonst unter apps-external/notifications.
 */

print_unescaped($this->inc('html.mail.header', ['app' => 'core']));
/*
 * Betreff und Nachricht stammen aus der auslösenden App und können in einer
 * anderen Sprache vorliegen als der Rahmen; dann tragen sie ein eigenes lang.
 * Getrennt, weil etwa eine Ankündigung einen übersetzten Betreff, aber frei
 * geschriebenen Text hat - der bleibt in der Sprache des Rahmens.
 */
$langAttribut = function ($schluessel) use ($_) {
	return isset($_[$schluessel]) && $_[$schluessel] !== ''
		? ' lang="' . \OCP\Util::sanitizeHTML($_[$schluessel]) . '"'
		: '';
};
?>
<p<?php print_unescaped($langAttribut('subjectLang')); ?> style="margin:0 0 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.4;color:#1f2733;">
	<?php p($_['subject']); ?>
</p>
<?php if ($_['message'] !== '') { ?>
<p<?php print_unescaped($langAttribut('messageLang')); ?> style="margin:0 0 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#1f2733;">
	<?php
	/*
	 * Erst maskieren, dann Umbrüche setzen: mehrzeilige Ankündigungen kamen
	 * sonst als ein durchlaufender Block an.
	 */
	print_unescaped(\nl2br(\OCP\Util::sanitizeHTML($_['message']), false));
	?>
</p>
<?php } ?>
<?php
/*
 * Die Beschriftung kommt fertig übersetzt in den Baustein: dort gilt das
 * l10n-Objekt des Kerns, und 'hint' muss immer mit (html.mail.button.php liest
 * es ohne isset).
 */
print_unescaped($this->inc('html.mail.button', [
	'app' => 'core',
	'url' => $_['link'],
	'label' => $l->t('Open in %s', [$theme->getName()]),
	'hint' => $l->t('If the button does not work, open this address:'),
]));

print_unescaped($this->inc('html.mail.end', ['app' => 'core']));
