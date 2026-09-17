/**
 * Karte "Browser-Benachrichtigungen" in den persönlichen Einstellungen.
 *
 * Seit 1.0.0 fragt die Glocke nicht mehr von sich aus nach der Erlaubnis; ohne
 * diese Karte ließen sich Browser-Benachrichtigungen nicht mehr erlauben.
 *
 * Geprüft wird:
 *   - beim Laden wird NICHT nach der Erlaubnis gefragt
 *   - Erlaubnis offen: Status "Noch nicht erlaubt.", Knopf bedienbar; Klick
 *     fragt genau einmal, danach Status der Entscheidung, Knopf weg, Fokus
 *     auf der Statuszeile
 *   - Erlaubnis erteilt: Status "In diesem Browser erlaubt.", kein Knopf
 *   - Browser ohne Notification-API: Hinweis, kein Knopf
 *   - deutsch (du), keine Konsolenfehler
 *
 * Aufruf: OC_PASSWORD=... node tests/visual/pruefe-browser-benachrichtigungen.js
 *
 * @copyright Copyright (c) 2026, BW-Tech GmbH
 * @license AGPL-3.0
 */
'use strict';

let chromium;
try {
	({ chromium } = require('playwright'));
} catch (e) {
	({ chromium } = require('C:/git/owncloud.online-redesign/node_modules/playwright'));
}

const BASIS = process.env.OC_URL || 'http://127.0.0.1:18130';
const PASSWORT = process.env.OC_PASSWORD;
const SEITE = BASIS + '/index.php/settings/personal?sectionid=notifications';
if (!PASSWORT) {
	console.error('OC_PASSWORD fehlt.');
	process.exit(2);
}

const ergebnisse = [];
function pruefe(name, ok, zusatz) {
	ergebnisse.push({ name, ok: ok === true, zusatz: zusatz === undefined ? '' : String(zusatz) });
}

/**
 * Notification-API im Browser nachbilden, damit Entscheidung und Zählung
 * steuerbar sind (kopflose Browser zeigen keinen echten Dialog).
 */
function attrappe(anfangsWert, antwort) {
	return `(() => {
		let erlaubnis = ${JSON.stringify(anfangsWert)};
		window.__anfragen = 0;
		function N() {}
		Object.defineProperty(N, 'permission', { get: () => erlaubnis });
		N.requestPermission = function (rueckruf) {
			window.__anfragen++;
			erlaubnis = ${JSON.stringify(antwort)};
			if (typeof rueckruf === 'function') { rueckruf(erlaubnis); }
			return Promise.resolve(erlaubnis);
		};
		window.Notification = N;
	})();`;
}

async function anmelden(kontext) {
	const seite = await kontext.newPage();
	await seite.goto(BASIS + '/index.php/login', { waitUntil: 'domcontentloaded' });
	await seite.fill('#user', 'admin');
	await seite.fill('#password', PASSWORT);
	await Promise.all([seite.waitForNavigation({ timeout: 60000 }).catch(() => {}), seite.click('#submit, button[type=submit], input[type=submit]')]);
	return seite;
}

async function zustand(seite) {
	return seite.evaluate(() => {
		const k = document.getElementById('browser_notifications_allow');
		return {
			titel: (document.querySelector('#browser_notifications h2') || {}).textContent,
			status: document.getElementById('browser_notifications_status').textContent,
			knopf: k ? { text: k.textContent.trim(), aus: k.disabled } : null,
			fokus: document.activeElement ? document.activeElement.id : null,
			anfragen: window.__anfragen,
		};
	});
}

(async () => {
	const browser = await chromium.launch();
	const konsole = [];

	for (const [name, anfang, antwort] of [['offen, Nutzer erlaubt', 'default', 'granted'], ['offen, Nutzer blockiert', 'default', 'denied']]) {
		const kontext = await browser.newContext({ locale: 'de-DE' });
		const seite = await anmelden(kontext);
		seite.on('console', (m) => { if (m.type() === 'error') { konsole.push(m.text().slice(0, 160)); } });
		await seite.addInitScript(attrappe(anfang, antwort));
		await seite.goto(SEITE, { waitUntil: 'load' });
		await seite.waitForSelector('#browser_notifications', { timeout: 30000 });
		await seite.waitForTimeout(800);
		const vorher = await zustand(seite);
		pruefe(name + ': Karte deutsch', vorher.titel === 'Browser-Benachrichtigungen', vorher.titel);
		pruefe(name + ': beim Laden keine Abfrage', vorher.anfragen === 0, vorher.anfragen);
		pruefe(name + ': Status "Noch nicht erlaubt.", Knopf bedienbar', vorher.status === 'Noch nicht erlaubt.' && vorher.knopf && vorher.knopf.aus === false && vorher.knopf.text === 'Browser-Benachrichtigungen erlauben', JSON.stringify(vorher));

		await seite.focus('#browser_notifications_allow');
		await seite.keyboard.press('Enter');
		await seite.waitForTimeout(600);
		const nachher = await zustand(seite);
		const erwartet = antwort === 'granted' ? 'In diesem Browser erlaubt.' : 'In diesem Browser blockiert. Zum Ändern die Benachrichtigungen für diese Seite in den Browser-Einstellungen erlauben.';
		pruefe(name + ': genau eine Abfrage, Status der Entscheidung', nachher.anfragen === 1 && nachher.status === erwartet, JSON.stringify(nachher));
		pruefe(name + ': Knopf weg, Fokus auf der Statuszeile', nachher.knopf === null && nachher.fokus === 'browser_notifications_status', JSON.stringify(nachher));
		await kontext.close();
	}

	// schon erlaubt
	{
		const kontext = await browser.newContext({ locale: 'de-DE' });
		const seite = await anmelden(kontext);
		await seite.addInitScript(attrappe('granted', 'granted'));
		await seite.goto(SEITE, { waitUntil: 'load' });
		await seite.waitForSelector('#browser_notifications');
		await seite.waitForTimeout(800);
		const z = await zustand(seite);
		pruefe('schon erlaubt: Status, kein Knopf, keine Abfrage', z.status === 'In diesem Browser erlaubt.' && z.knopf === null && z.anfragen === 0, JSON.stringify(z));
		await kontext.close();
	}

	// ohne Notification-API
	{
		const kontext = await browser.newContext({ locale: 'de-DE' });
		const seite = await anmelden(kontext);
		await seite.addInitScript('delete window.Notification;');
		await seite.goto(SEITE, { waitUntil: 'load' });
		await seite.waitForSelector('#browser_notifications');
		await seite.waitForTimeout(800);
		const z = await zustand(seite);
		pruefe('ohne Notification-API: Hinweis, kein Knopf', z.status === 'Dieser Browser unterstützt keine Benachrichtigungen.' && z.knopf === null, JSON.stringify(z));
		await kontext.close();
	}

	pruefe('keine Konsolenfehler', konsole.length === 0, konsole.join(' | '));
	await browser.close();

	let fehler = 0;
	for (const e of ergebnisse) {
		console.log((e.ok ? 'OK    ' : 'FEHL  ') + e.name + (e.zusatz ? '  (' + e.zusatz + ')' : ''));
		if (!e.ok) {
			fehler++;
		}
	}
	console.log('\n' + (ergebnisse.length - fehler) + '/' + (ergebnisse.length) + ' bestanden');
	process.exit(fehler === 0 ? 0 : 1);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
