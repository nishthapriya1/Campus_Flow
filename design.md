# Technical Design Document — Campus Flow

## Overview

Campus Flow is an AI-powered campus assistant that consolidates academic schedules, institutional notices, deadline reminders, and a conversational study assistant into a single web application. The MVP is scoped for a 48-hour hackathon, built by a 2-person team using React + Tailwind CSS on the frontend, Node.js + Express on the backend, MongoDB Atlas for persistence, Amazon S3 for file storage, Amazon Bedrock (Claude 3 Haiku) for all AI capabilities, Amazon SNS as the notification event bus, AWS Lambda as the push-delivery consumer, and the Web Push API + Service Workers for browser push notifications that work even when the tab is closed.

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│          React + Tailwind CSS  (Vite, port 5173)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │Dashboard │ │Calendar  │ │ Chatbot  │ │  Admin Upload UI   │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬───────────┘ │
│  Service Worker (/sw.js) — handles push events when tab closed  │
└───────┼────────────┼────────────┼─────────────────┼────────────┘
        │  HTTPS / REST (JWT Bearer)                │
        ▼                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API SERVER (Node.js + Express)                │
│                         (port 4000)                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ Auth     │ │ Notices  │ │ Events   │ │  AI / Guardian /   │ │
│  │ Router   │ │ Router   │ │ Router   │ │  Push / Notif.     │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Reminder Scheduler (node-cron)                 ││
│  └─────────────────────────────────────────────────────────────┘│
└───────┬──────────────────────┬──────────────┬────────┬──────────┘
        │                      │              │        │
        ▼                      ▼              ▼        ▼
┌──────────────┐  ┌──────────────────┐  ┌────────┐  ┌──────────────────┐
│ MongoDB Atlas│  │   Amazon S3      │  │Bedrock │  │   Amazon SNS     │
│  (cloud)     │  │ (notice files)   │  │(Claude)│  │ campusflow-notif.│
└──────────────┘  └──────────────────┘  └────────┘  └────────┬─────────┘
                                                              │ triggers
                                                              ▼
                                                   ┌──────────────────────┐
                                                   │   AWS Lambda         │
                                                   │ push-consumer        │
                                                   │  reads PushSubs      │
                                                   │  calls web-push →    │
                                                   │  Browser Push Svc    │
                                                   └──────────────────────┘
```

### Deployment Topology (MVP)

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Vite + React | Built to static files, served from Express `/public` or CDN |
| Backend | Node.js 20 + Express 4 | Single process, single server instance |
| Database | MongoDB Atlas (M0 free tier) | Shared cluster, connection via Mongoose |
| File Storage | Amazon S3 (single bucket) | Private bucket, pre-signed URLs for reads |
| AI | Amazon Bedrock — `anthropic.claude-3-haiku-20240307-v1:0` | Low-latency, cost-effective |
| Notification Bus | Amazon SNS (`campusflow-notifications`) | Express publishes; Lambda subscribes |
| Push Delivery | AWS Lambda (`campusflow-push-consumer`) | Receives SNS events, sends Web Push |
| Browser Push | Web Push API + Service Worker + VAPID | Works when tab is closed |
| Hosting | EC2 t3.micro or Render | One dyno / one instance |

### Request Flow — Notice Upload + Summarization

```
Admin Browser
    │
    ├─1─► POST /api/notices (multipart/form-data, JWT)
    │         │
    │         ├─2─► Validate JWT role = "administrator"
    │         ├─3─► Validate file type + size
    │         ├─4─► Upload file ──────────────────────► S3
    │         ├─5─► Insert Notice record ─────────────► MongoDB
    │         └─6─► Return 201 { noticeId, fileName }
    │
    └─ (async, after response)
              ├─7─► Extract text (pdf-parse / plain text)
              ├─8─► POST to Bedrock (summarize prompt)
              ├─9─► Store Summary text ────────────────► MongoDB
              └─10► Notice status updated to "summarized"
```

### Request Flow — Reminder Scheduler

```
node-cron (runs every minute on the server)
    │
    ├─► Query MongoDB for Events where:
    │       type IN ["exam","assignment"]
    │       AND startTime within ±1 min of (now + 24h)  [24h window]
    │       OR  startTime within ±1 min of (now + 1h)   [1h window]
    │
    ├─► For each matched Event → upsert Reminder document
    └─► Client polls GET /api/reminders/pending every 30 seconds
```

### Environment Variables

```env
# server/.env
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/campusflow
JWT_SECRET=<minimum-32-char-random-string>
AWS_REGION=us-east-1
S3_BUCKET_NAME=campusflow-notices
# Local dev only — use IAM role in production
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

```env
# client/.env
VITE_API_URL=http://localhost:4000/api
```

### Backend Directory Structure

```
server/
├── src/
│   ├── index.js
│   ├── config/
│   │   ├── db.js                 # Mongoose connection
│   │   └── aws.js                # S3 + Bedrock + SNS client setup
│   ├── middleware/
│   │   ├── auth.js               # verifyJWT, requireRole
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Notice.js
│   │   ├── Event.js
│   │   ├── Reminder.js
│   │   ├── StudyPlan.js
│   │   ├── Notification.js       # NEW
│   │   └── PushSubscription.js   # NEW
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── notice.routes.js
│   │   ├── event.routes.js
│   │   ├── studyplan.routes.js
│   │   ├── chat.routes.js
│   │   ├── reminder.routes.js
│   │   ├── guardian.routes.js    # NEW
│   │   ├── notification.routes.js# NEW
│   │   └── push.routes.js        # NEW
│   ├── services/
│   │   ├── s3.service.js
│   │   ├── sns.service.js        # NEW — publishNotification()
│   │   ├── bedrock.service.js
│   │   ├── reminder.scheduler.js
│   │   └── textExtract.service.js
│   └── utils/
│       ├── dateParser.js
│       └── validators.js
├── .env
└── package.json

lambda/
└── push-consumer/
    ├── index.mjs                 # SNS → web-push delivery handler
    ├── package.json              # web-push, mongoose
    └── .env.example
```

---

## Components and Interfaces

### Frontend Component Tree

```
App
├── AuthProvider (context: user, token, login, logout)
├── Router
│   ├── /login          → <LoginPage>
│   ├── /dashboard      → <DashboardPage> [protected]
│   │   ├── <NotificationBanner>   (unread count badge + polling reminders every 30s)
│   │   ├── <UpcomingEvents>       (next 3 events)
│   │   ├── <NoticesFeed>          (recent notices + urgency badges + summaries)
│   │   ├── <StudyPlanWidget>      (active study plan preview)
│   │   └── <GuardianAIPanel>      (on-demand risk analysis, POST /guardian/analyze)
│   ├── /calendar       → <CalendarPage> [protected]
│   │   ├── <CalendarHeader>       (day/week/month toggle)
│   │   ├── <CalendarGrid>         (react-big-calendar, conflict highlights)
│   │   └── <EventModal>           (create/edit form)
│   ├── /notices        → <NoticesPage> [protected]
│   │   ├── <NoticeCard>           (urgency badge + category tag + summary + "View full")
│   │   └── <AddToCalendarPrompt>  (rendered if extractedDate present)
│   ├── /notifications  → <NotificationsPage> [protected]
│   │   ├── <NotificationList>     (paginated, newest first, read/unread state)
│   │   └── <MarkAllReadButton>    (PATCH /notifications/read-all)
│   ├── /study-plan     → <StudyPlanPage> [protected]
│   │   ├── <StudyPlanForm>        (subjects, examDates, dailyHours)
│   │   └── <StudyPlanTimeline>    (day-by-day time blocks)
│   ├── /chat           → <ChatPage> [protected]
│   │   ├── <MessageList>
│   │   └── <ChatInput>            (character counter, Enter to send)
│   └── /admin          → <AdminPage> [admin role only]
│       └── <NoticeUploadForm>
└── <ToastNotifications>  (global)
```

### Key Component Behaviours

**`<CalendarGrid>`**
- Library: `react-big-calendar` with `date-fns` localizer
- Conflict detection computed client-side after fetching events (O(n²) over visible range)
- Overlapping events rendered with `className="bg-red-100 border-red-500"` + warning icon

**`<NotificationBanner>`**
- Polls `GET /api/reminders/pending` every 30 seconds via `setInterval`
- Sticky banner per pending reminder on Dashboard
- Dismiss button calls `PATCH /api/reminders/:id/dismiss` and removes the banner immediately

**`<StudyPlanTimeline>`**
- Sessions grouped by date, rendered as vertical timeline
- Subject color derived from deterministic hash → Tailwind color class

**`<ChatInput>`**
- Live character counter: `500 - value.length` remaining
- Enter submits; Shift+Enter inserts newline
- History stored in `sessionStorage` key `cf_chat_history`; cleared on logout

**`<NoticeUploadForm>` (Admin)**
- `accept=".pdf,.png,.jpg,.jpeg,.txt"` on file input
- Client-side pre-check: size ≤ 10 MB before sending
- Upload progress bar via `axios` `onUploadProgress`

### API Client

```js
// src/api/client.js
import axios from 'axios';

const client = axios.create({ baseURL: import.meta.env.VITE_API_URL });

client.interceptors.request.use(config => {
  const token = localStorage.getItem('cf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cf_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
```

### Auth Middleware

```js
// src/middleware/auth.js
import jwt from 'jsonwebtoken';

export const verifyJWT = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required' });
  }
};

export const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role)
    return res.status(403).json({ error: 'Access denied' });
  next();
};
```

### REST API Endpoints

Base path: `/api` — all protected routes require `Authorization: Bearer <JWT>`

#### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register student account |
| `POST` | `/auth/login` | Public | Authenticate; receive JWT |

`POST /auth/register` — `{ email, password, name }` → `201 { userId, email, role }` / `400` / `409`  
`POST /auth/login` — `{ email, password }` → `200 { token, expiresIn: 28800, user }` / `401`

#### Notices

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/notices` | Admin JWT | Upload a notice file (multipart) |
| `GET` | `/notices` | Student JWT | List active notices (paginated) |
| `GET` | `/notices/:id` | Student JWT | Notice detail + summary + pre-signed S3 URL |

#### Events

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/events` | Student JWT | Create event |
| `GET` | `/events` | Student JWT | List events (`?from=&to=` ISO 8601) |
| `PUT` | `/events/:id` | Student JWT | Edit event (owner only) |
| `DELETE` | `/events/:id` | Student JWT | Delete event (owner only) |

#### Study Plans

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/studyplans/generate` | Student JWT | Generate new study plan via Bedrock |
| `GET` | `/studyplans/active` | Student JWT | Fetch active study plan |
| `GET` | `/studyplans/history` | Student JWT | Last 5 archived plans (7-day window) |

`POST /studyplans/generate` — `{ subjects[], examDates[], dailyHours }` → `201 { studyPlan }` / `400` / `504`

#### Chatbot

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/chat/message` | Student JWT | Send message; receive AI reply |

`POST /chat/message` — `{ message: string, history: [{ role, content }] }` → `200 { reply }` / `400` / `503`

> History is maintained client-side (sessionStorage). The server is stateless per request.

#### Reminders

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/reminders/pending` | Student JWT | Poll undismissed reminders |
| `PATCH` | `/reminders/:id/dismiss` | Student JWT | Dismiss a reminder |

#### Guardian AI Route

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/guardian/analyze` | Student JWT | Run on-demand Guardian AI risk analysis |

`POST /guardian/analyze` — no body required; uses `req.user.userId` to fetch context → `200 { report }` / `503`

#### Push Subscription Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/push/subscribe` | Student JWT | Store browser PushSubscription in MongoDB |
| `POST` | `/push/unsubscribe` | Student JWT | Delete Student's PushSubscription |
| `GET` | `/push/vapid-public-key` | Public | Return VAPID public key for client subscription |

`POST /push/subscribe` — `{ subscription: PushSubscriptionJSON }` → `201 { success: true }` / `400`

#### Notification Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/notifications` | Student JWT | List notifications, paginated, sorted newest first |
| `PATCH` | `/notifications/:id/read` | Student JWT | Mark single notification as read |
| `PATCH` | `/notifications/read-all` | Student JWT | Mark all unread notifications as read |
| `GET` | `/notifications/unread-count` | Student JWT | Return count of unread notifications |

`GET /notifications` — `?page=1&limit=20` → `200 { notifications: [...], total, unreadCount }`

---

### Notification Architecture

#### Event Flow

```
Express Server (reminder fires OR Guardian AI detects risk)
    │
    ├─► Persist Notification document in MongoDB
    │
    ├─► SNSClient.publish({ TopicArn, Message: JSON.stringify(payload) })
    │         where payload = { userId, alertType, severity, title,
    │                           shortMessage, detailedReason,
    │                           recommendedAction, deadline }
    │
SNS Topic: campusflow-notifications
    │
    └─► Lambda subscription (campusflow-push-consumer)
              │
              ├─► Parse SNS event body
              ├─► MongoDB: find PushSubscriptions where userId = payload.userId
              ├─► For each subscription:
              │     webpush.sendNotification(subscription, JSON.stringify({
              │       title, body: shortMessage, data: { url: '/notifications' }
              │     }))
              │
              ├─► On 410/404 response: delete stale subscription from MongoDB
              └─► Log result
```

#### When Push Events Are Sent

| Trigger | Severity | SNS Published | alertType |
|---|---|---|---|
| Exam/assignment event within 72 hours | critical | Yes | `deadline_72h` |
| 24h reminder fires | high | Yes | `reminder_24h` |
| 1h reminder fires | critical | Yes | `reminder_1h` |
| Guardian AI: missed deadline risk | critical | Yes | `guardian_risk` |
| Guardian AI: exam prep gap < 48h | high | Yes | `guardian_risk` |
| Guardian AI: attendance risk | high | Yes | `guardian_risk` |
| Guardian AI: placement deadline | high | Yes | `guardian_risk` |
| Guardian AI: overloaded week | medium | No (in-app only) | `guardian_risk` |
| Guardian AI: opportunity (placement, event) | low | No (in-app only) | `guardian_opportunity` |
| New critical/high urgency notice uploaded | high | Yes | `notice_critical` |

#### 72-Hour Deadline Detection Flow

The 72h deadline check is a **separate node-cron schedule** that runs every 15 minutes (independent of the 1-min reminder scheduler). It is implemented in `reminder.scheduler.js` alongside `startScheduler()`.

```
node-cron (runs every 15 minutes)
    │
    ├─► Query Events where:
    │       type IN ["exam", "assignment"]
    │       AND startTime BETWEEN (now + 1h) AND (now + 72h)
    │       AND userId valid (student account)
    │
    ├─► For each matched Event:
    │     ├─► Check: does a Notification document already exist where
    │     │         { userId, eventId (via deadline field match), alertType: "deadline_72h" }?
    │     │
    │     ├─► IF no existing Notification:
    │     │     ├─► Create Notification document { alertType:"deadline_72h", severity:"critical",
    │     │     │       title, shortMessage, detailedReason, deadline: event.startTime }
    │     │     └─► Call sns.publishNotification(payload)
    │     │
    │     └─► IF Notification already exists: SKIP (deduplication guard)
    │
    └─► Log results
```

**Deduplication rule:** The 72h Notification is keyed on `{ userId, eventId ref in deadline field, alertType: "deadline_72h" }`. Because the same event will later trigger a 24h reminder (`reminder_24h`), the two Notification documents have different `alertType` values and are treated as distinct records — no collision occurs.

**Guardian AI alert SNS publish flow:**

When `runGuardianAnalysis()` returns alerts, the Guardian AI route (`POST /api/guardian/analyze`) evaluates each alert:

```
Guardian AI route handler
    │
    ├─► For each alert in report.alerts where severity IN ["critical", "high"]:
    │     ├─► Determine alertType:
    │     │     - "attendance" context  → alertType: "guardian_risk"
    │     │     - "placement" context   → alertType: "guardian_risk"
    │     │     - other risk            → alertType: "guardian_risk"
    │     │     - opportunity           → alertType: "guardian_opportunity" (no SNS)
    │     │
    │     ├─► Create Notification document in MongoDB
    │     └─► IF severity === "critical" || "high":
    │           Call sns.publishNotification(payload)
    │
    └─► Return report to client
```

**Failure handling for 72h detection:**

| Failure | Behaviour |
|---|---|
| SNS publish fails (72h) | Log error; Notification document already persisted; skip retry |
| MongoDB query fails in cron | Log error; skip this cron run; retry on next 15-min tick |
| Event deleted after 72h notification sent | Notification document remains in history (read-only); no further SNS publish |

#### Service Worker (`public/sw.js`)

```js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'CampusFlow AI', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: { url: data.data?.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

#### Lambda Function Structure

```
lambda/
└── push-consumer/
    ├── index.mjs           # handler: parse SNS, fetch subs, call web-push
    ├── package.json        # dependencies: web-push, mongoose
    └── .env                # MONGODB_URI, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
```

Lambda is deployed as a ZIP package. SNS triggers it via a subscription on the `campusflow-notifications` topic.

---

### AWS Service Interfaces

#### S3 Service (`src/services/s3.service.js`)

```js
uploadFile(buffer, mimeType, originalName) → Promise<s3Key: string>
getPresignedUrl(s3Key)                     → Promise<url: string>  // expires 15 min
deleteFile(s3Key)                          → Promise<void>
```

#### SNS Service (`src/services/sns.service.js`)

```js
publishNotification(payload) → Promise<messageId: string>
  // payload: { userId, alertType, severity, title, shortMessage,
  //            detailedReason, recommendedAction, deadline }
  // Publishes to SNS_TOPIC_ARN; only called for critical/high severity
```

#### Bedrock Service (`src/services/bedrock.service.js`)

```js
summarizeNotice(text: string)                             → Promise<summary: string>
analyzeNotice(text: string)                               → Promise<NoticeAnalysis>
  // NoticeAnalysis: { title, summary, deadlines: Date[], actions: string[],
  //                   urgency: 'critical'|'high'|'medium'|'low', category: string }
generateStudyPlan({ subjects, examDates, dailyHours,
                    blockedSlots })                       → Promise<sessions[]>
chatWithAssistant(message: string, history: Message[])   → Promise<reply: string>
runGuardianAnalysis({ events, studyPlan, notices })       → Promise<GuardianReport>
  // GuardianReport: { alerts: Alert[], dailyPlan: string, opportunities: string[],
  //                   onTrack: boolean, summary: string }
```

Model: `anthropic.claude-3-haiku-20240307-v1:0` (Messages API via Bedrock Runtime)

#### Reminder Scheduler (`src/services/reminder.scheduler.js`)

```js
startScheduler() → void
// Registers a node-cron job: cron.schedule('* * * * *', ...)
// Upserts Reminder documents for events within the 24h and 1h trigger windows
```

### Required IAM Permissions

```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/notices/*"
    },
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
    },
    {
      "Effect": "Allow",
      "Action": ["sns:Publish"],
      "Resource": "arn:aws:sns:us-east-1:YOUR_ACCOUNT_ID:campusflow-notifications"
    }
  ]
}
```

Lambda execution role also needs:
- `sns:Subscribe`, `sns:Receive` on the same topic
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` for CloudWatch

### Updated Environment Variables

```env
# server/.env — additions to existing vars
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:YOUR_ACCOUNT_ID:campusflow-notifications
VAPID_PUBLIC_KEY=<generated with web-push generate-vapid-keys>
VAPID_PRIVATE_KEY=<generated with web-push generate-vapid-keys>
VAPID_EMAIL=mailto:admin@campusflow.com
```

```env
# lambda/push-consumer/.env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/campusflow
VAPID_PUBLIC_KEY=<same as server>
VAPID_PRIVATE_KEY=<same as server>
VAPID_EMAIL=mailto:admin@campusflow.com
```

---

## Data Models

### `users`

```js
{
  _id:          ObjectId,
  email:        String,       // unique, RFC 5322; index: { email: 1 } unique
  passwordHash: String,       // bcrypt cost factor 12
  role:         String,       // "student" | "administrator"
  name:         String,
  createdAt:    Date,
  updatedAt:    Date
}
```

### `notices`

```js
{
  _id:           ObjectId,
  uploadedBy:    ObjectId,    // ref: users._id
  fileName:      String,      // unique among status != "archived"
  s3Key:         String,
  mimeType:      String,      // "application/pdf" | "image/png" | "image/jpeg" | "text/plain"
  sizeBytes:     Number,
  status:        String,      // "uploaded" | "summarized" | "summary_failed" | "archived"
  // AI-generated fields (populated by analyzeNotice pipeline)
  title:         String,      // ≤10 words; null until generated
  summary:       String,      // ≤150 words; null until generated
  summaryLang:   String,      // ISO 639-1, e.g. "en"
  deadlines:     [Date],      // dates extracted from notice text
  actions:       [String],    // action items extracted from notice text
  urgency:       String,      // "critical" | "high" | "medium" | "low" | "unknown"
  category:      String,      // "academic" | "event" | "administrative" | "placement" | "unknown"
  retryCount:    Number,      // summarization attempts (max 3)
  extractedDate: Date,        // first parseable date; used for "Add to Calendar" prompt
  uploadedAt:    Date,
  archivedAt:    Date,        // set at 90-day expiry
  updatedAt:     Date
}
// Indexes: { fileName: 1, status: 1 }, { uploadedAt: 1 }, { urgency: 1, uploadedAt: -1 }
```

### `events`

```js
{
  _id:            ObjectId,
  userId:         ObjectId,   // ref: users._id
  title:          String,     // max 100 chars
  type:           String,     // "exam" | "assignment" | "class" | "extracurricular"
  startTime:      Date,
  endTime:        Date,
  isBlocked:      Boolean,    // true = blocked from study plan scheduling
  sourceNoticeId: ObjectId,   // nullable; set if created from a notice
  createdAt:      Date,
  updatedAt:      Date
}
// Indexes: { userId: 1, startTime: 1 }, { userId: 1, type: 1 }
```

### `reminders`

```js
{
  _id:         ObjectId,
  userId:      ObjectId,      // ref: users._id
  eventId:     ObjectId,      // ref: events._id
  triggerType: String,        // "24h" | "1h"
  scheduledAt: Date,
  firedAt:     Date,          // null until delivered
  dismissed:   Boolean,       // default: false
  dismissedAt: Date,
  createdAt:   Date
}
// Indexes: { userId: 1, dismissed: 1 }, { scheduledAt: 1, firedAt: 1 }
```

### `studyplans`

```js
{
  _id:         ObjectId,
  userId:      ObjectId,      // ref: users._id
  status:      String,        // "active" | "archived"
  preferences: {
    subjects:   [String],     // up to 10
    examDates:  [Date],       // parallel array with subjects
    dailyHours: Number        // 0.5–16
  },
  sessions: [{                // AI-generated time blocks
    subject:      String,
    date:         Date,
    startTime:    String,     // "HH:mm"
    endTime:      String,     // "HH:mm"
    durationMins: Number
  }],
  generatedAt: Date,
  archivedAt:  Date,          // set when replaced by a new plan
  createdAt:   Date
}
// Index: { userId: 1, status: 1 }
```

### `notifications`

```js
{
  _id:               ObjectId,
  userId:            ObjectId,    // ref: users._id
  alertType:         String,      // "reminder_24h" | "reminder_1h" | "guardian_risk" |
                                  // "guardian_opportunity" | "notice_critical" | "deadline_72h"
  severity:          String,      // "critical" | "high" | "medium" | "low"
  title:             String,      // short heading, ≤60 chars
  shortMessage:      String,      // one-line summary for push/banner
  detailedReason:    String,      // full explanation shown in Notifications panel
  recommendedAction: String,      // what the student should do
  deadline:          Date,        // nullable; the relevant deadline
  read:              Boolean,     // default: false
  readAt:            Date,        // nullable
  snsMessageId:      String,      // SNS publish response MessageId; null if not published
  createdAt:         Date
}
// Indexes: { userId: 1, createdAt: -1 }, { userId: 1, read: 1 }
```

### `pushsubscriptions`

```js
{
  _id:      ObjectId,
  userId:   ObjectId,    // ref: users._id
  endpoint: String,      // browser push endpoint URL (unique per subscription)
  keys: {
    p256dh: String,      // browser-generated public key
    auth:   String,      // browser-generated auth secret
  },
  userAgent:   String,   // stored for debugging (browser/OS identifier)
  createdAt:   Date,
  lastUsedAt:  Date      // updated on each successful push delivery
}
// Indexes: { userId: 1 }, { endpoint: 1 } unique
```

---

## Error Handling

### API Error Response Shape

All error responses use a consistent JSON envelope:

```json
{ "error": "Human-readable message", "fields": ["fieldName"] }
```

`fields` is only included for validation errors (HTTP 400).

### HTTP Status Code Conventions

| Status | Meaning | Example |
|---|---|---|
| `400` | Validation or business rule failure | File too large, past exam date |
| `401` | Missing or expired JWT | Token not present or expired |
| `403` | Valid JWT but insufficient role | Student attempting admin upload |
| `404` | Resource not found | Notice or event ID doesn't exist |
| `409` | Unique constraint conflict | Duplicate email on registration |
| `503` | Upstream service unavailable | Bedrock unreachable |
| `504` | Upstream service timeout | Bedrock exceeded time limit |

### Bedrock Failure Strategy

| Operation | Timeout | Retry Policy | Fallback |
|---|---|---|---|
| Notice summarization | 30 s | 3 retries × 5 s delay | Display "Summary unavailable" label |
| Study plan generation | 15 s | None (user retries manually) | Preserve preferences; show error toast |
| Chatbot response | 10 s | None | Show "Assistant temporarily unavailable" |
| Guardian AI analysis | 20 s | None (user retries manually) | Return `503`; no partial data shown |
| Notice enhanced analysis (`analyzeNotice`) | 30 s | 3 retries × 5 s delay | `urgency="unknown"`, `category="unknown"`, preserve partial summary |

All Bedrock failures are logged server-side with `noticeId` / `userId` and timestamp for post-hackathon debugging.

### Global Express Error Handler

```js
// src/middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
};
```

### Frontend Error Handling

- Axios response interceptor handles 401 (auto-redirect to `/login`)
- All AI operations wrapped in try/catch; show inline error message + retry button
- `<ToastNotifications>` component for transient errors (file upload failure, network errors)
- Loading spinner shown during all async operations; disabled submit button to prevent double-submit

### Security

| Concern | Mitigation |
|---|---|
| Auth bypass | `verifyJWT` middleware on every protected route |
| Role escalation | `requireRole('administrator')` on all admin endpoints |
| XSS | React escapes by default; `DOMPurify` on any rendered HTML summary |
| Injection | Mongoose parameterized queries; Joi validation on all routes |
| Credential leak | AWS keys only in env vars / IAM role; never in frontend bundle |
| Password storage | bcrypt cost factor 12; plaintext never logged |
| User enumeration | Generic error on failed login: "Invalid email or password" |
| File upload abuse | MIME type + extension check server-side; 10 MB hard limit via `multer` |

### Security — Role Boundary and Data Isolation

The administrator and student roles have strictly separated resource access. This is not only enforced at the route level but must also be verified in integration tests.

**Role boundaries:**

| Role | Permitted resources | Prohibited resources |
|---|---|---|
| `administrator` | `POST /notices`, `GET /notices`, `GET /notices/:id`, `POST /auth/login` | `GET /events`, `PUT /events/:id`, `DELETE /events/:id`, `GET /reminders/pending`, `GET /studyplans/*`, `GET /notifications*`, `POST /chat/message`, `POST /guardian/analyze` |
| `student` | All student-facing routes listed above | `POST /notices` (upload) |

**Implementation rules:**

1. Every route that returns student-owned records (`events`, `reminders`, `studyplans`, `notifications`, `chat`) MUST include `verifyJWT` and MUST NOT be accessible with a JWT whose `role` claim is `"administrator"`. Use `requireRole('student')` middleware on these routes.
2. The `User.toJSON()` transform MUST strip `passwordHash` before any User document is included in any API response. This is the sole protection against hash exposure; it must not be bypassed by calling `.lean()` without explicitly projecting out `passwordHash`.
3. The administrator role has no read access to student calendar events, reminders, study plans, or notifications. There is no admin "view all students" endpoint in the MVP.

**Verification:** See Correctness Property 11 and Task 86 (admin isolation test).

---

## Correctness Properties

### Property 1: Reminder Idempotency
The reminder scheduler uses `updateOne` with `$setOnInsert` and `{ upsert: true }` keyed on `{ eventId, triggerType }`. Running the cron job multiple times within the same trigger window will not create duplicate reminders.

**Validates: Requirements 6.1, 6.2**

### Property 2: Dismissal Re-arm on Edit
When an event's `startTime` is updated, the corresponding reminder documents are deleted and re-created with recalculated `scheduledAt` values. This ensures a dismissed 24h reminder is re-armed correctly when the deadline shifts forward.

**Validates: Requirements 6.3, 6.6**

### Property 3: Study Plan Atomicity
If Bedrock fails during study plan generation, no new `StudyPlan` document is written and the previous active plan remains unchanged. The student's submitted preferences are returned in the error response so they can retry without re-entering data.

**Validates: Requirements 3.2, 3.8**

### Property 4: Study Plan History Cap
Before archiving a replaced plan, the system queries the count of existing archived plans for the user. If the count equals 5, the oldest archived plan (`archivedAt` ascending) is deleted before the new archive is written, maintaining the 5-plan cap.

**Validates: Requirements 3.7**

### Property 5: Notice Duplicate Guard
The duplicate-name check queries `{ fileName: req.body.originalName, status: { $ne: "archived" } }` so archived notices with the same name do not block new uploads.

**Validates: Requirements 1.7**

### Property 6: Calendar Conflict Detection (Client-Side)
After fetching events for the visible date range, the frontend runs an O(n²) overlap check. For each pair (A, B), a conflict exists if `A.startTime < B.endTime && A.endTime > B.startTime`. Both events are flagged with `hasConflict: true` in local state.

**Validates: Requirements 5.3**

### Property 7: Guardian AI Data Isolation
The Guardian AI analysis context is built exclusively from the requesting student's own events, study plan, and notices — never from other students' data. The query always scopes by `userId = req.user.userId` before passing data to Bedrock.

**Validates: Requirements 10.6**

### Property 8: Notice Analysis Fallback Integrity
If Bedrock's `analyzeNotice` call fails, the notice record is updated with `urgency = "unknown"` and `category = "unknown"` while the plain summary (if available from prior retry) is preserved. The notice remains visible and browsable — no fields are set to misleading values.

**Validates: Requirements 9.4**

### Property 9: SNS Publish Idempotency on Reminder Fire
The reminder scheduler upserts a Reminder document and then publishes to SNS only once per trigger event (keyed on `{ eventId, triggerType }`). Because Reminder creation is idempotent (Property 1), duplicate cron runs cannot result in duplicate SNS publishes for the same reminder.

**Validates: Requirements 11.1, 11.3**

### Property 10: Stale Subscription Cleanup
The Lambda consumer deletes a PushSubscription from MongoDB whenever the browser push endpoint returns HTTP 410 (Gone) or HTTP 404 (Not Found). This ensures the subscriber list stays accurate and future pushes are not wasted on dead endpoints.

**Validates: Requirements 12.4, 12.6**

### Property 11: Admin JWT Cannot Access Student-Owned Resources
All routes that return student-owned data (`/events`, `/reminders`, `/studyplans/*`, `/notifications*`, `/chat/message`, `/guardian/analyze`) carry `requireRole('student')` middleware. A valid JWT with `role: "administrator"` returns `403 { error: "Access denied" }` on any of these routes. No student email address, passwordHash, calendar event, or notification is ever returned in a response to an admin-role JWT.

**Validates: Requirements 8.6**

### Property 12: 72-Hour Deadline SNS Deduplication
The 15-minute cron checks for an existing Notification document before creating a new one for a given event's `deadline_72h` alert. Because `alertType` distinguishes `"deadline_72h"` from `"reminder_24h"`, the later 24h reminder does not collide with the earlier 72h notification — both are created as distinct documents with no duplicate SNS publish for the same trigger type.

**Validates: Requirements 11.2**

---

## Testing Strategy

For the 48-hour MVP, testing is focused on the highest-risk paths that could break the live demo.

### Manual Test Checklist (pre-demo)

| Area | Test |
|---|---|
| Auth | Register student → login → JWT in localStorage → protected route accessible |
| Auth | Unauthenticated request to `/api/events` returns 401 |
| Auth | Student JWT cannot POST to `/api/notices` (expect 403) |
| Notice Upload | Admin uploads PDF ≤ 10 MB → appears on Dashboard within 10 s |
| Notice Upload | Upload > 10 MB returns error message |
| Summarization | Uploaded PDF gets AI summary within 30 s |
| Summarization | Bedrock down → "Summary unavailable" shown; other features still work |
| Calendar | Create exam event → appears in day and week view |
| Calendar | Create two overlapping events → both show conflict highlight |
| Reminders | Create event 25 h from now → 24 h reminder appears on Dashboard after scheduler fires |
| Reminders | Dismiss reminder → does not reappear |
| Study Plan | Submit valid preferences → study plan rendered within 15 s |
| Chatbot | Ask academic question → response within 10 s |
| Chatbot | Ask off-topic question → polite decline |
| Chatbot | 10-message context maintained within session |
| Guardian AI | POST /guardian/analyze → report with alerts returned within 20 s |
| Guardian AI | Bedrock timeout → fallback error, no partial data shown |
| Notice Intelligence | Uploaded PDF → urgency badge and category tag appear within 30 s |
| Notice Intelligence | Notices sorted: critical notices appear before low-urgency notices |
| Push Subscription | Student grants permission → PushSubscription stored in MongoDB |
| Push Subscription | Student revokes permission → PushSubscription deleted |
| SNS + Lambda | 1h reminder fires → SNS published → Lambda receives → browser push delivered |
| SNS + Lambda | Stale subscription (410) → Lambda deletes PushSubscription document |
| Notifications panel | Notification history shows correct read/unread state |
| Notifications panel | "Mark all as read" → all notifications flipped to read, badge clears |

### Automated Tests (stretch goal if time permits)

- `auth.routes.test.js` — register, login, JWT expiry, duplicate email
- `notice.routes.test.js` — file upload validation, role guard
- `reminder.scheduler.test.js` — upsert idempotency, window boundary

Framework: Jest + Supertest

---

## MVP Build Order (48-Hour Sprint)

| Hours | Person A | Person B |
|---|---|---|
| 0–4 | Scaffold Express, Mongoose, AWS clients, `.env` | Scaffold Vite React, Tailwind, routing, AuthContext |
| 4–10 | Auth routes + User model + JWT middleware | Event routes + Event model |
| 10–14 | Login / Register pages | CalendarPage + EventModal |
| 14–20 | Notice upload route + S3 service | Bedrock summarization + async post-upload trigger |
| 20–24 | NoticesPage + NoticeCard + AdminPage | Study plan route + Bedrock study plan prompt |
| 24–28 | StudyPlanPage + StudyPlanTimeline | Chat route + Bedrock chat service |
| 28–32 | ChatPage + session history | Reminder scheduler + reminder routes |
| 32–36 | NotificationBanner + polling | Dashboard assembly |
| 36–42 | Integration testing + bug fixes (together) | |
| 42–46 | Tailwind polish + responsive checks | Seed demo data + Lighthouse audit |
| 46–48 | Deploy + demo rehearsal (together) | |
