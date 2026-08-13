# Notifications

Notification backend and UI for the notification panel/icon.
Used for notifications of other apps ([announcementcenter](https://github.com/BWTECH-github/announcementcenter), [federatedfilesharing](https://github.com/BWTECH-github/owncloud.online/tree/main/apps/federatedfilesharing) etc.)

## QA metrics on master branch:

## Screenshots

### No notifications (Sample)

**Note:**
In owncloud.online 8.2 the app hides itself, when there is no app registered,
that creates notifications. In this case the bell and the dropdown are not
accessible.

![Build Status](img/sample-empty.png)

### New notifications (Sample)

![Build Status](img/sample-new.png)

## Notification workflow

For information how to make your app interact with the notifications app, see
[Sending and processing/"mark as read" notifications as an owncloud.online App](https://github.com/BWTECH-github/notifications/blob/master/docs/notification-workflow.md)
in the wiki.

If you want to present notifications as a client, see [Reading and deleting notifications as an owncloud.online Client](https://github.com/BWTECH-github/notifications/blob/master/docs/ocs-endpoint-v1.md).
