import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Notice from '../src/models/Notice.js';
import User from '../src/models/User.js';
import { uploadFile } from '../src/services/s3.service.js';
import { runSummarization } from '../src/services/summarize.service.js';

dotenv.config();

const PDF_PATH = '/Users/ayushsingh/Desktop/imp folders/Notice_EC319_Date_Changed.pdf';

const run = async () => {
  try {
    await connectDB();
    console.log('✔ Connected to MongoDB.');

    const admin = await User.findOne({ role: 'administrator' });
    if (!admin) {
      console.error('No admin found.');
      await disconnectDB();
      process.exit(1);
    }

    if (!fs.existsSync(PDF_PATH)) {
      console.error(`PDF file not found at path: ${PDF_PATH}`);
      await disconnectDB();
      process.exit(1);
    }

    const fileContent = fs.readFileSync(PDF_PATH);
    const fileName = `Notice_EC319_Date_Changed_${Date.now()}.pdf`;
    const mimeType = 'application/pdf';

    console.log('1. Uploading PDF to S3...');
    const s3Key = await uploadFile(fileContent, mimeType, fileName);
    console.log(`✔ S3 Key: ${s3Key}`);

    console.log('2. Creating Notice database record...');
    const notice = new Notice({
      uploadedBy: admin._id,
      fileName,
      s3Key,
      mimeType,
      sizeBytes: fileContent.length,
      status: 'uploaded',
    });
    await notice.save();
    console.log(`✔ Notice ID: ${notice._id}`);

    console.log('3. Triggering async notice summarization pipeline...');
    await runSummarization(notice._id);

    console.log('4. Verifying Notice update...');
    const updated = await Notice.findById(notice._id);
    console.log('--- Notice Results ---');
    console.log('File Name:', updated.fileName);
    console.log('Status:', updated.status);
    console.log('Title:', updated.title);
    console.log('Summary:', updated.summary);
    console.log('Urgency:', updated.urgency);
    console.log('Category:', updated.category);
    console.log('Deadlines:', updated.deadlines);
    console.log('Actions:', updated.actions);
    console.log('----------------------');

    if (updated.status === 'summarized') {
      console.log('✔ SUCCESS: Notice E2E pipeline completed successfully (status is summarized).');
    } else {
      console.error(`❌ FAIL: Notice pipeline failed. Status: ${updated.status}`);
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('Error during E2E verification:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
    console.log('Disconnected from MongoDB.');
    process.exit();
  }
};

run();
