<?php
/**
 * @author Jannik Stehle <jstehle@owncloud.com>
 * @author Jan Ackermann <jackermann@owncloud.com>
 *
 * @copyright Copyright (c) 2021, ownCloud GmbH
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

namespace OCA\Notifications\Tests\Unit\Command;

use OCA\Notifications\Command\Generate;
use OCA\Notifications\Command\RepairNotifications;
use OCA\Notifications\Handler;
use OCA\Notifications\LegacyLinkRewriter;
use OCA\Notifications\Tests\Unit\TestCase;
use OCP\IConfig;
use Symfony\Component\Console\Tester\CommandTester;

class RepairNotificationsTest extends TestCase {
	/** @var Handler | \PHPUnit\Framework\MockObject\MockObject */
	protected $handler;
	/** @var IConfig | \PHPUnit\Framework\MockObject\MockObject */
	protected $config;
	/** @var Generate */
	protected $command;
	/** @var CommandTester */
	protected $tester;

	protected function setUp(): void {
		parent::setUp();

		$this->handler = $this->createMock(Handler::class);
		$this->config = $this->createMock(IConfig::class);
		$this->command = new RepairNotifications($this->handler, $this->config);
		$this->tester = new CommandTester($this->command);
	}

	public function testOldBaseUrlNeedsOption() {
		$this->handler->expects($this->never())->method('rewriteLegacyLinks');
		$response = $this->tester->execute(['subject' => 'oldBaseUrl']);
		$this->assertEquals(1, $response);
	}

	public function testOldBaseUrlRejectsInvalidUrl() {
		$this->handler->expects($this->never())->method('rewriteLegacyLinks');
		$response = $this->tester->execute(['subject' => 'oldBaseUrl', '--old-base-url' => 'owncloud']);
		$this->assertEquals(1, $response);
	}

	public function testOldBaseUrlUsesWebrootOfCliUrl() {
		$this->config->method('getSystemValue')
			->with('overwrite.cli.url', '')
			->willReturn('https://kunde.example.com/cloud');
		$this->handler->expects($this->once())
			->method('rewriteLegacyLinks')
			->willReturnCallback(function (LegacyLinkRewriter $rewriter) {
				$this->assertSame('/cloud/index.php/f/1', $rewriter->rewrite('/owncloud/index.php/f/1'));
				return 3;
			});

		$response = $this->tester->execute(['subject' => 'oldBaseUrl', '--old-base-url' => 'https://alt.example.com/owncloud']);
		$this->assertEquals(0, $response);
		$this->assertStringContainsString('3 notifications were updated', $this->tester->getDisplay());
	}

	public function testOldBaseUrlWithExplicitWebroot() {
		$this->config->expects($this->never())->method('getSystemValue');
		$this->handler->expects($this->once())
			->method('rewriteLegacyLinks')
			->willReturnCallback(function (LegacyLinkRewriter $rewriter) {
				$this->assertSame('/index.php/f/1', $rewriter->rewrite('/owncloud/index.php/f/1'));
				return 0;
			});

		$response = $this->tester->execute([
			'subject' => 'oldBaseUrl',
			'--old-base-url' => '/owncloud',
			'--new-webroot' => '',
		]);
		$this->assertEquals(0, $response);
	}

	public function testInvalidSubject() {
		$options = [];
		$input = ['subject' => 'test'];
		$response = $this->tester->execute($input, $options);
		$this->assertEquals(1, $response);
	}

	public function testRepairLinks() {
		$options = [];
		$input = ['subject' => RepairNotifications::$availableSubjects[0]];

		$this->handler->expects($this->once())->method('removeBaseUrlFromAbsoluteLinks');

		$response = $this->tester->execute($input, $options);
		$this->assertEquals(0, $response);
	}
}
