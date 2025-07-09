
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
    if (newImage.SK !== 'SECTION#PERSONAL_DATA') continue;

    const employeeId = newImage.PK;

    try {
      // Get contact info (contains email)
      const contactInfo = await ddbClient.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: { S: employeeId },
          SK: { S: 'SECTION#CONTACT_INFO' },
        },
      }));

      const contactData = contactInfo.Item ? unmarshall(contactInfo.Item) : {};
      const email = contactData.email || 'no-email@example.com';

     const payload = {
      type: 'WELCOME',
      employeeId,
      firstName: newImage.firstName,
      lastName: newImage.lastName,
      position: newImage.positionTitle || '',
      email,
    };

      await sqsClient.send(new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(payload),
      }));

    } catch (err) {
      console.error('Error processing stream record:', err);
    }
  }
};
