# CampusFlow — AWS Setup Guide

## IAM Security Setup

### Create IAM User for App Runner

```bash
aws iam create-user --user-name campusflow-apprunner

aws iam create-policy --policy-name CampusFlowAppRunnerPolicy --policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockAccess",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0"
    },
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::campusflow-notices/*"
    },
    {
      "Sid": "SNSPublish",
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:us-east-1:*:Campus_Flow_Notification"
    }
  ]
}'

aws iam attach-user-policy \
  --user-name campusflow-apprunner \
  --policy-arn arn:aws:iam::<account-id>:policy/CampusFlowAppRunnerPolicy
```

### Create IAM Role for Lambda

```bash
aws iam create-role --role-name CampusFlowLambdaRole --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}'

aws iam attach-role-policy \
  --role-name CampusFlowLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

---

## S3 Bucket Setup

```bash
# Create bucket
aws s3 mb s3://campusflow-notices --region us-east-1

# Block public access
aws s3api put-public-access-block --bucket campusflow-notices --public-access-block-configuration '{
  "BlockPublicAcls": true,
  "IgnorePublicAcls": true,
  "BlockPublicPolicy": true,
  "RestrictPublicBuckets": true
}'

# Set CORS
aws s3api put-bucket-cors --bucket campusflow-notices --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT"],
      "AllowedOrigins": ["https://your-amplify-domain.amplifyapp.com"],
      "MaxAgeSeconds": 3000
    }
  ]
}'
```

---

## SNS Topic Setup

```bash
# Create topic
aws sns create-topic --name Campus_Flow_Notification --region us-east-1

# Note the ARN from output and set as SNS_TOPIC_ARN env var

# Subscribe Lambda to topic
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:<account-id>:Campus_Flow_Notification \
  --protocol lambda \
  --notification-endpoint arn:aws:lambda:us-east-1:<account-id>:function:campusflow-push-consumer

# Grant SNS permission to invoke Lambda
aws lambda add-permission \
  --function-name campusflow-push-consumer \
  --statement-id sns-trigger \
  --action lambda:InvokeFunction \
  --principal sns.amazonaws.com \
  --source-arn arn:aws:sns:us-east-1:<account-id>:Campus_Flow_Notification
```

---

## Bedrock Setup

1. Go to AWS Console → Bedrock → Model Access
2. Request access to **Amazon Nova Lite (amazon.nova-lite-v1:0)**
3. Wait for approval (usually instant for Amazon models)
4. Verify in us-east-1 region

---

## Lambda Deployment

```bash
cd lambda/push-consumer

# Install dependencies
npm install

# Package
zip -r function.zip . -x "node_modules/.cache/*"

# Create function
aws lambda create-function \
  --function-name campusflow-push-consumer \
  --runtime nodejs20.x \
  --role arn:aws:iam::<account-id>:role/CampusFlowLambdaRole \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment "Variables={MONGODB_URI=<your-uri>,VAPID_PUBLIC_KEY=<key>,VAPID_PRIVATE_KEY=<key>,VAPID_EMAIL=mailto:admin@campusflow.com}"

# Or update existing
aws lambda update-function-code \
  --function-name campusflow-push-consumer \
  --zip-file fileb://function.zip
```

---

## Troubleshooting Guide

### CORS Issues

**Symptom**: Frontend gets `Access-Control-Allow-Origin` errors

**Fix**:
1. Verify App Runner's Express CORS config includes your Amplify domain:
   ```js
   cors({ origin: ['https://your-app.amplifyapp.com'], credentials: true })
   ```
2. Verify S3 CORS allows your Amplify domain
3. Ensure no trailing slash on origin URLs

### MongoDB Connection Failures

**Symptom**: `MongoServerSelectionError: connection timed out`

**Fix**:
1. Check MongoDB Atlas Network Access → IP Access List
2. Add App Runner's outbound IP range (or `0.0.0.0/0` for hackathon)
3. Verify connection string has correct password (no special chars unescaped)
4. Ensure database user has `readWriteAnyDatabase` role

### Bedrock Permission Errors

**Symptom**: `AccessDeniedException` when calling InvokeModel

**Fix**:
1. Verify model access is granted in Bedrock console
2. Verify IAM policy includes correct model ARN
3. Verify AWS_REGION matches model region (us-east-1)
4. Verify credentials are set correctly in App Runner environment

### SNS Delivery Failures

**Symptom**: Notifications not reaching Lambda

**Fix**:
1. Verify Lambda has SNS trigger configured
2. Verify SNS subscription is `Confirmed` (check in SNS console)
3. Check Lambda CloudWatch logs for errors
4. Verify Lambda has permission to be invoked by SNS

### Amplify Build Failures

**Symptom**: Build fails during deployment

**Fix**:
1. Ensure `amplify.yml` specifies Node.js 20
2. Ensure base directory is `client`
3. Check that `VITE_API_URL` environment variable is set in Amplify console
4. Clear Amplify cache and rebuild

### App Runner Deployment Failures

**Symptom**: Service fails to start or health check fails

**Fix**:
1. Check App Runner logs in CloudWatch
2. Verify PORT is set to 4000
3. Verify all environment variables are configured
4. Add a health check endpoint: `GET /health` → 200
5. Ensure `node src/index.js` is the start command
6. Check MongoDB connectivity from App Runner's VPC
