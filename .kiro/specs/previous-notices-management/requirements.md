# Requirements Document

## Introduction

The Previous Notices Management feature enables Campus Flow administrators to view, manage, and delete notices they have previously uploaded. This feature provides a dedicated page accessible via the sidebar, displays notice metadata in a tabular format with sorting controls, and supports permanent deletion of notices including associated files and summaries. Deletion propagates immediately to all student-facing views.

## Glossary

- **Administrator**: A user with the role "administrator" authenticated via JWT in the Campus Flow system
- **Student**: A user with the role "student" authenticated via JWT in the Campus Flow system
- **Notice**: A document record stored in MongoDB containing metadata (title, fileName, uploadedAt, category, urgency, status) with an associated file stored in S3 or local storage
- **Previous_Notices_Page**: The dedicated administrator-only page displaying all notices uploaded by the logged-in administrator
- **Notice_Record**: The MongoDB document in the Notice collection representing a single uploaded notice
- **Associated_File**: The file stored in S3 (or local uploads directory) referenced by the Notice_Record s3Key field
- **Notice_Summary**: The AI-generated summary text stored within the Notice_Record
- **Sidebar**: The left-positioned navigation component rendering role-specific navigation items
- **Admin_History_Endpoint**: The GET /api/notices/admin/history API endpoint returning notices uploaded by the authenticated administrator
- **Delete_Endpoint**: The DELETE /api/notices/:id API endpoint that permanently removes a notice
- **Confirmation_Dialog**: A modal UI element requiring explicit user confirmation before executing a destructive action
- **Sort_Order**: The ordering applied to notice results, either "newest" (descending uploadedAt) or "oldest" (ascending uploadedAt)

## Requirements

### Requirement 1: Administrator Sidebar Navigation

**User Story:** As an administrator, I want a "Previous Notices" item in my sidebar navigation, so that I can quickly access my previously uploaded notices.

#### Acceptance Criteria

1. WHEN the logged-in user has the role "administrator", THE Sidebar SHALL render a "Previous Notices" navigation item positioned immediately after the "Upload Notice" item in the administrator navigation list
2. WHEN the logged-in user has the role "student", THE Sidebar SHALL NOT render the "Previous Notices" navigation item
3. WHEN the administrator clicks the "Previous Notices" navigation item, THE Sidebar SHALL navigate to the /admin/previous-notices route
4. THE Sidebar SHALL preserve all existing student navigation items without modification
5. THE "Previous Notices" navigation item SHALL use an icon consistent with the Campus Flow design system (document list icon)

### Requirement 2: Previous Notices Page Display

**User Story:** As an administrator, I want to see all notices I have uploaded displayed on a dedicated page, so that I can review and manage my notice history.

#### Acceptance Criteria

1. WHEN an administrator navigates to the Previous_Notices_Page, THE Previous_Notices_Page SHALL display all Notice_Records where the uploadedBy field matches the logged-in administrator userId, sorted by uploadedAt in descending order (most recent first)
2. THE Previous_Notices_Page SHALL display the following columns for each notice: title, fileName, uploadedAt (formatted as "DD MMM YYYY, HH:mm" in 24-hour local time), category, urgency, status, and an Actions column containing a "View" action that opens the notice file
3. THE Previous_Notices_Page SHALL use the Campus Flow dark theme by applying the same background (bg-slate-950), text color (text-slate-100), and glass-panel component classes used on existing protected pages
4. WHEN the Previous_Notices_Page is loading data, THE Previous_Notices_Page SHALL display an animated spinner loading indicator until the data fetch completes or fails
5. WHEN no notices exist for the administrator, THE Previous_Notices_Page SHALL display an empty state message indicating no notices have been uploaded
6. THE Previous_Notices_Page SHALL be accessible only via the /admin/previous-notices route protected for the "administrator" role
7. IF the data fetch for Notice_Records fails, THEN THE Previous_Notices_Page SHALL display an error message indicating that notices could not be loaded and SHALL provide a retry action to re-attempt the fetch

### Requirement 3: Notice Sorting

**User Story:** As an administrator, I want to sort my notices by upload date, so that I can find recently uploaded or older notices quickly.

#### Acceptance Criteria

1. THE Previous_Notices_Page SHALL display sorting controls allowing selection between "Newest First" and "Oldest First" options
2. THE Previous_Notices_Page SHALL default to "Newest First" sort order (uploadedAt descending)
3. WHEN the administrator selects "Oldest First", THE Previous_Notices_Page SHALL re-order notices by uploadedAt ascending within 1 second without requiring a full page refresh
4. WHEN the administrator selects "Newest First", THE Previous_Notices_Page SHALL re-order notices by uploadedAt descending within 1 second without requiring a full page refresh
5. WHEN the administrator changes the sort order while viewing any page other than page 1, THE Previous_Notices_Page SHALL reset pagination to page 1 and display results in the newly selected sort order
6. THE Previous_Notices_Page SHALL maintain the currently selected sort order across all paginated results such that the last notice on page N immediately precedes the first notice on page N+1 according to uploadedAt in the active sort direction
7. IF two or more notices share the same uploadedAt value, THEN THE Previous_Notices_Page SHALL use a stable secondary sort by notice identifier descending so that repeated requests return a consistent order

### Requirement 4: Notice Deletion with Confirmation

**User Story:** As an administrator, I want to delete a previously uploaded notice with a confirmation step, so that I can permanently remove notices while avoiding accidental deletions.

#### Acceptance Criteria

1. THE Previous_Notices_Page SHALL display a Delete button in the Actions column for each notice, visible only to authenticated users with the "administrator" role
2. WHEN the administrator clicks the Delete button, THE Previous_Notices_Page SHALL display a Confirmation_Dialog with the message "Are you sure you want to permanently delete this notice?" and provide both a confirm and a cancel action
3. WHEN the administrator confirms deletion in the Confirmation_Dialog, THE Previous_Notices_Page SHALL send a DELETE request to the Delete_Endpoint with the notice identifier and display a loading state on the dialog until a response is received
4. WHEN the administrator cancels the Confirmation_Dialog, THE Previous_Notices_Page SHALL close the dialog and take no further action
5. WHEN a deletion request succeeds, THE Previous_Notices_Page SHALL close the Confirmation_Dialog, remove the deleted notice from the displayed list without requiring a full page refresh, and display a success notification indicating the notice was deleted
6. IF the deletion request fails due to a network error, server error, or the notice no longer existing, THEN THE Previous_Notices_Page SHALL close the Confirmation_Dialog, display an error notification indicating the deletion failed, and leave the notice list unchanged
7. WHEN a user without the "administrator" role attempts to call the Delete_Endpoint, THE System SHALL reject the request with a 403 status code and an "Access denied" message

### Requirement 5: Server-Side Notice Deletion

**User Story:** As an administrator, I want the system to completely remove all traces of a deleted notice, so that no orphaned data remains in the system.

#### Acceptance Criteria

1. WHEN an authenticated Administrator sends a deletion request for a notice identifier, THE Delete_Endpoint SHALL delete the Notice_Record (including its embedded summary, title, deadlines, actions, urgency, and category fields) from MongoDB and return a 200 status with a confirmation message within 5 seconds
2. WHEN the Delete_Endpoint receives a valid deletion request, THE Delete_Endpoint SHALL delete the Associated_File from S3 or local storage before confirming deletion
3. IF the Associated_File does not exist in storage during deletion, THEN THE Delete_Endpoint SHALL proceed with deleting the Notice_Record and return a 200 status without returning an error
4. IF the notice identifier provided to the Delete_Endpoint does not match any Notice_Record, THEN THE Delete_Endpoint SHALL return a 404 status with an error message indicating the notice was not found
5. IF a request is made to the Delete_Endpoint with a valid JWT that does not contain the "administrator" role claim, THEN THE Delete_Endpoint SHALL reject the request with a 403 status code and an "Access denied" message
6. IF a request is made to the Delete_Endpoint with an expired, malformed, or absent JWT, THEN THE Delete_Endpoint SHALL reject the request with a 401 status code and an "Authentication required" message

### Requirement 6: Student Synchronization After Deletion

**User Story:** As a student, I want deleted notices to disappear from all notice views immediately after deletion, so that I only see current and valid notices.

#### Acceptance Criteria

1. WHEN a notice is deleted via the Delete_Endpoint, THE Student notices listing endpoint (GET /api/notices) SHALL exclude the deleted Notice_Record from all subsequent responses immediately
2. WHEN a notice is deleted, THE notice detail endpoint (GET /api/notices/:id) SHALL return a 404 status with an error message for the deleted notice identifier
3. WHEN a student refreshes any page displaying notices after a deletion, THE page SHALL NOT display the deleted notice in listings, search results, or pagination results
4. WHEN a notice is deleted, THE Student notices listing pagination SHALL recalculate the total count so that page boundaries reflect the reduced total without leaving empty pages

### Requirement 7: Admin History API Endpoint

**User Story:** As an administrator, I want a secure API endpoint to fetch my notice upload history with sorting support, so that the Previous Notices page can retrieve data efficiently.

#### Acceptance Criteria

1. THE Admin_History_Endpoint SHALL accept GET requests at the path /api/notices/admin/history
2. THE Admin_History_Endpoint SHALL require a valid JWT token with the "administrator" role
3. WHEN an authenticated administrator calls the Admin_History_Endpoint, THE Admin_History_Endpoint SHALL return all Notice_Records where uploadedBy matches the requesting administrator userId; each returned record SHALL include: noticeId, fileName, title, summary, urgency, category, status, and uploadedAt
4. THE Admin_History_Endpoint SHALL accept a "sort" query parameter with values "newest" or "oldest"; IF the sort parameter is present but not one of these values, THEN THE Admin_History_Endpoint SHALL return a 400 response with an error message indicating the accepted values
5. WHEN the sort parameter is "newest" or absent, THE Admin_History_Endpoint SHALL return notices sorted by uploadedAt descending
6. WHEN the sort parameter is "oldest", THE Admin_History_Endpoint SHALL return notices sorted by uploadedAt ascending
7. IF a user with the "student" role calls the Admin_History_Endpoint, THEN THE Admin_History_Endpoint SHALL return a 403 Forbidden response
8. IF a request is made to the Admin_History_Endpoint with an expired, malformed, or absent JWT, THEN THE Admin_History_Endpoint SHALL return a 401 response with an "Authentication required" message

### Requirement 8: Delete API Endpoint Security

**User Story:** As a system administrator, I want the delete endpoint to be secured against unauthorized access, so that only administrators can delete notices.

#### Acceptance Criteria

1. THE Delete_Endpoint SHALL accept DELETE requests at the path /api/notices/:id
2. THE Delete_Endpoint SHALL require a valid JWT token with the "administrator" role
3. IF a user with the "student" role sends a DELETE request to the Delete_Endpoint, THEN THE Delete_Endpoint SHALL return a 403 Forbidden response with an "Access denied" message
4. IF a request without a valid JWT token is sent to the Delete_Endpoint, THEN THE Delete_Endpoint SHALL return a 401 Unauthorized response with an "Authentication required" message
5. WHEN a valid DELETE request is made by an authenticated administrator for an existing notice, THE Delete_Endpoint SHALL return a 200 status with a JSON body containing a success message and the deleted notice identifier

### Requirement 9: Non-Modification Constraints

**User Story:** As a developer, I want the feature implementation to be isolated from existing functionality, so that the notice upload, summarization, and other modules remain unaffected.

#### Acceptance Criteria

1. THE System SHALL preserve the existing notice upload endpoint (POST /api/notices) such that its request format, response format, status codes, and validation rules remain identical to the pre-implementation behavior
2. THE System SHALL preserve the existing notice summarization pipeline such that Summaries continue to be generated, stored, and displayed without changes to invocation triggers, retry behavior, or output format
3. THE System SHALL preserve the existing student notice listing (GET /api/notices) and detail (GET /api/notices/:id) endpoints such that their response schemas, sort order, pagination, and access control remain identical to their pre-implementation behavior
4. THE System SHALL NOT modify the notification, Guardian AI, attendance, scheduling, chatbot, calendar, study plan, authentication, or push subscription modules; any new code SHALL be contained in new files or additive sections that do not alter existing function signatures or database collection schemas used by those modules
5. THE System SHALL preserve all existing client-side routes (/dashboard, /calendar, /notices, /study-plan, /chat, /attendance, /notifications, /focus-zone, /scheduling, /routine, /life-companion, /admin, /login, /register) including their path, access-control role, layout wrapper, and rendered component; new routes for admin notice management SHALL be added without removing or reordering existing route definitions
