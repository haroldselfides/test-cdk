const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { decrypt } = require('../utils/cryptoUtil'); // Ensure this path is correct

const sesClient = new SESClient({});
const ADMIN_EMAIL = process.env.HR_ADMIN_EMAIL;
const SENDER_EMAIL = process.env.HR_ADMIN_EMAIL; // Must be verified in SES

exports.handler = async (event) => {
  console.log('Received SQS event for SES notifier:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      console.log('Parsed message:', message);

      if (message.type === 'WELCOME') {
        const decryptedEmail = decrypt(message.email);
        const decryptedFirstName = decrypt(message.firstName);
        const decryptedLastName = decrypt(message.lastName);

        // === Send Welcome Email to Employee ===
        const welcomeEmailParams = {
          Destination: { ToAddresses: [decryptedEmail] },
          Message: {
            Body: {
              Text: {
                Data: `Dear ${decryptedFirstName},\n\nWelcome to the team! We're excited to have you on board. Your onboarding process begins soon.\n\nBest regards,\nHR Team`,
              },
            },
            Subject: {
              Data: `Welcome to the Company, ${decryptedFirstName}!`,
            },
          },
          Source: SENDER_EMAIL,
        };

        console.log('Sending welcome email to employee...');
        await sesClient.send(new SendEmailCommand(welcomeEmailParams));
        console.log(`Email sent to ${decryptedEmail}`);

        // === Optional: Notify Admin of New Employee Creation ===
        if (ADMIN_EMAIL) {
          const adminNotificationParams = {
            Destination: { ToAddresses: [ADMIN_EMAIL] },
            Message: {
              Body: {
                Text: {
                  Data: `A new employee has joined the company.\n\nEmployee Name: ${decryptedFirstName} ${decryptedLastName}\nEmployee ID: ${message.employeeId}\n\nWelcome email was sent successfully.`,
                },
              },
              Subject: {
                Data: `New Employee Onboarded: ${decryptedFirstName} ${decryptedLastName}`,
              },
            },
            Source: SENDER_EMAIL,
          };

          console.log('Sending notification email to admin...');
          await sesClient.send(new SendEmailCommand(adminNotificationParams));
          console.log(`Admin notified at ${ADMIN_EMAIL}`);
        }
      }

    } catch (err) {
      console.error('Failed to process SES notification:', err);
      throw err; // ensures SQS will retry
    }
  }
};
