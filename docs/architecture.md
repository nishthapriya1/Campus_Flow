# CampusFlow — AWS Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USERS (Browser)                             │
│                                                                      │
│  ┌──────────────┐    ┌───────────────┐    ┌─────────────────────┐   │
│  │ React SPA    │    │ Service Worker│    │ Push Notifications  │   │
│  │ (Vite Build) │    │ (sw.js)       │    │ (Browser API)       │   │
│  └──────┬───────┘    └───────────────┘    └─────────────────────┘   │
└─────────┼───────────────────────────────────────────────────────────┘
          │ HTTPS
          ▼
┌─────────────────────┐
│   AWS AMPLIFY       │
│   Static Hosting    │
│   + CloudFront CDN  │
│   (React Frontend)  │
└─────────────────────┘
          │ API Calls (HTTPS)
          ▼
┌─────────────────────┐         ┌──────────────────────┐
│   AWS APP RUNNER    │────────▶│   MONGODB ATLAS      │
│   (Node.js/Express) │         │   (Database)         │
│                     │         │                      │
│   - Auth Routes     │         │   Collections:       │
│   - Notice Routes   │         │   - users            │
│   - Event Routes    │         │   - notices          │
│   - Study Plan      │         │   - events           │
│   - Guardian AI     │         │   - studyplans       │
│   - Chat Routes     │         │   - notifications    │
│   - Notification    │         │   - attendances      │
│   - Attendance      │         │   - pushsubscriptions│
│   - Focus Zone      │         │   - focussessions    │
│   - Scheduling      │         │   - expenses         │
│   - Life Companion  │         │   - monthlybudgets   │
│   - Routine         │         └──────────────────────┘
│   - Push Subscribe  │
└────┬───────┬────┬───┘
     │       │    │
     ▼       ▼    ▼
┌────────┐ ┌──────────┐ ┌──────────────┐
│ AWS S3 │ │AWS       │ │ AWS SNS      │
│        │ │BEDROCK   │ │              │
│ Notice │ │          │ │ Topic:       │
│ Files  │ │ Nova     │ │ Campus_Flow_ │
│ (PDF,  │ │ Lite v1  │ │ Notification │
│ PNG,   │ │          │ │              │
│ JPG,   │ │ - Summary│ └──────┬───────┘
│ TXT)   │ │ - Study  │        │
│        │ │ - Chat   │        ▼
└────────┘ │ - Guardian│ ┌──────────────┐
           └──────────┘ │ AWS LAMBDA   │
                        │              │
                        │ push-consumer│
                        │              │
                        │ Reads Push   │
                        │ Subscriptions│
                        │ from MongoDB │
                        │              │
                        │ Sends Web    │
                        │ Push via     │
                        │ VAPID        │
                        └──────────────┘
```

## Data Flow

### Authentication Flow
```
Browser → Amplify → App Runner → MongoDB (User lookup + bcrypt verify)
                  ← JWT Token (8h expiry, contains userId, role, name)
```

### Notice Upload Flow
```
Admin Browser → App Runner (multer parse) → S3 (file upload)
                                           → MongoDB (notice record)
                                           → Bedrock (async summarization)
                                           → MongoDB (update summary)
```

### AI Request Flow (Study Plan / Chat / Guardian)
```
Student Browser → App Runner → Bedrock (InvokeModel)
                             → MongoDB (store result)
               ← Response
```

### Notification Flow
```
App Runner (scheduler/guardian) → SNS (publish event)
                                → Lambda (consume)
                                → MongoDB (lookup PushSubscriptions)
                                → Web Push Protocol → Browser Service Worker
```

### Student Data Flow
```
MongoDB → App Runner API → React Frontend
(events, study plans, attendance, notifications, notices)
```

## Security Architecture

```
┌───────────────────────────────────────────┐
│              IAM Roles                     │
├───────────────────────────────────────────┤
│ App Runner Role:                          │
│   - bedrock:InvokeModel                   │
│   - s3:PutObject, GetObject, DeleteObject │
│   - sns:Publish                           │
│                                           │
│ Lambda Role:                              │
│   - No AWS service access needed          │
│   - MongoDB connection via connection str │
│                                           │
│ Amplify Role:                             │
│   - Default Amplify service role          │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│           Network Security                 │
├───────────────────────────────────────────┤
│ - All traffic over HTTPS/TLS 1.2+        │
│ - S3 bucket: private, pre-signed URLs    │
│ - MongoDB: IP whitelist or VPC peering   │
│ - JWT auth on all API routes             │
│ - Role-based access (student/admin)      │
│ - CORS restricted to Amplify domain      │
└───────────────────────────────────────────┘
```
