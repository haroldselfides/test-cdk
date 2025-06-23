const { encrypt } = require('../../utils/cryptoUtils');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TEST_TABLE_NAME;

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);

    // Destructure and set optional defaults
    const {
      // Personal Data
      firstName,
      lastName,
      middleName = '',
      preferredName = '',
      nationalId,
      dateOfBirth,
      gender,
      nationality,
      maritalStatus,
      status = 'Active',

      // Contact Info
      email,
      phone,
      altPhone = '',
      address,
      city,
      state,
      postalCode,
      country,

      // Emergency Contact
      emergencyContactName = '',
      emergencyContactPhone = '',
      emergencyContactRelationship = '',

      // Contract Details
      role,
      department,
      jobLevel,
      contractType,
      salaryGrade,
      salaryPay,
      allowance = ''
    } = body;

    // Collect missing fields
    const requiredFields = {
      firstName,
      lastName,
      nationalId,
      dateOfBirth,
      gender,
      nationality,
      maritalStatus,
      email,
      phone,
      address,
      city,
      state,
      postalCode,
      country,
      role,
      department,
      jobLevel,
      contractType,
      salaryGrade,
      salaryPay
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields',
          missing: missingFields
        }),
      };
    }

    const employeeId = uuidv4();
    const createdAt = new Date().toISOString();

    const items = [
      {
        PutRequest: {
          Item: {
            PK: `EMPLOYEE#${employeeId}`,
            SK: 'SECTION#PERSONAL_DATA',
            employeeId,
            firstName: encrypt(firstName),
            lastName: encrypt(lastName),
            middleName: encrypt(middleName),
            preferredName,
            nationalId: encrypt(nationalId),
            dateOfBirth,
            gender,
            nationality,
            maritalStatus,
            status,
            createdAt,
          }
        }
      },
      {
        PutRequest: {
          Item: {
            PK: `EMPLOYEE#${employeeId}`,
            SK: 'SECTION#CONTACT_INFO',
            email: encrypt(email),
            phone: encrypt(phone),
            altPhone: encrypt(altPhone),
            address: encrypt(address),
            city,
            state,
            postalCode,
            country,
            emergencyContactName,
            emergencyContactPhone,
            emergencyContactRelationship,
          }
        }
      },
      {
        PutRequest: {
          Item: {
            PK: `EMPLOYEE#${employeeId}`,
            SK: 'SECTION#CONTRACT_DETAILS',
            role,
            department,
            jobLevel,
            contractType,
            salaryGrade,
            salaryPay,
            allowance,
          }
        }
      }
    ];

    // Batch write in chunks of 25
    const chunks = [];
    while (items.length) chunks.push(items.splice(0, 25));
    for (const chunk of chunks) {
      await dynamoDb.batchWrite({ RequestItems: { [tableName]: chunk } }).promise();
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Employee created successfully',
        employeeId
      }),
    };

  } catch (error) {
    console.error('Error saving to DynamoDB:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        details: error.message,
      }),
    };
  }
};
