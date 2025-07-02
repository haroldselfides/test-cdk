// lambda/personnel/dev-employee/createPosition.js
const { DynamoDBClient, PutItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { encrypt } = require('../../utils/cryptoUtil');
const { validateBody } = require('../../utils/validationUtil');
const { getRequestingUser } = require('../../utils/authUtil');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TEST_ORGANIZATIONAL_TABLE_NAME;

const positionRequiredFields = [
  'positionTitle', 'positionCode', 'departmentCode', 'positionLevel',
  'employmentType', 'positionDescription', 'education',
  'skills', 'certifications', 'salaryGrade', 'competencyLevel'
];

exports.handler = async (event) => {
  console.log('Received request to create a new position.');

  try {
    const body = JSON.parse(event.body);
    const validationResult = validateBody(body, positionRequiredFields);

    if (!validationResult.isValid) {
      console.warn('Validation failed:', validationResult.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: validationResult.message }),
      };
    }

    // 1. --- Validate department exists ---
    const departmentParams = {
      TableName: tableName,
      Key: marshall({
        PK: `ORG#DEPARTMENT#${body.departmentCode}`,
        SK: 'METADATA'
      })
    };

    const departmentResult = await dbClient.send(new GetItemCommand(departmentParams));
    if (!departmentResult.Item) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid department code' }),
      };
    }

    // 2. --- Get department manager ---
    const managerParams = {
      TableName: tableName,
      Key: marshall({
        PK: `ORG#DEPARTMENT#${body.departmentCode}`,
        SK: 'MANAGER'
      })
    };

    const managerResult = await dbClient.send(new GetItemCommand(managerParams));
    if (!managerResult.Item) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'No manager assigned to this department.' }),
      };
    }

    const managerData = unmarshall(managerResult.Item);

    // 3. --- Prepare Item ---
    const positionId = uuidv4();
    const pk = `ORG#POSITION#${positionId}`;

    const positionItem = {
      PK: pk,
      SK: 'METADATA',
      positionId,
      positionTitle: body.positionTitle,
      positionCode: body.positionCode,
      department: body.departmentCode,
      positionLevel: body.positionLevel,
      employmentType: body.employmentType,
      reportsTo: managerData.managerId,
      positionDescription: encrypt(body.positionDescription),
      education: body.education,
      skills: body.skills,
      certifications: body.certifications,
      salaryGrade: body.salaryGrade,
      competencyLevel: body.competencyLevel,
      comments: body.comments ? encrypt(body.comments) : undefined,
      createdBy: getRequestingUser(event),
      createdAt: new Date().toISOString(),
    };

    await dbClient.send(new PutItemCommand({
      TableName: tableName,
      Item: marshall(positionItem, { removeUndefinedValues: true }),
      ConditionExpression: 'attribute_not_exists(PK)'
    }));

    console.log(`Successfully created position with ID: ${positionId}`);

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Position created successfully.',
        positionId: positionId,
      }),
    };

  } catch (error) {
    console.error('An error occurred during position creation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal Server Error. Failed to create position.',
        error: error.message,
      }),
    };
  }
};