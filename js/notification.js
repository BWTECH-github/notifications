/**
 * ownCloud - Notifications
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Tom Needham <tom@owncloud.com>
 * @copyright Tom Needham 2015
 *
 * @copyright Copyright (c) 2026, BW-Tech GmbH
 *
 * Modified by BW-Tech GmbH on 2026-09-16.
 * Changes:
 *   - list item markup (li) with a labelled, always visible dismiss button
 *     after the content, relative time, default icon for items without one
 *   - links and action URLs only for http(s) and instance paths; action URLs
 *     are no longer escaped twice
 */

(function() {

	var DEFAULT_ICON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">'
		+ '<path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-1.7 1.7A1 1 0 0 0 4 19.4h16a1 1 0 0 0 .7-1.7L19 16zm-2 .83.57.57H6.43l.57-.57V11a5 5 0 0 1 10 0v5.83z"/>'
		+ '</svg>';

	var CLOSE_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">'
		+ '<path fill="currentColor" d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"/>'
		+ '</svg>';

	/**
	 * Nur http(s) und Pfade der eigenen Instanz.
	 */
	var istSicher = function(url) {
		if (typeof url !== 'string' || url === '') {
			return false;
		}
		return /^https?:\/\//i.test(url) || (url.charAt(0) === '/' && url.charAt(1) !== '/');
	};

	/**
	 * Initialise the notification
	 */
	var Notif = function(jsonData){
		this.app = jsonData.app;
		this.user = jsonData.user;
		this.datetime = jsonData.datetime;
		this.timestamp = moment(jsonData.datetime).format('X');
		this.object_type = jsonData.object_type;
		this.object_id = jsonData.object_id;
		this.subject = jsonData.subject || '';
		this.message = jsonData.message || '';
		this.link = jsonData.link || '';
		this.icon = jsonData.icon || '';
		this.actions = jsonData.actions || [];
		this.notification_id = jsonData.notification_id;
	};

	Notif.prototype = {

		app: null,

		user: null,

		datetime: null,

		timestamp: null,

		object_type: null,

		object_id: null,

		subject: null,

		message: null,

		link: null,

		actions: [],

		notification_id: null,

		getSubject: function() {
			return this.subject;
		},

		getTimestamp: function() {
			return this.timestamp;
		},

		getObjectId: function() {
			return this.object_id;
		},

		getLink: function() {
			return this.link;
		},

		getIcon: function() {
			return this.icon;
		},

		getActions: function() {
			return this.actions;
		},

		getId: function() {
			return this.notification_id;
		},

		/**
		 * Kurzfassung für die Liste: nach dem Wortende ab 200 Zeichen, hart bei
		 * 240. Den vollen Text öffnet der Verweis der Meldung.
		 */
		getMessage: function() {
			var message = this.message;

			if (message.length > 240) {
				var spacePosition = message.indexOf(' ', 200);
				if (spacePosition !== -1 && spacePosition <= 240) {
					message = message.substring(0, spacePosition);
				} else {
					message = message.substring(0, 240);
				}
				message += '…';
			}

			return message.replace(/\s*\n\s*/g, ' ');
		},

		getRawMessage: function() {
			return this.message;
		},

		getEl: function() {
			var id = String(this.getId());
			return $('.notifications .notification').filter(function() {
				return this.getAttribute('data-id') === id;
			});
		},

		getApp: function() {
			return this.app;
		},

		/**
		 * Generates the HTML for the notification
		 */
		renderElement: function() {
			var id = String(this.getId());
			var titleId = 'notification-title-' + id.replace(/[^A-Za-z0-9_-]/g, '');

			var $item = $('<li>', {
				'class': 'notification',
				'data-id': id,
				'data-timestamp': this.getTimestamp()
			});

			var $icon;
			if (istSicher(this.getIcon())) {
				$icon = $('<img>', {
					'class': 'notification-icon',
					'src': this.getIcon(),
					'alt': ''
				});
			} else {
				// Ohne eigenes Symbol verrutschte der Text gegenüber den übrigen Meldungen.
				$icon = $('<span>', {
					'class': 'notification-icon notification-icon-default',
					'aria-hidden': 'true'
				}).html(DEFAULT_ICON_SVG);
			}

			var $content = $('<div>', {'class': 'notification-content'});
			var $title = $('<h3>', {'class': 'notification-title', 'id': titleId});
			if (istSicher(this.getLink())) {
				$title.append($('<a>', {
					'class': 'notification-link',
					'href': this.getLink(),
					'text': this.getSubject()
				}));
			} else {
				$title.text(this.getSubject());
			}
			$content.append($title);

			var message = this.getMessage();
			if (message !== '') {
				$content.append($('<p>', {
					'class': 'notification-message',
					'text': message
				}));
			}

			var zeit = moment(this.datetime);
			if (zeit.isValid()) {
				var ms = zeit.valueOf();
				$content.append($('<time>', {
					'class': 'notification-time',
					'datetime': zeit.toISOString(),
					'title': OC.Util.formatDate(ms),
					'data-ms': String(ms),
					'text': OC.Util.relativeModifiedDate(ms)
				}));
			}

			var actionsData = _.filter(this.getActions(), function(actionData) {
				return istSicher(actionData.link);
			});
			if (actionsData.length) {
				var $actions = $('<div>', {'class': 'notification-actions'});
				_.each(actionsData, function(actionData) {
					// jQuery maskiert Attribute selbst; das escapeHTML von früher
					// machte aus "&" in Aktions-URLs "&amp;".
					$('<button>', {
						'type': 'button',
						'class': 'notification-action-button' + (actionData.primary ? ' primary' : ''),
						'data-type': actionData.type,
						'data-href': actionData.link,
						'aria-describedby': titleId,
						'text': actionData.label
					}).appendTo($actions);
				});
				$content.append($actions);
			}

			// Nach dem Inhalt, damit Sprachausgaben erst die Meldung und dann den
			// Knopf hören - und mit dem Betreff im Namen, damit zwölf Knöpfe nicht
			// alle nur "Ausblenden" heißen.
			// Name aus dem vorhandenen Schlüssel "Dismiss" (in allen Katalogen
			// übersetzt) und dem Betreff zusammengesetzt.
			var $close = $('<button>', {
				'type': 'button',
				'class': 'notification-delete',
				'aria-label': t('notifications', 'Dismiss') + ': ' + this.getSubject(),
				'title': t('notifications', 'Dismiss')
			}).html(CLOSE_SVG);

			$item.append($icon, $content, $close);
			return $item;
		}

	};

	OCA.Notifications.Notif = Notif;

})();
