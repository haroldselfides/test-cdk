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
  'positionTitle', 'positionCode', 'department', 'positionLevel',
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

    // Get department manager
    const departmentCode = body.department;
    const managerGetParams = {
      TableName: tableName,
      Key: marshall({
        PK: `DEPARTMENT#${departmentCode}`,
        SK: 'MANAGER'
      })
    };

    const { Item: managerItem } = await dbClient.send(new GetItemCommand(managerGetParams));
    if (!managerItem) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Department ${departmentCode} not found or has no manager assigned` })
      };
    }

    const departmentManager = unmarshall(managerItem);
    const managerId = departmentManager.managerId;

    const positionId = uuidv4();
    const pk = `POSITION#${positionId}`;

    const positionItem = {
      PK: pk,
      SK: 'METADATA',
      positionId: positionId,
      positionTitle: body.positionTitle,
      positionCode: body.positionCode,
      department: departmentCode,
      positionLevel: body.positionLevel,
      employmentType: body.employmentType,
      reportsTo: managerId,
      positionDescription: body.positionDescription ? encrypt(body.positionDescription) : undefined,
      education: body.education,
      skills: body.skills,
      certifications: body.certifications,
      salaryGrade: body.salaryGrade,
      competencyLevel: body.competencyLevel,
      comments: body.comments ? encrypt(body.comments) : undefined,
      createdBy: getRequestingUser(event),
      createdAt: new Date().toISOString(),
    };

    console.log('Creating position record...');
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
    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        body: JSON.stringify({ message: 'A position with this ID already exists, which should not happen. Please try again.' }),
      };
    }
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