import mongoose from 'mongoose';

// Notification Schema definition to avoid needing to import the server model directly
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    alertType: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    shortMessage: {
      type: String,
      required: true,
    },
    detailedReason: {
      type: String,
      required: true,
    },
    recommendedAction: {
      type: String,
      required: true,
    },
    deadline: {
      type: Date,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
      required: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    snsMessageId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

let Notification;
try {
  Notification = mongoose.model('Notification');
} catch {
  Notification = mongoose.model('Notification', notificationSchema);
}

let cachedDb = null;

const connectToDatabase = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment.');
  }
  cachedDb = await mongoose.connect(uri);
  return cachedDb;
};

export const handler = async (event) => {
  console.log('Lambda triggered with event:', JSON.stringify(event));

  try {
    await connectToDatabase();

    const records = event.Records || [];
    for (const record of records) {
      if (record.EventSource === 'aws:sns' || record.eventSource === 'aws:sns' || record.Sns) {
        const snsMessage = record.Sns.Message;
        const messageId = record.Sns.MessageId;
        const payload = JSON.parse(snsMessage);

        console.log(`Processing SNS MessageId: ${messageId} for User: ${payload.userId}`);

        // Try to update existing notification created by server, or insert if none exists
        let notification = null;
        if (payload.notificationId) {
          notification = await Notification.findById(payload.notificationId);
        }

        if (notification) {
          // If already exists, update the snsMessageId
          notification.snsMessageId = messageId;
          await notification.save();
          console.log(`Notification document updated with snsMessageId: ${notification._id}`);
        } else {
          // Create Notification record (Requirement 11.5)
          notification = new Notification({
            userId: payload.userId,
            alertType: payload.alertType,
            severity: payload.severity,
            title: payload.title,
            shortMessage: payload.shortMessage,
            detailedReason: payload.detailedReason,
            recommendedAction: payload.recommendedAction,
            deadline: payload.deadline ? new Date(payload.deadline) : null,
            snsMessageId: messageId,
          });

          await notification.save();
          console.log(`Notification document created: ${notification._id}`);
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Processed successfully' }),
    };
  } catch (error) {
    console.error('Lambda processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
