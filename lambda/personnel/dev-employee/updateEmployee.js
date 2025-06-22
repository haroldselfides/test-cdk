const AWS = require('aws-sdk');
const { encrypt } = require('../../utils/cryptoUtils');

const dynamo = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TEST_TABLE_NAME;

exports.handler = async (event) => {
  try {
    const { employeeId } = event.pathParameters;
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
    } = JSON.parse(event.body);

    // Validate required fields
    if (
      !firstName || !lastName || !nationalId ||
      !dateOfBirth || !gender || !nationality ||
      !maritalStatus || !status
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields.' }),
      };
    }

    const pk = `EMP#${employeeId}`;
    const sk = 'METADATA';

    const params = {
      TransactItems: [
        // Condition to ensure the item exists
        {
          ConditionCheck: {
            TableName: tableName,
            Key: { PK: pk, SK: sk },
            ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
          },
        },
        {
          Update: {
            TableName: tableName,
            Key: { PK: pk, SK: sk },
            UpdateExpression: `
              SET firstName = :firstName,
                  lastName = :lastName,
                  middleName = :middleName,
                  preferredName = :preferredName,
                  nationalId = :nationalId,
                  dateOfBirth = :dateOfBirth,
                  gender = :gender,
                  nationality = :nationality,
                  maritalStatus = :maritalStatus,
                  status = :status
            `,
            ExpressionAttributeValues: {
              ':firstName': encrypt(firstName),
              ':lastName': encrypt(lastName),
              ':middleName': middleName,
              ':preferredName': preferredName,
              ':nationalId': encrypt(nationalId),
              ':dateOfBirth': dateOfBirth,
              ':gender': gender,
              ':nationality': nationality,
              ':maritalStatus': maritalStatus,
              ':status': encrypt(status),
            },
            ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
          },
        },
      ],
    };

    await dynamo.transactWrite(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Employee updated successfully.' }),
    };

  } catch (err) {
    console.error('Update transaction failed:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Update failed', details: err.message }),
    };
  }
};
