const AWS = require('aws-sdk');
const { encrypt, decrypt } = require('../../utils/cryptoUtils');

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TEST_TABLE_NAME;

exports.handler = async (event) => {
  try {
    const { employeeId } = event.pathParameters;

    if (!employeeId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing employeeId in path.' }),
      };
    }

    const params = {
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `EMPLOYEE#${employeeId}`,
      },
    };

    const result = await dynamoDb.query(params).promise();
    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Employee not found.' }),
      };
    }

    const personalData = result.Items.find(item => item.SK === 'SECTION#PERSONAL_DATA');
    if (!personalData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Personal data not found.' }),
      };
    }

    if (personalData.status !== 'Active') {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Unable to perform action. This employee is inactive.' }),
      };
    }

    const contactInfo = result.Items.find(item => item.SK === 'SECTION#CONTACT_INFO') || {};
    const contractDetails = result.Items.find(item => item.SK === 'SECTION#CONTRACT_DETAILS') || {};

    const response = {
      employeeId: personalData.employeeId,
      personalData: {
        firstName: decrypt(personalData.firstName),
        lastName: decrypt(personalData.lastName),
        middleName: personalData.middleName ? decrypt(personalData.middleName) : '',
        preferredName: personalData.preferredName || '',
        nationalId: decrypt(personalData.nationalId),
        dateOfBirth: personalData.dateOfBirth,
        gender: personalData.gender,
        nationality: personalData.nationality,
        maritalStatus: personalData.maritalStatus,
        status: personalData.status,
        createdAt: personalData.createdAt,
      },
      contactInfo: {
        email: contactInfo.email ? decrypt(contactInfo.email) : '',
        phone: contactInfo.phone ? decrypt(contactInfo.phone) : '',
        altPhone: contactInfo.altPhone ? decrypt(contactInfo.altPhone) : '',
        address: contactInfo.address ? decrypt(contactInfo.address) : '',
        city: contactInfo.city || '',
        state: contactInfo.state || '',
        postalCode: contactInfo.postalCode || '',
        country: contactInfo.country || '',
        emergencyContactName: contactInfo.emergencyContactName || '',
        emergencyContactPhone: contactInfo.emergencyContactPhone || '',
        emergencyContactRelationship: contactInfo.emergencyContactRelationship || '',
      },
      contractDetails: {
        role: contractDetails.role || '',
        department: contractDetails.department || '',
        jobLevel: contractDetails.jobLevel || '',
        contractType: contractDetails.contractType || '',
        salaryGrade: contractDetails.salaryGrade || '',
        salaryPay: contractDetails.salaryPay || '',
        allowance: contractDetails.allowance || '',
      },
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };

  } catch (error) {
    console.error('Error retrieving employee:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message }),
    };
  }
};
