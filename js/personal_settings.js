/**
 * @author Juan Pablo Villafáñez <jvillafanez@solidgear.es>
 *
 * @copyright Copyright (c) 2018, ownCloud GmbH
 * @license AGPL-3.0
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License, version 3,
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License, version 3,
 * along with this program.  If not, see <http://www.gnu.org/licenses/>
 *
 */

(function(OC, OCA) {

	if (!OCA.Notifications) {
		OCA.Notifications = {};
	}

	if (!OCA.Notifications.Settings) {
		OCA.Notifications.Settings = {};
	}

	OCA.Notifications.Settings.Model = OC.Backbone.Model.extend({
		url: function() {
			return OC.generateUrl('/apps/notifications/settings/personal/notifications/options');
		},

		parse: function(data) {
			return data.data.options;
		},

		/**
		 * Die Einstellungen gibt es immer, sie werden nie angelegt. Ohne das
		 * machte Backbone aus dem Speichern ein POST, sobald das Laden der
		 * Optionen gescheitert war (keine id) - die Route kennt nur GET, PUT und
		 * PATCH, jede Änderung endete bis zum Neuladen mit 405.
		 */
		isNew: function() {
			return false;
		}
	});
})(OC, OCA);

$(document).ready(function(){
	var model = new OCA.Notifications.Settings.Model();
	// Der Server rendert die gespeicherte Auswahl schon in die Seite.
	var gespeichert = $('#email_sending_option').val();
	// Mit den Pfeiltasten entstehen mehrere Speichervorgänge kurz
	// hintereinander. Nur der jüngste entscheidet, was das Feld zeigt; ein
	// älterer Fehlschlag setzt nicht zurück, was danach gewählt wurde.
	var letzteAnfrage = 0;
	var bestaetigt = 0;
	var letzteGescheitert = false;

	$('#email_sending_option').change(function(){
		var $element = $(this);
		var changeMap = {};
		var neu = $element.val();
		var nr = ++letzteAnfrage;
		letzteGescheitert = false;
		changeMap[$element.prop('name')] = neu;

		OC.msg.startSaving('#email_notifications .msg');
		model.save(changeMap, {patch: true}).done(function(result){
			if (nr > bestaetigt) {
				bestaetigt = nr;
				gespeichert = neu;
			}
			if (nr === letzteAnfrage) {
				OC.msg.finishedSuccess('#email_notifications .msg', result.data.message);
			} else if (letzteGescheitert) {
				// Der jüngste Versuch scheiterte, dieser ältere kam durch.
				$element.val(gespeichert);
			}
		}).fail(function(result){
			if (nr !== letzteAnfrage) {
				return;
			}
			letzteGescheitert = true;
			// Das Feld zeigte sonst weiter den nicht gespeicherten Wert.
			$element.val(gespeichert);
			// Ohne JSON (412, HTML-Fehlerseite, Status 0) warf der Zugriff einen
			// TypeError, und "Speichern…" blieb stehen.
			var message = result && result.responseJSON && result.responseJSON.data && result.responseJSON.data.message;
			OC.msg.finishedError('#email_notifications .msg', message || t('notifications', 'The setting could not be saved.'));
		});
	}).prop('disabled', true);

	model.fetch().always(function(){
		$('#email_sending_option').prop('disabled', false);
	});
});

/*
 * Karte "Browser-Benachrichtigungen". Die Glocke fragt seit 1.0.0 nicht mehr
 * von sich aus nach der Erlaubnis; hier fragt ein Knopf - Browser verlangen
 * dafür eine Nutzeraktion.
 */
$(document).ready(function(){
	var $status = $('#browser_notifications_status');
	var $knopf = $('#browser_notifications_allow');
	if (!$status.length) {
		return;
	}

	/**
	 * @param {string} erlaubnis granted | denied | default
	 * @param {boolean} [nachKlick] Fokus nach der Entscheidung auf die Statuszeile
	 */
	var zeige = function(erlaubnis, nachKlick) {
		var texte = {
			granted: t('notifications', 'Allowed in this browser.'),
			denied: t('notifications', 'Blocked in this browser. To change this, allow notifications for this site in the browser settings.'),
			'default': t('notifications', 'Not allowed yet.')
		};
		$status.text(texte[erlaubnis] || texte['default']);
		if (erlaubnis === 'default') {
			$knopf.prop('disabled', false);
		} else if ($knopf.length) {
			// Nach der Entscheidung gibt es nichts mehr zu fragen; der Fokus
			// geht auf die Statuszeile statt mit dem Knopf auf <body>.
			$knopf.remove();
			$knopf = $();
			if (nachKlick) {
				$status.trigger('focus');
			}
		}
	};

	if (!('Notification' in window) || typeof window.Notification.requestPermission !== 'function') {
		$status.text(t('notifications', 'This browser does not support notifications.'));
		$knopf.remove();
		return;
	}

	zeige(window.Notification.permission);

	// Merker statt disabled: ein gesperrter Knopf verlöre sofort den Fokus.
	var fragt = false;
	$knopf.on('click', function() {
		if (fragt) {
			return;
		}
		fragt = true;
		var erledigt = false;
		var fertig = function(erlaubnis) {
			// Rückruf und Promise können beide eintreffen
			if (erledigt) {
				return;
			}
			erledigt = true;
			fragt = false;
			zeige(erlaubnis || window.Notification.permission, true);
		};
		// Ältere Browser kennen nur die Rückruf-Form, neuere liefern ein Promise.
		var ergebnis = window.Notification.requestPermission(fertig);
		if (ergebnis && typeof ergebnis.then === 'function') {
			ergebnis.then(fertig, function() {
				fertig(window.Notification.permission);
			});
		}
	});
});
