/**
 * owncloud.online - Notifications
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
 *   - bell renders itself for the redesigned header (inline icon, counter,
 *     states) instead of relying on core CSS masks and core scripts
 *   - one menu handler; aria-expanded follows the real state
 *   - keyboard focus survives dismissing and actions, results are announced
 *   - failed actions are detected (OCS v1 reports errors with HTTP 200)
 *   - polling pauses in background tabs unless browser notifications are
 *     allowed, respects session_keepalive=false, backs off on errors and
 *     never triggers the core reload; stale responses cannot bring back
 *     notifications dismissed in the meantime
 *   - browser notifications no longer ask for permission without a user
 *     gesture and only appear for background tabs
 */

(function() {

	/*
	 * Die Glocke als eingebettetes SVG: Farbe über currentColor aus dem Blatt.
	 * Vorher kam ein weißes <img>, das der Kern per CSS-Maske umfärben musste -
	 * die Maske schnitt den Fokusrahmen weg und hing am festen Pfad
	 * apps-external/notifications.
	 */
	var BELL_SVG = '<svg class="notifications-bell" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">'
		+ '<path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-1.7 1.7A1 1 0 0 0 4 19.4h16a1 1 0 0 0 .7-1.7L19 16zm-2 .83.57.57H6.43l.57-.57V11a5 5 0 0 1 10 0v5.83z"/>'
		+ '</svg>';

	OCA.Notifications = {

		notifications: {},

		pollInterval: 30000, // milliseconds

		maxPollInterval: 300000,

		/**
		 * Zeitlimit eines Abrufs. Ohne Zeitlimit hielt eine hängende Anfrage die
		 * Timer-Kette an; die Merker für entfernte Meldungen leben länger.
		 */
		fetchTimeout: 20000,

		/**
		 * Takt in unsichtbaren Tabs - nur, wenn Browser-Benachrichtigungen
		 * erlaubt sind. Für sie ist der Hintergrund-Tab der eigentliche Fall.
		 */
		hiddenPollInterval: 120000,

		/**
		 * Im Browser entfernte Meldungen (Kennung => Zeitpunkt). Ein Abruf, der
		 * vor der Entfernung gestartet ist, darf sie nicht zurückholen.
		 */
		_entfernt: {},

		$notifications: null,

		$button: null,

		$badge: null,

		$container: null,

		$wrapper: null,

		$empty: null,

		$loading: null,

		$error: null,

		$status: null,

		$heading: null,

		_retrying: false,

		_timer: null,

		_currentInterval: 30000,

		_lastFetch: 0,

		_lastActivity: 0,

		_failures: 0,

		_loaded: false,

		_shutDown: false,

		initialise: function() {
			var self = this;

			this._lastActivity = Date.now();
			this._currentInterval = this.pollInterval;

			this.$notifications = $('<div class="notifications"></div>');
			this.$button = $('<button type="button" id="notifications-button" class="notifications-button menutoggle" aria-controls="notifications-panel" aria-expanded="false"></button>');
			this.$button.append(BELL_SVG);
			this.$badge = $('<span class="notifications-badge hidden" aria-hidden="true"></span>');
			this.$button.append(this.$badge);

			this.$container = $('<div id="notifications-panel" class="notification-container" role="region"></div>');
			this.$container.attr('aria-label', t('notifications', 'Notifications'));
			// tabindex -1: Ziel für den Fokus, wenn "Erneut versuchen" sich selbst ausblendet.
			var $heading = $('<h2 class="notifications-heading" tabindex="-1"></h2>').text(t('notifications', 'Notifications'));
			this.$heading = $heading;
			this.$loading = $('<p class="notifications-state notifications-loading"></p>').text(t('notifications', 'Loading notifications …'));
			this.$empty = $('<p class="notifications-state notifications-empty hidden"></p>').text(t('notifications', 'No notifications'));
			this.$error = $('<div class="notifications-state notifications-error hidden"></div>');
			this.$error.append($('<p></p>').text(t('notifications', 'Notifications could not be loaded.')));
			this.$error.append($('<button type="button" class="notifications-retry"></button>').text(t('notifications', 'Try again')));
			this.$wrapper = $('<ul class="notification-wrapper hidden"></ul>');

			// Feste Live-Region außerhalb des Menüs: Sprachausgaben melden nur
			// Änderungen an Regionen, die schon beim Laden im Dokument stehen.
			this.$status = $('<div class="notifications-status hidden-visually" role="status" aria-live="polite" aria-atomic="true"></div>');

			this.$container.append($heading, this.$loading, this.$empty, this.$error, this.$wrapper);
			this.$notifications.append(this.$button, this.$container, this.$status);
			this._updateButton();

			// Im Redesign steht die Glocke rechts in den Kopfleisten-Aktionen -
			// im Dokument, nicht nur im Bild, damit die Tab-Reihenfolge stimmt.
			// Ohne Aktionen und ohne Suchfeld ist es keine Nutzeroberfläche
			// (Gastvorlage: OAuth-Freigabe, Fehlerseiten) - dort keine Glocke,
			// wie in 0.7.3.
			var $actions = $('#oco-header-actions');
			if ($actions.length) {
				$actions.append(this.$notifications);
			} else if ($('form.searchbox').length) {
				$('form.searchbox').before(this.$notifications);
			} else {
				return;
			}

			// Genau ein Menü-Handler: registerMenu schaltet auf und zu. Der
			// zweite Handler (OC.showMenu) ließ aria-expanded nach dem ersten
			// Öffnen dauerhaft auf "true" stehen.
			OC.registerMenu(this.$button, this.$container);
			this.$button.on('click', _.bind(this._syncExpanded, this));
			// hideMenus meldet jedes Schließen (Escape, Klick daneben, anderes Menü).
			this.$container.on('beforeHide', function() {
				self.$button.attr('aria-expanded', 'false');
			});

			this.$container.on('click', '.notification-action-button', _.bind(this._onClickAction, this));
			this.$container.on('click', '.notification-delete', _.bind(this._onClickDismissNotification, this));
			this.$container.on('click', '.notifications-retry', _.bind(this._onClickRetry, this));

			var merkeAktivitaet = _.throttle(function() {
				self._lastActivity = Date.now();
			}, 5000);
			$(document).on('mousemove.notifications keydown.notifications click.notifications touchstart.notifications scroll.notifications', merkeAktivitaet);
			$(document).on('visibilitychange.notifications', function() {
				if (document.hidden) {
					self._vergissSichtbar();
					return;
				}
				self._merkeSichtbar();
				if (!self._shutDown && Date.now() - self._lastFetch >= self.pollInterval) {
					self.backgroundFetch();
				}
			});
			this._merkeSichtbar();

			this.initialFetch();
		},

		_syncExpanded: function() {
			this.$button.attr('aria-expanded', this._menueOffen() ? 'true' : 'false');
		},

		/**
		 * Fokus auf die Überschrift, ohne die Liste zu rollen: sie klebt oben
		 * und ist bei offener Liste sichtbar. Mit gewöhnlichem focus() rollte
		 * Chromium wegen scroll-padding-top an den Anfang, und die Stelle, an der
		 * jemand las, war weg.
		 */
		_focusHeading: function() {
			try {
				this.$heading[0].focus({preventScroll: true});
			} catch (e) {
				this.$heading.trigger('focus');
			}
		},

		/**
		 * Kleiner Speicher, den alle Tabs derselben Instanz teilen - je Konto.
		 * Gesperrter Speicher (privates Fenster, Richtlinie) ist kein Fehler:
		 * dann ohne Abstimmung zwischen Tabs.
		 *
		 * @param {string} name
		 * @param {string} [wert] ohne Wert wird gelesen
		 * @return {string|null}
		 */
		_tabSpeicher: function(name, wert) {
			try {
				var schluessel = 'oca.notifications.' + (OC.currentUser || '') + '.' + name;
				if (arguments.length < 2) {
					return window.localStorage.getItem(schluessel);
				}
				window.localStorage.setItem(schluessel, wert);
			} catch (e) {
				// ohne Speicher weiter
			}
			return null;
		},

		_sichtbarGemerkt: null,

		/**
		 * Ein sichtbarer Tab meldet sich regelmäßig. Solange das frisch ist,
		 * zeigen unsichtbare Tabs keine Browser-Benachrichtigung: wer die Glocke
		 * in einem anderen Tab vor sich hat, hört dort die Ansage.
		 */
		_merkeSichtbar: function() {
			if (document.hidden) {
				return;
			}
			this._sichtbarGemerkt = String(Date.now());
			this._tabSpeicher('sichtbar', this._sichtbarGemerkt);
		},

		_vergissSichtbar: function() {
			if (this._sichtbarGemerkt !== null && this._tabSpeicher('sichtbar') === this._sichtbarGemerkt) {
				this._tabSpeicher('sichtbar', '0');
			}
			this._sichtbarGemerkt = null;
		},

		/**
		 * Welche neuen Meldungen dieser unsichtbare Tab als Browser-
		 * Benachrichtigung zeigen darf: keine, solange ein anderer Tab sichtbar
		 * ist, und keine, die ein anderer unsichtbarer Tab schon gemeldet hat.
		 *
		 * @param {Array} neue
		 * @return {Array}
		 */
		_nochNichtGemeldet: function(neue) {
			var sichtbar = parseInt(this._tabSpeicher('sichtbar'), 10);
			if (!isNaN(sichtbar) && Date.now() - sichtbar < this.pollInterval * 3) {
				return [];
			}
			var gemeldet;
			try {
				gemeldet = JSON.parse(this._tabSpeicher('gemeldet') || '[]');
			} catch (e) {
				gemeldet = [];
			}
			if (!_.isArray(gemeldet)) {
				gemeldet = [];
			}
			var frisch = _.filter(neue, function(eintrag) {
				return gemeldet.indexOf(String(eintrag.getId())) === -1;
			});
			if (frisch.length) {
				gemeldet = gemeldet.concat(_.map(frisch, function(eintrag) {
					return String(eintrag.getId());
				})).slice(-100);
				this._tabSpeicher('gemeldet', JSON.stringify(gemeldet));
			}
			return frisch;
		},

		/**
		 * Sagt einen Text über die Live-Region an. Erst leeren, dann setzen:
		 * derselbe Text zweimal hintereinander würde sonst verschluckt.
		 */
		_announce: function(text) {
			var $status = this.$status;
			$status.text('');
			window.setTimeout(function() {
				$status.text(text);
			}, 100);
		},

		_onClickRetry: function(event) {
			event.preventDefault();
			// Der Knopf blendet sich gleich selbst aus - den Fokus vorher auf die
			// Überschrift, sonst fiele er auf <body>.
			this._focusHeading();
			this.$error.addClass('hidden');
			this.$loading.removeClass('hidden');
			this._failures = 0;
			this._currentInterval = this.pollInterval;
			this._retrying = true;
			this.initialFetch();
		},

		_onClickDismissNotification: function(event) {
			event.preventDefault();
			var self = this,
				$button = $(event.currentTarget),
				$notification = $button.closest('.notification'),
				id = String($notification.attr('data-id')),
				fokusAufBody = this._fokusAufBody();

			if ($notification.hasClass('notification-pending')) {
				return;
			}
			this._setPending($notification, true);

			$.ajax({
				url: OC.linkToOCS('apps/notifications/api/v1', 2) + 'notifications/' + encodeURIComponent(id) + '?format=json',
				type: 'DELETE'
			}).done(function() {
				self._removeNotification(id, {lokal: true, fokusAufBody: fokusAufBody});
				self._announce(t('notifications', 'Notification dismissed'));
			}).fail(function() {
				self._setPending($notification, false);
				self._focusIfStillThere($notification, $button);
				OC.Notification.showTemporary(t('notifications', 'The notification could not be dismissed.'), {type: 'error'});
			});
		},

		_onClickAction: function(event) {
			event.preventDefault();
			var self = this;
			var $target = $(event.currentTarget);
			var $notification = $target.closest('.notification');
			var id = String($notification.attr('data-id'));
			var actionType = String($target.attr('data-type') || 'GET').toUpperCase();
			var actionUrl = $target.attr('data-href');
			var label = $target.text();
			var fokusAufBody = this._fokusAufBody();

			if ($notification.hasClass('notification-pending') || !this._isSafeUrl(actionUrl)) {
				return;
			}
			this._setPending($notification, true);

			var fehlgeschlagen = function() {
				self._setPending($notification, false);
				self._focusIfStillThere($notification, $target);
				OC.Notification.showTemporary(t('notifications', 'The action could not be completed.'), {type: 'error'});
			};

			$.ajax({
				url: this._withJsonFormat(actionUrl),
				type: actionType
			}).done(function(data) {
				if (!self._ocsSucceeded(data)) {
					fehlgeschlagen();
					return;
				}
				$('body').trigger(new $.Event('OCA.Notification.Action', {
					notification: self.notifications[id],
					action: {
						url: actionUrl,
						type: actionType
					}
				}));
				self._removeNotification(id, {lokal: true, fokusAufBody: fokusAufBody});
				self._announce(t('notifications', 'Done: {action}', {action: label}, undefined, {escape: false}));
			}).fail(fehlgeschlagen);
		},

		/**
		 * Stand der Fokus beim Klick auf <body>? Safari und Firefox unter macOS
		 * fokussieren Knöpfe beim Mausklick nicht. Festgehalten wird das beim
		 * Klick, nicht bei der Antwort: wer bis dahin woanders geklickt hat,
		 * steht auch auf <body>, will aber nicht zurückgeholt werden.
		 */
		_fokusAufBody: function() {
			return document.activeElement === null || document.activeElement === document.body;
		},

		_menueOffen: function() {
			return !!(OC._currentMenu && OC._currentMenu.is(this.$container));
		},

		/**
		 * Nach einem Fehlschlag den Knopf wieder fokussieren - aber nur, wenn der
		 * Fokus noch in der Meldung oder nirgends steht. Wer inzwischen woanders
		 * arbeitet, wird nicht zurückgeholt.
		 */
		_focusIfStillThere: function($notification, $ziel) {
			var aktiv = document.activeElement;
			if (aktiv === null || aktiv === document.body || $.contains($notification[0], aktiv) || aktiv === $notification[0]) {
				$ziel.trigger('focus');
			}
		},

		_setPending: function($notification, pending) {
			$notification.toggleClass('notification-pending', pending);
			if (pending) {
				$notification.attr('aria-busy', 'true');
			} else {
				$notification.removeAttr('aria-busy');
			}
		},

		/**
		 * Aktions-Links von files_sharing und federatedfilesharing zeigen auf
		 * ocs/v1.php. Dort kommt ein Fehler (404, 403, 400) mit HTTP 200 zurück -
		 * ohne diese Prüfung meldete die Glocke Erfolg und blendete die Meldung
		 * aus, obwohl die Freigabe nicht angenommen war.
		 */
		_ocsSucceeded: function(data) {
			var code = null;
			if (data && data.ocs && data.ocs.meta && data.ocs.meta.statuscode !== undefined) {
				code = parseInt(data.ocs.meta.statuscode, 10);
			} else if (typeof data === 'string') {
				var treffer = data.match(/<statuscode>\s*(\d+)\s*<\/statuscode>/);
				if (treffer) {
					code = parseInt(treffer[1], 10);
				}
			} else if (data && data.documentElement) {
				var knoten = data.getElementsByTagName('statuscode');
				if (knoten.length) {
					code = parseInt(knoten[0].textContent, 10);
				}
			}
			if (code === null || isNaN(code)) {
				// Kein OCS-Umschlag: ein gewöhnlicher Endpunkt, HTTP 2xx genügt.
				return true;
			}
			return code === 100 || (code >= 200 && code < 300);
		},

		_withJsonFormat: function(url) {
			if (/[?&]format=/.test(url)) {
				return url;
			}
			return url + (url.indexOf('?') === -1 ? '?' : '&') + 'format=json';
		},

		/**
		 * Nur http(s) und Pfade der eigenen Instanz - kein javascript: oder data:.
		 */
		_isSafeUrl: function(url) {
			if (typeof url !== 'string' || url === '') {
				return false;
			}
			return /^https?:\/\//i.test(url) || (url.charAt(0) === '/' && url.charAt(1) !== '/');
		},

		_findElement: function(id) {
			id = String(id);
			return this.$wrapper.children('.notification').filter(function() {
				return this.getAttribute('data-id') === id;
			});
		},

		/**
		 * Entfernt eine Meldung. Stand der Fokus in ihr, wandert er zur nächsten
		 * Meldung, sonst zur vorigen, sonst zurück auf die Glocke - vorher fiel er
		 * auf <body>, und wer mit der Tastatur arbeitet, stand wieder am
		 * Seitenanfang.
		 *
		 * Fokus auf <body> zählt nur, wenn der Nutzer diese Meldung selbst
		 * erledigt hat (optionen.lokal), der Fokus schon beim Klick auf <body>
		 * stand (Safari und Firefox unter macOS fokussieren Knöpfe beim Mausklick
		 * nicht) und die Liste noch offen ist. Entfernt dagegen der
		 * Hintergrundabruf eine Meldung, wird der Fokus nie von <body> weggeholt.
		 *
		 * Entfernt der Hintergrundabruf die Meldung, in der der Fokus steht,
		 * wandert er auf die Überschrift, nicht auf einen Ausblenden-Knopf: der
		 * nächste Tastendruck galt der verschwundenen Meldung und löschte sonst
		 * ungefragt die Nachbarin.
		 *
		 * @param {string} id
		 * @param {{lokal: boolean, fokusAufBody: boolean}} [optionen]
		 */
		_removeNotification: function(id, optionen) {
			optionen = optionen || {};
			var lokal = optionen.lokal === true;
			var $notification = this._findElement(id);
			delete this.notifications[String(id)];
			if (lokal) {
				this._entfernt[String(id)] = Date.now();
			}
			if (!$notification.length) {
				this._render();
				return;
			}

			var aktiv = document.activeElement;
			var hatteFokus = aktiv === $notification[0] || $.contains($notification[0], aktiv)
				|| (lokal && optionen.fokusAufBody === true && this._menueOffen()
					&& (aktiv === null || aktiv === document.body));
			var $ziel;
			if (lokal) {
				$ziel = $notification.next('.notification').find('.notification-delete');
				if (!$ziel.length) {
					$ziel = $notification.prev('.notification').find('.notification-delete');
				}
				if (!$ziel.length) {
					$ziel = this.$button;
				}
			} else {
				$ziel = null;
			}

			$notification.remove();
			this._render();
			if (hatteFokus && $ziel === null) {
				this._focusHeading();
			} else if (hatteFokus) {
				$ziel.trigger('focus');
			}
		},

		/**
		 * Meldungen aus einer Antwort, die älter ist als eine Entfernung im
		 * Browser, bleiben draußen: GET und DELETE laufen am Server parallel
		 * (die Sitzung ist vor dem Controller geschlossen). Kam das DELETE
		 * zuerst zurück, holte der langsamere Abruf die Meldung wieder herein
		 * und kündigte sie als neu an.
		 *
		 * @param {Array} data
		 * @param {number} gestartet Zeitpunkt, zu dem der Abruf abging
		 * @return {Array}
		 */
		_ohneEntfernte: function(data, gestartet) {
			var self = this;
			var uebrig = _.filter(data, function(item) {
				var zeit = self._entfernt[String(item.notification_id)];
				return zeit === undefined || zeit < gestartet;
			});
			// Ein Abruf, der nach der Entfernung abging, kennt den Serverstand
			// danach. Der Merker bleibt trotzdem, bis kein älterer Abruf mehr
			// unterwegs sein kann (Zeitlimit von fetch): überlappende Abrufe
			// (Zeitgeber und visibilitychange) holten die Meldung sonst mit der
			// späteren Antwort des älteren doch zurück.
			var jetzt = Date.now();
			_.each(_.keys(this._entfernt), function(id) {
				if (self._entfernt[id] < gestartet && jetzt - self._entfernt[id] > self.fetchTimeout + 10000) {
					delete self._entfernt[id];
				}
			});
			return uebrig;
		},

		initialFetch: function() {
			var self = this;
			var gestartet = Date.now();

			this.fetch(
				function(data) {
					data = self._ohneEntfernte(data, gestartet);
					// Der automatische Nachholversuch (Zeitgeber) blendet den
					// Fehlerhinweis samt "Erneut versuchen" aus. Stand der Fokus
					// darauf, fiele er auf <body>.
					var fehlerSichtbar = !self.$error.hasClass('hidden');
					var fokusImFehler = $.contains(self.$error[0], document.activeElement);
					self._loaded = true;
					self._failures = 0;
					self._currentInterval = self.pollInterval;
					self.$wrapper.empty();
					self.notifications = {};
					_.each(data, function(item) {
						var eintrag = new self.Notif(item);
						self.notifications[String(eintrag.getId())] = eintrag;
					});
					_.each(self._sortedIds(), function(id) {
						self.$wrapper.append(self.notifications[id].renderElement());
					});
					self._render();
					self._merkeSichtbar();
					if (fokusImFehler) {
						self._focusHeading();
					}
					if (self._retrying || (fehlerSichtbar && self._menueOffen())) {
						self._retrying = false;
						var anzahl = self.numNotifications();
						self._announce(anzahl === 0
							? t('notifications', 'No notifications')
							: t('notifications', 'Notifications') + ' (' + anzahl + ')');
					}
					self._schedule();
				},
				function(xhr) {
					self._onFetchError(xhr, true);
				}
			);
		},

		/**
		 * Background fetch handler
		 */
		backgroundFetch: function() {
			var self = this;

			if (this._shutDown) {
				return;
			}
			// Unsichtbarer Tab: nur abfragen, wenn Browser-Benachrichtigungen
			// erlaubt sind - für sie ist das der eigentliche Fall -, und dann
			// seltener. Sonst holt visibilitychange den Abruf beim Zurückkehren
			// sofort nach.
			if (document.hidden
				&& (!this._webNotificationsAllowed() || Date.now() - this._lastFetch < this.hiddenPollInterval)) {
				this._schedule();
				return;
			}
			// session_keepalive=false heißt: Sitzungen sollen ohne Zutun ablaufen.
			// Jeder Abruf erneuert die Sitzung - also nur, solange jemand da ist.
			// Dieselbe Auswertung wie der Kern (core/js/js.js): fehlt der Wert,
			// gilt true; sonst zählt die Wahrheitswertigkeit (auch 0 oder '').
			var keepalive = !window.oc_config || typeof window.oc_config.session_keepalive === 'undefined'
				|| !!window.oc_config.session_keepalive;
			if (!keepalive && Date.now() - this._lastActivity > this.pollInterval * 2) {
				this._schedule();
				return;
			}
			if (!this._loaded) {
				this.initialFetch();
				return;
			}

			var gestartet = Date.now();
			this.fetch(
				function(data) {
					data = self._ohneEntfernte(data, gestartet);
					self._failures = 0;
					self._currentInterval = self.pollInterval;
					var imAbruf = {};
					var neue = [];
					_.each(data, function(item) {
						var eintrag = new self.Notif(item);
						var id = String(eintrag.getId());
						imAbruf[id] = true;
						if (!self.notifications[id]) {
							self.notifications[id] = eintrag;
							neue.push(eintrag);
						}
					});

					_.each(_.keys(self.notifications), function(id) {
						if (imAbruf[id]) {
							return;
						}
						// Läuft auf der Meldung gerade eine eigene Aktion, räumt deren
						// Antwort sie weg - mit dem Fokus auf der Nachbarin. Kam der
						// Abruf zuerst zurück, landete er sonst auf der Überschrift.
						if (self._findElement(id).hasClass('notification-pending')) {
							return;
						}
						self._removeNotification(id);
					});

					_.each(neue, function(eintrag) {
						self._insertElement(eintrag);
					});
					self._merkeSichtbar();
					// Browser-Benachrichtigungen nur für unsichtbare Tabs, und nur,
					// wenn kein anderer Tab sichtbar ist und kein anderer sie schon
					// gezeigt hat. Mehrere neue Meldungen ergeben eine
					// Sammelbenachrichtigung statt eines Schwalls.
					var zuMelden = document.hidden && neue.length ? self._nochNichtGemeldet(neue) : [];
					if (zuMelden.length === 1) {
						self._createWebNotification(zuMelden[0]);
					} else if (zuMelden.length > 1) {
						self._createWebNotificationSummary(zuMelden);
					}

					self.$wrapper.find('.notification-time').each(function() {
						var ms = parseInt(this.getAttribute('data-ms'), 10);
						if (!isNaN(ms)) {
							this.textContent = OC.Util.relativeModifiedDate(ms);
						}
					});

					self._render();
					if (neue.length === 1) {
						self._announce(t('notifications', 'New notification: {subject}', {subject: neue[0].getSubject()}, undefined, {escape: false}));
					} else if (neue.length > 1) {
						// Ohne Pluralschlüssel: Arabisch kennt sechs Formen, Polnisch vier -
						// "Neue Benachrichtigungen: 3" ist in jeder Sprache richtig.
						self._announce(t('notifications', 'New notifications: {count}', {count: neue.length}));
					}
					self._schedule();
				},
				function(xhr) {
					self._onFetchError(xhr, false);
				}
			);
		},

		_sortedIds: function() {
			return _.sortBy(_.keys(this.notifications), function(id) {
				return -parseInt(id, 10);
			});
		},

		/**
		 * Neueste zuerst: die Liste ist absteigend nach Kennung geordnet.
		 */
		_insertElement: function(notification) {
			var id = parseInt(notification.getId(), 10);
			var $el = notification.renderElement();
			var $davor = this.$wrapper.children('.notification').filter(function() {
				return parseInt(this.getAttribute('data-id'), 10) < id;
			}).first();
			if ($davor.length) {
				$davor.before($el);
			} else {
				this.$wrapper.append($el);
			}
		},

		/**
		 * Fehler beim Abruf. Kein Toast alle 30 Sekunden mehr und kein Neuladen
		 * der Seite: allowAuthErrors hält den globalen Fehlerhandler des Kerns
		 * heraus, der bei Status 0 (WLAN-Wechsel, Standby) die Seite neu lud.
		 */
		_onFetchError: function(xhr, initial) {
			var status = xhr ? xhr.status : 0;
			if (status === 404) {
				this._shutDownNotifications();
				return;
			}
			if (initial && !this._loaded) {
				this.$loading.addClass('hidden');
				this.$error.removeClass('hidden');
				if (this._retrying) {
					this._retrying = false;
					this._announce(t('notifications', 'Notifications could not be loaded.'));
				}
			}
			if (status === 401) {
				// Sitzung abgelaufen oder abgemeldet: nicht still aufhören, sondern
				// wie 0.7.3 den Kern entscheiden lassen - er lädt zur Anmeldung neu.
				// allowAuthErrors hält ihn nur bei Netzfehlern heraus.
				this._stopPolling();
				if (typeof OC._processAjaxError === 'function') {
					OC._processAjaxError(xhr);
				}
				return;
			}
			this._failures++;
			this._currentInterval = Math.min(this.pollInterval * Math.pow(2, this._failures), this.maxPollInterval);
			this._schedule();
		},

		_schedule: function() {
			if (this._shutDown) {
				return;
			}
			window.clearTimeout(this._timer);
			this._timer = window.setTimeout(_.bind(this.backgroundFetch, this), this._currentInterval);
		},

		_stopPolling: function() {
			window.clearTimeout(this._timer);
			this._timer = null;
		},

		/**
		 * Browser-Benachrichtigung nur, wenn die Erlaubnis schon erteilt ist.
		 * Die Anfrage kam früher aus dem 30-Sekunden-Takt, also ohne Zutun:
		 * Firefox und Safari lehnen das still ab, Chrome platzte mitten in die
		 * Arbeit. Chrome für Android wirft beim Konstruktor.
		 */
		_webNotificationsAllowed: function() {
			return 'Notification' in window && window.Notification.permission === 'granted';
		},

		_createWebNotification: function(notification) {
			this._showWebNotification(notification.getSubject(), {
				body: notification.getRawMessage(),
				icon: notification.getIcon(),
				tag: String(notification.getId())
			});
		},

		_createWebNotificationSummary: function(notifications) {
			var betreffe = _.map(notifications.slice(0, 5), function(eintrag) {
				return eintrag.getSubject();
			});
			this._showWebNotification(
				t('notifications', 'New notifications: {count}', {count: notifications.length}, undefined, {escape: false}),
				{body: betreffe.join('\n'), tag: 'notifications-summary'}
			);
		},

		_showWebNotification: function(title, options) {
			if (!this._webNotificationsAllowed()) {
				return;
			}
			try {
				var webNotification = new window.Notification(title, _.extend({lang: OC.getLocale()}, options));
				window.setTimeout(webNotification.close.bind(webNotification), 5000);
			} catch (e) {
				// Kein Konstruktor verfügbar - die Glocke zeigt die Meldung trotzdem.
			}
		},

		/**
		 * Die App ist aus oder niemand meldet Benachrichtigungen: Glocke weg,
		 * nicht versteckt.
		 */
		_shutDownNotifications: function() {
			this._shutDown = true;
			this._stopPolling();
			$(document).off('.notifications');
			if (OC._currentMenu && OC._currentMenu.is(this.$container)) {
				OC.hideMenus();
			}
			OC.unregisterMenu(this.$button, this.$container);
			this.$notifications.remove();
		},

		_updateButton: function() {
			var anzahl = this.numNotifications();
			this.$button.toggleClass('has-notifications', anzahl > 0);
			if (anzahl > 0) {
				// Aus dem vorhandenen Schlüssel zusammengesetzt: "Notifications" ist in
				// allen 37 Katalogen übersetzt, ein neuer Schlüssel fiele außerhalb
				// von Deutsch auf Englisch zurück.
				this.$button.attr('aria-label', t('notifications', 'Notifications') + ' (' + anzahl + ')');
				this.$badge.text(anzahl > 99 ? '99+' : String(anzahl)).removeClass('hidden');
			} else {
				this.$button.attr('aria-label', t('notifications', 'Notifications'));
				this.$badge.text('').addClass('hidden');
			}
		},

		/**
		 * Zustand von Liste, Leer-, Lade- und Fehlertext aus den Daten ableiten.
		 */
		_render: function() {
			var anzahl = this.numNotifications();
			if (this._loaded) {
				this.$loading.addClass('hidden');
				this.$error.addClass('hidden');
			}
			this.$empty.toggleClass('hidden', !this._loaded || anzahl !== 0);
			this.$wrapper.toggleClass('hidden', anzahl === 0);
			this._updateButton();
		},

		/**
		 * Performs the AJAX request to retrieve the notifications
		 * @param {Function} success
		 * @param {Function} failure
		 */
		fetch: function(success, failure) {
			var self = this;
			this._lastFetch = Date.now();
			$.ajax({
				url: OC.linkToOCS('apps/notifications/api/v1', 2) + 'notifications?format=json',
				type: 'GET',
				timeout: self.fetchTimeout,
				allowAuthErrors: true
			}).done(function(data, statusText, xhr) {
				if (xhr.status === 204 || (data && data.ocs && data.ocs.meta && data.ocs.meta.statuscode === 204)) {
					// 204 No Content - no app registers notifiers.
					self._shutDownNotifications();
					return;
				}
				if (!data || !data.ocs || !_.isArray(data.ocs.data)) {
					failure(xhr);
					return;
				}
				success(data.ocs.data);
			}).fail(failure);
		},

		/**
		 * Retrieves a notification object by id
		 * @param {int} id
		 */
		getNotification: function(id) {
			return this.notifications[String(id)] || false;
		},

		/**
		 * Returns all notification objects
		 */
		getNotifications: function() {
			return this.notifications;
		},

		/**
		 * Returns how many notifications in the UI
		 */
		numNotifications: function() {
			return _.keys(this.notifications).length;
		}

	};
})();

$(document).ready(function () {
	OCA.Notifications.initialise();
});
