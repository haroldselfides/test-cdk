/**
 * @file updateEmployee.js
 * @description Handles the full replacement (PUT) of an existing, active employee record.
 * This function validates that all required fields are present and uses a DynamoDB
 * transaction to ensure all sections of the employee record are updated atomically.
 * A successful update to the database will trigger the DynamoDB Stream for notifications.
 */

const { DynamoDBClient, TransactWriteItemsCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const { encrypt } = require('../../utils/cryptoUtil');
const { validateBody } = require('../../utils/validationUtil');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TEST_TABLE_NAME;

// Define all required fields for a full employee update
const personalDataRequiredFields = [
  'firstName', 'lastName', 'nationalId', 'dateOfBirth', 'age', 
  'gender', 'nationality', 'maritalStatus'
];
const contactInfoRequiredFields = [
  'email', 'phone', 'address', 'city', 'state', 'postalCode', 'country'
];
const contractDetailsRequiredFields = [
  'role', 'department', 'jobLevel', 'contractType', 'salaryGrade', 'salaryPay'
];

exports.handler = async (event) => {
  const { employeeId } = event.pathParameters;

  // Define CORS headers for this specific PUT endpoint
  const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  };

  if (!employeeId) {
    return {
      statusCode: 400,
      headers: headers,
      body: JSON.stringify({ message: 'Employee ID is required in the path.' }),
    };
  }
  
  const pk = `EMPLOYEE#${employeeId}`;

  try {
    const body = JSON.parse(event.body);

    // 1. --- Input Validation for a Full Update ---
    const allRequiredFields = [
      ...personalDataRequiredFields, 
      ...contactInfoRequiredFields, 
      ...contractDetailsRequiredFields
    ];
    const validationResult = validateBody(body, allRequiredFields);

    if (!validationResult.isValid) {
      console.warn(`Validation failed for employee ${employeeId}:`, validationResult.message);
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ message: validationResult.message }),
      };
    }
    console.log(`Input validation passed for employee ${employeeId}.`);

    // 2. --- Prepare Data Items with Encryption (same as your original, correct logic) ---
    const personalDataItem = {
      PK: pk,
      SK: 'SECTION#PERSONAL_DATA',
      firstName: encrypt(body.firstName),
      lastName: encrypt(body.lastName),
      middleName: body.middleName ? encrypt(body.middleName) : undefined,
      preferredName: body.preferredName,
      nationalId: encrypt(body.nationalId),
      dateOfBirth: body.dateOfBirth,
      age: body.age,
      gender: body.gender,
      nationality: body.nationality,
      maritalStatus: body.maritalStatus,
      status: 'ACTIVE', // Ensure status remains ACTIVE after update
    };

    const contactInfoItem = {
      PK: pk,
      SK: 'SECTION#CONTACT_INFO',
      email: encrypt(body.email),
      phone: encrypt(body.phone),
      altPhone: body.altPhone ? encrypt(body.altPhone) : undefined,
      address: encrypt(body.address),
      city: encrypt(body.city),
      state: encrypt(body.state),
      postalCode: encrypt(body.postalCode),
      country: encrypt(body.country),
      emergencyContactName: body.emergencyContactName ? encrypt(body.emergencyContactName) : undefined,
      emergencyContactPhone: body.emergencyContactPhone ? encrypt(body.emergencyContactPhone) : undefined,
      emergencyContactRelationship: body.emergencyContactRelationship ? encrypt(body.emergencyContactRelationship) : undefined,
    };

    const contractDetailsItem = {
      PK: pk,
      SK: 'SECTION#CONTRACT_DETAILS',
      role: body.role,
      department: body.department,
      jobLevel: body.jobLevel,
      contractType: body.contractType,
      salaryGrade: body.salaryGrade,
      salaryPay: body.salaryPay,
      allowance: body.allowance,
    };

    // 3. --- Construct and Execute Atomic Transaction ---
    const marshallOptions = { removeUndefinedValues: true };
    const transactionParams = {
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: marshall(personalDataItem, marshallOptions),
            // This condition ensures we only update an existing, active employee.
            ConditionExpression: 'attribute_exists(PK) AND #status = :activeStatus',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: marshall({ ':activeStatus': 'ACTIVE' }),
          }
        },
        { Put: { TableName: tableName, Item: marshall(contactInfoItem, marshallOptions) } },
        { Put: { TableName: tableName, Item: marshall(contractDetailsItem, marshallOptions) } },
      ],
    };

    console.log(`Executing transaction to update (PUT) employee ${employeeId}...`);
    await dbClient.send(new TransactWriteItemsCommand(transactionParams));
    
    // SUCCESS: This database change now creates an event in the DynamoDB Stream.
    // That stream event is the trigger for your separate notification system.
    console.log(`Successfully updated employee with ID: ${employeeId}. Notification process initiated.`);

    // 4. --- Return Success Response ---
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        message: 'Employee updated successfully.',
        employeeId: employeeId,
      }),
    };

  } catch (error) {
    if (error.name === 'TransactionCanceledException') {
      // This error means our ConditionExpression failed.
      console.warn(`Transaction for employee ${employeeId} failed. Employee not found or is inactive.`);
      return {
        statusCode: 404,
        headers: headers,
        body: JSON.stringify({ message: 'Employee not found or is inactive.' }),
      };
    }
    if (error instanceof SyntaxError) {
        return { statusCode: 400, headers, body: JSON.stringify({ message: 'Invalid JSON in request body.' })};
    }
    
    console.error(`An unhandled error occurred during PUT for employee ${employeeId}:`, error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal Server Error.' }),
    };
  }
};