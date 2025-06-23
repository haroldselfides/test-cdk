const AWS = require('aws-sdk');
const { encrypt } = require('../../utils/cryptoUtils');

const dynamo = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TEST_TABLE_NAME;

exports.handler = async (event) => {
  try {
    const { employeeId } = event.pathParameters;
    const {
      emailAddress,
      phoneNumber,
      alternativePhoneNo = '',
      address,
      city,
      state,
      postalCode,
      country,
      emergencyContactName = '',
      emergencyContactPhone = '',
      emergencyContactRelationship = '',
    } = JSON.parse(event.body);

    // Validate required fields
    if (
      !emailAddress || !phoneNumber || !address ||
      !city || !state || !postalCode || !country ||
      !emergencyContactName || !emergencyContactPhone || !emergencyContactRelationship
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
        {
          Update: {
            TableName: tableName,
            Key: { PK: pk, SK: sk },
            UpdateExpression: `
              SET emailAddress = :emailAddress,
                  phoneNumber = :phoneNumber,
                  alternativePhoneNo = :alternativePhoneNo,
                  address = :address,
                  city = :city,
                  state = :state,
                  postalCode = :postalCode,
                  country = :country,
                  emergencyContactName = :emergencyContactName,
                  emergencyContactPhone = :emergencyContactPhone,
                  emergencyContactRelationship = :emergencyContactRelationship
            `,
            ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':emailAddress': encrypt(emailAddress),
              ':phoneNumber': encrypt(phoneNumber),
              ':alternativePhoneNo': alternativePhoneNo,
              ':address': encrypt(address),
              ':city': encrypt(city),
              ':state': encrypt(state),
              ':postalCode': encrypt(postalCode),
              ':country': encrypt(country),
              ':emergencyContactName': encrypt(emergencyContactName),
              ':emergencyContactPhone': encrypt(emergencyContactPhone),
              ':emergencyContactRelationship': encrypt(emergencyContactRelationship),
            },
          },
        },
      ],
    };

    await dynamo.transactWrite(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Employees Contact updated successfully.' }),
    };

  } catch (err) {
    console.error('Update transaction failed:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Update failed', details: err.message }),
    };
  }
};
