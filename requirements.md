# Requirements Document

## Introduction

Campus Flow is an AI-powered campus assistant designed to solve the fragmented information problem faced by college students. Students currently juggle academic schedules, assignments, exam dates, institutional notices, and extracurricular activities across multiple disconnected platforms, resulting in missed deadlines, increased cognitive load, and elevated stress.

Campus Flow consolidates these concerns into a single, intelligent interface. Using Amazon Bedrock for AI capabilities and Amazon S3 for document storage, the platform proactively surfaces relevant information, generates personalized study plans, and provides a conversational academic assistant — all scoped to a 48-hour hackathon MVP deliverable by a 2-person team.

---

## Glossary

- **Student**: A registered college student who uses Campus Flow to manage academic life.
- **Administrator**: A college staff member who uploads institutional notices and manages system-wide content.
- **Notice**: An official institutional document (PDF, image, or plain text) uploaded by an Administrator.
- **Study_Plan**: A time-blocked, AI-generated schedule of study sessions personalized to a Student's exam dates and available hours.
- **Event**: A calendar entry representing an exam, assignment deadline, class session, or extracurricular activity.
- **Reminder**: A proactive notification delivered to a Student before an Event deadline.
- **Chatbot**: The AI-powered conversational assistant that answers academic queries.
- **Summary**: A concise, AI-generated plain-language synopsis of a Notice.
- **Dashboard**: The primary Student-facing view that aggregates schedule, reminders, notices, and study plan.
- **Bedrock**: Amazon Bedrock, the AWS managed AI/ML service used for text generation and summarization.
- **S3**: Amazon S3, the AWS object storage service used to store uploaded Notice files.
- **System**: The Campus Flow application as a whole.
- **Guardian_AI_Report**: A Bedrock-generated analysis of a Student's upcoming schedule that identifies risks, gaps, and opportunities.
- **Urgency**: A classification (critical / high / medium / low / unknown) assigned to a Notice by the AI analysis pipeline.
- **Action_Item**: A specific task or step extracted from a Notice that requires a Student's response (e.g. "Submit form by Friday").
- **Notification**: A persisted record of an alert delivered or queued for delivery to a Student, with severity and read/dismissed state.
- **PushSubscription**: A Student's browser Web Push subscription object (endpoint + keys) stored in MongoDB and used by the Lambda consumer to deliver browser push notifications.
- **SNS_Topic**: The Amazon SNS topic (`campusflow-notifications`) used as the event bus for all notification events published by the Express server.
- **Lambda_Consumer**: An AWS Lambda function subscribed to the SNS topic that reads each notification event, looks up PushSubscriptions for the target user, and sends browser push payloads via the Web Push protocol.
- **VAPID**: Voluntary Application Server Identification — a key pair used to authenticate the push server when sending Web Push notifications to a browser.
- **Service_Worker**: A browser-side JavaScript file (`/sw.js`) registered by the React app that receives push events from the browser's push service and displays notifications even when the app tab is closed.

---

## User Personas

### Persona 1 — Arjun, the Overloaded Engineering Student

- **Age**: 20
- **Year**: Second year, B.Tech Computer Science
- **Pain Points**: Misses assignment deadlines because notices are buried in WhatsApp groups; spends hours building study schedules manually; forgets lab submission dates.
- **Goals**: One place to see everything due this week; get a ready-made study plan before exams; be reminded 24 hours before any deadline.
- **Tech Comfort**: High — uses smartphone and laptop daily.

### Persona 2 — Priya, the Active Extracurricular Participant

- **Age**: 21
- **Year**: Third year, B.Com
- **Pain Points**: Club event schedules clash with exam prep; loses track of academic notices while managing event coordination.
- **Goals**: See academic and extracurricular events in one calendar; ask the chatbot quick questions about syllabus topics.
- **Tech Comfort**: Medium — comfortable with apps, less so with complex settings.

### Persona 3 — Dr. Mehta, the College Administrator

- **Age**: 45
- **Role**: Academic Registrar
- **Pain Points**: Notices sent via email go unread; students claim they were not informed of schedule changes.
- **Goals**: Upload a notice once and have all students see it instantly; verify notices were surfaced.
- **Tech Comfort**: Medium — uses web portals regularly.

---

## Requirements

---

### Requirement 1: Notice Upload and Storage

**User Story:** As an Administrator, I want to upload institutional notices to a central location, so that all students can access them immediately without relying on email or messaging apps.

#### Acceptance Criteria

1. THE System SHALL provide an upload interface that accepts PDF, PNG, JPG, and plain-text (.txt) files up to 10 MB in size.
2. WHEN an Administrator submits a Notice file, THE System SHALL store the file in S3 and record the file metadata (uploader ID, upload timestamp, file name, S3 key) in the database within 5 seconds.
3. IF a file exceeds 10 MB or is of an unsupported type, THEN THE System SHALL reject the upload and display an error message that states the specific violation (e.g., "File exceeds the 10 MB limit" or "File type .docx is not supported. Accepted types: PDF, PNG, JPG, TXT").
4. WHEN a Notice is successfully stored, THE System SHALL make it visible to all Students on the Dashboard within 10 seconds of upload completion.
5. THE System SHALL retain Notice files in S3 for a minimum of 90 days from the upload date; WHEN a Notice's retention period expires, THE System SHALL delete the file from S3 and mark the corresponding database record as archived.
6. WHEN a user without the "administrator" role attempts to upload a Notice, THE System SHALL reject the request with a 403 status code and display an "Access denied" error message.
7. IF an Administrator submits a Notice file whose name exactly matches an existing active Notice in the database, THEN THE System SHALL reject the upload and display an error message identifying the conflicting file name.

---

### Requirement 2: AI Notice Summarization

**User Story:** As a Student, I want uploaded notices to be automatically summarized in plain language, so that I can understand key information quickly without reading the full document.

#### Acceptance Criteria

1. WHEN a Notice is successfully stored, THE System SHALL invoke Bedrock to generate a Summary of the Notice content within 30 seconds.
2. WHEN a Student views a Notice, THE System SHALL display the Summary alongside the original Notice on the Dashboard, limited to 150 words or fewer.
3. IF Bedrock returns an error or times out after 30 seconds, THEN THE System SHALL retry the summarization request up to 3 times with a 5-second delay between attempts; IF all 3 retries fail, THE System SHALL display the original Notice without a Summary and render a "Summary unavailable" label in place of the Summary.
4. WHEN a Summary is generated, THE System SHALL generate the Summary in the same language as the detected language of the source Notice text; IF language detection fails, THEN THE System SHALL generate the Summary in English and display a notice that the language could not be auto-detected.
5. WHEN a Summary is generated, THE System SHALL store the Summary text in the database linked to the corresponding Notice record.

---

### Requirement 3: AI Study Plan Generation

**User Story:** As a Student, I want an AI-generated study plan based on my exam schedule and available study hours, so that I can prepare effectively without spending time organizing manually.

#### Acceptance Criteria

1. WHEN a Student requests a Study_Plan, THE System SHALL prompt the Student to provide upcoming exam dates (up to 10, each a future calendar date), subjects (up to 10, each a non-empty string), and daily available study hours (a value between 0.5 and 16); IF any submitted value is outside these bounds or an exam date is in the past, THE System SHALL reject the submission and display an error message identifying the invalid field.
2. WHEN the Student submits valid study preferences, THE System SHALL invoke Bedrock and return a Study_Plan within 15 seconds.
3. THE Study_Plan SHALL allocate study time for each subject proportionally to the number of remaining days before its exam relative to the total remaining days across all subjects, with no single session shorter than 30 minutes or longer than 3 hours.
4. THE Study_Plan SHALL not schedule sessions during time slots the Student has marked as blocked in their calendar.
5. IF the Student has fewer than 2 days remaining before an exam, THEN THE System SHALL include a condensed revision schedule for that subject covering topics drawn from the Student-provided subject content, prioritised in the order the Student submitted them.
6. WHEN a Study_Plan is generated, THE System SHALL display the Study_Plan as a time-blocked daily schedule on the Dashboard.
7. WHEN a Student requests a new Study_Plan, THE System SHALL replace the current Study_Plan, retain the replaced plan in history for 7 days, and store a maximum of 5 replaced plans; WHEN a sixth replaced plan would be added, THE System SHALL delete the oldest retained plan.
8. IF Bedrock returns an error or times out after 15 seconds during Study_Plan generation, THEN THE System SHALL preserve the Student's submitted preferences, display an error message instructing the Student to retry, and SHALL NOT generate a partial Study_Plan.

---

### Requirement 4: Academic Assistant Chatbot

**User Story:** As a Student, I want to ask academic questions in natural language and receive helpful answers, so that I can get quick guidance without searching through notes or waiting for a professor's reply.

#### Acceptance Criteria

1. THE System SHALL provide a chat interface where a Student can submit text queries up to 500 characters in length; IF a query exceeds 500 characters, THE System SHALL reject the submission and display an error message stating the character limit.
2. WHEN a Student submits a valid query, THE System SHALL send the query to Bedrock and display a response within 10 seconds.
3. THE Chatbot SHALL maintain conversational context for a minimum of the last 10 messages within a single session, evicting the oldest message when the 11th message is added; a session ends when the Student logs out or closes the browser tab.
4. IF Bedrock returns an error, THEN THE System SHALL display a fallback message informing the Student that the assistant is temporarily unavailable and to try again.
5. THE System SHALL scope Chatbot responses to academic topics (course content, assignments, exams, research, and academic processes); WHEN a Student submits a query on an in-scope academic topic, THE Chatbot SHALL provide a substantive response.
6. WHEN a Student submits a query that is outside the defined academic scope, THE Chatbot SHALL decline to answer and suggest that the Student rephrase the question toward an academic topic.
7. THE System SHALL not store Student query content or Chatbot responses after the session ends (logout or browser close).

---

### Requirement 5: Smart Scheduling and Calendar Management

**User Story:** As a Student, I want to manage all my academic and extracurricular events in one calendar, so that I can see my full schedule at a glance and avoid conflicts.

#### Acceptance Criteria

1. THE System SHALL provide a calendar view displaying Events by day, week, and month.
2. WHEN a Student creates an Event, THE System SHALL require a title (non-empty, maximum 100 characters), date, start time, end time, and event type (exam, assignment, class, or extracurricular).
3. IF two Events for the same Student overlap in time (start time of one falls within the time range of another), THEN THE System SHALL display both Events in a distinct color highlight and render a warning icon on each overlapping Event on the calendar.
4. THE System SHALL allow a Student to edit or delete any Event the Student created.
5. WHEN an Administrator uploads a Notice that contains a date in ISO 8601 (YYYY-MM-DD), DD/MM/YYYY, or DD Month YYYY format, THE System SHALL extract the date and present the Student with an option to add a corresponding Event to their calendar; IF no parseable date is found in those formats, THE System SHALL not prompt the Student.
6. THE System SHALL synchronize calendar state across browser sessions for the same authenticated Student account within 5 seconds of a change; IF synchronization fails, THE System SHALL display a "Schedule may be out of date" warning banner to the Student.

---

### Requirement 6: Proactive Deadline Reminders

**User Story:** As a Student, I want to receive automatic reminders before my deadlines and exams, so that I am never caught off guard by an approaching due date.

#### Acceptance Criteria

1. THE System SHALL send a Reminder to a Student 24 hours before each Event marked as "exam" or "assignment"; IF an Event is created with fewer than 24 hours remaining before its deadline, THE System SHALL skip the 24-hour Reminder and only send the 1-hour Reminder if applicable.
2. THE System SHALL send a second Reminder to a Student 1 hour before each Event marked as "exam" or "assignment"; IF an Event is created with fewer than 1 hour remaining before its deadline, THE System SHALL skip the 1-hour Reminder entirely.
3. WHEN a Student dismisses a Reminder, THE System SHALL not resurface that same Reminder for the same Event unless the Event's deadline is subsequently edited.
4. THE System SHALL deliver Reminders as in-app notifications visible on the Dashboard; each in-app Reminder SHALL remain visible until the Student dismisses it or the Event's deadline passes, whichever comes first.
5. WHERE a Student has enabled browser notification permissions, THE System SHALL also deliver Reminders as browser push notifications.
6. IF an Event is edited and the deadline changes, THEN THE System SHALL recalculate and reschedule Reminders based on the updated deadline; IF a recalculated Reminder time has already elapsed at the moment of editing, THE System SHALL skip that Reminder.
7. IF an Event is deleted, THEN THE System SHALL cancel all pending Reminders associated with that Event.

---

### Requirement 7: Student Authentication and Onboarding

**User Story:** As a Student, I want to register and log in securely, so that my schedule, study plan, and preferences are private and accessible only to me.

#### Acceptance Criteria

1. THE System SHALL allow a Student to register using an email address and password.
2. WHEN a Student submits registration credentials, THE System SHALL validate that the email address conforms to RFC 5322 format and that the password is between 8 and 128 characters long; IF either validation fails, THE System SHALL reject the registration and display an error message identifying the specific failing field and rule.
3. IF a Student attempts to register with an email address already in use, THEN THE System SHALL reject the registration and display the message "An account with this email address already exists."
4. WHEN a Student successfully authenticates, THE System SHALL issue a JSON Web Token (JWT) with an expiry of 8 hours.
5. WHILE a Student's JWT is expired, THE System SHALL redirect all authenticated-route requests to the login page.
6. THE System SHALL store passwords as bcrypt hashes with a minimum cost factor of 12.
7. THE System SHALL never store or log plaintext passwords at any point during registration, authentication, or error handling.
8. WHEN a Student submits incorrect login credentials, THE System SHALL return a generic error message ("Invalid email or password") without indicating which field is incorrect.

---

### Requirement 8: Administrator Authentication and Role Management

**User Story:** As an Administrator, I want a dedicated login with elevated permissions, so that I can upload notices and manage content without access to student personal data.

#### Acceptance Criteria

1. THE System SHALL maintain separate role designations for "student" and "administrator" accounts; Administrator accounts SHALL be pre-provisioned by the system operator and SHALL NOT be self-registrable via the public registration endpoint.
2. WHEN an Administrator successfully authenticates, THE System SHALL issue a JWT that encodes the "administrator" role claim with an expiry of 8 hours.
3. WHEN a request is made to the notice upload endpoint with a valid JWT containing the "administrator" role claim, THE System SHALL permit the request to proceed.
4. IF a request is made to the notice upload endpoint with a valid JWT that does not contain the "administrator" role claim, THEN THE System SHALL reject the request with a 403 status code and an "Access denied" message.
5. IF a request is made to the notice upload endpoint with an expired, malformed, or absent JWT, THEN THE System SHALL reject the request with a 401 status code and an "Authentication required" message.
6. THE System SHALL not expose Student email addresses, password hashes, or calendar Events in any API response accessible to a JWT bearing the "administrator" role claim.

---

### Requirement 9: Notice Intelligence — Enhanced Analysis

**User Story:** As a Student, I want uploaded notices to be analyzed for deadlines, action items, and urgency level, so that I can immediately understand what the notice requires of me and when.

#### Acceptance Criteria

1. WHEN a Notice is successfully stored, THE System SHALL invoke Bedrock to extract from the notice text: a title (≤ 10 words), a plain-language summary (≤ 150 words), all deadline dates present, all required action items, an urgency level (critical / high / medium / low), and a category (academic / event / administrative / placement).
2. WHEN urgency extraction is complete, THE System SHALL store the extracted fields (`title`, `summary`, `deadlines`, `actions`, `urgency`, `category`) in the Notice database record.
3. WHEN a Student views the Notices page, THE System SHALL display the urgency badge and category tag alongside each Notice summary.
4. IF Bedrock returns an error during enhanced analysis, THE System SHALL fall back to storing only the plain summary and marking `urgency` as "unknown", so the notice remains visible to students.
5. THE System SHALL sort the Notices feed by urgency descending (critical first) then by `uploadedAt` descending within the same urgency tier.

---

### Requirement 10: Guardian AI — Proactive Risk Alerts

**User Story:** As a Student, I want the system to proactively detect when I am at risk of missing a deadline or falling behind, so that I receive a targeted recommendation before it is too late.

#### Acceptance Criteria

1. WHEN a Student requests Guardian AI analysis, THE System SHALL examine the Student's upcoming events (next 7 days), active study plan sessions, and recent notices to identify: events with no study plan coverage, exam deadlines within 48 hours that have no study sessions scheduled, and overlapping critical events on the same day.
2. WHEN risks are detected, THE System SHALL invoke Bedrock to generate a Guardian AI report containing: a list of risk alerts (each with `alertType`, `severity`, `title`, `detailedReason`, and `recommendedAction`), a suggested daily plan for the next 3 days, and a list of opportunities (events or notices flagged as high-value).
3. THE System SHALL return the Guardian AI report within 20 seconds of the Student's request.
4. IF no risks are detected, THE System SHALL return a report with an empty `alerts` array and a brief affirmative message confirming the Student is on track.
5. IF Bedrock returns an error or times out after 20 seconds, THE System SHALL return a fallback response instructing the Student to try again, without displaying partial or fabricated risk data.
6. THE System SHALL scope Guardian AI analysis strictly to data present in the Student's own account; THE System SHALL NOT infer or invent deadlines, events, or academic records not present in the provided data.

---

### Requirement 11: Notification Infrastructure and Event Bus

**User Story:** As a Student, I want to receive notifications for critical alerts even when the Campus Flow tab is not open, so that I never miss an urgent deadline or Guardian AI warning.

#### Acceptance Criteria

1. WHEN the System generates a Reminder or Guardian AI alert with severity "critical" or "high", THE System SHALL publish a notification event to the SNS Topic (`campusflow-notifications`) containing: `userId`, `alertType`, `severity`, `title`, `shortMessage`, `detailedReason`, `recommendedAction`, and `deadline` (ISO 8601, nullable).
2. THE System SHALL also publish SNS events for: deadlines within 72 hours (exam or assignment events), attendance risk alerts from Guardian AI, and placement deadline alerts from Guardian AI.
3. WHEN an SNS event is published, THE Lambda_Consumer SHALL receive it, look up all active PushSubscriptions for the target `userId`, and send a Web Push notification to each subscription endpoint within 10 seconds of event publication.
4. IF a Web Push delivery returns HTTP 410 (Gone) or HTTP 404 (subscription expired), THEN THE Lambda_Consumer SHALL delete the corresponding PushSubscription document from MongoDB.
5. THE System SHALL persist every notification event as a Notification document in MongoDB regardless of push delivery status, so the student can view notification history on the Dashboard.
6. THE System SHALL NOT publish SNS events for "medium" or "low" severity notifications; those are surfaced only as in-app notifications.

---

### Requirement 12: Browser Push Subscription Management

**User Story:** As a Student, I want to grant permission for browser push notifications once, so that I receive critical alerts on my device even when the site is closed.

#### Acceptance Criteria

1. WHEN a Student logs in and visits the Dashboard for the first time, THE System SHALL prompt the Student to enable browser notifications using the browser's Notification Permission API.
2. WHEN a Student grants notification permission, THE System SHALL generate a push subscription using the VAPID public key and call `POST /api/push/subscribe` to store the PushSubscription in MongoDB linked to the Student's `userId`.
3. THE System SHALL register a Service Worker (`/sw.js`) in the browser; THE Service_Worker SHALL handle `push` events and call `self.registration.showNotification()` with the received payload even when the browser tab is closed.
4. WHEN a Student revokes browser notification permission, THE System SHALL call `POST /api/push/unsubscribe` to delete the Student's PushSubscription from MongoDB.
5. THE System SHALL support multiple active PushSubscriptions per Student (one per browser/device).
6. IF a push subscription has not received a successful delivery in 30 days, THE System SHALL treat it as stale and delete it during the next Lambda invocation that targets that user.

---

### Requirement 13: Notification History and Dashboard

**User Story:** As a Student, I want to see a history of all notifications I have received, so that I can review alerts I may have missed.

#### Acceptance Criteria

1. THE System SHALL provide a Notifications panel accessible from the Dashboard showing all Notification documents for the authenticated Student, sorted by `createdAt` descending, paginated at 20 per page.
2. WHEN a Student views the Notifications panel, THE System SHALL display for each notification: title, shortMessage, severity badge, alertType, createdAt timestamp, and read/unread state.
3. WHEN a Student clicks a notification, THE System SHALL mark it as `read: true` via `PATCH /api/notifications/:id/read`.
4. THE Dashboard navigation SHALL display an unread notification count badge showing the number of unread Notification documents for the authenticated Student.
5. THE System SHALL provide a "Mark all as read" action that sets `read: true` on all unread Notification documents for the Student.

---

## Non-Functional Requirements

### Performance

1. THE System SHALL serve Dashboard page loads within 2 seconds on a standard broadband connection (≥ 10 Mbps).
2. THE System SHALL support at least 100 concurrent authenticated users without degradation in API response times beyond the thresholds specified in functional requirements.

### Reliability

3. THE System SHALL achieve 99% uptime measured over any 7-day rolling window during the hackathon demonstration period.
4. IF the Bedrock service is unavailable, THEN THE System SHALL continue to serve all non-AI features (calendar, reminders, notice browsing) without interruption.

### Security

5. THE System SHALL transmit all data between client and server over HTTPS/TLS 1.2 or higher.
6. THE System SHALL sanitize all user-supplied input before storage or rendering to prevent cross-site scripting (XSS) and injection attacks.
7. THE System SHALL not expose AWS credentials or S3 bucket names in client-side code or API responses.

### Usability

8. THE System SHALL render correctly on Chrome, Firefox, and Safari browsers at viewport widths of 375 px (mobile) and 1280 px (desktop).
9. THE System SHALL display a loading indicator whenever an AI operation (summarization, study plan, chatbot) is in progress.

### Scalability (MVP Scope)

10. THE System SHALL be deployable to a single Node.js server instance for the hackathon MVP demonstration.

---

## Success Metrics

| Metric | Target | Measurement Method |
|---|---|---|
| Notice summary accuracy | ≥ 80% of summaries rated "helpful" by evaluators | Manual review of 10 sample notices |
| Study plan generation time | ≤ 15 seconds end-to-end | Browser DevTools network timing |
| Chatbot response time | ≤ 10 seconds per query | Browser DevTools network timing |
| Reminder delivery accuracy | 100% of test events trigger reminders at correct times | Manual test with 5 pre-set events |
| Dashboard load time | ≤ 2 seconds | Lighthouse performance audit |
| Zero critical auth bugs | No unauthenticated access to protected routes | Manual security walkthrough |
| Hackathon demo stability | Zero crashes during 15-minute live demo | Observation |

---

## MVP Scope Boundary (48-Hour / 2-Person Team)

**In Scope:**
- Notice upload, S3 storage, and AI summarization with urgency/action extraction
- AI study plan generation (prompt-based, no persistent ML model training)
- Chatbot with session-level context
- Manual event creation and calendar view (day/week)
- In-app deadline reminders (24-hour and 1-hour)
- JWT-based student and administrator authentication
- Guardian AI on-demand risk analysis (Bedrock-powered, student-triggered)
- Amazon SNS notification event bus (Express publishes, Lambda consumes)
- AWS Lambda notification consumer (Web Push delivery)
- Browser push notifications via Service Worker + Push API + VAPID
- Notification model + history panel on Dashboard
- PushSubscription model + subscription management APIs

**Out of Scope (Post-Hackathon):**
- Email or SMS reminder delivery
- Student routine intelligence (attendance tracking, sleep analysis)
- Google Calendar / LMS integration
- Mobile native app (iOS/Android)
- Multi-tenant institution management
- Analytics dashboard for administrators
- Offline mode
