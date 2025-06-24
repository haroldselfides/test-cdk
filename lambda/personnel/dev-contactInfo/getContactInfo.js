// lambda/personnel/dev-employee/getContactDetails.js

const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { decrypt } = require('../../utils/cryptoUtil');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TEST_TABLE_NAME;

const extractContactInfo = (item) => ({
  email: item.email ? decrypt(item.email) : null,
  phone: item.phone ? decrypt(item.phone) : null,
  altPhone: item.altPhone ? decrypt(item.altPhone) : null,
  address: item.address ? decrypt(item.address) : null,
  city: item.city ? decrypt(item.city) : null,
  state: item.state ? decrypt(item.state) : null,
  postalCode: item.postalCode ? decrypt(item.postalCode) : null,
  country: item.country ? decrypt(item.country) : null,
  emergencyContact: {
    name: item.emergencyContactName ? decrypt(item.emergencyContactName) : null,
    phone: item.emergencyContactPhone ? decrypt(item.emergencyContactPhone) : null,
    relationship: item.emergencyContactRelationship ? decrypt(item.emergencyContactRelationship) : null,
  }
});

exports.handler = async (event) => {
  const { employeeId } = event.pathParameters;
  console.log(`Received request to get contact information for employee ID: ${employeeId}`);

  if (!employeeId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Employee ID is required.' }),
    };
  }

  const pk = `EMPLOYEE#${employeeId}`;

  const queryParams = {
    TableName: tableName,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': { S: pk },
    },
  };

  try {
    const { Items } = await dbClient.send(new QueryCommand(queryParams));

    if (!Items || Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Employee not found.' }),
      };
    }

    const unmarshalledItems = Items.map(item => unmarshall(item));
    const personalItem = unmarshalledItems.find(item => item.SK === 'SECTION#PERSONAL_DATA');
    const contactItem = unmarshalledItems.find(item => item.SK === 'SECTION#CONTACT_INFO');

    if (!personalItem || personalItem.status !== 'ACTIVE') {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Unable to perform action. This employee is inactive.' }),
      };
    }

    if (!contactItem) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Contact information not found.' }),
      };
    }

    const contactInfo = extractContactInfo(contactItem);

    return {
      statusCode: 200,
      body: JSON.stringify({ contactInfo }),
    };

  } catch (error) {
    console.error('Error retrieving contact information:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal Server Error. Failed to retrieve contact information.',
        error: error.message,
      }),
    };
  }
};
