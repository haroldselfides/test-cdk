// lambda/personnel/dev-employee/updateContractDetails.js

const { DynamoDBClient, TransactWriteItemsCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const { validateBody } = require('../../utils/validationUtil');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TEST_TABLE_NAME;

// Fields allowed in contract details section
const contractDetailsRequiredFields = [
  'role', 'department', 'jobLevel', 'contractType', 'salaryGrade', 'salaryPay'
];

exports.handler = async (event) => {
  const { employeeId } = event.pathParameters;
  console.log(`Received request to update contract details for employee ID: ${employeeId}`);

  if (!employeeId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Employee ID is required in the path.' }),
    };
  }

  try {
    const body = JSON.parse(event.body);

    // Validate only the contract fields that are required
    const validationResult = validateBody(body, contractDetailsRequiredFields);

    if (!validationResult.isValid) {
      console.warn(`Validation failed for contract update of employee ${employeeId}:`, validationResult.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: validationResult.message }),
      };
    }

    console.log(`Validation passed. Proceeding to update contract section for employee ${employeeId}.`);

    const pk = `EMPLOYEE#${employeeId}`;

    const contractDetailsItem = {
      PK: pk,
      SK: 'SECTION#CONTRACT_DETAILS',
      role: body.role,
      department: body.department,
      jobLevel: body.jobLevel,
      contractType: body.contractType,
      salaryGrade: body.salaryGrade,
      salaryPay: body.salaryPay,
      allowance: body.allowance, // Optional field (can be undefined or null)
    };

    const marshallOptions = { removeUndefinedValues: true };

    const transactionParams = {
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: marshall(contractDetailsItem, marshallOptions),
            ConditionExpression: 'attribute_exists(PK)', // Ensure employee exists
          },
        }
      ]
    };

    console.log(`Executing transaction to update contract section for employee ${employeeId}...`);
    await dbClient.send(new TransactWriteItemsCommand(transactionParams));
    console.log(`Successfully updated contract section for employee ID: ${employeeId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Contract details updated successfully.',
        employeeId: employeeId,
      }),
    };

  } catch (error) {
    if (error.name === 'TransactionCanceledException') {
      console.warn(`Contract update failed. Employee ${employeeId} not found or does not exist.`);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Employee not found or is not active.' }),
      };
    }

    console.error(`An error occurred while updating contract details for employee ID ${employeeId}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal Server Error. Failed to update contract details.',
        error: error.message,
      }),
    };
  }
}  ;