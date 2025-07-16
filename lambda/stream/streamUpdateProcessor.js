// lambda/stream/streamUpdateProcessor.js

const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const sqsClient = new SQSClient({});
//  FIX: Use the specific environment variable for the update notification queue.
const QUEUE_URL = process.env.EMPLOYEE_UPDATE_NOTIFICATION_QUEUE_URL;

exports.handler = async (event) => {
  console.log("Stream event received for update processing:", JSON.stringify(event, null, 2));

  // Group changes by employee ID (PK) to send a single notification per transaction.
  const employeeChanges = {};

  for (const record of event.Records) {
    if (record.eventName !== 'MODIFY') {
      console.log(`Skipping non-MODIFY event: ${record.eventName}`);
      continue;
    }

    const oldImage = unmarshall(record.dynamodb.OldImage);
    const newImage = unmarshall(record.dynamodb.NewImage);
    const employeeId = newImage.PK;

    // Initialize if this is the first change for this employee in this batch
    if (!employeeChanges[employeeId]) {
      employeeChanges[employeeId] = {
        type: 'UPDATE',
        employeeId: employeeId,
        changedFields: {}
      };
    }
    
    // Compare fields and add any differences to the consolidated object
    for (const key in newImage) {
      if (key === 'PK' || key === 'SK') continue; // Ignore partition/sort keys

      if (newImage[key] !== oldImage[key]) {
        const section = newImage.SK.split('#')[1].toLowerCase().replace('_', ' '); // e.g., "personal data"
        employeeChanges[employeeId].changedFields[`${section}.${key}`] = {
          old: oldImage[key],
          new: newImage[key],
        };
      }
    }
  }

  // Loop over the consolidated changes and send one message per employee
  for (const employeeId in employeeChanges) {
    const changeData = employeeChanges[employeeId];

    if (Object.keys(changeData.changedFields).length === 0) {
      console.log(`No meaningful changes detected for employee ${employeeId}.`);
      continue;
    }

    console.log("Prepared consolidated payload for SQS:", changeData);

    try {
      await sqsClient.send(new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(changeData),
      }));
      console.log(`SQS message sent successfully for employee ${employeeId}.`);
    } catch (error) {
      console.error(`Failed to send SQS message for employee ${employeeId}:`, error);
      // Re-throw the error to ensure the batch is retried and eventually sent to the DLQ.
      throw error; 
    }
  }
};