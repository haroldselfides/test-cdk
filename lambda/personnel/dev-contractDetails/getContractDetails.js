// lambda/personnel/dev-employee/getContractDetails.js
const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { decrypt } = require('../../utils/cryptoUtil'); 

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TEST_TABLE_NAME;

/**
 * Extract and decrypt contract details from a single item.
 * @param {Object} item - The unmarshalled item from DynamoDB
 * @returns {Object} contractDetails object
 */

const extractContractDetails = (item) => {
  return {
    role: item.role,
    department: item.department,
    jobLevel: item.jobLevel,
    contractType: item.contractType,
    salaryGrade: item.salaryGrade,
    salaryPay: item.salaryPay,
    allowance: item.allowance !== undefined ? item.allowance : null,
  };
};

exports.handler = async (event) => {
  const { employeeId } = event.pathParameters;
  console.log(`Received request to get contract details for employee ID: ${employeeId}`);

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
    console.log(`Querying DynamoDB for employee contract details with PK: ${pk}`);
    const { Items } = await dbClient.send(new QueryCommand(queryParams));

    if (!Items || Items.length === 0) {
      console.warn(`No records found for employee ID: ${employeeId}.`);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Employee not found.' }),
      };
    }

    const unmarshalledItems = Items.map(item => unmarshall(item));
    const contractItem = unmarshalledItems.find(item => item.SK === 'SECTION#CONTRACT_DETAILS');

    if (!contractItem) {
      console.warn(`Contract details not found for employee ID: ${employeeId}.`);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Contract details not found.' }),
      };
    }

    const contractDetails = extractContractDetails(contractItem);

    console.log(`Successfully retrieved and decrypted contract details for employee ID: ${employeeId}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ contractDetails }),
    };

  } catch (error) {
    console.error('An error occurred while getting contract details:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal Server Error. Failed to retrieve contract details.',
        error: error.message,
      }),
    };
  }
};