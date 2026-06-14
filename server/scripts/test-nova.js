import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

console.log("MODEL_ID =", MODEL_ID);
console.log("AWS_REGION =", AWS_REGION);

const bedrockClient = new BedrockRuntimeClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

async function run() {
  console.log('Preparing payload for Amazon Nova Lite...');
  const payload = {
    schemaVersion: "messages-v1",
    messages: [
      {
        role: "user",
        content: [
          {
            text: "Respond with SUCCESS"
          }
        ]
      }
    ],
    inferenceConfig: {
      maxTokens: 50,
      temperature: 0.1
    }
  };

  try {
    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });

    console.log('Sending request to Amazon Bedrock...');
    const response = await bedrockClient.send(command);
    
    const rawBody = new TextDecoder().decode(response.body);
    console.log('--- RAW RESPONSE BODY ---');
    console.log(rawBody);
    console.log('-------------------------');

    const parsed = JSON.parse(rawBody);
    console.log('Parsed Response Output Text:');
    if (parsed.output?.message?.content?.[0]?.text) {
      console.log(parsed.output.message.content[0].text);
    } else {
      console.log('No text output found in parsed body:', JSON.stringify(parsed));
    }
  } catch (error) {
    console.error('Test invocation failed with error:', error);
  }
}

run();
