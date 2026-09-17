<?php
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

namespace OCA\Notifications\Tests\Unit\Configuration;

use OCP\IConfig;
use OCA\Notifications\Configuration\OptionsStorage;

class OptionsStorageTest extends \Test\TestCase {
	/** @var IConfig */
	private $config;
	/** @var OptionsStorage */
	private $optionsStorage;

	protected function setUp(): void {
		parent::setUp();

		$this->config = $this->getMockBuilder(IConfig::class)
			->disableOriginalConstructor()
			->getMock();

		$this->optionsStorage = new OptionsStorage($this->config);
	}

	public function testGetValidOptionValuesInfo() {
		$expected = [
			'email_sending_option' => [
				'values' => ['never', 'action', 'always'],
				'default' => 'action',
			],
		];
		$this->assertEquals($expected, $this->optionsStorage->getValidOptionValuesInfo());
	}

	public function testGetOptions() {
		$this->config->method('getUserValue')
			->will($this->returnValueMap([
				['user1', 'notifications', 'email_sending_option', 'action', 'randomValue']
		]));
		$expected = ['email_sending_option' => 'randomValue'];
		$this->assertEquals($expected, $this->optionsStorage->getOptions('user1'));
	}

	public function validOptionProvider() {
		return [
			['email_sending_option', 'never'],
			['email_sending_option', 'action'],
			['email_sending_option', 'always'],
		];
	}

	/**
	 * @dataProvider validOptionProvider
	 */
	public function testSetOption($key, $value) {
		$this->assertTrue($this->optionsStorage->setOption('user1', $key, $value));
	}

	public function invalidOptionProvider() {
		return [
			['email_sending_option', 'VALUEWRONG'],
			['KEYWRONG', 'action'],
			['KEYWRONG', 'VALUEWRONG'],
		];
	}

	/**
	 * @dataProvider invalidOptionProvider
	 */
	public function testSetOptionWrong($key, $value) {
		$this->assertFalse($this->optionsStorage->setOption('user1', $key, $value));
	}

	/**
	 * @dataProvider invalidOptionProvider
	 */
	public function testIsOptionValid($key, $value) {
		$this->assertFalse($this->optionsStorage->isOptionValid($key, $value));
	}

	public function testGetUserLanguage() {
		$this->config->method('getUserValue')
			->will($this->returnValueMap([
				['user1', 'core', 'lang', null, 'de_DE']
		]));
		$this->assertEquals('de_DE', $this->optionsStorage->getUserLanguage('user1'));
	}

	public function dataGetMailLanguage() {
		return [
			'eigene Sprache gewinnt' => ['de_DE', 'fr', 'de_DE'],
			'ohne eigene Sprache die Standardsprache' => [null, 'de', 'de'],
			'leere eigene Sprache zählt nicht' => ['', 'de', 'de'],
			'Sprache ohne Katalog der App: Standardsprache' => ['da', 'de', 'de'],
			'Sprache ohne Katalog, keine Standardsprache: null' => ['da', '', null],
			'Standardsprache ohne Katalog zählt nicht' => [null, 'sv', null],
			'ohne beides bleibt es bei null' => [null, '', null],
		];
	}

	/**
	 * @dataProvider dataGetMailLanguage
	 */
	public function testGetMailLanguage($userLanguage, $defaultLanguage, $expected) {
		$this->config->method('getUserValue')
			->will($this->returnValueMap([
				['user1', 'core', 'lang', null, $userLanguage]
			]));
		$this->config->method('getSystemValue')
			->with('default_language', '')
			->willReturn($defaultLanguage);
		// Die App hat Kataloge für de, de_DE und fr, nicht für da und sv.
		$factory = $this->createMock(\OCP\L10N\IFactory::class);
		$factory->method('languageExists')
			->willReturnCallback(function ($app, $lang) {
				return $app === 'notifications' && \in_array($lang, ['en', 'de', 'de_DE', 'fr'], true);
			});
		$storage = new OptionsStorage($this->config, $factory);
		$this->assertSame($expected, $storage->getMailLanguage('user1'));
	}

	public function dataGetContentLanguage() {
		return [
			'Quell-App kennt die eigene Sprache, notifications nicht' => ['sv', 'de', 'files_sharing', 'sv'],
			'Quell-App kennt sie nicht: Standardsprache' => ['sv', 'de', 'probe', 'de'],
			'ohne eigene Sprache die Standardsprache' => [null, 'de', 'files_sharing', 'de'],
			'nichts passt' => ['sv', '', 'probe', null],
			'ohne App-Kennung null' => ['sv', 'de', '', null],
		];
	}

	/**
	 * @dataProvider dataGetContentLanguage
	 */
	public function testGetContentLanguage($userLanguage, $defaultLanguage, $app, $expected) {
		$this->config->method('getUserValue')
			->will($this->returnValueMap([
				['user1', 'core', 'lang', null, $userLanguage]
			]));
		$this->config->method('getSystemValue')
			->with('default_language', '')
			->willReturn($defaultLanguage);
		// files_sharing: sv und de; probe: nur de; notifications: kein sv.
		$kataloge = ['files_sharing' => ['sv', 'de'], 'probe' => ['de'], 'notifications' => ['de']];
		$factory = $this->createMock(\OCP\L10N\IFactory::class);
		$factory->method('languageExists')
			->willReturnCallback(function ($app, $lang) use ($kataloge) {
				return isset($kataloge[$app]) && \in_array($lang, $kataloge[$app], true);
			});
		$storage = new OptionsStorage($this->config, $factory);
		$this->assertSame($expected, $storage->getContentLanguage('user1', $app));
		if ($userLanguage === 'sv' && $defaultLanguage === 'de') {
			// Der Rahmen bleibt bei der Sprache, die notifications kennt.
			$this->assertSame('de', $storage->getMailLanguage('user1'));
		}
	}
}
