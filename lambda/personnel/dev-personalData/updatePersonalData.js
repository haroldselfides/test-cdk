// lambda/personnel/dev-personalData/updatePersonalData.js

const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const { encrypt } = require('../../utils/cryptoUtil');
const { validateBody } = require('../../utils/validationUtil');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.PERSONNEL_TABLE_NAME;

// Required fields for just this section
const requiredFields = [
  'firstName', 'lastName', 'nationalId', 'dateOfBirth', 'age', 
  'gender', 'nationality', 'maritalStatus'
];

exports.handler = async (event) => {
  const { employeeId } = event.pathParameters;
  console.log(`Request to update personal data for employee ID: ${employeeId}`);

  if (!employeeId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Employee ID is required.' }),
    };
  }

  try {
    const body = JSON.parse(event.body);

    // 1. --- Input Validation ---
    const validationResult = validateBody(body, requiredFields);
    if (!validationResult.isValid) {
      console.warn('Validation failed:', validationResult.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: validationResult.message }),
      };
    }
    console.log(`Input validation passed for ${employeeId}.`);

    // 2. --- Dynamically Build Update Expression ---
    // This allows for partial updates (like a PATCH) where not all fields need to be sent.
    const updateExpressionParts = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    // Map body fields to expression parts, encrypting where necessary
    const fieldsToUpdate = {
      firstName: encrypt(body.firstName),
      lastName: encrypt(body.lastName),
      nationalId: encrypt(body.nationalId),
      dateOfBirth: body.dateOfBirth,
      age: body.age,
      gender: body.gender,
      nationality: body.nationality,
      maritalStatus: body.maritalStatus,
      // Optional fields
      ...(body.middleName && { middleName: encrypt(body.middleName) }),
      ...(body.preferredName && { preferredName: body.preferredName }),
    };

    for (const [field, value] of Object.entries(fieldsToUpdate)) {
      if (value !== undefined) {
        const valueKey = `:${field}`;
        const nameKey = `#${field}`;
        updateExpressionParts.push(`${nameKey} = ${valueKey}`);
        expressionAttributeValues[valueKey] = value;
        expressionAttributeNames[nameKey] = field;
      }
    }

    if (updateExpressionParts.length === 0) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "No valid fields provided for update."})
        }
    }

    // 3. --- Construct and Execute Atomic Update ---
    const command = new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({
        PK: `EMPLOYEE#${employeeId}`,
        SK: 'SECTION#PERSONAL_DATA',
      }),
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      // This condition ensures the update only happens if the employee is active
      ConditionExpression: '#status = :activeStatus',
      ExpressionAttributeNames: { ...expressionAttributeNames, '#status': 'status' },
      ExpressionAttributeValues: marshall({
        ...expressionAttributeValues,
        ':activeStatus': 'ACTIVE',
      }),
      ReturnValues: 'NONE',
    });

    console.log(`Executing update for personal data of employee ${employeeId}...`);
    await dbClient.send(command);
    console.log(`Successfully updated personal data for ${employeeId}.`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Personal data updated successfully.' }),
    };
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      console.warn(`Update failed for ${employeeId}, employee not found or not active.`);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Employee not found.' }),
      };
    }
    console.error('Error updating personal data:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to update personal data.', error: error.message }),
    };
  }
};