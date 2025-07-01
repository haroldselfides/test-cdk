// lambda/organization/dev-position/createPosition.js

const { DynamoDBClient, PutItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { encrypt } = require('../../utils/cryptoUtil');
const { validateBody } = require('../../utils/validationUtil');
const { getRequestingUser } = require('../../utils/authUtil');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const orgTableName = process.env.TEST_ORGANIZATIONAL_TABLE_NAME;
const personnelTableName = process.env.TEST_TABLE_NAME;

// Define required fields for this endpoint
const requiredFields = [
    'positionTitle', 'positionCode', 'department',
    'positionLevel', 'employmentType', 'reportsTo',
    'education', 'skills', 'certifications',
    'salaryGrade', 'competencyLevel'
];

exports.handler = async (event) => {
    console.log('Received request to create a new position.');
    
    try {
        const body = JSON.parse(event.body);
        
        // 1. --- Input Validation ---
        const validationResult = validateBody(body, requiredFields);
        if (!validationResult.isValid) {
            console.warn('Validation failed:', validationResult.message);
            return {
                statusCode: 400,
                body: JSON.stringify({ message: validationResult.message }),
            };
        }
        console.log('Input validation passed.');

        // 2. --- Existence Validation for Foreign Keys ---
        
        // a. Validate that the reportsTo manager exists and is active
        const managerId = body.reportsTo;
        const managerCheckParams = {
            TableName: personnelTableName,
            Key: marshall({
                PK: `EMPLOYEE#${managerId}`,
                SK: 'SECTION#PERSONAL_DATA'
            }),
            ProjectionExpression: '#status',
            ExpressionAttributeNames: { '#status': 'status' }
        };

        const { Item: managerItem } = await dbClient.send(new GetItemCommand(managerCheckParams));
        if (!managerItem) {
            console.warn(`Validation failed: Manager with ID ${managerId} not found.`);
            return {
                statusCode: 400,
                body: JSON.stringify({ message: `Invalid input: Manager with ID ${managerId} not found.` }),
            };
        }

        const managerData = unmarshall(managerItem);
        if (managerData.status !== 'ACTIVE') {
            console.warn(`Validation failed: Manager with ID ${managerId} is not active.`);
            return {
                statusCode: 400,
                body: JSON.stringify({ message: `Invalid input: Manager with ID ${managerId} is not active.` }),
            };
        }

        // b. Validate that the department exists
        const departmentId = body.department;
        const departmentCheckParams = {
            TableName: orgTableName,
            Key: marshall({
                PK: `ORG#DEPARTMENT#${departmentId}`,
                SK: 'METADATA'
            })
        };
        const { Item: departmentItem } = await dbClient.send(new GetItemCommand(departmentCheckParams));

        if (!departmentItem) {
            console.warn(`Validation failed: Department with ID ${departmentId} not found.`);
            return {
                statusCode: 400,
                body: JSON.stringify({ message: `Invalid input: Department with ID ${departmentId} not found.` }),
            };
        }

        // 3. --- Prepare Core Data ---
        const positionId = uuidv4();
        const pk = `ORG#POSITION#${positionId}`;
        const sk = 'METADATA';
        const createdAt = new Date().toISOString();
        const createdBy = getRequestingUser(event);

        // 4. --- Construct the DynamoDB Item ---
        const positionItem = {
            PK: pk,
            SK: sk,
            positionId: positionId,
            positionTitle: body.positionTitle,
            positionCode: body.positionCode,
            department: departmentId,
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
            createdBy: createdBy,
            createdAt: createdAt,
        };

        const command = new PutItemCommand({
            TableName: orgTableName,
            Item: marshall(positionItem, { removeUndefinedValues: true }),
            ConditionExpression: 'attribute_not_exists(PK)',
        });

        // 5. --- Execute Database Command ---
        console.log('Creating position record in DynamoDB...');
        await dbClient.send(command);
        console.log(`Successfully created position with ID: ${positionId}`);
        
        return {
            statusCode: 201,
            body: JSON.stringify({
                message: 'Position created successfully',
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
