/**
 * @file notifyAdmin.js
 * @description This Lambda is triggered by SQS messages from the employee update pipeline.
 * It formats and sends an email notification to the administrator via SES,
 * detailing the changes made to an employee record. It intelligently decrypts
 * only the fields that are known to be encrypted.
 */

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { decrypt } = require('../utils/cryptoUtil'); // Ensure this path is correct

const sesClient = new SESClient({});
const ADMIN_EMAIL_TO = process.env.HR_ADMIN_EMAIL;
const SENDER_EMAIL_FROM = process.env.HR_ADMIN_EMAIL_FROM;

// ✅ FIX 1: Define which fields are encrypted.
// This list should match the fields you encrypt in your create/update functions.
const ENCRYPTED_FIELDS_KEYWORDS = [
  'firstName', 'lastName', 'middleName', 'nationalId', 'email', 'phone', 
  'altPhone', 'address', 'city', 'state', 'postalCode', 'country',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship'
];

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
      const changedFields = message.changedFields || {};
      
      const fieldChanges = Object.entries(changedFields)
        .map(([field, { old, new: newVal }]) => {
          
          let oldFormatted = old;
          let newFormatted = newVal;

          // ✅ FIX 2: Check if the field name contains any of our encrypted keywords.
          const isEncrypted = ENCRYPTED_FIELDS_KEYWORDS.some(keyword => field.includes(keyword));

          if (isEncrypted) {
            // Only attempt to decrypt if the field is in the list and the value exists.
            try {
              oldFormatted = old ? decrypt(old) : 'N/A';
              newFormatted = newVal ? decrypt(newVal) : 'N/A';
            } catch (e) {
              console.error(`Decryption failed for field: ${field}. Error: ${e.message}`);
              oldFormatted = '[Decryption Error]';
              newFormatted = '[Decryption Error]';
            }
          }

          return `- ${field}: "${oldFormatted}" → "${newFormatted}"`;
        })
        .join('\n');
      
      if (!fieldChanges) {
          console.log(`No field changes found in message for employee ${employeeId}. Skipping email.`);
          continue;
      }

      const emailBody = `Hello Admin,\n\nAn existing employee record has been updated.\n\nEmployee ID: ${employeeId}\n\nChanged Fields:\n${fieldChanges}\n\nThis is an automated notification.`;

      const emailParams = {
        Destination: { ToAddresses: [ADMIN_EMAIL_TO] },
        Message: {
          Body: { Text: { Data: emailBody } },
          Subject: { Data: `Employee Record Updated: ${employeeId}` },
        },
        Source: SENDER_EMAIL_FROM,
      };

      console.log('Sending update notification email to admin...');
      await sesClient.send(new SendEmailCommand(emailParams));
      console.log(`Admin update notification sent successfully to ${ADMIN_EMAIL_TO}`);

    } catch (error) {
      console.error('Failed to process UPDATE message or send email:', error);
      throw error;
    }
  }
};