// At the very top of the file, load environment variables
require('dotenv').config();

const { Stack, RemovalPolicy, CfnOutput } = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs');
const path = require('path');
const iam = require('aws-cdk-lib/aws-iam');
const cognito = require('aws-cdk-lib/aws-cognito');
const AWS = require('aws-sdk');


class TestCdkStack extends Stack {
  /**
   * @param {import('constructs').Construct} scope
   * @param {string} id
   * @param {import('aws-cdk-lib').StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // Validate env vars
    if (!process.env.TEST_TABLE_NAME || !process.env.AES_SECRET_KEY) {
      throw new Error('Missing required environment variables from .env file.');
    }
    

    // 1. Create DynamoDB Table
    const testTable = new dynamodb.Table(this, 'TestTable', {
      tableName: process.env.TEST_TABLE_NAME,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Add Global Secondary Index
    testTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // 2. Shared Lambda environment variables
    const lambdaEnvironment = {
      TEST_TABLE_NAME: testTable.tableName,
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

    // 5. Cognito User Pool
    const userPool = new cognito.UserPool(this, 'TestUserPool', {
      userPoolName: 'TestUserPool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      removalPolicy: RemovalPolicy.DESTROY, // For testing purposes
    });
      // Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'TestUserPoolClient', {
      userPool,
      generateSecret: false,
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'TestAuthorizer', {
      cognitoUserPools: [userPool],
      restApi: api,
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
    testTable.grantReadWriteData(createEmployeeLambda);
    testTable.grantReadWriteData(getEmployeeDetailsLambda);
    testTable.grant(updateEmployeeLambda, 'dynamodb:TransactWriteItems','dynamodb:PutItem','dynamodb:ConditionCheckItem');
    testTable.grant(deleteEmployeeLambda, 'dynamodb:UpdateItem'); // For soft delete
    testTable.grant(getEmployeeDetailsLambda, 'dynamodb:Query');
    testTable.grant(getPersonalDataLambda, 'dynamodb:GetItem');
    testTable.grant(updatePersonalDataLambda, 'dynamodb:TransactWriteItems','dynamodb:PutItem','dynamodb:ConditionCheckItem');
    testTable.grant(getContactInfoLambda, 'dynamodb:GetItem','dynamodb:Query');
    testTable.grant(updateContactInfoLambda, 'dynamodb:TransactWriteItems','dynamodb:PutItem','dynamodb:ConditionCheckItem');
    testTable.grant(getContractDetailsLambda, 'dynamodb:GetItem','dynamodb:Query');
    testTable.grant(updateContractDetailsLambda, 'dynamodb:TransactWriteItems','dynamodb:PutItem','dynamodb:ConditionCheckItem');
    
    // Permissions for search and list operations
    testTable.grant(listEmployeesLambda, 'dynamodb:Scan');
    // Grant permission to query the GSI specifically
    testTable.grant(searchEmployeesLambda, 'dynamodb:Query');

    // 6. API Gateway Endpoints
    const employees = api.root.addResource('personnel').addResource('employees');
    const employeeId = employees.addResource('{employeeId}');

    employees.addMethod('POST', new apigateway.LambdaIntegration(createEmployeeLambda),{
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    employeeId.addMethod('GET', new apigateway.LambdaIntegration(getEmployeeDetailsLambda),{
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    employeeId.addMethod('PUT', new apigateway.LambdaIntegration(updateEmployeeLambda),
    {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    employeeId.addMethod('DELETE', new apigateway.LambdaIntegration(deleteEmployeeLambda),
    {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const personalData = employeeId.addResource('personal-data');
    personalData.addMethod('GET', new apigateway.LambdaIntegration(getPersonalDataLambda),
    {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    personalData.addMethod('PUT', new apigateway.LambdaIntegration(updatePersonalDataLambda),
    {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const contactInfo = employeeId.addResource('contact-info');
    contactInfo.addMethod('GET', new apigateway.LambdaIntegration(getContactInfoLambda),
    {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    contactInfo.addMethod('PUT', new apigateway.LambdaIntegration(updateContactInfoLambda),
    {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const contractDetails = employeeId.addResource('contract-details');
    contractDetails.addMethod('GET', new apigateway.LambdaIntegration(getContractDetailsLambda),
    {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    contractDetails.addMethod('PUT', new apigateway.LambdaIntegration(updateContractDetailsLambda),
    {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    employees.addMethod('GET', new apigateway.LambdaIntegration(listEmployeesLambda),{
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    employees.addResource('search').addMethod('GET', new apigateway.LambdaIntegration(searchEmployeesLambda),
    {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
  }
}
// Proper export
module.exports = { TestCdkStack };
