# Implementation Plan

## Overview

Remove hardcoded sample notification and notice seeding from `server/src/scripts/seed.js`. The fix follows the exploratory bugfix workflow: write tests to confirm the bug, write preservation tests to capture existing behavior, implement the code removal, then verify all tests pass.

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Sample Notifications and Notices Inserted on Seed
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists (hardcoded notifications/notices are inserted)
  - **Scoped PBT Approach**: Scope the property to the concrete case: `seedDatabase()` is called on an empty database (admin user does not exist)
  - Set up test infrastructure: install `vitest` and `fast-check` as dev dependencies, configure vitest for ESM
  - Create test file `server/src/scripts/seed.test.js` using `mongodb-memory-server` (already a devDependency)
  - Connect to in-memory MongoDB, run `seedDatabase()`, then assert:
    - `Notification.countDocuments()` returns 0 (expected behavior — no sample notifications)
    - `Notice.countDocuments()` returns 0 (expected behavior — no sample notices)
  - Use `fast-check` property: for any random pre-existing notification count (0-10) inserted before seeding, after `seedDatabase()` the notification count should remain unchanged (not replaced with 5 hardcoded ones)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (notifications count is 5, notices count is 4 — this confirms the bug exists)
  - Document counterexamples: `seedDatabase()` inserts 5 notifications and 4 notices; `deleteMany` destroys pre-existing legitimate data
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.6_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - User Accounts, Events, Study Plans, and Attendance Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code:
    - `seedDatabase()` creates 2 users (admin with role 'administrator', student with role 'student')
    - `seedDatabase()` creates 6 events for the student (Chemistry Lab Final Exam, Mathematics Term Examination, Physics Lab Workbook Submission, Data Structures Lecture, Music Club Jam Session, Intro to Programming Exam)
    - `seedDatabase()` creates 1 active study plan with 2 sessions (Chemistry, Mathematics)
    - `seedDatabase()` creates 4 attendance records (Mathematics, Physics Lab, Chemistry, Computer Science)
  - Write property-based tests using `fast-check` and `vitest`:
    - Property: for any number of seed runs (1-3), user count is always exactly 2 (upsert idempotency)
    - Property: for any seed run, event count is exactly 6 with expected types (2 exam future, 1 assignment, 1 class, 1 extracurricular, 1 exam 72h)
    - Property: for any seed run, study plan count is exactly 1 with status 'active'
    - Property: for any seed run, attendance count is exactly 4 with expected subject codes
  - Verify all preservation tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.8_

- [ ] 3. Fix for sample notification and notice seeding removal

  - [ ] 3.1 Remove Notice model import and notice seeding code from `server/src/scripts/seed.js`
    - Remove the `import Notice from '../models/Notice.js'` line
    - Remove `await Notice.deleteMany({ uploadedBy: admin._id })` from the cleanup section
    - Remove the entire notice seeding block (notice1 through notice4 creation and `.save()` calls)
    - Remove `console.log('Seeded 4 demo notices.')` statement
    - _Bug_Condition: isBugCondition(input) where seedDatabase() inserts Notice documents_
    - _Expected_Behavior: seedDatabase() creates 0 Notice documents_
    - _Preservation: User accounts, events, study plans, attendance remain identical_
    - _Requirements: 2.2, 2.5, 2.6_

  - [ ] 3.2 Remove Notification model import and notification seeding code from `server/src/scripts/seed.js`
    - Remove the `import Notification from '../models/Notification.js'` line
    - Remove `await Notification.deleteMany({ userId: student._id })` from the cleanup section
    - Remove the entire notification seeding block (notification1 through notification5 creation and `.save()` calls)
    - Remove `console.log('Seeded 5 Notification documents.')` statement
    - _Bug_Condition: isBugCondition(input) where seedDatabase() inserts Notification documents_
    - _Expected_Behavior: seedDatabase() creates 0 Notification documents_
    - _Preservation: User accounts, events, study plans, attendance remain identical_
    - _Requirements: 2.1, 2.4, 2.6_

  - [ ] 3.3 Update the cleanup comment to reflect the reduced scope
    - Change comment from "Clear existing notices, events, and study plans for student and admin to ensure idempotency" to "Clear existing events, study plans, and attendance for student to ensure idempotency"
    - Verify only `Event.deleteMany`, `StudyPlan.deleteMany`, and `Attendance.deleteMany` remain in cleanup
    - _Requirements: 2.1, 2.2_

  - [ ] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - No Sample Notifications or Notices After Seed
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (0 notifications, 0 notices after seeding)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — no sample data inserted)
    - _Requirements: 2.1, 2.2, 2.6_

  - [ ] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - User Accounts, Events, Study Plans, and Attendance Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — user accounts, events, study plans, attendance seeding unchanged)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.8_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite (`npx vitest --run`) to confirm all property-based and unit tests pass
  - Verify `seedDatabase()` creates: 2 users, 6 events, 1 study plan, 4 attendance records, 0 notifications, 0 notices
  - Verify frontend empty states work correctly (NotificationsPage shows "No notifications have been received." and NoticesPage shows "No notices have been uploaded yet." when collections are empty)
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    ["1", "2"],
    ["3.1", "3.2", "3.3"],
    ["3.4", "3.5"],
    ["4"]
  ]
}
```

## Notes

- The project uses ESM modules (`"type": "module"` in package.json) — vitest and test files must be configured accordingly
- `mongodb-memory-server` is already a devDependency and can be used for in-memory MongoDB testing
- No frontend changes are needed — both NotificationsPage and NoticesPage already handle empty states correctly
- The seed script must continue to create user accounts, events, study plans, and attendance records unchanged
