import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, isAwsConfigured } from '../config/aws.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'campusflow-notices';
const LOCAL_UPLOADS_DIR = path.resolve('uploads');

// Ensure local uploads directory exists for mock mode
if (!isAwsConfigured) {
  if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
    console.log(`Mock S3 Mode: Created local storage directory at: ${LOCAL_UPLOADS_DIR}`);
  }
}

/**
 * Uploads a file to S3 or locally if running in mock mode.
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - File mime type
 * @param {string} originalName - Original name of the uploaded file
 * @returns {Promise<string>} S3 key
 */
export const uploadFile = async (buffer, mimeType, originalName) => {
  const fileExt = path.extname(originalName);
  const cleanName = path.basename(originalName, fileExt).replace(/[^a-zA-Z0-9]/g, '_');
  const uuid = uuidv4();
  const s3Key = `notices/${uuid}-${cleanName}${fileExt}`;

  if (!isAwsConfigured) {
    console.log(`Mock S3: Saving file ${originalName} to local directory`);
    const localPath = path.join(LOCAL_UPLOADS_DIR, `${uuid}-${cleanName}${fileExt}`);
    await fs.promises.writeFile(localPath, buffer);
    return s3Key;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: buffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
  return s3Key;
};

/**
 * Generates a pre-signed URL to read the notice file.
 * @param {string} s3Key - Notice file key
 * @returns {Promise<string>} File URL
 */
export const getPresignedUrl = async (s3Key) => {
  if (!isAwsConfigured) {
    const fileName = s3Key.replace('notices/', '');
    const port = process.env.PORT || 4000;
    return `http://localhost:${port}/uploads/${fileName}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  // Expire in 15 minutes (900 seconds)
  return await getSignedUrl(s3Client, command, { expiresIn: 900 });
};

/**
 * Deletes a file from S3 or locally if in mock mode.
 * @param {string} s3Key - S3 key to delete
 * @returns {Promise<void>}
 */
export const deleteFile = async (s3Key) => {
  if (!isAwsConfigured) {
    const fileName = s3Key.replace('notices/', '');
    const localPath = path.join(LOCAL_UPLOADS_DIR, fileName);
    if (fs.existsSync(localPath)) {
      await fs.promises.unlink(localPath);
      console.log(`Mock S3: Deleted local file ${fileName}`);
    }
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  await s3Client.send(command);
};

/**
 * Retrieves a file as a Buffer from S3 or local directory.
 * @param {string} s3Key - Notice file key
 * @returns {Promise<Buffer>} File contents as buffer
 */
export const getFile = async (s3Key) => {
  if (!isAwsConfigured) {
    const fileName = s3Key.replace('notices/', '');
    const localPath = path.join(LOCAL_UPLOADS_DIR, fileName);
    return await fs.promises.readFile(localPath);
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  const response = await s3Client.send(command);
  const streamToBuffer = (stream) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });

  return await streamToBuffer(response.Body);
};
