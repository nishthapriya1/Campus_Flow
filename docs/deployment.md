# CampusFlow — AWS Deployment Guide

## Overview

CampusFlow is deployed as a multi-service architecture on AWS with MongoDB Atlas as the database layer.

| Component | AWS Service | Purpose |
|-----------|-------------|---------|
| Frontend | AWS Amplify Hosting | Static React SPA hosting with CDN |
| Backend | AWS App Runner | Containerized Node.js/Express API |
| Database | MongoDB Atlas | Document database (managed) |
| File Storage | AWS S3 | Notice file uploads |
| AI Engine | AWS Bedrock | Summarization, study plans, chatbot |
| Notifications | AWS SNS | Push notification event bus |
| Push Delivery | AWS Lambda | Web Push notification consumer |

---

## Environment Variables

### Backend (.env)

```env
NODE_ENV=production
PORT=4000

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/campusflow?retryWrites=true&w=majority

# JWT Authentication
JWT_SECRET=<generate-a-64-char-random-string>

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<app-runner-iam-access-key>
AWS_SECRET_ACCESS_KEY=<app-runner-iam-secret-key>

# AWS S3
S3_BUCKET_NAME=campusflow-notices

# AWS SNS
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:<account-id>:Campus_Flow_Notification

# AWS Bedrock
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0

# VAPID Keys (Web Push)
VAPID_PUBLIC_KEY=<your-vapid-public-key>
VAPID_PRIVATE_KEY=<your-vapid-private-key>
VAPID_EMAIL=mailto:admin@campusflow.com
```

### Frontend (.env)

```env
VITE_API_URL=https://<your-app-runner-url>
```

### Lambda (.env / Runtime Configuration)

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/campusflow?retryWrites=true&w=majority
VAPID_PUBLIC_KEY=<your-vapid-public-key>
VAPID_PRIVATE_KEY=<your-vapid-private-key>
VAPID_EMAIL=mailto:admin@campusflow.com
```

---

## Frontend Deployment (AWS Amplify)

### Build Settings

| Setting | Value |
|---------|-------|
| Framework | Vite + React |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js version | 20 |
| Base directory | `client` |

### Amplify Configuration

The `amplify.yml` at the repository root handles build configuration. Amplify auto-detects the React SPA and serves `index.html` for all routes (SPA fallback).

### Custom Rewrites (Amplify Console → Rewrites)

```json
[
  {
    "source": "/<*>",
    "target": "/index.html",
    "status": "200",
    "condition": null
  }
]
```

---

## Backend Deployment (AWS App Runner)

### Configuration

| Setting | Value |
|---------|-------|
| Source | Container (ECR) or Source Code (GitHub) |
| Runtime | Node.js 20 |
| Build command | `npm install` |
| Start command | `node src/index.js` |
| Port | 4000 |
| Health check path | `/api/auth/login` (POST, or add a GET /health endpoint) |
| Instance size | 1 vCPU, 2 GB RAM (hackathon) |
| Min instances | 1 |
| Max instances | 4 (production) |

### Source-Based Deployment (Recommended for Hackathon)

1. Connect GitHub repository to App Runner
2. Set source directory to `server`
3. Configure environment variables in App Runner console
4. Enable auto-deploy on push to main branch

### Container-Based Deployment (Production)

Use the provided `Dockerfile` to build and push to ECR, then configure App Runner to pull from ECR.

---

## AWS Bedrock Configuration

### Required Model Access

Request access to the following model in the AWS Bedrock console:
- **amazon.nova-lite-v1:0** (us-east-1)

### IAM Policy for Bedrock

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0"
    }
  ]
}
```

---

## AWS SNS Configuration

### Topic Setup

```bash
aws sns create-topic --name Campus_Flow_Notification --region us-east-1
```

### Lambda Subscription

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:<account-id>:Campus_Flow_Notification \
  --protocol lambda \
  --notification-endpoint arn:aws:lambda:us-east-1:<account-id>:function:campusflow-push-consumer
```

### IAM Policy for SNS Publish

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:us-east-1:<account-id>:Campus_Flow_Notification"
    }
  ]
}
```

---

## AWS S3 Configuration

### Bucket Structure

```
campusflow-notices/
├── notices/          # Uploaded notice files (PDF, PNG, JPG, TXT)
```

### Bucket Policy (Private with Pre-signed URL access)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::campusflow-notices/*",
      "Condition": {
        "Bool": { "aws:SecureTransport": "false" }
      }
    }
  ]
}
```

### IAM Policy for S3 Access

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::campusflow-notices/*"
    }
  ]
}
```

### CORS Configuration

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": ["https://your-amplify-domain.amplifyapp.com"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

---

## MongoDB Atlas Setup

### Cluster Configuration (Hackathon)

| Setting | Value |
|---------|-------|
| Tier | M0 (Free) or M10 (Production) |
| Provider | AWS |
| Region | us-east-1 |
| Database | campusflow |

### Network Access

1. Add App Runner outbound IPs to IP Access List
2. Or use `0.0.0.0/0` for hackathon (restrict for production)

### Connection String Format

```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/campusflow?retryWrites=true&w=majority
```

### Production Recommendations

- Enable M10+ tier for dedicated resources
- Enable backup snapshots
- Create database user with readWrite role only on `campusflow` database
- Enable audit logging

---

## Lambda Deployment (Push Consumer)

### Configuration

| Setting | Value |
|---------|-------|
| Runtime | Node.js 20.x |
| Handler | index.handler |
| Timeout | 30 seconds |
| Memory | 256 MB |
| Trigger | SNS (Campus_Flow_Notification topic) |

### Deployment

```bash
cd lambda/push-consumer
npm install
zip -r function.zip .
aws lambda update-function-code \
  --function-name campusflow-push-consumer \
  --zip-file fileb://function.zip
```

---

## Cost Estimation

### Hackathon Usage (1 week, light traffic)

| Service | Estimated Cost |
|---------|---------------|
| Amplify Hosting | $0 (free tier) |
| App Runner (1 instance) | ~$5 |
| MongoDB Atlas M0 | $0 (free tier) |
| S3 (< 1 GB) | $0.02 |
| Bedrock (Nova Lite) | ~$2-5 |
| SNS (< 1000 msgs) | $0 |
| Lambda (< 1M invocations) | $0 |
| **Total** | **~$5-10** |

### Small Production (monthly, ~500 users)

| Service | Estimated Cost |
|---------|---------------|
| Amplify Hosting | ~$5 |
| App Runner (1-2 instances) | ~$25-50 |
| MongoDB Atlas M10 | ~$57 |
| S3 (< 10 GB) | ~$0.25 |
| Bedrock (Nova Lite) | ~$20-50 |
| SNS (< 100K msgs) | ~$1 |
| Lambda | ~$1 |
| **Total** | **~$110-165/month** |
