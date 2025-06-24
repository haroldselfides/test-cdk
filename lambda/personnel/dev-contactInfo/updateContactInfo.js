// lambda/personnel/dev-employee/updateContactDetails.js

const { DynamoDBClient, TransactWriteItemsCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const { validateBody } = require('../../utils/validationUtil');
const { encrypt } = require('../../utils/cryptoUtil');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TEST_TABLE_NAME;

// Required fields for contact info section
const contactInfoRequiredFields = [
  'email', 'phone', 'address', 'city', 'state', 'postalCode', 'country'
];

exports.handler = async (event) => {
  const { employeeId } = event.pathParameters;
  console.log(`Received request to update contact info for employee ID: ${employeeId}`);

  if (!employeeId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Employee ID is required in the path.' }),
    };
  }

  try {
    const body = JSON.parse(event.body);

    // Validate required contact fields
    const validationResult = validateBody(body, contactInfoRequiredFields);
    if (!validationResult.isValid) {
      console.warn(`Validation failed for contact update of employee ${employeeId}:`, validationResult.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: validationResult.message }),
      };
    }

    console.log(`Validation passed. Proceeding to update contact section for employee ${employeeId}.`);

    const pk = `EMPLOYEE#${employeeId}`;

    const contactItem = {
      PK: pk,
      SK: 'SECTION#CONTACT_INFO',
      email: encrypt(body.email),
      phone: encrypt(body.phone),
      altPhone: body.altPhone ? encrypt(body.altPhone) : '',
      address: encrypt(body.address),
      city: encrypt(body.city),
      state: encrypt(body.state),
      postalCode: encrypt(body.postalCode),
      country: encrypt(body.country),
      emergencyContactName: body.emergencyContactName ? encrypt(body.emergencyContactName) : '',
      emergencyContactPhone: body.emergencyContactPhone ? encrypt(body.emergencyContactPhone) : '',
      emergencyContactRelationship: body.emergencyContactRelationship ? encrypt(body.emergencyContactRelationship) : '',
    };

    const marshallOptions = { removeUndefinedValues: true };

    const transactionParams = {
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: marshall(contactItem, marshallOptions),
            ConditionExpression: 'attribute_exists(PK)', // Ensure employee exists
          },
        }
      ]
    };

    console.log(`Executing transaction to update contact section for employee ${employeeId}...`);
    await dbClient.send(new TransactWriteItemsCommand(transactionParams));
    console.log(`Successfully updated contact section for employee ID: ${employeeId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Contact information updated successfully.',
        employeeId: employeeId,
      }),
    };

  } catch (error) {
    if (error.name === 'TransactionCanceledException') {
      console.warn(`Contact update failed. Employee ${employeeId} not found or does not exist.`);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Employee not found or is not active.' }),
      };
    }

    console.error(`An error occurred while updating contact info for employee ID ${employeeId}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal Server Error. Failed to update contact info.',
        error: error.message,
      }),
    };
  }
};
