import { connectDB, disconnectDB } from './src/config/db.js';
import Notice from './src/models/Notice.js';

const run = async () => {
  await connectDB();
  const notices = await Notice.find({});
  console.log('--- ALL NOTICES IN DB ---');
  notices.forEach(n => {
    console.log({
      id: n._id,
      fileName: n.fileName,
      status: n.status,
      urgency: n.urgency,
      category: n.category,
      summary: n.summary,
      extractedDate: n.extractedDate
    });
  });
  await disconnectDB();
  process.exit(0);
};

run();
