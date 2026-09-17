<?php
/**
 * Textfassung der Benachrichtigungsmail; folgt htmlmail.php Satz für Satz.
 *
 * @var \OCP\IL10N $l
 * @var array $_
 *
 * @copyright Copyright (c) 2026, BW-Tech GmbH
 *
 * Modified by BW-Tech GmbH on 2026-09-16.
 * Changes:
 *   - same content as the HTML mail: subject, message, link
 *   - no HTML escaping in plain text (p() turned "&" into "&amp;")
 */

print_unescaped($_['subject']);
print_unescaped("\n\n");

if ($_['message'] !== '') {
	print_unescaped($_['message']);
	print_unescaped("\n\n");
}

print_unescaped($l->t('Open in %s:', [$theme->getName()]));
print_unescaped("\n");
print_unescaped($_['link']);
print_unescaped("\n\n\n");

print_unescaped($this->inc('plain.mail.footer', ['app' => 'core']));
