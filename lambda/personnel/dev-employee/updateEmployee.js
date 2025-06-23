const { encrypt, decrypt } = require('../../utils/cryptoUtils');
const AWS = require('aws-sdk');
const Joi = require('joi');

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.PERSONNEL_TABLE_NAME;

// Joi schema to validate update payload
const schema = Joi.object({
  firstName: Joi.string().trim().min(1),
  lastName: Joi.string().trim().min(1),
  middleName: Joi.string().trim().allow('', null),
  preferredName: Joi.string().trim().min(1),
  nationalId: Joi.string().trim().min(1),
  dateOfBirth: Joi.string().isoDate(),
  gender: Joi.string().valid('Male', 'Female', 'Other'),
  nationality: Joi.string().trim(),
  maritalStatus: Joi.string().valid('Single', 'Married', 'Divorced', 'Widowed'),
  status: Joi.string().valid('Active', 'Inactive'),
});

exports.handler = async (event) => {
  try {
    const { employeeId } = event.pathParameters || {};
    if (!employeeId) return response(400, 'Missing employeeId in path.');

    const body = JSON.parse(event.body || '{}');
    const { error, value: validatedData } = schema.validate(body, { stripUnknown: true });

    if (error) return response(400, 'Validation error', error.details.map(error => error.message));

    const modifiedBy = 'BackendDeveloper';
    const modifiedAt = new Date().toISOString();

    // Define fields that require encryption
    const fieldConfig = {
      firstName     : true,
      lastName      : true,
      middleName    : false,
      preferredName : false,
      nationalId    : true,
      dateOfBirth   : false,
      gender        : false,
      nationality   : false,
      maritalStatus : false,
      status: true,
    };

    // 🔹 Fetch existing record
    const existingRec = await dynamoDb.get({
      TableName: tableName,
      Key: {
        PK: `EMPLOYEE#${employeeId}`,
        SK: 'SECTION#PERSONAL_DATA',
      }
    }).promise();

    if (!existingRec.Item) return response(404, 'Employee not found.');

    const existing = existingRec.Item;
    const updates  = {};
    const former   = {};
    const updated  = {};

    // check for changes in fields
    for (const [field, shouldEncrypt] of Object.entries(fieldConfig)) {
      if (validatedData[field] !== undefined) {
        const newPlain = validatedData[field];
        const oldPlain = shouldEncrypt && existing[field] ? decrypt(existing[field]) : existing[field];

        if (oldPlain !== newPlain) {
          // dynamodb update
          updates[field] = shouldEncrypt ? encrypt(newPlain) : newPlain;
          
          // response from request
          former[field] = oldPlain;
          updated[field] = newPlain;
        }
      }
    }

    // If no changes in fields
    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 200, 
        body: JSON.stringify({
          message: 'No changes detected',
          employeeId
        })
      };
    }

    // Audits the update action
    updates.modifiedAt = modifiedAt;
    updates.modifiedBy = modifiedBy;

    // Build update expression for DynamoDB
    const exprNames = {};
    const exprValues = {};
    const exprs = [];

    for (const [key, val] of Object.entries(updates)) {
      exprNames[`#${key}`] = key;
      exprValues[`:${key}`] = val;
      exprs.push(`#${key} = :${key}`);
    }

    // execute update
    await  dynamoDb.update ({
        TableName: tableName,
        Key: { 
          PK: `EMPLOYEE#${employeeId}`, 
          SK: 'SECTION#PERSONAL_DATA' 
        },
        UpdateExpression: `SET ${exprs.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    }).promise();

    return {
      statusCode: 200, 
      body: JSON.stringify ({
        message: 'Employee updated successfully',
        employeeId,
        modifiedAt,
        modifiedBy,
        former,
        updated,
      })
    };

  } catch (error) {
    console.error('Update error:', error);
    if (error.code === 'ConditionalCheckFailedException') {
      return response(404, 'Employee not found.');
    }
    return response(500, 'Internal Server Error', error.message);
  }
};

// Helper to format API responses
function response(statusCode, message, details = null) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(details ? { error: message, details } : { message }),
  };
}