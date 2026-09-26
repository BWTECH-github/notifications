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

namespace OCA\Notifications\Command;

use OCA\Notifications\Handler;
use OCA\Notifications\LegacyLinkRewriter;
use OCP\IConfig;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

class RepairNotifications extends Command {
	/** @var Handler */
	protected $handler;

	/** @var IConfig */
	protected $config;

	public static $availableSubjects = [
		'relativeLinks',
		'oldBaseUrl',
	];

	/**
	 * @param Handler $handler
	 * @param IConfig $config
	 */
	public function __construct(Handler $handler, IConfig $config) {
		parent::__construct();
		$this->handler = $handler;
		$this->config = $config;
	}

	protected function configure() {
		$this
			->setName('notifications:repairNotifications')
			->setDescription('Repair existing notifications')
			->addArgument('subject', InputArgument::REQUIRED, 'Subject to repair: ' . \implode(', ', self::$availableSubjects))
			->addOption(
				'old-base-url',
				null,
				InputOption::VALUE_REQUIRED,
				'oldBaseUrl: base URL of the instance the database was moved from, e.g. https://cloud.example.com/owncloud. A bare webroot like /owncloud only matches relative links.'
			)
			->addOption(
				'new-webroot',
				null,
				InputOption::VALUE_REQUIRED,
				'oldBaseUrl: webroot of this instance, e.g. /cloud (default: path of overwrite.cli.url)'
			)
		;
	}

	/**
	 * @param InputInterface $input
	 * @param OutputInterface $output
	 * @return int
	 */
	protected function execute(InputInterface $input, OutputInterface $output): int {
		$subject = $input->getArgument('subject');

		if (!\in_array($subject, self::$availableSubjects)) {
			$output->writeln('Invalid subject');
			return 1;
		}

		if ($subject === 'oldBaseUrl') {
			return $this->rewriteLegacyLinks($input, $output);
		}

		$updatedNotificationsCount = $this->handler->removeBaseUrlFromAbsoluteLinks();

		$output->writeln("$updatedNotificationsCount notifications were updated");
		return 0;
	}

	/**
	 * Nach dem Umzug einer Datenbank: Links der Altinstanz (anderer Host oder
	 * anderes Webroot) auf diese Instanz umschreiben.
	 */
	private function rewriteLegacyLinks(InputInterface $input, OutputInterface $output): int {
		$oldBaseUrl = $input->getOption('old-base-url');
		if (!\is_string($oldBaseUrl) || \trim($oldBaseUrl) === '') {
			$output->writeln('<error>The subject oldBaseUrl needs --old-base-url</error>');
			return 1;
		}
		$newWebroot = $input->getOption('new-webroot');
		if (!\is_string($newWebroot)) {
			// Der CLI-Lauf kennt das Webroot der Web-Anfragen nicht; overwrite.cli.url
			// ist die Adresse, unter der diese Instanz erreichbar ist.
			$cliUrl = (string)$this->config->getSystemValue('overwrite.cli.url', '');
			$newWebroot = (string)\parse_url($cliUrl, PHP_URL_PATH);
		}

		try {
			$rewriter = new LegacyLinkRewriter($oldBaseUrl, $newWebroot);
		} catch (\InvalidArgumentException $e) {
			$output->writeln('<error>' . $e->getMessage() . '</error>');
			return 1;
		}

		$output->writeln('Old base URL: ' . \rtrim($oldBaseUrl, '/') . ', new webroot: "' . \rtrim($newWebroot, '/') . '"');
		$updatedNotificationsCount = $this->handler->rewriteLegacyLinks($rewriter);
		$output->writeln("$updatedNotificationsCount notifications were updated");
		return 0;
	}
}
