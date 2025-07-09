const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { decrypt } = require('../utils/cryptoUtil'); // Ensure this path is correct

const sesClient = new SESClient({});
const ADMIN_EMAIL = process.env.HR_ADMIN_EMAIL;
const SENDER_EMAIL = process.env.HR_ADMIN_EMAIL; // Must be SES-verified

exports.handler = async (event) => {
  console.log('Received SQS event for admin update notification:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      if (message.type !== 'UPDATE') {
        console.log('Skipping non-UPDATE message:', message.type);
        continue;
      }

      const employeeId = message.employeeId;
      const decryptedFirstName = decrypt(message.firstName || '');
      const decryptedLastName = decrypt(message.lastName || '');

      const changedFields = message.changedFields || {};
      const fieldChanges = Object.entries(changedFields)
        .map(([field, { old, new: newVal }]) => {
          const oldDecrypted = decrypt(old || '');
          const newDecrypted = decrypt(newVal || '');
          return `- ${field}: "${oldDecrypted}" → "${newDecrypted}"`;
        })
        .join('\n');

      const emailBody = `Hello Admin,\n\nAn existing employee record has been updated.\n\nEmployee: ${decryptedFirstName} ${decryptedLastName}\nEmployee ID: ${employeeId}\n\nChanged Fields:\n${fieldChanges}\n\nThis is an automated notification.`;

      const emailParams = {
        Destination: { ToAddresses: [ADMIN_EMAIL] },
        Message: {
          Body: { Text: { Data: emailBody } },
          Subject: { Data: `Employee Updated: ${decryptedFirstName} ${decryptedLastName}` },
        },
        Source: SENDER_EMAIL,
      };

      console.log('Sending update notification email to admin...');
      await sesClient.send(new SendEmailCommand(emailParams));
      console.log(`Admin update notification sent to ${ADMIN_EMAIL}`);

    } catch (error) {
      console.error('Failed to process UPDATE message or send email:', error);
      throw error; // So SQS retries
    }
  }
};
