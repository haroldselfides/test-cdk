/**
 * @file deleteEmployee.js
 * @description Handles the soft deletion (archiving) of an employee record.
 * This function updates the employee's status to 'INACTIVE' but does not permanently
 * remove their data. It uses a conditional update to ensure only active employees
 * can be deactivated. This change will trigger the DynamoDB Stream for notifications.
 */

const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TEST_TABLE_NAME;

exports.handler = async (event) => {
  const { employeeId } = event.pathParameters;

  // Define CORS headers for this DELETE endpoint
  const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  };

  // 1. --- Input Validation ---
  if (!employeeId) {
    return {
      statusCode: 400,
      headers: headers,
      body: JSON.stringify({ message: 'Employee ID is required in the path.' }),
    };
  }
  
  const pk = `EMPLOYEE#${employeeId}`;

  // 2. --- Construct Update Parameters for Soft Delete ---
  // This command targets the specific personal data item and updates only its status.
  const params = {
    TableName: tableName,
    Key: marshall({
      PK: pk,
      SK: 'SECTION#PERSONAL_DATA', // The 'status' attribute lives on this item
    }),
    // The UpdateExpression sets the 'status' attribute to the new value 'INACTIVE'.
    UpdateExpression: 'SET #status = :inactiveStatus',
    // The ConditionExpression is crucial: it ensures this operation only succeeds if the
    // employee exists and their current status is 'ACTIVE'.
    ConditionExpression: 'attribute_exists(PK) AND #status = :activeStatus',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: marshall({
      ':inactiveStatus': 'INACTIVE',
      ':activeStatus': 'ACTIVE',
    }),
  };

  try {
    // 3. --- Execute the Atomic Update ---
    console.log(`Executing soft delete for employee ${employeeId}...`);
    await dbClient.send(new UpdateItemCommand(params));
    
    // SUCCESS: This critical status change is now recorded in the DynamoDB Stream,
    // which will trigger the admin notification process.
    console.log(`Successfully deactivated employee with ID: ${employeeId}.`);

    // 4. --- Return Success Response ---
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({ message: 'Employee deactivated successfully.' }),
    };

  } catch (error) {
    // This specific error name means our ConditionExpression failed. This is expected.
    if (error.name === 'ConditionalCheckFailedException') {
      console.warn(`Attempted to deactivate employee ${employeeId}, but they are not active or do not exist.`);
      return {
        statusCode: 404,
        headers: headers,
        body: JSON.stringify({ message: 'Employee not found or is already inactive.' }),
      };
    }

    // Handle any other unexpected errors.
    console.error(`An error occurred while deactivating employee ID ${employeeId}:`, error);
    return {
      statusCode: 500,
      headers: headers,
      // SECURITY BEST PRACTICE: Avoid leaking internal error details to the client.
      body: JSON.stringify({ message: 'Internal Server Error.' }),
    };
  }
};