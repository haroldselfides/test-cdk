const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { decrypt } = require('../utils/cryptoUtil');// use your actual decrypt path
require('dotenv').config();

const sesClient = new SESClient({ region: 'ap-northeast-1' });

exports.handler = async (event) => {
  console.log(' Received event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      console.log(' Parsed message:', message);

      const decryptedEmail = decrypt(message.email, process.env.AES_SECRET_KEY);
      const decryptedFirstName = decrypt(message.firstName, process.env.AES_SECRET_KEY);

      const params = {
        Destination: { ToAddresses: [decryptedEmail] },
        Message: {
          Body: {
            Text: {
              Data: `Hello ${decryptedFirstName || 'Employee'}, welcome to the company!`,
            },
          },
          Subject: {
            Data: `Welcome, ${decryptedFirstName || 'Employee'}`,
          },
        },
        Source: process.env.HR_ADMIN_EMAIL,
      };

      console.log(' Sending email with params:', params);

      const result = await sesClient.send(new SendEmailCommand(params));
      console.log(' Email sent!', result);
    } catch (error) {
      console.error(' Failed to send email:', error);
    }
  }
};
