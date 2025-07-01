// lib/test-cdk-stack.js

// Load environment variables
require('dotenv').config();

const { Stack, RemovalPolicy, CfnOutput } = require('aws-cdk-lib'); // Added CfnOutput
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const cognito = require('aws-cdk-lib/aws-cognito'); // Added Cognito library
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs');
const path = require('path');
const { PolicyStatement, Effect } = require('aws-cdk-lib/aws-iam');

class TestCdkStack extends Stack {
  /**
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // Updated check to include the new table name from the .env file
    if (!process.env.TEST_TABLE_NAME || !process.env.TEST_ORGANIZATIONAL_TABLE_NAME || !process.env.AES_SECRET_KEY) {
      throw new Error('Missing required environment variables. Check .env for TEST_TABLE_NAME, TEST_ORGANIZATIONAL_TABLE_NAME, and AES_SECRET_KEY.');
    }
    
    // 1. Cognito User Pool and Client
    const userPool = new cognito.UserPool(this, 'TestUserPool', {
      userPoolName: 'TestUserPool',
      selfSignUpEnabled: false, // Self sign-up is disabled
      signInAliases: { email: true },
      autoVerify: { email: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'TestUserPoolClient', {
        userPool,
        generateSecret: false,
        authFlows: {
            userPassword: true, // This enables the USER_PASSWORD_AUTH flow
        },
    });
    
    // 2. DynamoDB Table
    // Existing Personnel Table
    const testTable = new dynamodb.Table(this, 'TestTable', {
      tableName: process.env.TEST_TABLE_NAME,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

        // --- NEW: Organizational Table for Week 2 ---
    const organizationalTable = new dynamodb.Table(this, 'OrganizationalTable', {
        tableName: process.env.TEST_ORGANIZATIONAL_TABLE_NAME,
        partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
        removalPolicy: RemovalPolicy.DESTROY,
    });

    // 3. --- Updated Environment variables for Lambda functions ---
    const lambdaEnvironment = {
      TEST_TABLE_NAME: testTable.tableName,
      TEST_ORGANIZATIONAL_TABLE_NAME: organizationalTable.tableName,
      AES_SECRET_KEY: process.env.AES_SECRET_KEY,
    };
    
    // 4. API Gateway REST API and Cognito Authorizer
    const api = new apigateway.RestApi(this, 'TestRESTAPI', {
      restApiName: 'Test REST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Create the Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'TestCognitoAuthorizer', {
        cognitoUserPools: [userPool],
        identitySource: 'method.request.header.Authorization',
    });


    // 5. Define business logic Lambda functions
    const functionProps = (entryPath) => ({
        entry: path.join(__dirname, entryPath),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
    });

    // Lambda function definitions (no changes here)
    const testcreateEmployeeLambda = new NodejsFunction(this, 'CreateEmployeeLambda', functionProps('../lambda/personnel/dev-employee/createEmployee.js'));
    const testgetEmployeeDetailsLambda = new NodejsFunction(this, 'GetEmployeeDetailsLambda', functionProps('../lambda/personnel/dev-employee/getEmployee.js'));
    const testupdateEmployeeLambda = new NodejsFunction(this, 'UpdateEmployeeLambda', functionProps('../lambda/personnel/dev-employee/updateEmployee.js'));
    const testdeleteEmployeeLambda = new NodejsFunction(this, 'DeleteEmployeeLambda', functionProps('../lambda/personnel/dev-employee/deleteEmployee.js'));
    const testgetPersonalDataLambda = new NodejsFunction(this, 'GetPersonalDataLambda', functionProps('../lambda/personnel/dev-personalData/getPersonalData.js'));
    const testupdatePersonalDataLambda = new NodejsFunction(this, 'UpdatePersonalDataLambda', functionProps('../lambda/personnel/dev-personalData/updatePersonalData.js'));
    const testgetContactInfoLambda = new NodejsFunction(this, 'GetContactInfoLambda', functionProps('../lambda/personnel/dev-contactInfo/getContactInfo.js'));
    const testupdateContactInfoLambda = new NodejsFunction(this, 'UpdateContactInfoLambda', functionProps('../lambda/personnel/dev-contactInfo/updateContactInfo.js'));
    const testgetContractDetailsLambda = new NodejsFunction(this, 'GetContractDetailsLambda', functionProps('../lambda/personnel/dev-contractDetails/getContractDetails.js'));
    const testupdateContractDetailsLambda = new NodejsFunction(this, 'UpdateContractDetailsLambda', functionProps('../lambda/personnel/dev-contractDetails/updateContractDetails.js'));
    const testlistEmployeesLambda = new NodejsFunction(this, 'ListEmployeesLambda', functionProps('../lambda/personnel/listEmployees.js'));
    const testsearchEmployeesLambda = new NodejsFunction(this, 'SearchEmployeesLambda', functionProps('../lambda/personnel/searchEmployees.js'));

    // --- NEW: Organization Management Lambdas for Week 2 ---
    const testcreateDepartmentLambda = new NodejsFunction(this, 'CreateDepartmentLambda', functionProps('../lambda/organization/dev-department/createDepartment.js'));
    testcreateDepartmentLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'dynamodb:PutItem',
        'dynamodb:GetItem'  // Also needed for department validation in position creation
      ],
      resources: [testTable.tableArn]
    }));
    const testcreatePositionLambda = new NodejsFunction(this, 'CreatePositionLambda', functionProps('../lambda/organization/dev-position/createPosition.js'));
    testcreatePositionLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'dynamodb:PutItem',
        'dynamodb:GetItem'  // Also needed for department validation in position creation
      ],
      resources: [testTable.tableArn,organizationalTable.tableArn]
    }));
    const testcreatePositionMethodLambda = new NodejsFunction(this, 'CreatePositionMethodLambda', functionProps('../lambda/organization/dev-position/createPositionMethod.js'));
    const testcreateOrgUnitLambda = new NodejsFunction(this, 'CreateOrgUnitLambda', functionProps('../lambda/organization/dev-orgUnit/createOrgUnit.js'));
    const testcreateJobClassificationLambda = new NodejsFunction(this, 'CreateJobClassificationLambda', functionProps('../lambda/organization/dev-jobClassification/createJobClassification.js'));

    // 6. Grant IAM Permissions (no changes here)
    testTable.grantReadWriteData(testcreateEmployeeLambda);
    testTable.grant(testupdateEmployeeLambda, 'dynamodb:TransactWriteItems','dynamodb:PutItem');
    testTable.grant(testdeleteEmployeeLambda, 'dynamodb:UpdateItem');
    testTable.grant(testgetEmployeeDetailsLambda, 'dynamodb:Query');
    testTable.grant(testgetPersonalDataLambda, 'dynamodb:GetItem');
    testTable.grant(testupdatePersonalDataLambda, 'dynamodb:UpdateItem');
    testTable.grant(testgetContactInfoLambda, 'dynamodb:GetItem');
    testTable.grant(testupdateContactInfoLambda, 'dynamodb:TransactWriteItems','dynamodb:UpdateItem','dynamodb:ConditionCheckItem');
    testTable.grant(testgetContractDetailsLambda, 'dynamodb:GetItem');
    testTable.grant(testupdateContractDetailsLambda, 'dynamodb:TransactWriteItems','dynamodb:UpdateItem','dynamodb:ConditionCheckItem');
    testTable.grant(testlistEmployeesLambda, 'dynamodb:Scan');
    testTable.grant(testsearchEmployeesLambda, 'dynamodb:Scan');

    // --- NEW: Organization Table Permissions ---
    organizationalTable.grantReadWriteData(testcreateDepartmentLambda);
    testTable.grant(testcreateDepartmentLambda,'dynamodb:GetItem');
    organizationalTable.grantReadWriteData(testcreatePositionLambda);
    organizationalTable.grantReadWriteData(testcreateOrgUnitLambda);
    organizationalTable.grantReadWriteData(testcreateJobClassificationLambda);
    organizationalTable.grantReadWriteData(testcreatePositionMethodLambda);
    
    // 7. --- Define API Gateway Resources and Methods with Authorization ---
    const employees = api.root.addResource('personnel').addResource('employees');
    const employeeId = employees.addResource('{employeeId}');

    // Helper function to add methods with the Cognito authorizer attached
    const addAuthorizedMethod = (resource, method, integration) => {
        resource.addMethod(method, integration, {
            authorizationType: apigateway.AuthorizationType.COGNITO,
            authorizer: authorizer,
        });
    };
    
    // Protect all routes
    addAuthorizedMethod(employees, 'POST', new apigateway.LambdaIntegration(testcreateEmployeeLambda));
    addAuthorizedMethod(employees, 'GET', new apigateway.LambdaIntegration(testlistEmployeesLambda));

    addAuthorizedMethod(employeeId, 'GET', new apigateway.LambdaIntegration(testgetEmployeeDetailsLambda));
    addAuthorizedMethod(employeeId, 'PUT', new apigateway.LambdaIntegration(testupdateEmployeeLambda));
    addAuthorizedMethod(employeeId, 'DELETE', new apigateway.LambdaIntegration(testdeleteEmployeeLambda));

    const personalData = employeeId.addResource('personal-data');
    addAuthorizedMethod(personalData, 'GET', new apigateway.LambdaIntegration(testgetPersonalDataLambda));
    addAuthorizedMethod(personalData, 'PUT', new apigateway.LambdaIntegration(testupdatePersonalDataLambda));

    const contactInfo = employeeId.addResource('contact-info');
    addAuthorizedMethod(contactInfo, 'GET', new apigateway.LambdaIntegration(testgetContactInfoLambda));
    addAuthorizedMethod(contactInfo, 'PUT', new apigateway.LambdaIntegration(testupdateContactInfoLambda));

    const contractDetails = employeeId.addResource('contract-details');
    addAuthorizedMethod(contractDetails, 'GET', new apigateway.LambdaIntegration(testgetContractDetailsLambda));
    addAuthorizedMethod(contractDetails, 'PUT', new apigateway.LambdaIntegration(testupdateContractDetailsLambda));

    employees.addResource('search').addMethod('GET', new apigateway.LambdaIntegration(testsearchEmployeesLambda), {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: authorizer,
    });

    // --- NEW: Organization Endpoints (Unprotected) ---
    const organization = api.root.addResource('organization');
    
    const department = organization.addResource('department');
    department.addMethod('POST', new apigateway.LambdaIntegration(testcreateDepartmentLambda),{
      authorizer: authorizer,
    });

    const position = organization.addResource('position');
    position.addMethod('POST', new apigateway.LambdaIntegration(testcreatePositionLambda),{
      authorizer: authorizer,
    });

    const orgUnitParent = organization.addResource('{id}');
    const orgUnit = orgUnitParent.addResource('org-unit');
    orgUnit.addMethod('POST', new apigateway.LambdaIntegration(testcreateOrgUnitLambda),);

    const jobClassification = organization.addResource('job-classification');
    jobClassification.addMethod('POST', new apigateway.LambdaIntegration(testcreateJobClassificationLambda));

    const positionMethod = orgUnitParent.addResource('position-method');
    positionMethod.addMethod('POST', new apigateway.LambdaIntegration(testcreatePositionMethodLambda));

    // 8. --- NEW: CloudFormation Outputs ---
    new CfnOutput(this, 'UserPoolId', {
        value: userPool.userPoolId,
        description: 'The ID of the Cognito User Pool',
    });

    new CfnOutput(this, 'UserPoolClientId', {
        value: userPoolClient.userPoolClientId,
        description: 'The ID of the Cognito User Pool Client',
    });
  }
}

module.exports = { TestCdkStack };