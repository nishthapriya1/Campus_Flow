import { S3Client } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { SNSClient } from '@aws-sdk/client-sns';
import dotenv from 'dotenv';

dotenv.config();

export const isAwsConfigured = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.S3_BUCKET_NAME
);

if (!isAwsConfigured) {
  console.warn('AWS credentials or S3 bucket name not fully configured in .env. Running AWS operations in Mock Mode.');
}

const credentials = isAwsConfigured
  ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  : {
      accessKeyId: 'mock-access-key-id',
      secretAccessKey: 'mock-secret-access-key',
    };

const region = process.env.AWS_REGION || 'us-east-1';

export const s3Client = new S3Client({
  region,
  credentials,
});

export const bedrockClient = new BedrockRuntimeClient({
  region,
  credentials,
});

export const snsClient = new SNSClient({
  region,
  credentials,
});

