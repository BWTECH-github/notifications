@api
Feature: notifications-content

  Background:
    Given user "Alice" has been created with default attributes and without skeleton files
    And using OCS API version "2"


  Scenario: Create notification
    When user "Alice" is sent a notification with
      | app         | notificationsacceptancetesting                               |
      | timestamp   | 144958517                                                    |
      | subject     | Acceptance Testing                                           |
      | link        | https://example.com/blog/about-activities-and-notifications/ |
      | message     | About Activities and Notifications in owncloud.online        |
      | object_type | blog                                                         |
      | object_id   | 9483                                                         |
    Then user "Alice" should have 1 notification
    And the last notification of user "Alice" should match
      | key         | regex                                                        |
      | app         | notificationsacceptancetesting                               |
      | datetime    | 1974-08-05T18:15:17+00:00                                    |
      | subject     | Acceptance Testing                                           |
      | link        | https://example.com/blog/about-activities-and-notifications/ |
      | message     | About Activities and Notifications in owncloud.online        |
      | object_type | blog                                                         |
      | object_id   | 9483                                                         |


  Scenario: Create different notification
    When user "Alice" is sent a notification with
      | app         | notificationsacceptancetesting                            |
      | timestamp   | 144958515                                                 |
      | subject     | Testing Acceptance                                        |
      | link        | https://example.com/notifications/docs/ocs-endpoint-v1.md |
      | message     | Reading and deleting notifications as a Client            |
      | object_type | repo                                                      |
      | object_id   | notifications                                             |
    Then user "Alice" should have 1 notification
    And the last notification of user "Alice" should match
      | key         | regex                                                     |
      | app         | notificationsacceptancetesting                            |
      | datetime    | 1974-08-05T18:15:15+00:00                                 |
      | subject     | Testing Acceptance                                        |
      | link        | https://example.com/notifications/docs/ocs-endpoint-v1.md |
      | message     | Reading and deleting notifications as a Client            |
      | object_type | repo                                                      |
      | object_id   | notifications                                             |
