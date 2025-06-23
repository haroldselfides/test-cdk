const { encrypt } = require('../../utils/cryptoUtils');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.PERSONNEL_TABLE_NAME;

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);


    const {
      firstName,
      lastName,
      middleName = '',
      preferredName = '',
      nationalId,
      dateOfBirth,
      gender,
      nationality,
      maritalStatus,
      status
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !nationalId || !dateOfBirth || !gender || !nationality || !maritalStatus || !status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields.' }),
      };
    }

    const employeeId = uuidv4();

    const item = {
      PK: `EMPLOYEE#${employeeId}`,
      SK: 'SECTION#PERSONAL_DATA',
      employeeId,
      firstName: encrypt(firstName),
      lastName: encrypt(lastName),
      middleName,
      preferredName,
      nationalId: encrypt(nationalId),
      dateOfBirth,
      gender,
      nationality,
      maritalStatus,
      status: encrypt(status),
    };

    await dynamoDb.put({
      TableName: tableName,
      Item: item,
    }).promise();

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Employee created successfully', employeeId }),
    };
  } catch (error) {
    console.error('Error saving to DynamoDB:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message }),
    };
  }
};
