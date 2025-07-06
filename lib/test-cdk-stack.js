// lib/hr-cdk-stack-stack.js

// Load environment variables
require('dotenv').config();

const { Stack, RemovalPolicy, CfnOutput } = require('aws-cdk-lib'); // Added CfnOutput
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
// const cognito = require('aws-cdk-lib/aws-cognito'); // 👈 Commented out Cognito library
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs');
const path = require('path');

class TestCdkStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    if (!process.env.TEST_TABLE_NAME || !process.env.TEST_ORGANIZATIONAL_TABLE_NAME || !process.env.AES_SECRET_KEY) {
      throw new Error('Missing required environment variables. Check .env for TEST_TABLE_NAME, TEST_ORGANIZATIONAL_TABLE_NAME, and AES_SECRET_KEY.');
    }

    // === COGNITO SETUP (COMMENTED FOR TESTING PURPOSES) ===
    /*
    const userPool = new cognito.UserPool(this, 'TestUserPool', {
      userPoolName: 'TestUserPool',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'TestUserPoolClient', {
      userPool,
      generateSecret: false,
      authFlows: {
        userPassword: true,
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'TestCognitoAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });
    */

    const testTable = new dynamodb.Table(this, 'TestTable', {
      tableName: process.env.TEST_TABLE_NAME,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const testorganizationalTable = new dynamodb.Table(this, 'TestOrganizationalTable', {
      tableName: process.env.TEST_ORGANIZATIONAL_TABLE_NAME,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const lambdaEnvironment = {
      TEST_TABLE_NAME: testTable.tableName,
      TEST_ORGANIZATIONAL_TABLE_NAME: testorganizationalTable.tableName,
      AES_SECRET_KEY: process.env.AES_SECRET_KEY,
    };

    const api = new apigateway.RestApi(this, 'TestRESTAPI', {
      restApiName: 'Test REST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const functionProps = (entryPath) => ({
      entry: path.join(__dirname, entryPath),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: lambdaEnvironment,
    });

    // Define Lambda functions
    const testcreateEmployeeLambda = new NodejsFunction(this, 'TestCreateEmployeeLambda', functionProps('../lambda/personnel/dev-employee/createEmployee.js'));
    const testgetEmployeeDetailsLambda = new NodejsFunction(this, 'TestGetEmployeeDetailsLambda', functionProps('../lambda/personnel/dev-employee/getEmployee.js'));
    const testupdateEmployeeLambda = new NodejsFunction(this, 'TestUpdateEmployeeLambda', functionProps('../lambda/personnel/dev-employee/updateEmployee.js'));
    const testdeleteEmployeeLambda = new NodejsFunction(this, 'TestDeleteEmployeeLambda', functionProps('../lambda/personnel/dev-employee/deleteEmployee.js'));
    const testgetPersonalDataLambda = new NodejsFunction(this, 'TestGetPersonalDataLambda', functionProps('../lambda/personnel/dev-personalData/getPersonalData.js'));
    const testupdatePersonalDataLambda = new NodejsFunction(this, 'TestUpdatePersonalDataLambda', functionProps('../lambda/personnel/dev-personalData/updatePersonalData.js'));
    const testgetContactInfoLambda = new NodejsFunction(this, 'TestGetContactInfoLambda', functionProps('../lambda/personnel/dev-contactInfo/getContactInfo.js'));
    const testupdateContactInfoLambda = new NodejsFunction(this, 'TestUpdateContactInfoLambda', functionProps('../lambda/personnel/dev-contactInfo/updateContactInfo.js'));
    const testgetContractDetailsLambda = new NodejsFunction(this, 'TestGetContractDetailsLambda', functionProps('../lambda/personnel/dev-contractDetails/getContractDetails.js'));
    const testupdateContractDetailsLambda = new NodejsFunction(this, 'TestUpdateContractDetailsLambda', functionProps('../lambda/personnel/dev-contractDetails/updateContractDetails.js'));
    const testlistEmployeesLambda = new NodejsFunction(this, 'TestListEmployeesLambda', functionProps('../lambda/personnel/listEmployees.js'));
    const testsearchEmployeesLambda = new NodejsFunction(this, 'TestSearchEmployeesLambda', functionProps('../lambda/personnel/searchEmployees.js'));

    const testcreateDepartmentLambda = new NodejsFunction(this, 'TestCreateDepartmentLambda', functionProps('../lambda/organization/dev-department/createDepartment.js'));
    const testcreatePositionLambda = new NodejsFunction(this, 'TestCreatePositionLambda', functionProps('../lambda/organization/dev-position/createPosition.js'));
    const testcreatePositionMethodLambda = new NodejsFunction(this, 'TestCreatePositionMethodLambda', functionProps('../lambda/organization/dev-position/createPositionMethod.js'));
    const testcreateOrgUnitLambda = new NodejsFunction(this, 'TestCreateOrgUnitLambda', functionProps('../lambda/organization/dev-orgUnit/createOrgUnit.js'));
    const testcreateJobClassificationLambda = new NodejsFunction(this, 'TestCreateJobClassificationLambda', functionProps('../lambda/organization/dev-jobClassification/createJobClassification.js'));

    const testgetDepartmentLambda = new NodejsFunction(this, 'TestGetDepartmentLambda', functionProps('../lambda/organization/dev-department/getDepartment.js'));
    const testgetPositionLambda = new NodejsFunction(this, 'TestGetPositionLambda', functionProps('../lambda/organization/dev-position/getPosition.js'));
    const testgetOrgUnitLambda = new NodejsFunction(this, 'TestGetOrgUnitLambda', functionProps('../lambda/organization/dev-orgUnit/getOrgUnit.js'));
    const testgetJobClassificationLambda = new NodejsFunction(this, 'TestGetJobClassificationLambda', functionProps('../lambda/organization/dev-jobClassification/getJobClassification.js'));

    const testlistDepartmentLambda = new NodejsFunction(this, 'TestListDepartmentLambda', functionProps('../lambda/organization/dev-department/listDepartment.js'));
    const testlistPositionLambda = new NodejsFunction(this, 'TestListPositionLambda', functionProps('../lambda/organization/dev-position/listPosition.js'));
    const testlistOrgUnitLambda = new NodejsFunction(this, 'TestListOrgUnitLambda', functionProps('../lambda/organization/dev-orgUnit/listOrgUnit.js'));
    const testlistJobClassificationLambda = new NodejsFunction(this, 'TestListJobClassificationLambda', functionProps('../lambda/organization/dev-jobClassification/listJobClassification.js'));

    // Grant permissions
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
    testTable.grant(testcreateDepartmentLambda, 'dynamodb:GetItem');

    testorganizationalTable.grantReadWriteData(testcreateDepartmentLambda);
    testorganizationalTable.grantReadWriteData(testcreatePositionLambda);
    testorganizationalTable.grantReadWriteData(testcreateOrgUnitLambda);
    testorganizationalTable.grantReadWriteData(testcreateJobClassificationLambda);
    testorganizationalTable.grantReadWriteData(testcreatePositionMethodLambda);
    testorganizationalTable.grantReadData(testgetDepartmentLambda);
    testorganizationalTable.grantReadData(testgetPositionLambda);
    testorganizationalTable.grantReadData(testgetOrgUnitLambda);
    testorganizationalTable.grantReadData(testgetJobClassificationLambda);
    testorganizationalTable.grantReadData(testlistDepartmentLambda);
    testorganizationalTable.grantReadData(testlistPositionLambda);
    testorganizationalTable.grantReadData(testlistOrgUnitLambda);
    testorganizationalTable.grantReadData(testlistJobClassificationLambda);

    // Replace Cognito auth method with open access for testing
    const addAuthorizedMethod = (resource, method, integration) => {
      resource.addMethod(method, integration); // 🔓 No authorization for testing
    };

    const employees = api.root.addResource('personnel').addResource('employees');
    const employeeId = employees.addResource('{employeeId}');

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

    employees.addResource('search').addMethod('GET', new apigateway.LambdaIntegration(testsearchEmployeesLambda));

    const organization = api.root.addResource('organization');
    const orgParentById = organization.addResource('{id}');

    const department = organization.addResource('department');
    addAuthorizedMethod(department, 'POST', new apigateway.LambdaIntegration(testcreateDepartmentLambda));
    addAuthorizedMethod(department, 'GET', new apigateway.LambdaIntegration(testlistDepartmentLambda));
    const departmentById = department.addResource('{departmentId}');
    addAuthorizedMethod(departmentById, 'GET', new apigateway.LambdaIntegration(testgetDepartmentLambda));

    const position = organization.addResource('position');
    addAuthorizedMethod(position, 'POST', new apigateway.LambdaIntegration(testcreatePositionLambda));
    addAuthorizedMethod(position, 'GET', new apigateway.LambdaIntegration(testlistPositionLambda));
    const positionById = position.addResource('{positionId}');
    addAuthorizedMethod(positionById, 'GET', new apigateway.LambdaIntegration(testgetPositionLambda));
    addAuthorizedMethod(orgParentById.addResource('position-method'), 'POST', new apigateway.LambdaIntegration(testcreatePositionMethodLambda));

    const orgUnitCollection = organization.addResource('org-unit');
    addAuthorizedMethod(orgUnitCollection, 'GET', new apigateway.LambdaIntegration(testlistOrgUnitLambda));
    const orgUnitById = orgUnitCollection.addResource('{unitId}');
    addAuthorizedMethod(orgUnitById, 'GET', new apigateway.LambdaIntegration(testgetOrgUnitLambda));
    addAuthorizedMethod(orgParentById.addResource('org-unit'), 'POST', new apigateway.LambdaIntegration(testcreateOrgUnitLambda));

    const jobClassification = organization.addResource('job-classification');
    addAuthorizedMethod(jobClassification, 'POST', new apigateway.LambdaIntegration(testcreateJobClassificationLambda));
    addAuthorizedMethod(jobClassification, 'GET', new apigateway.LambdaIntegration(testlistJobClassificationLambda));
    const jobClassificationById = jobClassification.addResource('{jobClassificationId}');
    addAuthorizedMethod(jobClassificationById, 'GET', new apigateway.LambdaIntegration(testgetJobClassificationLambda));

    // === COGNITO OUTPUTS COMMENTED ===
    /*
    new CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'The ID of the Cognito User Pool',
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'The ID of the Cognito User Pool Client',
    });
    */
  }
}

module.exports = { TestCdkStack };
