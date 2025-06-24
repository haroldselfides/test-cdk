const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { decrypt } = require('../utils/cryptoUtil');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.PERSONNEL_TABLE_NAME;

exports.handler = async (event) => {
  const query = event.queryStringParameters || {};

  if (Object.keys(query).length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Provide at least one search filter in the query string.' }),
    };
  }

  try {
    // Step 1: Scan the full table
    const scanResult = await dbClient.send(new ScanCommand({ TableName: tableName }));
    const allItems = scanResult.Items.map(unmarshall);

    // Step 2: Group all sections by employeeId
    const employees = {};
    for (const item of allItems) {
      if (!item.PK || !item.SK) continue;

      const idMatch = item.PK.match(/^EMPLOYEE#(.+)$/);
      if (!idMatch) continue;

      const id = idMatch[1];
      if (!employees[id]) employees[id] = { employeeId: id };

      if (item.SK === 'SECTION#PERSONAL_DATA') {
        employees[id].personal = item;
      } else if (item.SK === 'SECTION#CONTACT_INFO') {
        employees[id].contact = item;
      } else if (item.SK === 'SECTION#CONTRACT_DETAILS') {
        employees[id].contract = item;
      }
    }

    // Step 3: Apply dynamic filters
    const results = Object.values(employees)
      .filter(emp => emp.personal?.status === 'ACTIVE')
      .filter(emp => {
        return Object.entries(query).every(([key, value]) => {
          const lowerVal = value.toLowerCase();

          // Check across all sections
          const sectionMatch =
            (emp.personal && emp.personal[key]?.toString().toLowerCase() === lowerVal) ||
            (emp.contact && emp.contact[key]?.toString().toLowerCase() === lowerVal) ||
            (emp.contract && emp.contract[key]?.toString().toLowerCase() === lowerVal) ||
            (emp.employeeId === value);

          return sectionMatch;
        });
      })
      .map(emp => ({
        employeeId: emp.employeeId,
        personalData: {
          firstName: decrypt(emp.personal.firstName),
          lastName: decrypt(emp.personal.lastName),
          middleName: emp.personal.middleName ? decrypt(emp.personal.middleName) : '',
          preferredName: emp.personal.preferredName || '',
          nationalId: decrypt(emp.personal.nationalId),
          dateOfBirth: emp.personal.dateOfBirth,
          age: emp.personal.age,
          gender: emp.personal.gender,
          nationality: emp.personal.nationality,
          maritalStatus: emp.personal.maritalStatus,
          status: emp.personal.status,
        },
        contactInfo: {
          email: decrypt(emp.contact.email),
          phone: decrypt(emp.contact.phone),
          altPhone: emp.contact.altPhone ? decrypt(emp.contact.altPhone) : '',
          address: decrypt(emp.contact.address),
          city: emp.contact.city,
          state: emp.contact.state,
          postalCode: emp.contact.postalCode,
          country: emp.contact.country,
          emergencyContact: {
            name: emp.contact.emergencyContactName ? decrypt(emp.contact.emergencyContactName) : '',
            phone: emp.contact.emergencyContactPhone ? decrypt(emp.contact.emergencyContactPhone) : '',
            relationship: emp.contact.emergencyContactRelationship ? decrypt(emp.contact.emergencyContactRelationship) : '',
          },
        },
        contractDetails: {
          role: emp.contract.role,
          department: emp.contract.department,
          jobLevel: emp.contract.jobLevel,
          contractType: emp.contract.contractType,
          salaryGrade: emp.contract.salaryGrade,
          salaryPay: emp.contract.salaryPay,
          allowance: emp.contract.allowance || null,
        },
      }));

    if (results.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'No matching employees found.' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ results }),
    };

  } catch (err) {
    console.error('searchEmployees error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Search failed', error: err.message }),
    };
  }
};