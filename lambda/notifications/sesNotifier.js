// lambda/notifications/sesNotifier.js

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { decrypt } = require('../utils/cryptoUtil'); // Ensure this path is correct

const sesClient = new SESClient({});
const ADMIN_EMAIL = process.env.HR_ADMIN_EMAIL;
const SENDER_EMAIL = process.env.HR_ADMIN_EMAIL; // Must be a verified SES identity

exports.handler = async (event) => {
    console.log('Received SQS event for new employee notification:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        try {
            const message = JSON.parse(record.body);
            console.log('Parsed message:', message);

            const decryptedEmail = decrypt(message.email); // Assuming your decrypt doesn't need the key passed if it's in env
            const decryptedFirstName = decrypt(message.firstName);
            const decryptedLastName = decrypt(message.lastName);
            
            // === 1. Send Welcome Email to the Employee ===
            const welcomeEmailParams = {
                Destination: { ToAddresses: [decryptedEmail] },
                Message: {
                    Body: {
                        Text: {
                            Data: `Dear ${decryptedFirstName},\n\nWelcome to the team! We are thrilled to have you join us. Your onboarding process will begin shortly.\n\nBest regards,\nThe HR Team`,
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
            console.log(`Email sent successfully to ${decryptedEmail}`);

            // === 2. Send Notification Email to the Admin ===
            // This fulfills the second part of Use Case 3's description
            if (message.notifyAdmin && ADMIN_EMAIL) {
                const adminNotificationParams = {
                    Destination: { ToAddresses: [ADMIN_EMAIL] },
                    Message: {
                        Body: {
                            Text: {
                                Data: `This is a notification that a new employee has been successfully created in the system and a welcome email has been sent.\n\nEmployee Details:\nName: ${decryptedFirstName} ${decryptedLastName}\nEmployee ID: ${message.employeeId}\n\nThis is an automated message.`,
                            },
                        },
                        Subject: {
                            Data: `New Employee Created: ${decryptedFirstName} ${decryptedLastName}`,
                        },
                    },
                    Source: SENDER_EMAIL,
                };
                
                console.log('Sending notification email to admin...');
                await sesClient.send(new SendEmailCommand(adminNotificationParams));
                console.log(`Admin notification sent successfully to ${ADMIN_EMAIL}`);
            }

        } catch (error) {
            console.error('Failed to process message and send email(s). Error:', error);
            // Throw error to ensure SQS retries the message
            throw error;
        }
    }
};