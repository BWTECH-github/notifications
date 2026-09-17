<?php
/**
 * @author Juan Pablo Villafáñez <jvillafanez@solidgear.es>
 *
 * @copyright Copyright (c) 2018, ownCloud GmbH
 * Modified by BW-Tech GmbH
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

namespace OCA\Notifications\Tests\Unit\Mailer;

use OC\Mail\Mailer;
use OCP\IURLGenerator;
use OCP\Notification\IManager;
use OCP\Notification\INotification;
use OCP\L10N\IFactory;
use OCP\IL10N;
use OCA\Notifications\Configuration\OptionsStorage;
use OCA\Notifications\Mailer\NotificationMailer;

class NotificationMailerTest extends \Test\TestCase {
	/** @var IManager */
	private $manager;
	/** @var Mailer */
	private $mailer;
	/** @var OptionsStorage */
	private $optionsStorage;
	/** @var NotificationMailer*/
	private $notificationMailer;
	/** @var IURLGenerator*/
	private $urlGenerator;

	protected function setUp(): void {
		parent::setUp();

		$this->manager = $this->getMockBuilder(IManager::class)
			->disableOriginalConstructor()
			->getMock();

		$this->mailer = $this->getMockBuilder(Mailer::class)
			->setMethodsExcept(['createMessage'])
			->disableOriginalConstructor()
			->getMock();

		$this->optionsStorage = $this->getMockBuilder(OptionsStorage::class)
			->disableOriginalConstructor()
			->getMock();

		$this->urlGenerator = $this->getMockBuilder(IURLGenerator::class)
			->disableOriginalConstructor()
			->getMock();

		$this->notificationMailer = new NotificationMailer($this->manager, $this->mailer, $this->optionsStorage, $this->urlGenerator);
	}

	public function emailProvider() {
		return [
			['a@test.com'],
			['a@x.invalid.com'],
			['oöGm41l@test.com'],
			['@b.test.com'],
			[''],
		];
	}

	/**
	 * @dataProvider emailProvider
	 */
	public function testValidateEmail($email) {
		$pattern = '/^[a-zA-Z0-9][a-zA-Z0-9]*@test\.com$/';

		$this->mailer->method('validateMailAddress')
			->will($this->returnCallback(function ($email) use ($pattern) {
				return \preg_match($pattern, $email) === 1;
			}));

		$this->assertEquals(\preg_match($pattern, $email) === 1, $this->notificationMailer->validateEmail($email));
	}

	public function testSendNotification() {
		$mockedNotification = $this->getMockBuilder(INotification::class)->disableOriginalConstructor()->getMock();
		$mockedNotification->method('getUser')->willReturn('userTest1');
		$mockedNotification->method('getObjectType')->willReturn('test_obj_type');
		$mockedNotification->method('getObjectId')->willReturn('202');
		$mockedNotification->method('getParsedSubject')->willReturn('This is a parsed subject');
		$mockedNotification->method('getParsedMessage')->willReturn('Parsed message is this');
		$mockedNotification->method('getLink')->willReturn('');

		$this->manager->method('prepare')->willReturn($mockedNotification);

		$mockedL10N = $this->getMockBuilder(IL10N::class)->disableOriginalConstructor()->getMock();
		$mockedL10N->method('t')
			->will($this->returnCallback(function ($text, $params) {
				return \vsprintf($text, $params);
			}));

		$this->mailer->expects($this->once())->method('send');

		$this->optionsStorage->method('getOptions')
			->with('userTest1')
			->willReturn(['email_sending_option' => 'always']);

		$sentMessage = $this->notificationMailer->sendNotification($mockedNotification, 'http://test.server/oc', 'test@example.com');

		// Seit dem symfony/mailer-Umbau im Core liefert getTo() Address-Objekte
		// statt Strings — für den Vergleich auf die E-Mail-Adresse normalisieren.
		$recipients = \array_map(
			static fn ($address) => \is_object($address) ? $address->getAddress() : (string)$address,
			\array_values($sentMessage->getTo())
		);
		$this->assertEquals(['test@example.com'], $recipients);
		// check that the notification subject is the email subject
		$this->assertEquals('This is a parsed subject', $sentMessage->getSubject());

		// notification's subject and message must be present in the email body, as well as the server url
		$plainBody = self::extractPlainBody($sentMessage->getPlainBody());
		$this->assertStringContainsString($mockedNotification->getParsedSubject(), $plainBody);
		$this->assertStringContainsString($mockedNotification->getParsedMessage(), $plainBody);
		$this->assertStringContainsString('http://test.server/oc', $plainBody);
	}

	/**
	 * Seit dem symfony/mailer-Umbau im Core liefert getPlainBody() je nach
	 * Mail-Aufbau ein TextPart- oder Multipart-Objekt statt eines Strings —
	 * hier wird der text/plain-Teil für die Assertions extrahiert.
	 *
	 * @param mixed $body
	 */
	private static function extractPlainBody($body): string {
		if (\is_string($body)) {
			return $body;
		}
		if ($body instanceof \Symfony\Component\Mime\Part\TextPart) {
			return $body->getBody();
		}
		if ($body instanceof \Symfony\Component\Mime\Part\AbstractMultipartPart) {
			foreach ($body->getParts() as $part) {
				$extracted = self::extractPlainBody($part);
				if ($extracted !== '') {
					return $extracted;
				}
			}
		}
		return '';
	}

	/**
	 */
	public function testSendNotificationFailedRecipients() {
		$this->expectException(\Exception::class);

		$mockedNotification = $this->getMockBuilder(INotification::class)->disableOriginalConstructor()->getMock();
		$mockedNotification->method('getUser')->willReturn('userTest1');
		$mockedNotification->method('getObjectType')->willReturn('test_obj_type');
		$mockedNotification->method('getObjectId')->willReturn('202');
		$mockedNotification->method('getParsedSubject')->willReturn('This is a parsed subject');
		$mockedNotification->method('getParsedMessage')->willReturn('Parsed message is this');
		$mockedNotification->method('getLink')->willReturn('');

		$this->manager->method('prepare')->willReturn($mockedNotification);

		$mockedL10N = $this->getMockBuilder(IL10N::class)->disableOriginalConstructor()->getMock();
		$mockedL10N->method('t')
			->will($this->returnCallback(function ($text, $params) {
				return \vsprintf($text, $params);
			}));

		$this->mailer->expects($this->once())
			->method('send')
			->willReturn(['userTest1']);

		$this->optionsStorage->method('getOptions')
			->with('userTest1')
			->willReturn(['email_sending_option' => 'always']);

		$sentMessage = $this->notificationMailer->sendNotification($mockedNotification, 'http://test.server/oc', 'test@example.com');
	}

	public function testSendNotificationPrevented() {
		$mockedNotification = $this->getMockBuilder(INotification::class)->disableOriginalConstructor()->getMock();
		$mockedNotification->method('getUser')->willReturn('userTest1');
		$mockedNotification->method('getObjectType')->willReturn('test_obj_type');
		$mockedNotification->method('getObjectId')->willReturn('202');
		$mockedNotification->method('getParsedSubject')->willReturn('This is a parsed subject');
		$mockedNotification->method('getParsedMessage')->willReturn('Parsed message is this');

		$this->manager->method('prepare')->willReturn($mockedNotification);

		$this->optionsStorage->method('getOptions')
			->with('userTest1')
			->willReturn(['email_sending_option' => 'never']);

		$sentMessage = $this->notificationMailer->sendNotification($mockedNotification, 'http://test.server/oc', ['test@example.com']);
		$this->assertFalse($sentMessage);
	}

	public function willSendNotificationProvider() {
		$mockedAction = $this->getMockBuilder(IAction::class)
			->disableOriginalConstructor()
			->getMock();
		$mockedNotification = $this->getMockBuilder(INotification::class)
			->disableOriginalConstructor()
			->getMock();
		$mockedNotification->method('getUser')->willReturn('userTest1');
		$mockedNotification->method('getObjectType')->willReturn('test_obj_type');
		$mockedNotification->method('getObjectId')->willReturn('202');
		$mockedNotification->method('getParsedSubject')->willReturn('This is a parsed subject');
		$mockedNotification->method('getParsedMessage')->willReturn('Parsed message is this');
		$mockedNotification->method('getActions')->willReturn([$mockedAction]);

		$mockedNotification2 = $this->getMockBuilder(INotification::class)
			->disableOriginalConstructor()
			->getMock();
		$mockedNotification2->method('getUser')->willReturn('userTest1');
		$mockedNotification2->method('getObjectType')->willReturn('test_obj_type');
		$mockedNotification2->method('getObjectId')->willReturn('202');
		$mockedNotification2->method('getParsedSubject')->willReturn('This is a parsed subject');
		$mockedNotification2->method('getParsedMessage')->willReturn('Parsed message is this');

		return [
			[$mockedNotification, 'never', false],
			[$mockedNotification, 'always', true],
			[$mockedNotification, 'action', true],
			[$mockedNotification, 'randomMissing', false],
			[$mockedNotification2, 'never', false],
			[$mockedNotification2, 'always', true],
			[$mockedNotification2, 'action', false],
			[$mockedNotification2, 'randomMissing', false],
		];
	}

	/**
	 * @dataProvider willSendNotificationProvider
	 */
	public function testWillSendNotification($notification, $configOption, $expectedValue) {
		$this->optionsStorage->method('getOptions')
			->with('userTest1')
			->willReturn(['email_sending_option' => $configOption]);

		$this->assertEquals($expectedValue, $this->notificationMailer->willSendNotification($notification));
	}

	/**
	 * Ziel der Schaltfläche ist nur http(s) - ein javascript:-Link aus einer
	 * fremden App führt auf die Instanz.
	 */
	public function testSendNotificationUnsafeLinkFallsBackToServer() {
		$mockedNotification = $this->getMockBuilder(INotification::class)->disableOriginalConstructor()->getMock();
		$mockedNotification->method('getUser')->willReturn('userTest1');
		$mockedNotification->method('getParsedSubject')->willReturn('Subject');
		$mockedNotification->method('getParsedMessage')->willReturn('Message');
		$mockedNotification->method('getLink')->willReturn('javascript:alert(1)');

		$this->manager->method('prepare')->willReturn($mockedNotification);
		$this->urlGenerator->method('getAbsoluteURL')->willReturnArgument(0);
		$this->mailer->expects($this->once())->method('send');
		$this->optionsStorage->method('getOptions')->willReturn(['email_sending_option' => 'always']);

		$sentMessage = $this->notificationMailer->sendNotification($mockedNotification, 'http://test.server/oc', 'test@example.com');
		$plainBody = self::extractPlainBody($sentMessage->getPlainBody());
		$this->assertStringContainsString('http://test.server/oc', $plainBody);
		$this->assertStringNotContainsString('javascript:', $plainBody);
	}

	/**
	 * Die Mail wird in der Sprache des Empfängers vorbereitet, nicht in der
	 * des auslösenden Requests.
	 */
	public function testSendNotificationUsesRecipientMailLanguage() {
		$mockedNotification = $this->getMockBuilder(INotification::class)->disableOriginalConstructor()->getMock();
		$mockedNotification->method('getUser')->willReturn('userTest1');
		$mockedNotification->method('getParsedSubject')->willReturn('Subject');
		$mockedNotification->method('getParsedMessage')->willReturn('');
		$mockedNotification->method('getLink')->willReturn('');

		$this->optionsStorage->method('getMailLanguage')->with('userTest1')->willReturn('de');
		$this->manager->expects($this->once())->method('prepare')
			->with($mockedNotification, 'de')
			->willReturn($mockedNotification);
		$this->mailer->expects($this->once())->method('send');
		$this->optionsStorage->method('getOptions')->willReturn(['email_sending_option' => 'always']);

		$this->notificationMailer->sendNotification($mockedNotification, 'http://test.server/oc', 'test@example.com');
	}

	/**
	 * Meldung, deren prepare() je Sprache die angegebenen Texte liefert.
	 * Protokolliert die Sprachen, mit denen vorbereitet wurde.
	 *
	 * @param array $texte Sprache => [Betreff, Nachricht]
	 * @param array $sprachen wird mit den Sprachen der prepare-Aufrufe gefüllt
	 */
	private function prepareLiefert(array $texte, array &$sprachen): INotification {
		$original = $this->getMockBuilder(INotification::class)->disableOriginalConstructor()->getMock();
		$original->method('getUser')->willReturn('userTest1');
		$original->method('getApp')->willReturn('files_sharing');
		$this->manager->method('prepare')
			->willReturnCallback(function ($notification, $sprache) use ($texte, &$sprachen) {
				$sprachen[] = $sprache;
				$vorbereitet = $this->getMockBuilder(INotification::class)->disableOriginalConstructor()->getMock();
				$vorbereitet->method('getUser')->willReturn('userTest1');
				$vorbereitet->method('getLink')->willReturn('');
				$vorbereitet->method('getParsedSubject')->willReturn($texte[$sprache][0]);
				$vorbereitet->method('getParsedMessage')->willReturn($texte[$sprache][1]);
				return $vorbereitet;
			});
		$this->mailer->expects($this->once())->method('send');
		$this->optionsStorage->method('getOptions')->willReturn(['email_sending_option' => 'always']);
		$this->optionsStorage->method('getMailLanguage')->with('userTest1')->willReturn('de');
		return $original;
	}

	/**
	 * Betreff und Nachricht in der Sprache, die die auslösende App übersetzt
	 * (hier sv für files_sharing), auch wenn der Rahmen mangels Katalog dieser
	 * App auf die Standardsprache ausweicht. Der Inhalt trägt ein eigenes lang.
	 */
	public function testSendNotificationPreparesContentInSourceAppLanguage() {
		$sprachen = [];
		$notification = $this->prepareLiefert([
			'en' => ['Shared', 'Message'],
			'sv' => ['Delat', 'Meddelande'],
			'de' => ['Geteilt', 'Nachricht'],
		], $sprachen);
		$this->optionsStorage->method('getContentLanguage')->with('userTest1', 'files_sharing')->willReturn('sv');

		$sentMessage = $this->notificationMailer->sendNotification($notification, 'http://test.server/oc', 'test@example.com');
		$htmlBody = self::extractBodyPart($sentMessage->getPlainBody(), 'html');
		$this->assertSame(['en', 'sv'], $sprachen);
		$this->assertSame('Delat', $sentMessage->getSubject());
		$this->assertMatchesRegularExpression('/<p lang="sv"[^>]*>\s*Delat/u', $htmlBody);
		$this->assertMatchesRegularExpression('/<p lang="sv"[^>]*>\s*Meddelande/u', $htmlBody);
	}

	/**
	 * Der Katalog der auslösenden App existiert, übersetzt diese Meldung aber
	 * nicht (files_sharing/da): dann gilt die Rahmensprache, ohne eigenes lang -
	 * statt englischem Text, der als Dänisch ausgezeichnet ist.
	 */
	public function testSendNotificationUntranslatedContentUsesMailLanguage() {
		$sprachen = [];
		$notification = $this->prepareLiefert([
			'en' => ['Shared', 'Message'],
			'da' => ['Shared', 'Message'],
			'de' => ['Geteilt', 'Nachricht'],
		], $sprachen);
		$this->optionsStorage->method('getContentLanguage')->willReturn('da');

		$sentMessage = $this->notificationMailer->sendNotification($notification, 'http://test.server/oc', 'test@example.com');
		$htmlBody = self::extractBodyPart($sentMessage->getPlainBody(), 'html');
		$this->assertSame(['en', 'da', 'de'], $sprachen);
		$this->assertSame('Geteilt', $sentMessage->getSubject());
		$this->assertStringContainsString('Nachricht', $htmlBody);
		$this->assertStringNotContainsString('<p lang=', $htmlBody);
	}

	/**
	 * Übersetzter Betreff, frei geschriebene Nachricht (Ankündigung): nur der
	 * Betreff bekommt lang, die Nachricht bleibt in der Rahmensprache.
	 */
	public function testSendNotificationFreeTextMessageKeepsMailLanguage() {
		$sprachen = [];
		$notification = $this->prepareLiefert([
			'en' => ['admin announced “Wartung”', 'Heute ab 18 Uhr'],
			'sv' => ['admin meddelade “Wartung”', 'Heute ab 18 Uhr'],
		], $sprachen);
		$this->optionsStorage->method('getContentLanguage')->willReturn('sv');

		$sentMessage = $this->notificationMailer->sendNotification($notification, 'http://test.server/oc', 'test@example.com');
		$htmlBody = self::extractBodyPart($sentMessage->getPlainBody(), 'html');
		$this->assertMatchesRegularExpression('/<p lang="sv"[^>]*>\s*admin meddelade/u', $htmlBody);
		$this->assertMatchesRegularExpression('/<p style="[^"]*">\s*Heute ab 18 Uhr/u', $htmlBody);
	}

	/**
	 * Kennt die auslösende App keine passende Sprache, gilt die Rahmensprache -
	 * und der Inhalt bekommt kein abweichendes lang.
	 */
	public function testSendNotificationContentFallsBackToMailLanguage() {
		$mockedNotification = $this->getMockBuilder(INotification::class)->disableOriginalConstructor()->getMock();
		$mockedNotification->method('getUser')->willReturn('userTest1');
		$mockedNotification->method('getApp')->willReturn('probe');
		$mockedNotification->method('getParsedSubject')->willReturn('Betreff');
		$mockedNotification->method('getParsedMessage')->willReturn('Nachricht');
		$mockedNotification->method('getLink')->willReturn('');

		$this->optionsStorage->method('getMailLanguage')->willReturn('de');
		$this->optionsStorage->method('getContentLanguage')->willReturn(null);
		$this->manager->expects($this->once())->method('prepare')
			->with($mockedNotification, 'de')
			->willReturn($mockedNotification);
		$this->mailer->expects($this->once())->method('send');
		$this->optionsStorage->method('getOptions')->willReturn(['email_sending_option' => 'always']);

		$sentMessage = $this->notificationMailer->sendNotification($mockedNotification, 'http://test.server/oc', 'test@example.com');
		$htmlBody = self::extractBodyPart($sentMessage->getPlainBody(), 'html');
		$this->assertStringContainsString('Betreff', $htmlBody);
		$this->assertStringNotContainsString('<p lang=', $htmlBody);
	}

	/**
	 * Den Teil mit dem gewünschten Untertyp (plain/html) aus dem Rumpf holen.
	 *
	 * @param mixed $body
	 */
	private static function extractBodyPart($body, string $subtype): string {
		if ($body instanceof \Symfony\Component\Mime\Part\TextPart) {
			return $body->getMediaSubtype() === $subtype ? $body->getBody() : '';
		}
		if ($body instanceof \Symfony\Component\Mime\Part\AbstractMultipartPart) {
			foreach ($body->getParts() as $part) {
				$extracted = self::extractBodyPart($part, $subtype);
				if ($extracted !== '') {
					return $extracted;
				}
			}
		}
		return '';
	}
}
