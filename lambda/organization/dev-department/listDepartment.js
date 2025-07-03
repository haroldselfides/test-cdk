//lambda/organization/dev-department/listDepartment.js

const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { decrypt } = require('../../utils/cryptoUtil');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TEST_ORGANIZATIONAL_TABLE_NAME;

// Combine and decrypt grouped department items into a readable structure
const assembleDepartment = (items) => {
  const combinedData = items.reduce((acc, item) => ({ ...acc, ...item }), {});

  return {
    departmentId: combinedData.departmentId,
    departmentCode: combinedData.departmentCode,
    departmentType: combinedData.departmentType,
    departmentName: decrypt(combinedData.departmentName),
    description: combinedData.description ? decrypt(combinedData.description) : "",
    comments: combinedData.comments ? decrypt(combinedData.comments) : "",
    costCenter: combinedData.costCenter,
    organizationLevel: combinedData.organizationLevel,
    allowSubDepartments: combinedData.allowSubDepartments,
    maximumPositions: combinedData.maximumPositions,
    reportingStructure: combinedData.reportingStructure,
    departmentManager: combinedData.departmentManager,
    parentDepartment: combinedData.parentDepartment || null,
    createdBy: combinedData.createdBy,
    createdAt: combinedData.createdAt,
  };
};

exports.handler = async (event) => {
  console.log('Request to list departments received with event:', event);

  try {
    const query = event.queryStringParameters || {};
    const multiQuery = event.multiValueQueryStringParameters || {};

    // Set pagination limit and nextToken for continuation
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    let exclusiveStartKey = query.nextToken
      ? JSON.parse(Buffer.from(query.nextToken, 'base64').toString())
      : undefined;

    const filterableFields = [
      'departmentId',
      'departmentCode',
      'departmentType',
      'costCenter',
      'organizationLevel',
      'allowSubDepartments',
      'maximumPositions',
      'reportingStructure',
      'budgetControl',
      'departmentManager',
      'parentDepartment',
      'createdBy',
      'createdAt',
      'departmentName'
    ];

    // Check if query contains unsupported/invalid keys (case-sensitive)
    const invalidKeys = Object.keys(query).filter(k => {
      return k !== 'limit' && k !== 'nextToken' && !filterableFields.includes(k);
    });
    // Check if multiQuery contains unsupported/invalid keys (case-sensitive)
    Object.keys(multiQuery).forEach(k => {
      if (!filterableFields.includes(k)) invalidKeys.push(k);
    });
    if (invalidKeys.length > 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Invalid query parameters: ${invalidKeys.join(', ')}`,
          allowedFields: filterableFields
        }),
      };
    }

    // Normalize and process all filterable query parameters
    const parseQuery = {};
    for (const key of filterableFields) {
      const multiVal = multiQuery[key];
      const singleVal = query[key];
      
    // Process multi-value and single-value query parameters:
    // - For multi-value parameters, split on commas and flatten the array
    // - For single-value parameters, split on commas if present
    // - Trim whitespace and convert to lowercase for consistent comparison
      if (multiVal && multiVal.length > 0) {
        parseQuery[key] = multiVal.flatMap(v => v.split(',')).map(val => val.trim().toLowerCase());
      } else if (singleVal) {
        parseQuery[key] = singleVal.includes(',')
          ? singleVal.split(',').map(val => val.trim().toLowerCase())
          : [singleVal.trim().toLowerCase()];
      }
    }

    // Check if a department record matches the parsed query filters
    const matchesFilter = (department) => {
      for (const field of filterableFields) {
        if (!(field in parseQuery)) continue;

        const queryValues = parseQuery[field];
        const actualValue = department[field];

        if (actualValue === undefined || actualValue === null) return false;

        const actualStr = actualValue.toString().toLowerCase();
        const match = queryValues.some(val => actualStr === val);
        if (!match) return false;
      }
      return true;
    };

    let filteredDepartments = [];
    let lastEvaluatedKey = exclusiveStartKey;

    // Start paginated scan of DynamoDB table
    while (filteredDepartments.length < limit) {
      const scanResult = await dbClient.send(new ScanCommand({
        TableName: tableName,
        Limit: 50, // internal scan limit (not the result limit)
        ExclusiveStartKey: lastEvaluatedKey,
      }));

      const items = scanResult.Items ? scanResult.Items.map(unmarshall) : [];
      const departmentMap = new Map();

      // Group METADATA records by PK to assemble departments
      for (const item of items) {
        if (!item.PK || item.SK !== 'METADATA') continue;
        const pk = item.PK;
        if (!departmentMap.has(pk)) departmentMap.set(pk, []);
        departmentMap.get(pk).push(item);
      }

      // Assemble and filter each grouped department
      for (const group of departmentMap.values()) {
        const department = assembleDepartment(group);
        if (matchesFilter(department)) {
          filteredDepartments.push(department);
          if (filteredDepartments.length === limit) break;
        }
      }

      if (!scanResult.LastEvaluatedKey) break;
      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    }

    // Return the final filtered and paginated department list
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        departments: filteredDepartments,
        nextToken: lastEvaluatedKey
          ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
          : null
      }),
    };
  } catch (error) {
    console.error('Error listing departments:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error while listing departments' })
    };
  }
};
