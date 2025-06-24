const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { decrypt } = require('../utils/cryptoUtil');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TEST_TABLE_NAME;

// Helper to assemble and decrypt employee data
const assembleAndDecryptEmployee = (items) => {
  if (!items || items.length === 0) return null;
  const combinedData = items.reduce((acc, item) => ({ ...acc, ...item }), {});
  const personalData = {
    firstName: decrypt(combinedData.firstName),
    lastName: decrypt(combinedData.lastName),
    middleName: combinedData.middleName ? decrypt(combinedData.middleName) : "",
    preferredName: combinedData.preferredName || "",
    nationalId: decrypt(combinedData.nationalId),
    dateOfBirth: combinedData.dateOfBirth,
    age: combinedData.age,
    gender: combinedData.gender,
    nationality: combinedData.nationality,
    maritalStatus: combinedData.maritalStatus,
  };
  const contactInfo = {
    email: decrypt(combinedData.email),
    phone: decrypt(combinedData.phone),
    altPhone: combinedData.altPhone ? decrypt(combinedData.altPhone) : "",
    address: decrypt(combinedData.address),
    city: combinedData.city ? decrypt(combinedData.city) : "",
    state: combinedData.state ? decrypt(combinedData.state) : "",
    postalCode: combinedData.postalCode ? decrypt(combinedData.postalCode) : "",
    country: combinedData.country ? decrypt(combinedData.country) : "",
    emergencyContact: {
      name: combinedData.emergencyContactName ? decrypt(combinedData.emergencyContactName) : "",
      phone: combinedData.emergencyContactPhone ? decrypt(combinedData.emergencyContactPhone) : "",
      relationship: combinedData.emergencyContactRelationship ? decrypt(combinedData.emergencyContactRelationship) : "",
    }
  };
  const contractDetails = {
    role: combinedData.role,
    department: combinedData.department,
    jobLevel: combinedData.jobLevel,
    contractType: combinedData.contractType,
    salaryGrade: combinedData.salaryGrade,
    salaryPay: combinedData.salaryPay,
    allowance: combinedData.allowance !== undefined ? combinedData.allowance : null,
  };
  return { personalData, contactInfo, contractDetails };
};

exports.handler = async (event) => {
  try {
    const query = event.queryStringParameters || {};
    const { status, role, department, limit, nextToken } = query;
    const pageLimit = limit ? parseInt(limit) : 20;

    // Default filter for status
    let filterExp = 'SK = :sk';
    let expAttrVals = { ':sk': { S: 'SECTION#PERSONAL_DATA' } };
    let expAttrNames = {};

    if (status) {
      filterExp += ' AND #status = :status';
      expAttrVals[':status'] = { S: status };
      expAttrNames['#status'] = 'status';
    } else {
      filterExp += ' AND #status = :status';
      expAttrVals[':status'] = { S: 'ACTIVE' };
      expAttrNames['#status'] = 'status';
    }

    // Manual pagination logic
    let ExclusiveStartKey = undefined;
    if (nextToken) {
      try {
        ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString('utf8'));
      } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Invalid nextToken' }) };
      }
    }

    let collected = [];
    let lastEvaluatedKey = ExclusiveStartKey;
    let done = false;

    while (!done && collected.length < pageLimit) {
      const scanParams = {
        TableName: tableName,
        FilterExpression: filterExp,
        ExpressionAttributeValues: expAttrVals,
        ExpressionAttributeNames: expAttrNames,
        Limit: Math.max(pageLimit - collected.length, 1),
      };
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }
      const { Items, LastEvaluatedKey } = await dbClient.send(new ScanCommand(scanParams));
      if (Items && Items.length > 0) {
        collected.push(...Items);
      }
      if (!LastEvaluatedKey) {
        done = true;
      } else {
        lastEvaluatedKey = LastEvaluatedKey;
      }
    }

    if (collected.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ employees: [], nextToken: null }) };
    }

    // Fetch all sections for each employee and filter by role and department
    const employeePKs = collected.map(item => unmarshall(item).PK);
    const allEmployees = [];
    for (const pk of employeePKs) {
      // Scan all sections for this employee
      const { Items: empItems } = await dbClient.send(new ScanCommand({
        TableName: tableName,
        FilterExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': { S: pk } },
      }));
      const unmarshalled = empItems.map(item => unmarshall(item));

      // Combine all sections into a single object
      const combinedData = unmarshalled.reduce((acc, item) => ({ ...acc, ...item }), {});

      // Apply filtering for role and department
      if (
        (!role || combinedData.role === role) &&
        (!department || combinedData.department === department)
      ) {
        allEmployees.push(assembleAndDecryptEmployee(unmarshalled));
      }
    }

    // Apply pagination after filtering
    const paginatedEmployees = allEmployees.slice(0, pageLimit);
    const nextOutToken = allEmployees.length > pageLimit
      ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
      : null;

    return {
      statusCode: 200,
      body: JSON.stringify({
        employees: paginatedEmployees,
        count: paginatedEmployees.length,
        nextToken: nextOutToken
      })
    };
  } catch (error) {
    console.error('Error listing employees:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to list employees', error: error.message })
    };
  }
};