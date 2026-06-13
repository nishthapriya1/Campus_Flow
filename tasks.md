# Implementation Plan: Campus Flow MVP

## Overview

84 implementation tasks across 15 waves for the Campus Flow 48-hour hackathon MVP. The work is split between Developer A (backend-first) and Developer B (frontend-first). Authentication uses two pre-seeded accounts only — no registration, password reset, or email verification.

Pre-seeded accounts:
- Admin: `admin@campusflow.com` / `admin123`
- Student: `student@campusflow.com` / `student123`

## Tasks

- [ ] 1. Initialize backend project — Create Node.js + Express server. Install dependencies: `express`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `multer`, `pdf-parse`, `node-cron`, `joi`, `cors`, `dotenv`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-sns`, `web-push`, `uuid`. Configure `package.json` scripts (dev, start). Create `.env` from template. Set up `nodemon`.
  - **Owner:** Developer A
  - **Effort:** 30 min
  - **Dependencies:** None

- [ ] 2. Initialize frontend project — Scaffold Vite + React app. Install: `react-router-dom`, `axios`, `react-big-calendar`, `date-fns`, `dompurify`. Configure Tailwind CSS v3 with postcss and autoprefixer. Create `.env` with `VITE_API_URL`. Set up folder structure: `src/api/`, `src/components/`, `src/pages/`, `src/context/`.
  - **Owner:** Developer B
  - **Effort:** 30 min
  - **Dependencies:** None

- [ ] 3. Configure MongoDB Atlas connection — Create free M0 cluster. Whitelist `0.0.0.0/0`. Add `MONGODB_URI` to `.env`. Create `src/config/db.js` with Mongoose connection and error logging. Call `connectDB()` in `index.js` before starting the server.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 1

- [ ] 4. Configure AWS clients — Create `src/config/aws.js` exporting pre-configured `S3Client`, `BedrockRuntimeClient`, and `SNSClient` using env vars. Create the S3 bucket (`campusflow-notices`) with private ACL. Enable Bedrock model access for `anthropic.claude-3-haiku-20240307-v1:0` in the AWS console. Create the SNS standard topic (`campusflow-notifications`) and copy the Topic ARN to `.env` as `SNS_TOPIC_ARN`. Generate VAPID keys with `npx web-push generate-vapid-keys` and add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` to `.env`.
  - **Owner:** Developer A
  - **Effort:** 45 min
  - **Dependencies:** Task 1

- [ ] 5. Create Mongoose User model — Fields: `email` (unique, RFC 5322), `passwordHash` (bcrypt), `role` (enum: student/administrator), `name`, timestamps. Unique index on `email`.
  - **Owner:** Developer A
  - **Effort:** 15 min
  - **Dependencies:** Task 3

- [ ] 6. Seed pre-built accounts — Create `src/scripts/seed.js`. Hash passwords with bcryptjs cost 12. Upsert admin (`admin@campusflow.com / admin123 / role:administrator`) and student (`student@campusflow.com / student123 / role:student`). Add `"seed"` npm script.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 5

- [ ] 7. Create auth middleware — `src/middleware/auth.js`. Export `verifyJWT`: reads Bearer token, verifies with JWT_SECRET, attaches `req.user`; returns 401 if absent/expired/malformed. Export `requireRole(role)`: checks `req.user.role`; returns 403 `{ error: "Access denied" }` if mismatch.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 5

- [ ] 8. Create login endpoint — `POST /api/auth/login`. Validate email + password with Joi. Find user by email, compare with bcrypt. On match: sign JWT `{ userId, role, name }` expiry 8h, return `200 { token, expiresIn: 28800, user }`. On mismatch: return `401 { error: "Invalid email or password" }`.
  - **Owner:** Developer A
  - **Effort:** 25 min
  - **Dependencies:** Task 5, Task 7

- [ ] 9. Create global error handler — `src/middleware/errorHandler.js`. Express 4-argument middleware: logs error, returns `{ error: err.message || "Internal server error" }` with `err.status || 500`. Mount as last middleware in `index.js`.
  - **Owner:** Developer A
  - **Effort:** 15 min
  - **Dependencies:** Task 1

- [ ] 10. Create Mongoose Notice model — Fields: `uploadedBy` (ref User), `fileName`, `s3Key`, `mimeType`, `sizeBytes`, `status` (enum: uploaded/summarized/summary_failed/archived), `title` (nullable, ≤10 words), `summary` (nullable), `summaryLang`, `deadlines` ([Date], default []), `actions` ([String], default []), `urgency` (enum: critical/high/medium/low/unknown, default "unknown"), `category` (enum: academic/event/administrative/placement/unknown, default "unknown"), `retryCount` (default 0), `extractedDate` (nullable), `uploadedAt`, `archivedAt`. Indexes: `{ fileName:1, status:1 }`, `{ uploadedAt:-1 }`, `{ urgency:1, uploadedAt:-1 }`. Implements Req 1 and Req 9.
  - **Owner:** Developer A
  - **Effort:** 25 min
  - **Dependencies:** Task 3

- [ ] 11. Create Mongoose Event model — Fields: `userId` (ref User), `title` (max 100), `type` (enum: exam/assignment/class/extracurricular), `startTime`, `endTime`, `isBlocked` (default false), `sourceNoticeId` (nullable). Indexes: `{ userId:1, startTime:1 }`, `{ userId:1, type:1 }`. Timestamps enabled.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 3

- [ ] 12. Create Mongoose Reminder model — Fields: `userId` (ref User), `eventId` (ref Event), `triggerType` (enum: 24h/1h), `scheduledAt`, `firedAt` (nullable), `dismissed` (default false), `dismissedAt`. Unique compound index `{ eventId:1, triggerType:1 }`. Indexes: `{ userId:1, dismissed:1 }`, `{ scheduledAt:1, firedAt:1 }`.
  - **Owner:** Developer A
  - **Effort:** 15 min
  - **Dependencies:** Task 3

- [ ] 13. Create Mongoose StudyPlan model — Fields: `userId` (ref User), `status` (enum: active/archived), `preferences` `{ subjects:[String], examDates:[Date], dailyHours:Number }`, `sessions` `[{ subject, date, startTime, endTime, durationMins }]`, `generatedAt`, `archivedAt`. Index: `{ userId:1, status:1 }`. Timestamps enabled.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 3

- [ ] 14. Build S3 upload service — `src/services/s3.service.js`. Export `uploadFile(buffer, mimeType, originalName) → Promise<s3Key>`: key = `notices/<uuid>-<name>`, PutObjectCommand. Export `getPresignedUrl(s3Key) → Promise<url>`: GetObjectCommand via getSignedUrl, 15-min expiry. Export `deleteFile(s3Key) → Promise<void>`: DeleteObjectCommand.
  - **Owner:** Developer A
  - **Effort:** 25 min
  - **Dependencies:** Task 4

- [ ] 15. Build text extraction service — `src/services/textExtract.service.js`. Export `extractText(buffer, mimeType) → Promise<string>`. PDF: use pdf-parse. Plain text: decode as UTF-8. Images: return empty string (OCR out of scope). Cap output at 4000 characters.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 1

- [ ] 16. Build Bedrock summarization service — `src/services/bedrock.service.js`. Export `summarizeNotice(text) → Promise<string>`. Use InvokeModelCommand, model `anthropic.claude-3-haiku-20240307-v1:0`, Messages API. Prompt: summarize in ≤150 words, preserve dates/action items, match source language. `max_tokens: 300`.
  - **Owner:** Developer A
  - **Effort:** 30 min
  - **Dependencies:** Task 4

- [ ] 17. Build Bedrock study plan service — In `bedrock.service.js`, export `generateStudyPlan({ subjects, examDates, dailyHours, blockedSlots }) → Promise<session[]>`. Prompt: return JSON array `{ subject, date, startTime, endTime, durationMins }`, sessions 30 min–3 hr, proportional allocation, skip blocked slots. Parse JSON response; throw `BEDROCK_PARSE_ERROR` if invalid.
  - **Owner:** Developer A
  - **Effort:** 40 min
  - **Dependencies:** Task 16

- [ ] 18. Build Bedrock chatbot service — In `bedrock.service.js`, export `chatWithAssistant(message, history) → Promise<string>`. System prompt scopes to academic topics (course content, assignments, exams, research, academic processes). Pass client history + new user message as `messages`. `max_tokens: 512`.
  - **Owner:** Developer A
  - **Effort:** 25 min
  - **Dependencies:** Task 16

- [ ] 19. Build date extraction utility — `src/utils/dateParser.js`. Export `extractDate(text) → Date | null`. Regex detection for ISO 8601 (YYYY-MM-DD), DD/MM/YYYY, and DD Month YYYY formats. Return first matched date as Date object, or null.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 1

- [ ] 20. Build async summarization pipeline — `src/services/summarize.service.js`. Export `runSummarization(noticeId)`. Fetch notice, extract text, call Bedrock with retry loop (3 attempts, 5-second delay). On success: update status=`summarized`, store summary and summaryLang. On all retries failed: set status=`summary_failed`. Run `extractDate()` and store `extractedDate` if found.
  - **Owner:** Developer A
  - **Effort:** 45 min
  - **Dependencies:** Task 10, Task 15, Task 16, Task 19

- [ ] 21. Create notice upload route — `POST /api/notices`. Guards: `verifyJWT` + `requireRole('administrator')`. Parse multipart via multer (memory storage). Validate: accepted MIME types (pdf/png/jpg/jpeg/txt), max 10 MB, no duplicate active fileName. Call `s3.uploadFile()`. Insert Notice document. Return `201 { noticeId, fileName, status:"uploaded" }`. Fire `runSummarization(noticeId)` asynchronously after response.
  - **Owner:** Developer A
  - **Effort:** 45 min
  - **Dependencies:** Task 10, Task 14, Task 7, Task 20

- [ ] 22. Create get notices route — `GET /api/notices`. Guard: `verifyJWT`. Query active notices sorted by urgency descending (critical → high → medium → low → unknown) then by `uploadedAt` descending within the same urgency tier (Req 9.5). Support `?page` and `?limit` (default 20). Return `{ notices:[{ _id, fileName, title, summary, urgency, category, status, uploadedAt, extractedDate }], total, page, limit }`.
  - **Owner:** Developer A
  - **Effort:** 25 min
  - **Dependencies:** Task 10, Task 7

- [ ] 23. Create get single notice route — `GET /api/notices/:id`. Guard: `verifyJWT`. Fetch by `_id`. Generate pre-signed S3 URL. Return `{ _id, fileName, summary, summaryLang, status, uploadedAt, extractedDate, fileUrl }`. Return 404 if not found.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 10, Task 14, Task 7

- [ ] 24. Create reminder scheduler service — `src/services/reminder.scheduler.js`. Export `startScheduler()`: node-cron `'* * * * *'`. For exam/assignment events within ±1 min of now+24h and now+1h: upsert Reminder with `$setOnInsert` keyed on `{ eventId, triggerType }`. Export `scheduleRemindersForEvent(event)`: creates only reminder documents for trigger windows still in the future.
  - **Owner:** Developer A
  - **Effort:** 45 min
  - **Dependencies:** Task 11, Task 12

- [ ] 25. Create event CRUD routes — `POST /api/events` (Joi validation: title max 100, type enum, startTime, endTime, isBlocked optional), `GET /api/events` (filter by userId, optional ?from/?to), `PUT /api/events/:id` (ownership check, re-schedule reminders on deadline change), `DELETE /api/events/:id` (ownership check, delete associated reminders). All four routes use `verifyJWT` + `requireRole('student')` — admin JWTs receive 403. Implements Req 8.6.
  - **Owner:** Developer A
  - **Effort:** 75 min
  - **Dependencies:** Task 11, Task 12, Task 7, Task 24

- [ ] 26. Create reminder routes — `GET /api/reminders/pending`: reminders where `userId=req.user.userId`, `dismissed=false`, `scheduledAt <= now`, populated event title/type, sorted by scheduledAt asc. `PATCH /api/reminders/:id/dismiss`: set dismissed=true, dismissedAt=now; verify userId ownership; return 200 or 404. Both routes use `verifyJWT` + `requireRole('student')` — admin JWTs receive 403. Implements Req 8.6.
  - **Owner:** Developer A
  - **Effort:** 25 min
  - **Dependencies:** Task 12, Task 7

- [ ] 27. Create study plan generate route — `POST /api/studyplans/generate`. Guards: `verifyJWT` + `requireRole('student')` — admin JWTs receive 403 (Req 8.6). Joi validation: subjects (array 1–10), examDates (future ISO dates, same length), dailyHours (0.5–16). Fetch blocked events. Call `bedrock.generateStudyPlan()` with 15-second `Promise.race` timeout. On success: archive existing active plan, enforce 5-plan history cap (delete oldest if ≥5), insert new active plan. Return `201 { studyPlan }`. On timeout/error: return 504/503 without modifying existing plan.
  - **Owner:** Developer A
  - **Effort:** 50 min
  - **Dependencies:** Task 13, Task 17, Task 11, Task 7

- [ ] 28. Create study plan fetch routes — `GET /api/studyplans/active` and `GET /api/studyplans/history`. Both routes use `verifyJWT` + `requireRole('student')` — admin JWTs receive 403 (Req 8.6). `GET /api/studyplans/active`: active plan for req.user or 404. `GET /api/studyplans/history`: archived plans within last 7 days, max 5, sorted by archivedAt desc.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 13, Task 7

- [ ] 29. Create chatbot route — `POST /api/chat/message`. Guards: `verifyJWT` + `requireRole('student')` — admin JWTs receive 403 (Req 8.6). Validate: message (string, max 500), history (array ≤10 `{ role, content }` items, optional). Call `bedrock.chatWithAssistant()` with 10-second timeout. Return `200 { reply }`. Timeout or Bedrock error → `503 { error: "Assistant temporarily unavailable. Please try again." }`.
  - **Owner:** Developer A
  - **Effort:** 25 min
  - **Dependencies:** Task 18, Task 7

- [ ] 30. Build frontend auth context — `src/context/AuthContext.jsx`. Provide `user`, `token`, `login(token, user)`, `logout()`. On mount: read `cf_token` from localStorage, decode payload to restore session. `logout()`: clear localStorage, redirect to /login.
  - **Owner:** Developer B
  - **Effort:** 25 min
  - **Dependencies:** Task 2

- [ ] 31. Build protected route and axios client — `src/components/ProtectedRoute.jsx`: reads token from AuthContext, redirects to /login if absent. `src/api/client.js`: axios instance with VITE_API_URL baseURL; request interceptor attaches Bearer token; response interceptor redirects to /login on 401.
  - **Owner:** Developer B
  - **Effort:** 20 min
  - **Dependencies:** Task 30

- [ ] 32. Build login page — `src/pages/LoginPage.jsx`. Email + password form. On submit: POST /api/auth/login. On success: store token in localStorage as `cf_token`, call `login()` from AuthContext, redirect to /dashboard. On failure: show error message. Tailwind centered card layout.
  - **Owner:** Developer B
  - **Effort:** 30 min
  - **Dependencies:** Task 30, Task 8

- [ ] 33. Build app shell and router — `src/App.jsx`. React Router v6 routes: /login (public), /dashboard, /calendar, /notices, /notifications, /study-plan, /chat (all protected), /admin (protected + admin role), / → redirect to /dashboard. Wrap protected routes with `<ProtectedRoute>`. Add `<AdminRoute>` that also checks `role === "administrator"`. Implements Req 13 route.
  - **Owner:** Developer B
  - **Effort:** 25 min
  - **Dependencies:** Task 30, Task 31

- [ ] 34. Build navigation sidebar — `src/components/Sidebar.jsx`. Fixed left sidebar (desktop), bottom nav (mobile). Links: Dashboard, Calendar, Notices, Notifications, Study Plan, Chat. Admin-only link: Upload Notice. Show user name + role badge. Logout button. Highlight active route with Tailwind `bg-indigo-700`. Notifications link shows an unread count badge fetched from `GET /api/notifications/unread-count`; badge hidden when count is 0. Implements Req 13.4.
  - **Owner:** Developer B
  - **Effort:** 40 min
  - **Dependencies:** Task 30, Task 33

- [ ] 35. Build notification banner component — `src/components/NotificationBanner.jsx`. Poll `GET /api/reminders/pending` every 30 seconds via setInterval. Render sticky amber banner per pending reminder showing event title, type, time remaining. Dismiss button: call `PATCH /api/reminders/:id/dismiss`, remove from local state immediately (optimistic). Clear interval on unmount.
  - **Owner:** Developer B
  - **Effort:** 35 min
  - **Dependencies:** Task 26, Task 31

- [ ] 36. Build dashboard page — `src/pages/DashboardPage.jsx`. Fetch all 4 data sources in parallel with `Promise.allSettled`: (1) NotificationBanner (pending reminders), (2) UpcomingEvents (next 3 events), (3) NoticesFeed (5 most recent notices + summaries), (4) StudyPlanWidget (today's sessions). Skeleton loaders while loading. Empty-state messages with action CTAs when lists are empty.
  - **Owner:** Developer B
  - **Effort:** 60 min
  - **Dependencies:** Task 22, Task 25, Task 28, Task 35

- [ ] 37. Build calendar page — `src/pages/CalendarPage.jsx`. Use `react-big-calendar` with date-fns localizer. Fetch events via GET /api/events with from/to range when view changes. Client-side conflict detection: O(n²) overlap check, flag `hasConflict: true` on both overlapping events. Custom `eventStyleGetter`: conflicting events get `className="bg-red-100 border-l-4 border-red-500"`. Day/week/month view toggle.
  - **Owner:** Developer B
  - **Effort:** 60 min
  - **Dependencies:** Task 25, Task 31

- [ ] 38. Build event modal — `src/components/EventModal.jsx`. Modal triggered by clicking empty calendar slot (create) or existing event (edit). Fields: title (text, max 100), type (select), date picker, start/end time inputs, blocked toggle. Create: POST /api/events. Edit: PUT /api/events/:id. Delete: DELETE /api/events/:id with confirmation. Refresh calendar after any action.
  - **Owner:** Developer B
  - **Effort:** 50 min
  - **Dependencies:** Task 25, Task 37

- [ ] 39. Build notices page — `src/pages/NoticesPage.jsx`. Paginated list (20/page) from GET /api/notices. Each notice as `<NoticeCard>`: urgency badge (color-coded: red=critical, orange=high, yellow=medium, gray=low/unknown), category tag, file name, upload date, AI summary or "Summary unavailable" badge, "View Full Notice" link (pre-signed URL from GET /api/notices/:id, opens in new tab). Notices arrive pre-sorted urgency-first (server-side). If `extractedDate` present: render `<AddToCalendarPrompt>` button. Implements Req 9.3, 9.5.
  - **Owner:** Developer B
  - **Effort:** 50 min
  - **Dependencies:** Task 22, Task 23, Task 38

- [ ] 40. Build admin upload page — `src/pages/AdminPage.jsx`. Admin role only. File input: `accept=".pdf,.png,.jpg,.jpeg,.txt"`. Client-side pre-check: size ≤ 10 MB (show error without API call). Upload via POST /api/notices with multipart/form-data. Progress bar via `axios.onUploadProgress`. On success: show toast, clear form. On error: show response error message.
  - **Owner:** Developer B
  - **Effort:** 40 min
  - **Dependencies:** Task 21, Task 33

- [ ] 41. Build study plan page — `src/pages/StudyPlanPage.jsx`. Two views: (1) `<StudyPlanForm>`: dynamic subject/date rows (add/remove, max 10), daily hours input (0.5–16), submit calls POST /api/studyplans/generate with loading spinner. (2) `<StudyPlanTimeline>`: sessions grouped by date, color-coded by subject (deterministic string→Tailwind color hash), history toggle via GET /api/studyplans/history.
  - **Owner:** Developer B
  - **Effort:** 70 min
  - **Dependencies:** Task 27, Task 28

- [ ] 42. Build chat page — `src/pages/ChatPage.jsx`. `<MessageList>`: scrollable, auto-scroll to bottom on new message. `<ChatInput>`: textarea with live counter (`500 - length`, red when < 50), Enter submits, Shift+Enter newlines. On submit: append user message, call POST /api/chat/message with last 10 messages as history, append reply. On error: inline "Assistant temporarily unavailable". Store history in `sessionStorage` key `cf_chat_history`; restore on mount; clear on logout.
  - **Owner:** Developer B
  - **Effort:** 55 min
  - **Dependencies:** Task 29, Task 31

- [ ] 43. Wire event creation to reminder scheduling — Update `POST /api/events` to call `reminder.scheduler.scheduleRemindersForEvent(event)` immediately after saving. Helper checks whether 24h and 1h trigger times are still in the future and creates only applicable Reminder documents.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 25, Task 24

- [ ] 44. Wire notice upload to calendar prompt — Confirm GET /api/notices/:id returns `extractedDate`. On NoticesPage, when extractedDate is truthy render AddToCalendarPrompt. Clicking opens EventModal with startTime pre-filled to extractedDate at 09:00 and title pre-filled to notice fileName (without extension). Confirm `sourceNoticeId` is set on the created event.
  - **Owner:** Developer B
  - **Effort:** 25 min
  - **Dependencies:** Task 20, Task 39, Task 38

- [ ] 45. Wire study plan blocked slots — Update POST /api/studyplans/generate to fetch student's events where `isBlocked=true`. Pass as `blockedSlots` (formatted as `{ date, startTime, endTime }`) to `bedrock.generateStudyPlan()`.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 27, Task 25

- [ ] 46. Verify dashboard parallel loading — Confirm DashboardPage uses `Promise.allSettled` for all 4 data requests. Each section renders independently — Bedrock failure on study plan widget must not block notices feed or calendar widget. NotificationBanner starts polling only after auth confirmed.
  - **Owner:** Developer B
  - **Effort:** 20 min
  - **Dependencies:** Task 36, Task 35

- [ ] 47. Implement Bedrock graceful degradation — Verify when Bedrock is unavailable: Dashboard loads without crash; notices without summaries show "Summary unavailable" badge; chatbot shows fallback message; all non-AI features (calendar, reminders, notice browsing) remain fully functional. Catch `AccessDeniedException` and `ServiceUnavailableException` from AWS SDK.
  - **Owner:** Developer A
  - **Effort:** 30 min
  - **Dependencies:** Task 20, Task 27, Task 29

- [ ] 48. Auth flow verification — Manually test: student login returns student-role JWT; admin login returns admin-role JWT; student JWT rejected with 403 on `POST /api/notices`; expired/missing JWT returns 401 on all protected routes; logout clears token and redirects to /login. Admin data isolation checks (Req 8.6): admin JWT on `GET /api/events` → 403; admin JWT on `GET /api/studyplans/active` → 403; admin JWT on `GET /api/notifications` → 403; admin JWT on `POST /api/guardian/analyze` → 403; admin JWT on `GET /api/reminders/pending` → 403.
  - **Owner:** Developer A + Developer B
  - **Effort:** 30 min
  - **Dependencies:** Task 8, Task 32, Task 31

- [ ] 49. Notice upload and summarization E2E test — Upload a real PDF as admin. Verify: file appears in S3 console; notice appears on Dashboard within 10 s; AI summary appears within 30 s (status → "summarized"); "Summary unavailable" badge shown when Bedrock fails; duplicate file name rejected; file > 10 MB rejected before S3 upload.
  - **Owner:** Developer A
  - **Effort:** 25 min
  - **Dependencies:** Task 21, Task 20, Task 40

- [ ] 50. Calendar and conflict detection test — Create two overlapping events; verify both show red highlight and warning icon in week view. Create non-overlapping event; verify no highlight. Edit event so it no longer overlaps; verify highlights clear. Verify CRUD operations reflect immediately without full page reload.
  - **Owner:** Developer B
  - **Effort:** 20 min
  - **Dependencies:** Task 37, Task 38

- [ ] 51. Reminder trigger test — Create event at now+25h; wait up to 1 min for cron; verify 24h Reminder document in MongoDB and banner on Dashboard. Dismiss it; verify it disappears and does not reappear. Create event < 1h away; verify only 1h reminder is created (not 24h).
  - **Owner:** Developer A
  - **Effort:** 25 min
  - **Dependencies:** Task 24, Task 26, Task 35

- [ ] 52. Study plan generation test — Submit form with 2 subjects, exam dates 5 and 10 days away, 4 daily hours. Verify plan within 15 s. Verify proportional session allocation. Verify no sessions in blocked calendar slots. Generate second plan; verify first is archived. Verify Bedrock timeout returns error without corrupting existing plan.
  - **Owner:** Developer B
  - **Effort:** 20 min
  - **Dependencies:** Task 27, Task 41

- [ ] 53. Chatbot scope and context test — Ask academic question (e.g. "Explain Newton's second law"); verify response within 10 s. Ask non-academic question (e.g. "What's the weather?"); verify polite decline. Send 11 messages; verify coherent responses (10-message sliding window). Verify chat history clears after logout.
  - **Owner:** Developer B
  - **Effort:** 20 min
  - **Dependencies:** Task 29, Task 42

- [ ] 54. Responsive layout check — Open Chrome DevTools at 375 px (mobile) and 1280 px (desktop). Verify Dashboard, Calendar, Notices, Study Plan, Chat, Admin pages render without horizontal overflow at both viewports. Sidebar collapses to bottom nav on mobile. All touch targets ≥ 44 px.
  - **Owner:** Developer B
  - **Effort:** 30 min
  - **Dependencies:** Task 34, Task 33

- [ ] 55. Seed demo data — Add to `seed.js`: 3 sample notices with pre-stored summaries, urgency values (1 critical, 1 high, 1 medium), and category tags (bypassing Bedrock for seed stability); 5 events (2 exams next week, 1 assignment tomorrow, 1 class today, 1 extracurricular); 1 active study plan; 3 sample Notification documents (1 unread critical, 1 unread high, 1 read medium) linked to the demo student. Ensures demo can proceed even if Bedrock or SNS is unavailable. Implements seed coverage for Req 9, 11, 13.
  - **Owner:** Developer A
  - **Effort:** 40 min
  - **Dependencies:** Task 6, Task 10, Task 11, Task 13, Task 60, Task 66

- [ ] 56. Add loading and empty states — Audit all pages for missing states. Each data-fetching component must show: skeleton loader (`animate-pulse` gray blocks) while loading; friendly empty-state message with action CTA when list is empty. No page shows blank white screen during demo flow.
  - **Owner:** Developer B
  - **Effort:** 40 min
  - **Dependencies:** Task 36, Task 37, Task 39, Task 41, Task 42

- [ ] 57. Build toast notification system — `src/components/Toast.jsx` + `useToast` hook. Variants: success, error, info. Auto-dismiss after 4 seconds. Stack up to 3 toasts. Integrate into: notice upload, event CRUD, study plan generation, chatbot errors. Replace any raw `alert()` calls.
  - **Owner:** Developer B
  - **Effort:** 30 min
  - **Dependencies:** Task 40, Task 38, Task 41, Task 42

- [ ] 58. Performance audit — Run Lighthouse on Dashboard (Chrome DevTools). Target: Performance ≥ 80, FCP ≤ 2 s. Lazy-load react-big-calendar with `React.lazy` + `Suspense`. Ensure no large uncompressed images. Run audit against `npm run build` output (not dev server). Document final Lighthouse scores.
  - **Owner:** Developer B
  - **Effort:** 30 min
  - **Dependencies:** Task 36, Task 37

- [ ] 59. Final deployment — Build React app (`npm run build`). Copy `dist/` to `server/public/`, serve statically from Express. Set `NODE_ENV=production`. Deploy to hosting (EC2, Render, or Railway). Set all production env vars in platform secrets. Run `npm run seed` against production DB. Verify live URL works end-to-end for both admin and student flows.
  - **Owner:** Developer A + Developer B
  - **Effort:** 45 min
  - **Dependencies:** Task 48, Task 49, Task 50, Task 51, Task 52, Task 53, Task 54, Task 55, Task 56, Task 57, Task 58, Task 83, Task 84

---
<!-- Wave 13: Notice Intelligence (Req 9) -->

- [ ] 60. Extend Bedrock analyzeNotice service — In `bedrock.service.js`, export `analyzeNotice(text) → Promise<NoticeAnalysis>`. Prompt instructs Claude to return strict JSON: `{ title, summary, deadlines: ["YYYY-MM-DD"], actions: [string], urgency: "critical"|"high"|"medium"|"low", category: "academic"|"event"|"administrative"|"placement" }`. Set `max_tokens: 600`. Validate the parsed response shape; on parse failure throw `BEDROCK_PARSE_ERROR` so the pipeline falls back to `urgency: "unknown"`. Implements Req 9.1.
  - **Owner:** Developer A
  - **Effort:** 40 min
  - **Dependencies:** Task 16

- [ ] 61. Extend summarization pipeline to use analyzeNotice — Update `summarize.service.js` to call `bedrock.analyzeNotice()` instead of `bedrock.summarizeNotice()`. On success: persist `title`, `summary`, `summaryLang`, `deadlines`, `actions`, `urgency`, `category` on the Notice document, set `status = "summarized"`. On `BEDROCK_PARSE_ERROR` or all retries failed: set `urgency = "unknown"`, `category = "unknown"`, preserve any partial `summary` if available, set `status = "summary_failed"`. Implements Req 9.2, 9.4.
  - **Owner:** Developer A
  - **Effort:** 30 min
  - **Dependencies:** Task 60, Task 20

- [ ] 62. Add urgency-first sort and urgency badge to Notices API test — Manually verify: upload 3 notices via Admin (one critical, one medium, one low urgency via seeded data); call `GET /api/notices` and confirm order is critical → medium → low. Verify response includes `urgency`, `category`, `title`, `actions`, `deadlines` fields. Implements Req 9.5 verification.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 22, Task 61

---
<!-- Wave 14: Guardian AI (Req 10) -->

- [ ] 63. Build Bedrock Guardian AI service — In `bedrock.service.js`, export `runGuardianAnalysis({ events, studyPlan, notices }) → Promise<GuardianReport>`. System prompt instructs Claude to act as an academic risk detector operating only on provided data (no hallucination). Return strict JSON: `{ alerts: [{ alertType, severity, title, detailedReason, recommendedAction }], dailyPlan: string, opportunities: [string], onTrack: boolean, summary: string }`. Set `max_tokens: 1024`, timeout 20 seconds via `Promise.race`. On parse failure: throw `BEDROCK_PARSE_ERROR`. Implements Req 10.1, 10.2, 10.6.
  - **Owner:** Developer A
  - **Effort:** 50 min
  - **Dependencies:** Task 16

- [ ] 64. Create Guardian AI route — `src/routes/guardian.routes.js`. `POST /api/guardian/analyze`. Guards: `verifyJWT` + `requireRole('student')` — admin JWTs receive 403 (Req 8.6). Fetch context: student's events for next 7 days, active study plan, and 5 most recent notices — all scoped to `req.user.userId`. Call `bedrock.runGuardianAnalysis()` with 20-second `Promise.race`. On success: return `200 { report }`. On timeout or Bedrock error: return `503 { error: "Guardian AI temporarily unavailable. Please try again." }` without partial data. Register route in `index.js`. Implements Req 10.3, 10.5.
  - **Owner:** Developer A
  - **Effort:** 35 min
  - **Dependencies:** Task 63, Task 7, Task 11, Task 13, Task 10

- [ ] 65. Build GuardianAIPanel frontend component — `src/components/GuardianAIPanel.jsx`. "Run Guardian AI" button that calls `POST /api/guardian/analyze`. Show loading spinner during request (up to 20 s). On success: render `report.alerts` as a list (severity badge + title + detailedReason + recommendedAction), `report.dailyPlan` as a text block, and `report.opportunities` as a bulleted list. On error: show fallback message. If `report.onTrack === true` and no alerts: show a green "You're on track" banner. Integrate into `<DashboardPage>` below `<StudyPlanWidget>`. Implements Req 10.1–10.5.
  - **Owner:** Developer B
  - **Effort:** 50 min
  - **Dependencies:** Task 64, Task 36

---
<!-- Wave 14: SNS Notification Infrastructure (Req 11) -->

- [ ] 66. Build SNS publish service — `src/services/sns.service.js`. Export `publishNotification(payload) → Promise<messageId>`. Payload shape: `{ userId, alertType, severity, title, shortMessage, detailedReason, recommendedAction, deadline }`. Use `SNSClient` from `aws.js` with `PublishCommand` to `process.env.SNS_TOPIC_ARN`. Only call when `severity === "critical" || severity === "high"`. On SNS error: log the error but do NOT throw — the notification document is already persisted, push delivery is best-effort. Implements Req 11.1, 11.6.
  - **Owner:** Developer A
  - **Effort:** 25 min
  - **Dependencies:** Task 4

- [ ] 67. Create Mongoose Notification model — `src/models/Notification.js`. Fields: `userId` (ref User), `alertType` (enum: reminder_24h/reminder_1h/guardian_risk/guardian_opportunity/notice_critical/deadline_72h), `severity` (enum: critical/high/medium/low), `title` (String, ≤60 chars), `shortMessage` (String), `detailedReason` (String), `recommendedAction` (String), `deadline` (Date, nullable), `read` (Boolean, default false), `readAt` (Date, nullable), `snsMessageId` (String, nullable), `createdAt` (Date, default now). Indexes: `{ userId:1, createdAt:-1 }`, `{ userId:1, read:1 }`. Implements Req 13 schema.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 3

- [ ] 68. Wire SNS publish into reminder scheduler — Update `reminder.scheduler.js`: when a Reminder fires (cron creates/upserts it), call `sns.publishNotification()` for `triggerType === "1h"` (severity: critical) and `triggerType === "24h"` (severity: high). Before publishing: create a Notification document via `Notification.create()` with the reminder details. Implements Req 11.1, 11.5.
  - **Owner:** Developer A
  - **Effort:** 30 min
  - **Dependencies:** Task 66, Task 67, Task 24

- [ ] 69. Wire SNS publish for critical notices — Update `summarize.service.js`: after `analyzeNotice()` completes and `urgency === "critical" || urgency === "high"`, create a Notification document and call `sns.publishNotification()` with `alertType: "notice_critical"`. Implements Req 11.2 (critical notice push).
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 66, Task 67, Task 61

- [ ] 70. Build Lambda push consumer — `lambda/push-consumer/index.mjs`. Handler parses the SNS event body to extract the notification payload. Connects to MongoDB Atlas using Mongoose (connection cached across warm invocations). Queries `PushSubscription.find({ userId: payload.userId })`. For each subscription: call `webpush.sendNotification(sub, JSON.stringify({ title: payload.title, body: payload.shortMessage, data: { url: '/notifications' } }))`. On HTTP 410 or 404 response from the push service: delete the stale subscription document. Log success/failure for each delivery. Implements Req 11.3, 11.4.
  - **Owner:** Developer A
  - **Effort:** 60 min
  - **Dependencies:** Task 66, Task 71

- [x] 71. Create Mongoose PushSubscription model — `src/models/PushSubscription.js`. Fields: `userId` (ref User), `endpoint` (String, unique), `keys.p256dh` (String), `keys.auth` (String), `userAgent` (String), `createdAt` (Date, default now), `lastUsedAt` (Date, default now). Indexes: `{ userId:1 }`, `{ endpoint:1 }` unique. Used by both the Express push routes and the Lambda consumer. Implements Req 12 schema.
  - **Owner:** Developer A
  - **Effort:** 15 min
  - **Dependencies:** Task 3

- [ ] 72. Deploy Lambda and subscribe to SNS — Zip `lambda/push-consumer/` (including `node_modules`). Upload to AWS Lambda (Node.js 20.x runtime). Set Lambda environment variables: `MONGODB_URI`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`. In SNS console: add Lambda subscription to `campusflow-notifications` topic. Confirm subscription. Set Lambda concurrency limit to 5 to prevent Atlas connection exhaustion. Implements Req 11.3 delivery pipeline.
  - **Owner:** Developer A
  - **Effort:** 45 min
  - **Dependencies:** Task 70, Task 4

---
<!-- Wave 15: Browser Push Subscriptions (Req 12) -->

- [x] 73. Create push subscription routes — `src/routes/push.routes.js`. `POST /api/push/subscribe` (verifyJWT): upsert PushSubscription document keyed on `endpoint`; set `userId`, `keys`, `userAgent` from request body; return `201 { success: true }`. `POST /api/push/unsubscribe` (verifyJWT): delete PushSubscription by `endpoint`; return `200`. `GET /api/push/vapid-public-key` (public): return `{ publicKey: process.env.VAPID_PUBLIC_KEY }`. Register routes in `index.js`. Implements Req 12.2, 12.4.
  - **Owner:** Developer A
  - **Effort:** 30 min
  - **Dependencies:** Task 71, Task 7

- [x] 74. Build service worker — `client/public/sw.js`. Register push event listener: parse `event.data.json()`, call `self.registration.showNotification(data.title, { body, icon: '/icon-192.png', badge: '/badge-72.png', data: { url: data.data?.url ?? '/notifications' } })`. Register notificationclick listener: close notification, call `clients.openWindow(event.notification.data.url)`. Service worker must be served from the root path so its scope covers the entire app. Implements Req 12.3.
  - **Owner:** Developer B
  - **Effort:** 25 min
  - **Dependencies:** Task 2

- [x] 75. Register service worker and push permission flow — In `src/main.jsx` (or `App.jsx`): on app load call `navigator.serviceWorker.register('/sw.js')`. In `src/hooks/usePushPermission.js`: export a hook that checks `Notification.permission`; if "default" and user is authenticated, shows a prompt card on first Dashboard visit. On "Allow": call `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidPublicKey })` (vapidPublicKey fetched from `GET /api/push/vapid-public-key`), then POST the subscription object to `POST /api/push/subscribe`. On "Deny": store `cf_push_denied` in localStorage and never re-prompt. Implements Req 12.1, 12.2.
  - **Owner:** Developer B
  - **Effort:** 45 min
  - **Dependencies:** Task 74, Task 73, Task 31

---
<!-- Wave 15: Notification Center (Req 13) -->

- [ ] 76. Create notification routes — `src/routes/notification.routes.js`. All routes use `verifyJWT` + `requireRole('student')` — admin JWTs receive 403 (Req 8.6). All routes scope to `req.user.userId`. `GET /api/notifications?page=1&limit=20`: return `{ notifications: [...], total, unreadCount }` sorted by `createdAt` desc. `PATCH /api/notifications/:id/read`: set `read = true`, `readAt = now`; verify ownership; return `200`. `PATCH /api/notifications/read-all`: set `read = true` on all unread docs for userId; return `200 { updated: n }`. `GET /api/notifications/unread-count`: return `{ count: n }`. Register routes in `index.js`. Implements Req 13.1–13.5.
  - **Owner:** Developer A
  - **Effort:** 35 min
  - **Dependencies:** Task 67, Task 7

- [ ] 77. Build NotificationsPage and NotificationList — `src/pages/NotificationsPage.jsx`. Fetch `GET /api/notifications` with pagination. Render `<NotificationList>`: each item shows severity badge (color-coded), title, shortMessage, alertType label, `createdAt` timestamp (relative, e.g. "2 h ago"), and read/unread dot indicator. Clicking an item calls `PATCH /api/notifications/:id/read` and removes the unread dot. "Mark all as read" button calls `PATCH /api/notifications/read-all` and refreshes the list. Show skeleton loaders while loading. Show empty state when no notifications exist. Implements Req 13.1–13.5.
  - **Owner:** Developer B
  - **Effort:** 55 min
  - **Dependencies:** Task 76, Task 33

- [ ] 78. Wire unread count badge in sidebar — Update `<Sidebar>` to fetch `GET /api/notifications/unread-count` on mount and after any `PATCH /notifications/read` or `PATCH /notifications/read-all` action. Display count as a red pill badge on the Notifications link; hide when count is 0. Implements Req 13.4.
  - **Owner:** Developer B
  - **Effort:** 20 min
  - **Dependencies:** Task 76, Task 34

---
<!-- Wave 15: Integration tests for new requirements -->

- [ ] 79. Notice intelligence E2E test — Upload a real PDF containing a date and action item as admin. Verify within 30 s: notice has `urgency` set (not "unknown"), `title` populated, `actions` array non-empty, `deadlines` array non-empty. Verify GET /api/notices returns notices sorted urgency-first. Verify urgency badge and category tag appear on NoticesPage. Verify Bedrock failure → notice shows "Summary unavailable" + urgency remains "unknown". Covers Req 9.1–9.5.
  - **Owner:** Developer A
  - **Effort:** 25 min
  - **Dependencies:** Task 61, Task 62, Task 39

- [ ] 80. Guardian AI E2E test — Log in as student with seeded events. POST /api/guardian/analyze. Verify response arrives within 20 s with `alerts`, `dailyPlan`, `opportunities`, `onTrack` fields. Verify no data from other students is included. Mock Bedrock timeout → verify 503 returned with no partial data. Verify GuardianAIPanel renders alerts list and daily plan correctly. Covers Req 10.1–10.6.
  - **Owner:** Developer A + Developer B
  - **Effort:** 25 min
  - **Dependencies:** Task 64, Task 65

- [ ] 81. SNS and Lambda push E2E test — Create an event 25 h away; wait for cron to fire the 24h reminder; verify: Notification document created in MongoDB with correct alertType; SNS publish was called (check CloudWatch logs); Lambda received the event and called web-push; browser displayed a push notification. Dismiss reminder; verify SNS is not republished. Create a critical-urgency seeded notice; verify SNS publish triggered for it. Covers Req 11.1–11.6.
  - **Owner:** Developer A
  - **Effort:** 30 min
  - **Dependencies:** Task 68, Task 69, Task 72

- [x] 82. Push subscription and service worker test — In Chrome with tab closed: grant notification permission on Dashboard; verify PushSubscription stored in MongoDB; trigger a critical alert (edit event to 1 h away); verify browser notification appears with correct title and body even when tab is closed. Revoke permission; verify PushSubscription deleted. Verify stale 410 subscription is removed by Lambda. Covers Req 12.1–12.6.
  - **Owner:** Developer B
  - **Effort:** 30 min
  - **Dependencies:** Task 73, Task 74, Task 75, Task 72

- [ ] 83. Notification center test — Open /notifications page; verify 3 seeded notifications appear sorted newest-first with correct severity badges. Click one → verify it turns read. Click "Mark all as read" → verify all turn read and unread badge in sidebar clears to 0. Reload page → verify read state persisted. Covers Req 13.1–13.5.
  - **Owner:** Developer B
  - **Effort:** 20 min
  - **Dependencies:** Task 76, Task 77, Task 78

- [x] 84. Update final deployment for new infrastructure — Add to deployment checklist: set `SNS_TOPIC_ARN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` in production env vars; re-deploy Lambda ZIP with production `MONGODB_URI`; confirm SNS subscription is confirmed for production Lambda ARN; verify `public/sw.js` is served at root URL; run `npm run seed` to seed demo Notification documents in production DB.
  - **Owner:** Developer A
  - **Effort:** 30 min
  - **Dependencies:** Task 72, Task 75

---
<!-- Wave 16: Req 8.6 Admin Isolation + Req 11.2 72h / Guardian Notifications -->

- [ ] 85. Build 72-hour deadline detection scheduler — In `reminder.scheduler.js`, add a second `node-cron` schedule running every 15 minutes: `cron.schedule('*/15 * * * *', ...)`. Query Events where `type IN ["exam","assignment"]` and `startTime BETWEEN (now + 1h) AND (now + 72h)`. For each event: check whether a Notification document already exists with `{ userId: event.userId, alertType: "deadline_72h" }` and a `deadline` field matching `event.startTime` (±1 minute tolerance). If none exists: create the Notification document and call `sns.publishNotification()`. Export as `startDeadlineScheduler()`. Call it in `index.js` alongside `startScheduler()`. Implements Req 11.2 (72h deadline trigger) and Property 12 (deduplication).
  - **Owner:** Developer A
  - **Effort:** 45 min
  - **Dependencies:** Task 66, Task 67, Task 24

- [ ] 86. Wire Guardian AI attendance and placement alerts to SNS — Update the Guardian AI route handler (`guardian.routes.js`): after `runGuardianAnalysis()` returns, iterate `report.alerts`. For each alert where `severity === "critical" || "high"`: create a Notification document with the appropriate `alertType` (`"guardian_risk"` for attendance risk, exam prep gap, and missed deadlines; `"guardian_opportunity"` for placement and event opportunities with severity overridden to "low" — no SNS publish for those). For `"guardian_risk"` alerts only: call `sns.publishNotification(payload)`. Map alert fields to notification fields: `alert.title → title`, `alert.detailedReason → detailedReason`, `alert.recommendedAction → recommendedAction`. Implements Req 11.2 (Guardian AI attendance risk + placement deadline SNS publish).
  - **Owner:** Developer A
  - **Effort:** 35 min
  - **Dependencies:** Task 64, Task 66, Task 67

- [ ] 87. Admin isolation E2E test — Using an admin JWT: send `GET /api/events` → verify 403; send `GET /api/studyplans/active` → verify 403; send `GET /api/notifications` → verify 403; send `POST /api/guardian/analyze` → verify 403; send `GET /api/reminders/pending` → verify 403. Confirm no student email, passwordHash, or calendar data is returned in any admin-accessible response (GET /api/notices list and detail responses). Implements Req 8.6 verification.
  - **Owner:** Developer A + Developer B
  - **Effort:** 25 min
  - **Dependencies:** Task 25, Task 26, Task 27, Task 28, Task 64, Task 76, Task 48

- [ ] 88. 72-hour deadline notification E2E test — Create an exam event with `startTime = now + 50h`. Wait up to 15 min for the 15-minute cron to fire (or manually invoke `startDeadlineScheduler()` in a test script). Verify: a Notification document exists with `alertType: "deadline_72h"`, `severity: "critical"`, and the correct `deadline` value. Verify SNS publish was called (CloudWatch log). Wait for the same event to cross the 24h window; verify a second Notification document is created with `alertType: "reminder_24h"` — confirm **no duplicate** `deadline_72h` document was created. Covers Req 11.2 and Property 12 (deduplication).
  - **Owner:** Developer A
  - **Effort:** 30 min
  - **Dependencies:** Task 85, Task 68, Task 67

- [ ] 89. Guardian AI attendance risk and placement deadline notification test — Seed a student with: (1) attendance below 75% indicator in their events (class events marked as isBlocked spanning past weeks as a proxy); (2) a placement-deadline notice with urgency "critical". Run `POST /api/guardian/analyze`. Verify: `report.alerts` contains at least one alert with attendance-related context and at least one with placement context. Verify Notification documents are created in MongoDB for both. Verify SNS publish was called for the `guardian_risk` alerts. Verify no SNS publish for `guardian_opportunity` alerts. Covers Req 11.2 (attendance risk + placement deadline SNS paths).
  - **Owner:** Developer A + Developer B
  - **Effort:** 25 min
  - **Dependencies:** Task 86, Task 80

- [ ] 90. Extend seed data for 72h and Guardian notification demos — Add to `seed.js`: 1 exam event at `now + 50h` (triggers 72h detection on first cron run); 1 placement notice with `urgency: "critical"` and `category: "placement"`; 2 pre-seeded Notification documents with `alertType: "deadline_72h"` and `alertType: "guardian_risk"` for the demo student. Ensures the Notifications panel and push demo work even if the real-time SNS pipeline is slow.
  - **Owner:** Developer A
  - **Effort:** 20 min
  - **Dependencies:** Task 55, Task 67, Task 85

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "label": "Scaffolding",
      "tasks": [1, 2]
    },
    {
      "wave": 2,
      "label": "Config and Models",
      "tasks": [3, 4, 30]
    },
    {
      "wave": 3,
      "label": "User Model and Auth Middleware",
      "tasks": [5, 9, 31]
    },
    {
      "wave": 4,
      "label": "Data Models and Auth Endpoints",
      "tasks": [6, 7, 8, 10, 11, 12, 13, 32]
    },
    {
      "wave": 5,
      "label": "AWS Services and App Shell",
      "tasks": [14, 15, 16, 19, 33]
    },
    {
      "wave": 6,
      "label": "Bedrock Services and Frontend Core",
      "tasks": [17, 18, 20, 34, 35]
    },
    {
      "wave": 7,
      "label": "Backend Routes and Calendar UI",
      "tasks": [21, 22, 23, 24, 37]
    },
    {
      "wave": 8,
      "label": "Event and Reminder Routes and Notices UI",
      "tasks": [25, 26, 38, 39, 40]
    },
    {
      "wave": 9,
      "label": "Study Plan and Chat Routes and Dashboard",
      "tasks": [27, 28, 29, 36, 41, 42]
    },
    {
      "wave": 10,
      "label": "Integration Wiring",
      "tasks": [43, 44, 45, 46, 47]
    },
    {
      "wave": 11,
      "label": "Testing and QA",
      "tasks": [48, 49, 50, 51, 52, 53, 54]
    },
    {
      "wave": 12,
      "label": "Polish and Deploy",
      "tasks": [55, 56, 57, 58, 59]
    },
    {
      "wave": 13,
      "label": "Notice Intelligence (Req 9)",
      "tasks": [60, 61, 62]
    },
    {
      "wave": 14,
      "label": "Guardian AI and SNS Infrastructure (Req 10, 11)",
      "tasks": [63, 64, 65, 66, 67, 68, 69, 70, 71, 72]
    },
    {
      "wave": 15,
      "label": "Push Notifications and Notification Center (Req 12, 13)",
      "tasks": [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84]
    },
    {
      "wave": 16,
      "label": "Admin Isolation and 72h Guardian Notifications (Req 8.6, 11.2)",
      "tasks": [85, 86, 87, 88, 89, 90]
    }
  ]
}
```

## Notes

**Effort distribution:**
- Developer A total: ~40 hr (Tasks 1, 3–29, 43, 45, 47, 48–49, 51, 55, 59–64, 66–73, 76, 79–81, 84–86, 88–90)
- Developer B total: ~37 hr (Tasks 2, 30–42, 44, 46, 50, 52–54, 56–58, 65, 74–75, 77–78, 82–83, 87, 89)

**Build order by hour:**
- Hours 0–5: Tasks 1–9, 30–32 (scaffolding + auth, both devs in parallel)
- Hours 5–10: Tasks 10–15, 33–34 (models + AWS/SNS setup / app shell)
- Hours 10–18: Tasks 16–21, 35–38 (AWS services / notice + calendar UI)
- Hours 18–26: Tasks 22–27, 39–41 (routes / notices + study plan UI)
- Hours 26–32: Tasks 28–29, 42–46 (remaining routes / chat + integration wiring)
- Hours 32–36: Tasks 47–54 (testing and QA — core MVP)
- Hours 36–40: Tasks 55–59, 60–62 (polish + deploy + notice intelligence)
- Hours 40–44: Tasks 63–72 (Guardian AI + SNS + Lambda)
- Hours 44–48: Tasks 73–90 (push subscriptions + notification center + admin isolation + 72h notifications)

**Key risks:**
- Bedrock latency — mitigated by pre-stored summaries/urgency in seed data and graceful degradation (Task 47)
- S3 + SNS + VAPID setup — allocate 45 min to AWS console configuration in Task 4 before any coding
- Lambda cold start latency — keep Lambda warm during demo or use provisioned concurrency
- react-big-calendar configuration — can be complex; lazy-load it and keep the integration simple for MVP
- node-cron reminder timing — create a test event 25 h out early in integration testing (Task 51) so there is time to debug the scheduler
- Service Worker scope — must be served from the root path; misconfiguration silently breaks all push delivery
- Admin isolation — `requireRole('student')` must be added to routes in Tasks 25, 26, 27, 28, 29, 64, 76; missing it on even one route is an Req 8.6 violation; Task 87 catches omissions
