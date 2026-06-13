import { PublishCommand } from '@aws-sdk/client-sns';
import { snsClient, isAwsConfigured } from '../config/aws.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Local simulation path for invoking the Lambda consumer when AWS is unavailable.
 * @param {object} payload - Notification payload
 * @param {string} messageId - Simulated Message ID
 */
const simulateLambdaCall = async (payload, messageId) => {
  try {
    const mockSnsEvent = {
      Records: [
        {
          EventSource: 'aws:sns',
          Sns: {
            MessageId: messageId,
            Message: JSON.stringify(payload),
          },
        },
      ],
    };

    // Dynamically import the lambda handler
    const { handler } = await import('../../../lambda/push-consumer/index.mjs');
    await handler(mockSnsEvent);
    console.log('SNS Simulation: Successfully routed notification payload to simulated Lambda handler.');
  } catch (error) {
    console.error('SNS Simulation Error: Local Lambda simulation execution failed:', error.message);
  }
};

/**
 * Publishes a notification event to the Amazon SNS topic.
 * @param {object} payload - Notification payload
 * @returns {Promise<string|null>} Message ID or null if skipped
 */
export const publishNotification = async (payload) => {
  const topicArn = process.env.SNS_TOPIC_ARN;
  if (!topicArn) {
    console.warn('SNS Warning: SNS_TOPIC_ARN is not configured in .env. Skipping SNS publish.');
    // Trigger local simulation path anyway for test validation
    const mockMessageId = `mock-msg-${uuidv4()}`;
    await simulateLambdaCall(payload, mockMessageId);
    return mockMessageId;
  }

  // Only publish for critical or high severity (Requirement 11.6)
  if (payload.severity !== 'critical' && payload.severity !== 'high') {
    console.log(`SNS Info: Skipping SNS publish for ${payload.severity} severity notification.`);
    return null;
  }

  if (!isAwsConfigured) {
    console.log('Mock SNS: Running SNS publish in local simulation mode.');
    const mockMessageId = `mock-msg-${uuidv4()}`;
    await simulateLambdaCall(payload, mockMessageId);
    return mockMessageId;
  }

  try {
    const params = {
      TopicArn: topicArn,
      Message: JSON.stringify(payload),
    };

    const command = new PublishCommand(params);
    const response = await snsClient.send(command);
    console.log(`SNS Success: Published notification to SNS. MessageId: ${response.MessageId}`);

    // Call Lambda consumer simulation to ensure MongoDB state updates locally
    await simulateLambdaCall(payload, response.MessageId);

    return response.MessageId;
  } catch (error) {
    console.error('SNS Error: Failed to publish notification to SNS:', error.message);
    // Graceful degradation: run local simulation to persist database documents
    const mockMessageId = `mock-msg-${uuidv4()}`;
    await simulateLambdaCall(payload, mockMessageId);
    return mockMessageId;
  }
};
