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
