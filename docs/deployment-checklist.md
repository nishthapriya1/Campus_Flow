# CampusFlow — Deployment Checklist

## Pre-Deployment

- [ ] AWS Account created with billing alerts set
- [ ] AWS CLI installed and configured locally
- [ ] MongoDB Atlas account created
- [ ] VAPID keys generated (`npx web-push generate-vapid-keys`)
- [ ] Strong JWT_SECRET generated (`openssl rand -hex 32`)

---

## Step 1: MongoDB Atlas Setup

- [ ] Create free M0 cluster (or M10 for production) in us-east-1
- [ ] Create database user with readWrite access
- [ ] Add `0.0.0.0/0` to IP Access List (hackathon) or specific IPs (production)
- [ ] Copy connection string
- [ ] Test connection: `mongosh "<connection-string>"`

---

## Step 2: AWS S3 Setup

- [ ] Create bucket `campusflow-notices` in us-east-1
- [ ] Enable "Block all public access"
- [ ] Configure CORS for your frontend domain
- [ ] Verify bucket exists: `aws s3 ls s3://campusflow-notices`

---

## Step 3: AWS Bedrock Setup

- [ ] Navigate to Bedrock console in us-east-1
- [ ] Request model access for `amazon.nova-lite-v1:0`
- [ ] Wait for access confirmation
- [ ] Test with AWS CLI: `aws bedrock-runtime invoke-model ...`

---

## Step 4: AWS SNS Setup

- [ ] Create topic `Campus_Flow_Notification`
- [ ] Note the Topic ARN
- [ ] Verify topic: `aws sns list-topics`

---

## Step 5: AWS Lambda Setup

- [ ] Create function `campusflow-push-consumer` (Node.js 20.x)
- [ ] Attach `CampusFlowLambdaRole` execution role
- [ ] Set environment variables (MONGODB_URI, VAPID keys)
- [ ] Deploy code from `lambda/push-consumer/`
- [ ] Subscribe Lambda to SNS topic
- [ ] Grant SNS invoke permission
- [ ] Test with sample SNS event

---

## Step 6: IAM Setup

- [ ] Create `CampusFlowAppRunnerPolicy` with Bedrock + S3 + SNS permissions
- [ ] Create IAM user `campusflow-apprunner` (or use App Runner instance role)
- [ ] Attach policy to user/role
- [ ] Generate access keys (if using IAM user approach)

---

## Step 7: Backend Deployment (App Runner)

- [ ] Option A: Connect GitHub repo directly to App Runner
  - [ ] Set source directory to `server`
  - [ ] Set build command: `npm install`
  - [ ] Set start command: `node src/index.js`
  - [ ] Set port: `4000`
- [ ] Option B: Build Docker image and push to ECR
  - [ ] `docker build -t campusflow-backend ./server`
  - [ ] Push to ECR
  - [ ] Create App Runner service from ECR image
- [ ] Configure all environment variables in App Runner console
- [ ] Set health check path to `/api/notices` (GET, any authenticated route will 401 which is fine)
- [ ] Deploy and verify service URL is accessible
- [ ] Test: `curl https://<app-runner-url>/api/auth/login` → should return 400 (no body)

---

## Step 8: Frontend Deployment (Amplify)

- [ ] Connect GitHub repository to Amplify
- [ ] Set framework: Vite
- [ ] Set base directory: `client`
- [ ] Set build command: `npm run build`
- [ ] Set output directory: `dist`
- [ ] Set environment variable: `VITE_API_URL=https://<app-runner-url>/api`
- [ ] Configure SPA rewrite rule: `/<*>` → `/index.html` (200)
- [ ] Deploy and verify frontend loads
- [ ] Test login with seeded credentials

---

## Step 9: Domain Setup (Optional)

- [ ] Register domain or use existing
- [ ] Add custom domain in Amplify console
- [ ] Configure DNS records (CNAME)
- [ ] Wait for SSL certificate provisioning
- [ ] Update CORS in App Runner to include custom domain
- [ ] Update S3 CORS to include custom domain

---

## Step 10: Final Verification

- [ ] Login as student → Dashboard loads
- [ ] Login as admin → Upload Notice page loads
- [ ] Upload a notice → File stored in S3, summary generated via Bedrock
- [ ] View notices as student → Summary displayed
- [ ] Create event → Calendar shows event
- [ ] Generate study plan → Bedrock returns plan
- [ ] Ask chatbot question → Response received
- [ ] Run Guardian AI → Risk analysis returned
- [ ] Enable push notifications → Subscription stored
- [ ] Trigger notification → Push received in browser
- [ ] Admin Previous Notices → List shows, delete works
- [ ] Refresh pages → No sample/demo data appears
- [ ] Test with multiple browser tabs → Real-time badge updates

---

## Post-Deployment

- [ ] Set up CloudWatch alarms for App Runner errors
- [ ] Set up billing alerts at $10, $50, $100 thresholds
- [ ] Restrict MongoDB IP access to App Runner IPs only
- [ ] Review and remove unused IAM permissions
- [ ] Document the deployed URLs for team reference
