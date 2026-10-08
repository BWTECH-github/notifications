<?php
/**
 * @author Joas Schilling <nickvergessen@owncloud.com>
 * @author Thomas Müller <thomas.mueller@tmit.eu>
 *
 * @copyright Copyright (c) 2016, ownCloud, Inc.
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

namespace OCA\Notifications\Tests\Unit;

use OCA\Notifications\Handler;
use OCA\Notifications\LegacyLinkRewriter;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\Notification\INotification;

/**
 * Class HandlerTest
 *
 * @group DB
 * @package OCA\Notifications\Tests\Lib
 */
class HandlerTest extends TestCase {
	/** @var \OCA\Notifications\Handler */
	protected $handler;

	protected function setUp(): void {
		parent::setUp();

		$this->handler = new Handler(
			\OC::$server->getDatabaseConnection(),
			\OC::$server->getNotificationManager()
		);

		$this->handler->delete($this->getNotification([
			'getApp' => 'testing_notifications',
		]));
	}

	protected function tearDown(): void {
		parent::tearDown();
		$this->handler->delete($this->getNotification([
			'getApp' => 'testing_notifications',
		]));
	}

	public function testFull() {
		$notification = $this->getNotification([
			'getApp' => 'testing_notifications',
			'getUser' => 'test_user1',
			'getDateTime' => new \DateTime(),
			'getObjectType' => 'notification',
			'getObjectId' => '1337',
			'getSubject' => 'subject',
			'getSubjectParameters' => [],
			'getMessage' => 'message',
			'getMessageParameters' => [],
			'getLink' => 'link',
			'getActions' => [
				[
					'getLabel' => 'action_label',
					'getLink' => 'action_link',
					'getRequestType' => 'GET',
					'isPrimary' => false,
				]
			],
		]);
		$limitedNotification1 = $this->getNotification([
			'getApp' => 'testing_notifications',
			'getUser' => 'test_user1',
		]);
		$limitedNotification2 = $this->getNotification([
			'getApp' => 'testing_notifications',
			'getUser' => 'test_user2',
		]);

		// Make sure there is no notification
		$this->assertSame(0, $this->handler->count($limitedNotification1), 'Wrong notification count for user1 before adding');
		$notifications = $this->handler->get($limitedNotification1);
		$this->assertCount(0, $notifications, 'Wrong notification count for user1 before beginning');
		$this->assertSame(0, $this->handler->count($limitedNotification2), 'Wrong notification count for user2 before adding');
		$notifications = $this->handler->get($limitedNotification2);
		$this->assertCount(0, $notifications, 'Wrong notification count for user2 before beginning');

		// Add and count
		$this->handler->add($notification);
		$this->assertSame(1, $this->handler->count($limitedNotification1), 'Wrong notification count for user1 after adding');
		$this->assertSame(0, $this->handler->count($limitedNotification2), 'Wrong notification count for user2 after adding');

		// Get and count
		$notifications = $this->handler->get($limitedNotification1);
		$this->assertCount(1, $notifications, 'Wrong notification get for user1 after adding');
		$notifications = $this->handler->get($limitedNotification2);
		$this->assertCount(0, $notifications, 'Wrong notification get for user2 after adding');

		// Delete and count again
		$this->handler->delete($notification);
		$this->assertSame(0, $this->handler->count($limitedNotification1), 'Wrong notification count for user1 after deleting');
		$this->assertSame(0, $this->handler->count($limitedNotification2), 'Wrong notification count for user2 after deleting');
	}

	public function testDeleteUserNotifications() {
		$notification1 = $this->getNotification([
			'getApp' => 'testing_notifications',
			'getUser' => 'test_user1',
			'getDateTime' => new \DateTime(),
			'getObjectType' => 'notification',
			'getObjectId' => '1337',
			'getSubject' => 'subject',
			'getSubjectParameters' => [],
			'getMessage' => 'message',
			'getMessageParameters' => [],
			'getLink' => 'link',
			'getActions' => [
				[
					'getLabel' => 'action_label',
					'getLink' => 'action_link',
					'getRequestType' => 'GET',
					'isPrimary' => true,
				]
			],
		]);
		$notification2 = $this->getNotification([
			'getApp' => 'testing_notifications',
			'getUser' => 'test_user2',
			'getDateTime' => new \DateTime(),
			'getObjectType' => 'notification',
			'getObjectId' => '1337',
			'getSubject' => 'subject',
			'getSubjectParameters' => [],
			'getMessage' => 'message',
			'getMessageParameters' => [],
			'getLink' => 'link',
			'getActions' => [
				[
					'getLabel' => 'action_label',
					'getLink' => 'action_link',
					'getRequestType' => 'GET',
					'isPrimary' => true,
				]
			],
		]);
		$limitedNotification = $this->getNotification([
			'getApp' => 'testing_notifications',
			'getUser' => 'test_user1',
		]);
		$limitedNotification2 = $this->getNotification([
			'getApp' => 'testing_notifications',
			'getUser' => 'test_user2',
		]);

		$this->handler->add($notification1);
		$this->handler->add($notification2);
		$notifications = $this->handler->get($limitedNotification);
		$notificationId = \key($notifications);

		$this->handler->deleteUserNotifications($notification1->getUser());

		$this->assertNull($this->handler->getById($notificationId, 'test_user1'));

		$notifications2 = $this->handler->get($limitedNotification2);
		$notificationId2 = \key($notifications2);
		$result = $this->handler->getById($notificationId2, 'test_user2');
		$this->assertInstanceOf(INotification::class, $result);
		$this->assertEquals('test_user2', $result->getUser());
	}

	public function testDeleteById() {
		$notification = $this->getNotification([
			'getApp' => 'testing_notifications',
			'getUser' => 'test_user1',
			'getDateTime' => new \DateTime(),
			'getObjectType' => 'notification',
			'getObjectId' => '1337',
			'getSubject' => 'subject',
			'getSubjectParameters' => [],
			'getMessage' => 'message',
			'getMessageParameters' => [],
			'getLink' => 'link',
			'getActions' => [
				[
					'getLabel' => 'action_label',
					'getLink' => 'action_link',
					'getRequestType' => 'GET',
					'isPrimary' => true,
				]
			],
		]);
		$limitedNotification = $this->getNotification([
			'getApp' => 'testing_notifications',
			'getUser' => 'test_user1',
		]);

		// Make sure there is no notification
		$this->assertSame(0, $this->handler->count($limitedNotification));
		$notifications = $this->handler->get($limitedNotification);
		$this->assertCount(0, $notifications);

		// Add and count
		$this->handler->add($notification);
		$this->assertSame(1, $this->handler->count($limitedNotification));

		// Get and count
		$notifications = $this->handler->get($limitedNotification);
		$this->assertCount(1, $notifications);
		\reset($notifications);
		$notificationId = \key($notifications);

		// Get with wrong user
		$getNotification = $this->handler->getById($notificationId, 'test_user2');
		$this->assertSame(null, $getNotification);

		// Delete with wrong user
		$this->handler->deleteById($notificationId, 'test_user2');
		$this->assertSame(1, $this->handler->count($limitedNotification), 'Wrong notification count for user1 after trying to delete for user2');

		// Get with correct user
		$getNotification = $this->handler->getById($notificationId, 'test_user1');
		$this->assertInstanceOf('OCP\Notification\INotification', $getNotification);

		// Delete and count
		$this->handler->deleteById($notificationId, 'test_user1');
		$this->assertSame(0, $this->handler->count($limitedNotification), 'Wrong notification count for user1 after deleting');
	}

	/**
	 * @param array $values
	 * @return \OCP\Notification\INotification|\PHPUnit\Framework\MockObject\MockObject
	 */
	protected function getNotification(array $values = []) {
		$notification = $this->getMockBuilder('OCP\Notification\INotification')
			->disableOriginalConstructor()
			->getMock();

		foreach ($values as $method => $returnValue) {
			if ($method === 'getActions') {
				$actions = [];
				foreach ($returnValue as $actionData) {
					$action = $this->getMockBuilder('OCP\Notification\IAction')
						->disableOriginalConstructor()
						->getMock();
					foreach ($actionData as $actionMethod => $actionValue) {
						$action->expects($this->any())
							->method($actionMethod)
							->willReturn($actionValue);
					}
					$actions[] = $action;
				}
				$notification->expects($this->any())
					->method($method)
					->willReturn($actions);
			} else {
				$notification->expects($this->any())
					->method($method)
					->willReturn($returnValue);
			}
		}

		$defaultDateTime = new \DateTime();
		$defaultDateTime->setTimestamp(0);
		$defaultValues = [
			'getApp' => '',
			'getUser' => '',
			'getDateTime' => $defaultDateTime,
			'getObjectType' => '',
			'getObjectId' => '',
			'getSubject' => '',
			'getSubjectParameters' => [],
			'getMessage' => '',
			'getMessageParameters' => [],
			'getLink' => '',
			'getActions' => [],
		];
		foreach ($defaultValues as $method => $returnValue) {
			if (isset($values[$method])) {
				continue;
			}

			$notification->expects($this->any())
				->method($method)
				->willReturn($returnValue);
		}

		$defaultValues = [
			'setApp',
			'setUser',
			'setDateTime',
			'setObject',
			'setSubject',
			'setMessage',
			'setLink',
			'addAction',
		];
		foreach ($defaultValues as $method) {
			$notification->expects($this->any())
				->method($method)
				->willReturnSelf();
		}

		return $notification;
	}

	public function testInsert() {
		$notification = $this->getNotification([
			'getApp' => 'testing_notifications',
			'getUser' => 'test_user1',
			'getDateTime' => new \DateTime(),
			'getObjectType' => 'notification',
			'getObjectId' => '1337',
			'getSubject' => 'subject',
		]);

		// Add and count
		$this->handler->add($notification);

		$limitedNotification = $this->getNotification([
			'getApp' => 'testing_notifications',
		]);

		$notifications = $this->handler->get($limitedNotification);
		$this->assertCount(1, $notifications);
	}

	/**
	 * Altbestand einer Instanz unter https://alt.example.com/altroot: die
	 * Zeilen stehen so in der Datenbank, wie eine 10.x-Altinstanz sie schrieb.
	 */
	public function testRewriteLegacyLinks() {
		$connection = \OC::$server->getDatabaseConnection();
		$insert = function (string $user, string $link, string $icon, array $actions) use ($connection) {
			$qb = $connection->getQueryBuilder();
			$qb->insert('notifications')->values([
				'app' => $qb->createNamedParameter('testing_notifications'),
				'user' => $qb->createNamedParameter($user),
				'timestamp' => $qb->createNamedParameter(\time(), IQueryBuilder::PARAM_INT),
				'object_type' => $qb->createNamedParameter('local_share'),
				'object_id' => $qb->createNamedParameter('ocinternal:7'),
				'subject' => $qb->createNamedParameter('local_share'),
				'subject_parameters' => $qb->createNamedParameter('[]'),
				'message' => $qb->createNamedParameter(''),
				'message_parameters' => $qb->createNamedParameter('[]'),
				'link' => $qb->createNamedParameter($link),
				'icon' => $qb->createNamedParameter($icon),
				'actions' => $qb->createNamedParameter(\json_encode($actions)),
			])->execute();
			return $connection->lastInsertId('*PREFIX*notifications');
		};
		$read = function ($id) use ($connection) {
			$qb = $connection->getQueryBuilder();
			$row = $qb->select(['link', 'icon', 'actions'])->from('notifications')
				->where($qb->expr()->eq('notification_id', $qb->createNamedParameter((int)$id, IQueryBuilder::PARAM_INT)))
				->execute()->fetchAssociative();
			$row['actions'] = \json_decode($row['actions'], true);
			return $row;
		};
		$pending = '/altroot/ocs/v1.php/apps/files_sharing/api/v1/shares/pending/7';
		$actions = [
			['label' => 'decline', 'link' => $pending, 'type' => 'DELETE', 'primary' => false],
			['label' => 'accept', 'link' => $pending, 'type' => 'POST', 'primary' => true],
		];
		$legacyRelative = $insert('test_user1', '/altroot/index.php/f/7', '/altroot/core/img/actions/shared.svg', $actions);
		$legacyAbsolute = $insert('test_user1', 'https://alt.example.com/altroot/index.php/settings/personal?sectionid=customgroups&group=x', '', []);
		$foreign = $insert('test_user2', 'https://fremd.example.com/altroot/index.php/f/7', '', []);
		$current = $insert('test_user2', '/index.php/f/8', '/core/img/actions/shared.svg', [
			['label' => 'accept', 'link' => '/ocs/v1.php/apps/files_sharing/api/v1/shares/pending/8', 'type' => 'POST', 'primary' => true],
		]);
		$currentBefore = $read($current);
		$foreignBefore = $read($foreign);

		$rewriter = new LegacyLinkRewriter('https://alt.example.com/altroot', '');
		// Stapelgröße 1: der Lauf muss über alle Stapel hinweg alles finden
		$this->assertSame(2, $this->handler->rewriteLegacyLinks($rewriter, 1));

		$row = $read($legacyRelative);
		$this->assertSame('/index.php/f/7', $row['link']);
		$this->assertSame('/core/img/actions/shared.svg', $row['icon']);
		$this->assertSame('/ocs/v1.php/apps/files_sharing/api/v1/shares/pending/7', $row['actions'][0]['link']);
		$this->assertSame('/ocs/v1.php/apps/files_sharing/api/v1/shares/pending/7', $row['actions'][1]['link']);
		$this->assertSame('DELETE', $row['actions'][0]['type']);
		$this->assertTrue($row['actions'][1]['primary']);
		$this->assertSame('/index.php/settings/personal?sectionid=customgroups&group=x', $read($legacyAbsolute)['link']);
		$this->assertSame($foreignBefore, $read($foreign), 'Fremder Host bleibt unberührt');
		$this->assertSame($currentBefore, $read($current), 'Neue Daten bleiben unberührt');

		// Zweiter Lauf ändert nichts mehr
		$this->assertSame(0, $this->handler->rewriteLegacyLinks($rewriter));

		// Die umgeschriebene Zeile liest der Handler wie jede andere
		$notification = $this->handler->getById((int)$legacyRelative, 'test_user1');
		$this->assertInstanceOf(INotification::class, $notification);
	}
}
