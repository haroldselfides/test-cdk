const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { decrypt } = require('../utils/cryptoUtil'); // Ensure this path is correct

const sesClient = new SESClient({});
const ADMIN_EMAIL = process.env.HR_ADMIN_EMAIL; // Admin email for notifications
const SENDER_EMAIL = process.env.HR_ADMIN_EMAIL; // Must be verified in SES

exports.handler = async (event) => {
  console.log('Received SQS event for SES notifier:', JSON.stringify(event, null, 2)); // Log received event

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body); // Parse the SQS message body
      console.log('Parsed message:', message); // Log parsed message

      if (message.type === 'WELCOME') { // Check for 'WELCOME' message type
        const decryptedEmail = decrypt(message.email); // Decrypt employee email
        const decryptedFirstName = decrypt(message.firstName); // Decrypt employee first name
        const decryptedLastName = decrypt(message.lastName); // Decrypt employee last name
        // NEW: Decrypt and use role and department from the message
        const role = message.role; // Role is not encrypted
        const department = message.department; // Department is not encrypted

        // === Send Welcome Email to Employee ===
        const welcomeEmailBody = `Dear ${decryptedFirstName},\n\n` +
                                 `On behalf of the entire team, we extend a most enthusiastic and sincere welcome to you!\n\n` +
                                 `We are absolutely delighted to have you join us as a **${role}** in the **${department}** department.\n` +
                                 `Your expertise and contributions are highly anticipated, and we are confident that you will be a valuable asset to our organization.\n\n` +
                                 `Your journey with us begins shortly, and we are excited to support your success and growth here.\n\n` +
                                 `Should you have any immediate questions, please do not hesitate to reach out.\n\n` +
                                 `Warmest regards,\n` +
                                 `The HR Department`; // Changed from 'HR Team' to 'HR Department' for formality

        const welcomeEmailParams = {
          Destination: { ToAddresses: [decryptedEmail] }, // Send to decrypted employee email
          Message: {
            Body: {
              Text: {
                Data: welcomeEmailBody, // Use the enhanced email body
              },
            },
            Subject: {
              Data: `A Warm Welcome to the Company, ${decryptedFirstName}!`, // Dynamic and more enthusiastic subject
            },
          },
          Source: SENDER_EMAIL, // Verified SES sender email
        };

        console.log('Sending welcome email to employee...'); // Log email sending attempt
        await sesClient.send(new SendEmailCommand(welcomeEmailParams)); // Send email via SES
        console.log(`Welcome email sent to ${decryptedEmail}`); // Log successful send

        // === Optional: Notify Admin of New Employee Creation ===
        if (ADMIN_EMAIL) { // Check if ADMIN_EMAIL is configured
          const adminNotificationBody = `A new employee has joined the company.\n\n` +
                                        `Employee Name: ${decryptedFirstName} ${decryptedLastName}\n` +
                                        `Employee ID: ${message.employeeId}\n` +
                                        `Role: ${role}\n` +
                                        `Department: ${department}\n\n` +
                                        `Welcome email was sent successfully to ${decryptedEmail}.`;

          const adminNotificationParams = {
            Destination: { ToAddresses: [ADMIN_EMAIL] }, // Send to admin email
            Message: {
              Body: {
                Text: {
                  Data: adminNotificationBody, // Use enhanced admin notification body
                },
              },
              Subject: {
                Data: `New Employee Onboarded: ${decryptedFirstName} ${decryptedLastName} (${role})`, // Enhanced admin subject
              },
            },
            Source: SENDER_EMAIL, // Verified SES sender email
          };

          console.log('Sending notification email to admin...'); // Log admin notification attempt
          await sesClient.send(new SendEmailCommand(adminNotificationParams)); // Send admin notification via SES
          console.log(`Admin notified at ${ADMIN_EMAIL}`); // Log successful admin notification
        }
      }

    } catch (err) {
      console.error('Failed to process SES notification:', err); // Log processing errors
      throw err; // Ensures SQS will retry if there's an error
    }
  }
};