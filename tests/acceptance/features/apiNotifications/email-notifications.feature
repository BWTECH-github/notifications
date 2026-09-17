@api @email
Feature: notifications-content

  Background:
    Given user "Alice" has been created with default attributes and without skeleton files
    And using OCS API version "2"


  # Rumpf seit 1.0.0: Betreff, Nachricht, "Open in <Instanz>:" mit Verweis;
  # die HTML-Fassung trägt den Verweis als Schaltfläche des Kern-Mailrahmens.
  Scenario: Create notification
    When user "Alice" sets the email notification option to "always" using the API
    And user "Alice" is sent a notification with
      | app         | notificationsacceptancetesting                               |
      | timestamp   | 144958517                                                    |
      | subject     | Acceptance Testing                                           |
      | link        | https://example.com/blog/about-activities-and-notifications/ |
      | message     | About Activities and Notifications in owncloud.online        |
      | object_type | blog                                                         |
      | object_id   | 9483                                                         |
    Then the email address "alice@example.org" should have received an email with the body containing
      """
      Acceptance Testing

      About Activities and Notifications in owncloud.online

      Open in owncloud.online:
      https://example.com/blog/about-activities-and-notifications/
      """
    And the email address "alice@example.org" should have received an email with the body containing
      """
      href="https://example.com/blog/about-activities-and-notifications/"
      """
