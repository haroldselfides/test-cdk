//lambda/organization/dev-department/getDepartment.js

const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { decrypt } = require('../../utils/cryptoUtil');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TEST_ORGANIZATIONAL_TABLE_NAME;

// Lambda handler function
exports.handler = async (event) => {
  // Extract departmentId from path parameters
  const { departmentId } = event.pathParameters;
  // Log the incoming request
  console.log(`Received request to get details for department ID: ${departmentId}`);

  // Validate that departmentId is provided
  if (!departmentId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Department ID is required.' }),
    };
  }

  // Construct the GetItem request parameters for DynamoDB
  const getParams = {
    TableName: tableName,
    Key: {
      PK: { S: `ORG#DEPARTMENT#${departmentId}` }, // Partition Key
      SK: { S: 'METADATA' }                         // Sort Key
    }
  };

  // Try querying the department item from DynamoDB
  try {
    console.log(`Querying DynamoDB for department with PK: ORG#DEPARTMENT#${departmentId}`);
    const { Item } = await dbClient.send(new GetItemCommand(getParams)); // Execute the query

    // If no item was found, return 404
    if (!Item) {
      console.warn(`Department with ID ${departmentId} not found.`);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Department not found.' }),
      };
    }

    // Convert the DynamoDB item to a plain JS object
    const data = unmarshall(Item);

    // Assemble the final department object with decrypted and raw fields
    const departmentDetails = {
      departmentId: data.departmentId, 
      departmentCode: data.departmentCode, 
      departmentType: data.departmentType, 
      departmentName: decrypt(data.departmentName),
      description: data.description ? decrypt(data.description) : "", 
      comments: data.comments ? decrypt(data.comments) : "", 
      costCenter: data.costCenter, 
      organizationLevel: data.organizationLevel, 
      allowSubDepartments: data.allowSubDepartments, 
      maximumPositions: data.maximumPositions, 
      reportingStructure: data.reportingStructure, 
      budgetControl: data.budgetControl, 
      departmentManager: data.departmentManager, 
      parentDepartment: data.parentDepartment || null, 
      createdBy: data.createdBy, 
      createdAt: data.createdAt, 
    };

    // Log success and return 200 OK with department details
    console.log(`Successfully retrieved and decrypted department ID: ${departmentId}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ department: departmentDetails }),
    };

  } catch (error) {
    // Catch and log any unexpected error
    console.error('An error occurred while retrieving department:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal Server Error. Failed to retrieve department details.',
        error: error.message,
      }),
    };
  }
};
