@webUI @insulated @disablePreviews
Feature: display notifications on the webUI

  As an administrator
  I want to see my notifications on the webUI
  So that I can know about reported system issues

  Background:
    Given the administrator has logged in using the webUI
    And using OCS API version "2"


  Scenario: Create notifications
    When the administrator is sent a notification with
      | app         | notificationsacceptancetesting   |
      | timestamp   | 144958517                        |
      | subject     | Acceptance Testing               |
      | link        | https://example.com/blog         |
      | message     | Notifications in owncloud.online |
      | object_type | blog                             |
      | object_id   | 9483                             |
    And the administrator is sent a notification with
      | app         | notificationsacceptancetesting |
      | timestamp   | 144958517                      |
      | subject     | UI tests                       |
      | link        | http://example.com/            |
      | message     | second notification            |
      | object_type | blog                           |
      | object_id   | 9484                           |
    Then the user should see 2 notifications on the webUI with these details
      | title              | link                     | message                          | user  |
      | Acceptance Testing | https://example.com/blog | Notifications in owncloud.online | Alice |
      | UI tests           | http://example.com/      | second notification              | Alice |


  Scenario: follow notifications link
    When the administrator is sent a notification with
      | app         | notificationsacceptancetesting         |
      | timestamp   | 144958517                              |
      | subject     | Acceptance Testing                     |
      | link        | %base_url%/index.php/settings/personal |
      | message     | Settings of owncloud.online            |
      | object_type | blog                                   |
      | object_id   | 9483                                   |
    And the user follows the link of the first notification on the webUI
    Then the user should be redirected to a webUI page with the title "Settings - owncloud.online"
