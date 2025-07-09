// lambda/stream/streamUpdateProcessor.js

const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const sqsClient = new SQSClient({});
const QUEUE_URL = process.env.EMPLOYEE_NOTIFICATION_QUEUE_URL;

exports.handler = async (event) => {
  console.log("Stream event received:", JSON.stringify(event, null, 2)); // Debug full event

  for (const record of event.Records) {
    console.log(`Processing record with eventName: ${record.eventName}`);

    if (record.eventName !== 'MODIFY') {
      console.log("Skipping non-MODIFY event.");
      continue;
    }

    const oldImage = unmarshall(record.dynamodb.OldImage);
    const newImage = unmarshall(record.dynamodb.NewImage);

    console.log("Old Image:", oldImage);
    console.log("New Image:", newImage);

    if (newImage.SK !== 'SECTION#PERSONAL_DATA') {
      console.log(`Skipping record with SK: ${newImage.SK}`);
      continue;
    }

    const changedFields = {};

    for (const key in newImage) {
      if (newImage[key] !== oldImage[key]) {
        changedFields[key] = {
          old: oldImage[key],
          new: newImage[key],
        };
      }
    }

    if (Object.keys(changedFields).length === 0) {
      console.log("No meaningful changes detected.");
      continue;
    }

    const payload = {
      type: 'UPDATE',
      employeeId: newImage.PK,
      firstName: newImage.firstName,
      lastName: newImage.lastName,
      email: '', // optional or can be fetched from CONTACT_INFO if needed
      changedFields,
    };

    console.log("Prepared payload for SQS:", payload);

    try {
      const response = await sqsClient.send(new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(payload),
      }));

      console.log("SQS message sent successfully:", response.MessageId);
    } catch (error) {
      console.error("Failed to send message to SQS:", error);
    }
  }
};
