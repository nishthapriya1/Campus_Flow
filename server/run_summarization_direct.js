import { connectDB, disconnectDB } from './src/config/db.js';
import Notice from './src/models/Notice.js';
import User from './src/models/User.js';
import { runSummarization } from './src/services/summarize.service.js';

const run = async () => {
  await connectDB();
  const admin = await User.findOne({ role: 'administrator' });
  if (!admin) {
    console.error('No admin found.');
    await disconnectDB();
    process.exit(1);
  }

  const notice = new Notice({
    uploadedBy: admin._id,
    fileName: 'test_direct_notice.txt',
    s3Key: 'notices/test_direct.txt',
    mimeType: 'text/plain',
    sizeBytes: 100,
    status: 'uploaded',
  });
  await notice.save();

  console.log(`Created notice ${notice._id}. Running pipeline...`);
  try {
    await runSummarization(notice._id);
    console.log('Pipeline finished.');
    const updated = await Notice.findById(notice._id);
    console.log('Updated Notice:', {
      id: updated._id,
      status: updated.status,
      summary: updated.summary,
      retryCount: updated.retryCount
    });
  } catch (err) {
    console.error('Pipeline threw error:', err);
  }

  await disconnectDB();
  process.exit(0);
};

run();
