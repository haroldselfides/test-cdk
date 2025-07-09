// lambda/attendance/createAttendance.js

const { DynamoDBClient, QueryCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb'); // MODIFIED: Imported QueryCommand
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { encrypt } = require('../../utils/cryptoUtil');
const { validateBody } = require('../../utils/validationUtil');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TEST_TABLE_NAME;

// ADDED: Business rule constants for easy configuration
const MAX_WORK_HOURS = 12;
const MIN_BREAK_MINUTES = 30;

const attendanceRequiredFields = [
  'checkInTime', 'checkOutTime', 'totalHours', 'taskCategory', 'wbsCode', 'costCenter', 'projectCode'
];

exports.handler = async (event) => {
  console.log('Received request to create attendance record.');
  const headers = { /* ... CORS headers ... */ };

  try {
    const pathEmployeeId = event.pathParameters?.employeeId;
    if (!pathEmployeeId) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: 'Employee ID is missing from the URL path.' }) };
    }
    const body = JSON.parse(event.body);

    // Initial payload validation...
    const validationResult = validateBody(body, attendanceRequiredFields);
    if (!validationResult.isValid) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: validationResult.message }) };
    }

    // MODIFIED: Use Query to fetch both Personal and Contract data in one call
    const employeePk = `EMPLOYEE#${pathEmployeeId}`;
    console.log(`Querying for employee data: ${pathEmployeeId}`);

    const queryParams = {
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': { S: employeePk },
      },
    };

    const queryResult = await dbClient.send(new QueryCommand(queryParams));
    
    if (queryResult.Items.length === 0) {
      console.warn(`Validation failed: Employee with ID ${pathEmployeeId} not found.`);
      return { statusCode: 404, headers, body: JSON.stringify({ message: 'Employee not found.' }) };
    }

    // Unmarshall and find the specific items we need
    const employeeItems = queryResult.Items.map(item => unmarshall(item));
    const personalData = employeeItems.find(item => item.SK === 'SECTION#PERSONAL_DATA');
    const contractDetails = employeeItems.find(item => item.SK === 'SECTION#CONTRACT_DETAILS');

    // --- Core Employee Validation ---
    if (!personalData || !contractDetails) {
      console.error(`Data integrity issue for employee ${pathEmployeeId}: Missing core sections.`);
      return { statusCode: 500, headers, body: JSON.stringify({ message: 'Incomplete employee record found.' }) };
    }

    if (personalData.status !== 'ACTIVE') {
      console.warn(`Validation failed: Employee ${pathEmployeeId} is not ACTIVE.`);
      return {
        statusCode: 403, headers, body: JSON.stringify({ message: `Cannot create attendance for an employee with status: ${personalData.status}.` })
      };
    }
    console.log(`Employee ${pathEmployeeId} is ACTIVE. Proceeding to business logic validation...`);
    
    // --- ADDED: Business Logic Validation Block ---

    // 1. Enforce max work hours
    const checkIn = new Date(body.checkInTime);
    const checkOut = new Date(body.checkOutTime);
    const workDurationHours = (checkOut - checkIn) / (1000 * 60 * 60);

    if (workDurationHours > MAX_WORK_HOURS) {
      return {
        statusCode: 400, headers, body: JSON.stringify({ message: `Total work duration cannot exceed ${MAX_WORK_HOURS} hours.` })
      };
    }

    // 2. Validate break durations (if breaks are provided)
    if (body.breaks && body.breaks.length > 0) {
      let totalBreakMinutes = 0;
      for (const breakPeriod of body.breaks) {
        if (breakPeriod.start && breakPeriod.end) {
          const breakStart = new Date(breakPeriod.start);
          const breakEnd = new Date(breakPeriod.end);
          totalBreakMinutes += (breakEnd - breakStart) / (1000 * 60);
        }
      }
      if (totalBreakMinutes < MIN_BREAK_MINUTES) {
        return {
          statusCode: 400, headers, body: JSON.stringify({ message: `Total break time must be at least ${MIN_BREAK_MINUTES} minutes.` })
        };
      }
    }

    // 3. Require location data if remote work is not allowed
    if (contractDetails.allowRemoteWork === false && !body.location) {
      return {
        statusCode: 400, headers, body: JSON.stringify({ message: 'Location data is required for office-based work.' })
      };
    }

    console.log('All business logic validations passed.');
    
    // --- Construct and Save the Item ---
    const attendanceId = uuidv4();
    const createdAt = new Date().toISOString();
    const attendanceDate = new Date(body.checkInTime).toISOString().split('T')[0];
    
    // Calculate overtime hours (anything over 8 hours)
    const standardHours = 8;
    const overtimeHours = Math.max(0, body.totalHours - standardHours);

    const attendanceItem = {
        PK: employeePk,
        SK: `ATTENDANCE#${attendanceDate}`,
        attendanceId: attendanceId,
        formType: 'ATTENDANCE',
        employeeId: pathEmployeeId,
        checkInTime: body.checkInTime,
        checkOutTime: body.checkOutTime,
        wbsCode: body.wbsCode,
        costCenter: body.costCenter,
        projectCode: body.projectCode,
        taskCategory: body.taskCategory,
        location: body.location ? encrypt(body.location) : null,
        breaks: body.breaks || [],
        totalHours: body.totalHours,
        overtimeHours: overtimeHours,
        notes: body.notes ? encrypt(body.notes) : null,
        createdAt: createdAt
    };

    const putParams = {
      TableName: tableName,
      Item: marshall(attendanceItem, { removeUndefinedValues: true }),
      ConditionExpression: 'attribute_not_exists(SK)',
    };
    
    await dbClient.send(new PutItemCommand(putParams));
    
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ 
        message: 'Attendance record created successfully.',
        attendanceId: attendanceId,
        overtimeHours: overtimeHours
      }),
    };
  } catch (error) {
    // ... (error handling is unchanged) ...
    console.error('An error occurred during attendance creation:', error);
    if (error.name === 'ConditionalCheckFailedException') {
        return { statusCode: 409, headers, body: JSON.stringify({ message: 'An attendance record for this employee on this date already exists.' })};
    }
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Internal Server Error.', error: error.message })};
  }
};