# Implementation Plan: Previous Notices Management

## Overview

Implement an administrator-only page for viewing and deleting previously uploaded notices. This involves adding two new API endpoints to the existing notice routes, creating a new React page component with sorting/pagination/deletion UI, and wiring it into the sidebar and router. The implementation is additive — no existing endpoints, models, or components are modified in breaking ways.

## Tasks

- [ ] 1. Add server-side API endpoints for admin notice history and deletion
  - [ ] 1.1 Add GET /api/notices/admin/history endpoint to notice.routes.js
    - Import `deleteFile` from `../services/s3.service.js`
    - Add route `GET /admin/history` guarded by `verifyJWT` and `requireRole('administrator')`
    - Accept `sort` query parameter ("newest" or "oldest"); return 400 for invalid values
    - Query `Notice.find({ uploadedBy: req.user.userId })` sorted by `uploadedAt` descending (default) or ascending
    - Project: `_id`, `fileName`, `title`, `summary`, `urgency`, `category`, `status`, `uploadedAt`
    - Return `{ notices: [...] }` with 200 status
    - Place this route BEFORE the existing `/:id` route to avoid path collision
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ] 1.2 Add DELETE /api/notices/:id endpoint to notice.routes.js
    - Add route `DELETE /:id` guarded by `verifyJWT` and `requireRole('administrator')`
    - Find notice by `req.params.id`; return 404 if not found
    - Call `deleteFile(notice.s3Key)` wrapped in try-catch (swallow errors if file missing)
    - Delete the Notice document from MongoDB via `Notice.deleteOne({ _id: id })`
    - Return `{ message: "Notice deleted successfully", deletedId: id }` with 200 status
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 1.3 Write property tests for admin history and deletion endpoints
    - **Property 1: Admin Filtering Invariant** — generate multiple admins with notices; verify endpoint only returns notices matching the requesting admin's userId
    - **Property 2: Sort Ordering Invariant** — generate notices with random timestamps; verify returned array is sorted correctly for both "newest" and "oldest"
    - **Property 3: Role-Based Access Denial** — generate JWTs with non-administrator roles; verify 403 for both endpoints
    - **Property 4: Deletion Removes Record** — create a notice, delete it, verify it no longer exists in DB
    - **Property 5: File Deletion Accompanies Record Deletion** — verify deleteFile is called with the correct s3Key during deletion
    - **Property 8: Invalid Sort Parameter Validation** — generate arbitrary strings (not "newest"/"oldest"); verify 400 response
    - Install `vitest` and `fast-check` as devDependencies in server/
    - Create test file at `server/src/__tests__/notices-admin.property.test.js`
    - Use `mongodb-memory-server` for in-memory DB
    - **Validates: Requirements 2.1, 3.3, 3.4, 4.7, 5.1, 5.2, 5.5, 7.3, 7.4, 7.5, 7.6, 7.7, 8.3**

- [ ] 2. Checkpoint - Verify server endpoints
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Create PreviousNoticesPage component with sorting, pagination, and deletion UI
  - [ ] 3.1 Create PreviousNoticesPage.jsx with table display and loading/empty/error states
    - Create `client/src/pages/PreviousNoticesPage.jsx`
    - Implement state: `notices`, `loading`, `error`, `sortOrder`, `page`, `deleteTarget`, `deleting`
    - On mount, fetch `GET /api/notices/admin/history?sort={sortOrder}` using the existing `client` axios instance
    - Render a table with columns: Title, File Name, Uploaded At (formatted "DD MMM YYYY, HH:mm"), Category, Urgency, Status, Actions
    - Show animated spinner during loading state
    - Show empty state message when no notices exist
    - Show error message with "Retry" button on fetch failure
    - Apply Campus Flow dark theme classes (`bg-slate-950`, `text-slate-100`, `glass-panel`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [ ] 3.2 Add sort controls and client-side pagination to PreviousNoticesPage
    - Add sort toggle buttons for "Newest First" (default) and "Oldest First"
    - On sort change, reset page to 1 and re-fetch with updated `sort` param
    - Implement client-side pagination (page size 10) with Previous/Next buttons and page indicator
    - Maintain sort order across paginated views
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 3.3 Add delete button and confirmation dialog to PreviousNoticesPage
    - Add "Delete" button in the Actions column for each notice row
    - On click, set `deleteTarget` to show ConfirmDeleteDialog modal
    - Dialog shows "Are you sure you want to permanently delete this notice?" with Confirm and Cancel buttons
    - On confirm: send `DELETE /api/notices/:id`, show loading state on dialog, on success remove notice from list optimistically, show success toast, close dialog
    - On cancel: close dialog, no action
    - On failure: close dialog, show error toast, leave list unchanged
    - Use `useToast()` from existing `ToastContext` for notifications
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 3.4 Write property tests for deletion UI synchronization
    - **Property 6: Deleted Notices Excluded From All Endpoints** — after deletion via API, verify GET /api/notices excludes the deleted notice
    - **Property 7: Pagination Total Decreases After Deletion** — verify total count decreases by 1 after a successful deletion
    - Add tests to `server/src/__tests__/notices-admin.property.test.js`
    - **Validates: Requirements 6.1, 6.2, 6.4**

- [ ] 4. Checkpoint - Verify page component renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Wire PreviousNoticesPage into sidebar navigation and app router
  - [ ] 5.1 Add "Previous Notices" nav item to Sidebar.jsx for administrator role
    - In the administrator `navItems` array, add a new entry after "Upload Notice":
      - `name: 'Previous Notices'`, `path: '/admin/previous-notices'`
      - Use a document-list SVG icon consistent with existing nav items
    - Ensure student `navItems` array is NOT modified
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 5.2 Add /admin/previous-notices route to App.jsx
    - Add lazy import: `const PreviousNoticesPage = lazy(() => import('./pages/PreviousNoticesPage'))`
    - Add a new `<Route>` for path `/admin/previous-notices` wrapped in `<ProtectedRoute allowedRoles={['administrator']}>` and `<AppLayout>`
    - Place the new route after the existing `/admin` route definition
    - Do NOT remove or reorder any existing route definitions
    - _Requirements: 2.6, 9.5_

  - [ ]* 5.3 Write unit tests for sidebar and routing integration
    - Verify Sidebar renders "Previous Notices" for administrator role
    - Verify Sidebar does NOT render "Previous Notices" for student role
    - Verify /admin/previous-notices route renders PreviousNoticesPage for admin
    - _Requirements: 1.1, 1.2, 2.6_

- [ ] 6. Final checkpoint - Ensure all tests pass and feature is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation is fully additive — existing routes, components, and models are preserved per Requirement 9
- `fast-check` and `vitest` need to be added as devDependencies for property testing

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["3.4", "5.1", "5.2"] },
    { "id": 4, "tasks": ["5.3"] }
  ]
}
```
