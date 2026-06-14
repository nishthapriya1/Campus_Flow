# Remove Sample Data Bugfix Design

## Overview

The `seedDatabase()` function in `server/src/scripts/seed.js` inserts 5 hardcoded sample notifications and 4 hardcoded sample notices every time the server starts without an existing admin user. This pollutes the database with fabricated data that mixes with legitimate system-generated notifications. The fix removes the notification and notice seeding code while preserving all other seed behavior (user accounts, events, study plans, attendance records). The frontend already handles empty states correctly, so no UI changes are needed.

## Glossary

- **Bug_Condition (C)**: The server startup condition where `seedDatabase()` inserts hardcoded notification and notice documents into MongoDB
- **Property (P)**: After the fix, `seedDatabase()` shall create user accounts, events, study plans, and attendance without inserting any notification or notice documents
- **Preservation**: User account creation, event seeding, study plan seeding, attendance seeding, and all API/frontend behavior must remain unchanged
- **seedDatabase()**: The function in `server/src/scripts/seed.js` that initializes the database with demo data on first startup
- **Notification model**: MongoDB document representing system-generated alerts (deadline reminders, guardian risks)
- **Notice model**: MongoDB document representing admin-uploaded institutional announcements

## Bug Details

### Bug Condition

The bug manifests when the server starts and the admin user does not exist in the database. The `seedDatabase()` function deletes all existing notifications and notices for the seeded accounts, then inserts 5 hardcoded notification documents and 4 hardcoded notice documents with fabricated content and fake S3 keys.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ServerStartupContext
  OUTPUT: boolean
  
  RETURN input.adminUserExists == false
         AND seedDatabase() is invoked
         AND (notificationDocumentsInserted > 0 OR noticeDocumentsInserted > 0)
END FUNCTION
```

### Examples

- Server starts fresh → `seedDatabase()` inserts 5 notifications ("Math Exam Deadline Approaching", "Chemistry Lab Exam 24h Reminder", etc.) and 4 notices ("Semester_Registration_Notice.txt", "Capstone_Project_Guidelines.pdf", etc.) with fake S3 keys
- Database is reset, server restarts → all legitimate notifications and notices are deleted via `Notification.deleteMany()` and `Notice.deleteMany()`, then replaced with hardcoded demo data
- User deletes a sample notification via the UI, server restarts → the deleted notification reappears because seeding re-runs
- Notices page shows "Google_Summer_Placement_Drive.pdf" with S3 key `notices/seed_google_placement.pdf` that points to no real file — clicking "View Full Notice" fails

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Admin and student user account creation via `User.findOneAndUpdate()` with upsert must continue to work
- Event seeding (6 demo events) for the student account must continue to work
- Study plan seeding (1 active study plan) must continue to work
- Attendance seeding (4 subjects with log history) must continue to work
- The `startServer()` function in `index.js` must continue to check for admin existence before seeding
- All notification API routes (`GET /api/notifications`, `PATCH /api/notifications/:id/read`, etc.) must continue to function
- All notice API routes (`GET /api/notices`, `POST /api/notices`, etc.) must continue to function
- The frontend NotificationsPage empty state ("No notifications have been received.") must display when no notifications exist
- The frontend NoticesPage empty state ("No notices have been uploaded yet.") must display when no notices exist
- The NotificationContext polling for unread count must continue to work (returns 0 when no notifications)
- Legitimate notification creation by reminder scheduler and Guardian AI must not be affected

**Scope:**
All inputs that do NOT involve the seed script's notification/notice insertion should be completely unaffected by this fix. This includes:
- User authentication and account management
- Event CRUD operations
- Study plan generation
- Attendance tracking
- Reminder scheduling and notification firing
- Admin notice upload workflow
- All frontend rendering and API consumption

## Hypothesized Root Cause

Based on the bug description, the root cause is straightforward:

1. **Intentional but problematic seeding code**: Lines in `seedDatabase()` that create `Notification` and `Notice` documents were added for demo/development purposes but should not exist in production. The code explicitly creates 5 notification documents (lines ~175-240) and 4 notice documents (lines ~60-130).

2. **Aggressive cleanup before seeding**: The line `await Notification.deleteMany({ userId: student._id })` and `await Notice.deleteMany({ uploadedBy: admin._id })` delete ALL notifications/notices before re-inserting demo data, which destroys legitimate data on re-seed.

3. **No separation of concerns**: The seed script mixes essential data (user accounts) with demo data (notifications, notices) without any configuration flag to control what gets seeded.

## Correctness Properties

Property 1: Bug Condition - No Sample Notifications or Notices Seeded

_For any_ server startup where the admin user does not exist and `seedDatabase()` is invoked, the fixed function SHALL NOT insert any documents into the `notifications` or `notices` collections, and SHALL NOT call `Notification.deleteMany()` or `Notice.deleteMany()`.

**Validates: Requirements 2.1, 2.2, 2.6**

Property 2: Preservation - User Accounts and Other Seed Data Unchanged

_For any_ server startup where the admin user does not exist and `seedDatabase()` is invoked, the fixed function SHALL produce the same user accounts (admin + student), events (6), study plans (1), and attendance records (4) as the original function, preserving all non-notification/notice seeding behavior identically.

**Validates: Requirements 3.1, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `server/src/scripts/seed.js`

**Function**: `seedDatabase()`

**Specific Changes**:
1. **Remove Notice imports and seeding**: Remove the `import Notice from '../models/Notice.js'` import and delete the entire block that creates `notice1` through `notice4` (approximately lines 55-130)

2. **Remove Notification imports and seeding**: Remove the `import Notification from '../models/Notification.js'` import and delete the entire block that creates `notification1` through `notification5` (approximately lines 175-240)

3. **Remove deleteMany calls for Notification and Notice**: Remove `await Notice.deleteMany({ uploadedBy: admin._id })` and `await Notification.deleteMany({ userId: student._id })` from the cleanup section (these are destructive to legitimate data)

4. **Remove associated console.log statements**: Remove `console.log('Seeded 4 demo notices.')` and `console.log('Seeded 5 Notification documents.')`

5. **Update the cleanup comment**: Change the comment from "Clear existing notices, events, and study plans..." to reflect that only events, study plans, and attendance are cleared

**No frontend changes required**: Both `NotificationsPage` and `NoticesPage` already have proper empty state handling (`"No notifications have been received."` and `"No notices have been uploaded yet."` respectively). The `NotificationContext` returns `unreadCount: 0` when no notifications exist, which correctly hides the badge.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Run `seedDatabase()` against an in-memory MongoDB instance and query the `notifications` and `notices` collections afterward. Run these tests on the UNFIXED code to observe that documents are inserted.

**Test Cases**:
1. **Notification Insertion Test**: Run `seedDatabase()` on empty DB, assert `Notification.countDocuments()` returns 5 (will confirm bug on unfixed code)
2. **Notice Insertion Test**: Run `seedDatabase()` on empty DB, assert `Notice.countDocuments()` returns 4 (will confirm bug on unfixed code)
3. **DeleteMany Destruction Test**: Insert a legitimate notification, run `seedDatabase()`, assert the legitimate notification is gone (will confirm destructive behavior on unfixed code)
4. **Re-seed Idempotency Test**: Run `seedDatabase()` twice, assert notifications/notices are replaced not doubled (confirms the aggressive delete pattern)

**Expected Counterexamples**:
- `Notification.countDocuments()` returns 5 after seeding (confirms hardcoded insertion)
- `Notice.countDocuments()` returns 4 after seeding (confirms hardcoded insertion)
- Legitimate notifications are destroyed by `deleteMany` call

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := seedDatabase_fixed(input)
  ASSERT Notification.countDocuments() == 0
  ASSERT Notice.countDocuments() == 0
  ASSERT User.countDocuments() == 2
  ASSERT Event.countDocuments() == 6
  ASSERT StudyPlan.countDocuments() == 1
  ASSERT Attendance.countDocuments() == 4
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT seedDatabase_original(input).users == seedDatabase_fixed(input).users
  ASSERT seedDatabase_original(input).events == seedDatabase_fixed(input).events
  ASSERT seedDatabase_original(input).studyPlans == seedDatabase_fixed(input).studyPlans
  ASSERT seedDatabase_original(input).attendance == seedDatabase_fixed(input).attendance
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for user creation, event seeding, and attendance seeding, then write property-based tests capturing that behavior remains identical after the fix.

**Test Cases**:
1. **User Account Preservation**: Verify admin and student accounts are created with correct email, role, and password hash after fix
2. **Event Seeding Preservation**: Verify 6 events with correct titles, types, and time offsets are created identically after fix
3. **Study Plan Preservation**: Verify active study plan with correct subjects and sessions is created identically after fix
4. **Attendance Preservation**: Verify 4 attendance subjects with correct log counts are created identically after fix

### Unit Tests

- Test that `seedDatabase()` creates exactly 2 users (admin + student) with correct fields
- Test that `seedDatabase()` creates exactly 6 events for the student
- Test that `seedDatabase()` creates 0 notifications and 0 notices
- Test that `seedDatabase()` does not call `Notification.deleteMany()` or `Notice.deleteMany()`
- Test that existing legitimate notifications in the DB are not affected by running `seedDatabase()`

### Property-Based Tests

- Generate random pre-existing notification counts and verify `seedDatabase()` does not modify the notifications collection
- Generate random pre-existing notice counts and verify `seedDatabase()` does not modify the notices collection
- Verify user account fields are deterministic across multiple seed runs

### Integration Tests

- Start server with empty database, verify NotificationsPage shows empty state
- Start server with empty database, verify NoticesPage shows empty state
- Start server, create a legitimate notification via Guardian AI endpoint, verify it persists across server restart
- Start server, upload a notice via admin portal, verify it persists across server restart
