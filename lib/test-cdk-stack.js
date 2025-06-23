// At the very top of the file, load environment variables
require('dotenv').config();
const { Stack, RemovalPolicy } = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs');
const path = require('path');

class TestCdkStack extends Stack {
  /**
   * @param {import('constructs').Construct} scope
   * @param {string} id
   * @param {import('aws-cdk-lib').StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // Validate env vars
    if (!process.env.PERSONNEL_TABLE_NAME || !process.env.AES_SECRET_KEY) {
      throw new Error('Missing required environment variables from .env file.');
    }
    

    // 1. Create DynamoDB Table
    const personnelTable = new dynamodb.Table(this, 'PersonnelTable', {
      tableName: process.env.PERSONNEL_TABLE_NAME,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Add Global Secondary Index
    personnelTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // 2. Shared Lambda environment variables
    const lambdaEnvironment = {
      PERSONNEL_TABLE_NAME: personnelTable.tableName,
      AES_SECRET_KEY: process.env.AES_SECRET_KEY,
    };

    // 3. API Gateway
    const api = new apigateway.RestApi(this, 'TestRESTAPI', {
      restApiName: 'Test REST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // 4. Helper for Lambda creation
    const functionProps = (entryPath) => ({
      entry: path.join(__dirname, entryPath),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: lambdaEnvironment,
    });

    // Personnel Lambdas
    const createEmployeeLambda = new NodejsFunction(this, 'TestCreateEmployeeLambda', functionProps('../lambda/personnel/dev-employee/createEmployee.js'));
    const getEmployeeDetailsLambda = new NodejsFunction(this, 'TestGetEmployeeDetailsLambda', functionProps('../lambda/personnel/dev-employee/getEmployee.js'));
    const updateEmployeeLambda = new NodejsFunction(this, 'TestUpdateEmployeeLambda', functionProps('../lambda/personnel/dev-employee/updateEmployee.js'));
    const deleteEmployeeLambda = new NodejsFunction(this, 'TestDeleteEmployeeLambda', functionProps('../lambda/personnel/dev-employee/deleteEmployee.js'));

    const getPersonalDataLambda = new NodejsFunction(this, 'TestGetPersonalDataLambda', functionProps('../lambda/personnel/dev-personalData/getPersonalData.js'));
    const updatePersonalDataLambda = new NodejsFunction(this, 'TestUpdatePersonalDataLambda', functionProps('../lambda/personnel/dev-personalData/updatePersonalData.js'));
    const getContactInfoLambda = new NodejsFunction(this, 'TestGetContactInfoLambda', functionProps('../lambda/personnel/dev-contactInfo/getContactInfo.js'));
    const updateContactInfoLambda = new NodejsFunction(this, 'TestUpdateContactInfoLambda', functionProps('../lambda/personnel/dev-contactInfo/updateContactInfo.js'));
    const getContractDetailsLambda = new NodejsFunction(this, 'TestGetContractDetailsLambda', functionProps('../lambda/personnel/dev-contractDetails/getContractDetails.js'));
    const updateContractDetailsLambda = new NodejsFunction(this, 'TestUpdateContractDetailsLambda', functionProps('../lambda/personnel/dev-contractDetails/updateContractDetails.js'));

    // Search/Selection Lambdas
    const listEmployeesLambda = new NodejsFunction(this, 'TestListEmployeesLambda', functionProps('../lambda/personnel/listEmployees.js'));
    const searchEmployeesLambda = new NodejsFunction(this, 'TestSearchEmployeesLambda', functionProps('../lambda/personnel/searchEmployees.js'));

    // 5. Grant Permissions (Least Privilege)
    personnelTable.grantReadWriteData(createEmployeeLambda);
    personnelTable.grantReadWriteData(updateEmployeeLambda);
    personnelTable.grant(updateEmployeeLambda, 'dynamodb:UpdateItem');
    personnelTable.grant(updateEmployeeLambda, 'dynamodb:PutItem');
    personnelTable.grant(deleteEmployeeLambda, 'dynamodb:UpdateItem');
    personnelTable.grant(getEmployeeDetailsLambda, 'dynamodb:Query');

    personnelTable.grant(getPersonalDataLambda, 'dynamodb:GetItem');
    personnelTable.grant(updatePersonalDataLambda, 'dynamodb:UpdateItem');
    personnelTable.grant(getContactInfoLambda, 'dynamodb:GetItem');
    personnelTable.grant(updateContactInfoLambda, 'dynamodb:UpdateItem');
    personnelTable.grant(getContractDetailsLambda, 'dynamodb:GetItem');
    personnelTable.grant(updateContractDetailsLambda, 'dynamodb:UpdateItem');
    personnelTable.grant(listEmployeesLambda, 'dynamodb:Scan');
    personnelTable.grant(searchEmployeesLambda, 'dynamodb:Query');

    // 6. API Gateway Endpoints
    const employees = api.root.addResource('personnel').addResource('employees');
    const employeeId = employees.addResource('{employeeId}');

    employees.addMethod('POST', new apigateway.LambdaIntegration(createEmployeeLambda));
    employeeId.addMethod('GET', new apigateway.LambdaIntegration(getEmployeeDetailsLambda));
    employeeId.addMethod('PUT', new apigateway.LambdaIntegration(updateEmployeeLambda));
    employeeId.addMethod('DELETE', new apigateway.LambdaIntegration(deleteEmployeeLambda));

    const personalData = employeeId.addResource('personal-data');
    personalData.addMethod('GET', new apigateway.LambdaIntegration(getPersonalDataLambda));
    personalData.addMethod('PUT', new apigateway.LambdaIntegration(updatePersonalDataLambda));

    const contactInfo = employeeId.addResource('contact-info');
    contactInfo.addMethod('GET', new apigateway.LambdaIntegration(getContactInfoLambda));
    contactInfo.addMethod('PUT', new apigateway.LambdaIntegration(updateContactInfoLambda));

    const contractDetails = employeeId.addResource('contract-details');
    contractDetails.addMethod('GET', new apigateway.LambdaIntegration(getContractDetailsLambda));
    contractDetails.addMethod('PUT', new apigateway.LambdaIntegration(updateContractDetailsLambda));

    employees.addMethod('GET', new apigateway.LambdaIntegration(listEmployeesLambda));
    employees.addResource('search').addMethod('GET', new apigateway.LambdaIntegration(searchEmployeesLambda));
  }
}
// Proper export
module.exports = { TestCdkStack };
