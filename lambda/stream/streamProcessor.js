const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const ddbClient = new DynamoDBClient({});
const sqsClient = new SQSClient({});

const QUEUE_URL = process.env.EMPLOYEE_NOTIFICATION_QUEUE_URL;
const TABLE_NAME = process.env.TEST_TABLE_NAME;

exports.handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') continue;

    const newImage = unmarshall(record.dynamodb.NewImage);
    // We are interested in the initial PERSONAL_DATA record insert
    if (newImage.SK !== 'SECTION#PERSONAL_DATA') continue;

    const employeeId = newImage.PK; // PK is 'EMPLOYEE#<uuid>'

    try {
      // Get contact info (contains email)
      const contactInfoResult = await ddbClient.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: { S: employeeId },
          SK: { S: 'SECTION#CONTACT_INFO' },
        },
      }));
      const contactData = contactInfoResult.Item ? unmarshall(contactInfoResult.Item) : {};
      const email = contactData.email || 'no-email@example.com';

      // --- NEW: Get contract details for more robust welcome email ---
      const contractDetailsResult = await ddbClient.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: { S: employeeId },
          SK: { S: 'SECTION#CONTRACT_DETAILS' },
        },
      }));
      const contractData = contractDetailsResult.Item ? unmarshall(contractDetailsResult.Item) : {};

      const payload = {
        type: 'WELCOME',
        employeeId,
        firstName: newImage.firstName,
        lastName: newImage.lastName,
        // Using 'role' from contract details for more accuracy
        role: contractData.role || '',
        department: contractData.department || '',
        jobLevel: contractData.jobLevel || '',
        email,
      };

      console.log('Sending SQS message with payload:', JSON.stringify(payload));
      await sqsClient.send(new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(payload),
      }));
      console.log(`SQS message sent for employee ID: ${employeeId}`);

    } catch (err) {
      console.error('Error processing stream record for employee ID:', employeeId, err);
      // Depending on your error handling strategy, you might re-throw to trigger a retry
      // or implement DLQ for this Lambda
    }
  }
};