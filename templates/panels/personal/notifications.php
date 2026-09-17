<?php
/**
 * Karte "E-Mail-Benachrichtigungen" in den persönlichen Einstellungen.
 *
 * @var \OCP\IL10N $l
 * @var array $_
 *
 * @copyright Copyright (c) 2026, BW-Tech GmbH
 *
 * Modified by BW-Tech GmbH on 2026-09-16.
 * Changes:
 *   - status region is present from the start (screen readers only announce
 *     regions that already exist)
 *   - the email hint only appears while no address is set, and points to the
 *     profile instead of a "General" section the redesign does not have
 *
 * Modified by BW-Tech GmbH on 2026-09-17: card "Browser notifications". Since
 * 1.0.0 the bell no longer asks for permission on its own (browsers refuse or
 * hide a request without a user action); without this card there was no way
 * left to allow browser notifications.
 */
script('notifications', 'personal_settings');
?>
<div id="email_notifications" class="section">
	<h2 id="email_notifications_label" class="app-name"><?php p($l->t('Mail Notifications'));?></h2>
	<?php if ($_['validUserObject']): ?>
	<p id="email_notifications_description"><?php p($l->t('You can choose to be notified about events via mail. Some events are informative, others require an action (like accept/decline). Select your preference below:')); ?></p>
	<select id="email_sending_option" name="email_sending_option" aria-labelledby="email_notifications_label" aria-describedby="email_notifications_description">
		<?php foreach ($_['possibleOptions'] as $possibleValue => $data): ?>
		<option value="<?php p($possibleValue) ?>" <?php if ($data['selected']) {
			echo 'selected="selected"';
		} ?>><?php p($data['visibleText']); ?></option>
		<?php endforeach; ?>
	</select>
	<span class="msg" role="status" aria-live="polite"></span>
	<?php if (!$_['hasEmail']): ?>
	<?php /* Der bisherige Schlüssel bleibt: er ist in 37 Katalogen übersetzt, ein
	         neuer fiele außerhalb von Deutsch auf Englisch zurück. Der deutsche
	         Text verweist jetzt auf das Profil. */ ?>
	<p><?php p($l->t('To be able to receive mail notifications it is required to specify an email address for your account.')); ?></p>
	<?php endif; ?>
	<?php else: ?>
	<p><?php p($l->t('It was not possible to get your session. Please, try reloading the page or logout and login again')); ?></p>
	<?php endif; ?>
</div>

<div id="browser_notifications" class="section">
	<h2 id="browser_notifications_label" class="app-name"><?php p($l->t('Browser notifications')); ?></h2>
	<p id="browser_notifications_description"><?php p($l->t('Show a notification from your browser when something new arrives while this page is open in a background tab.')); ?></p>
	<?php /* Status und Knopf setzt personal_settings.js: nur der Browser kennt
	         die Erlaubnis. Der Knopf fragt erst auf Klick - ohne Nutzeraktion
	         lehnen Browser die Anfrage ab oder zeigen sie versteckt an. */ ?>
	<p id="browser_notifications_status" role="status" aria-live="polite" tabindex="-1"></p>
	<button type="button" id="browser_notifications_allow" aria-describedby="browser_notifications_description" disabled><?php p($l->t('Allow browser notifications')); ?></button>
</div>
