const AWS = require('aws-sdk');
const { encrypt } = require('../../utils/cryptoUtils');

const dynamo = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TEST_TABLE_NAME;

exports.handler = async (event) => {
  try {
    const { employeeId } = event.pathParameters;

    if (!employeeId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing employeeId in path.' }),
      };
    }

    const pk = `EMPLOYEE#${employeeId}`;
    const sk = 'SECTION#PERSONAL_DATA';

    const params = {
      TransactItems: [
        // Ensure the employee exists
        {
          ConditionCheck: {
            TableName: tableName,
            Key: { PK: pk, SK: sk },
            ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
          },
        },
        // Soft-delete: update the status to 'Inactive'
        {
          Update: {
            TableName: tableName,
            Key: { PK: pk, SK: sk },
            UpdateExpression: 'SET #status = :inactive, deletedAt = :timestamp',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':inactive': encrypt('Inactive'),
              ':timestamp': new Date().toISOString(),
            },
            ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
          },
        },
      ],
    };

    await dynamo.transactWrite(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Employee soft-deleted (status: Inactive).' }),
    };
  } catch (err) {
    console.error('Soft delete failed:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Soft delete failed', details: err.message }),
    };
  }
};
