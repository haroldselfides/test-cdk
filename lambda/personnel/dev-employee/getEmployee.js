const AWS = require('aws-sdk');
const { encrypt,decrypt } = require('../../utils/cryptoUtils');

const dynamoDb = new AWS.DynamoDB.DocumentClient();
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

    // Use Query instead of GetItem to fetch all related items under same PK
    const params = {
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `EMP#${employeeId}`,
      },
    };

    const result = await dynamoDb.query(params).promise();

    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Employee not found.' }),
      };
    }

    // Find the METADATA item
    const metadataItem = result.Items.find(item => item.SK === 'METADATA');

    if (!metadataItem) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Metadata for employee not found.' }),
      };
    }

    const employee = {
      employeeId: metadataItem.employeeId,
      firstName: decrypt(metadataItem.firstName),
      lastName: decrypt(metadataItem.lastName),
      middleName: metadataItem.middleName || '',
      preferredName: metadataItem.preferredName || '',
      nationalId: decrypt(metadataItem.nationalId),
      dateOfBirth: metadataItem.dateOfBirth,
      gender: metadataItem.gender,
      nationality: metadataItem.nationality,
      maritalStatus: metadataItem.maritalStatus,
      status: decrypt(metadataItem.status),
      createdAt: metadataItem.createdAt,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(employee),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };

  } catch (error) {
    console.error('Error retrieving employee:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message }),
    };
  }
};
