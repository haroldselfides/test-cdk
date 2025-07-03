// Load environment variables
require('dotenv').config();

const { Stack, RemovalPolicy, CfnOutput } = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
// const cognito = require('aws-cdk-lib/aws-cognito'); // Commented out
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs');
const path = require('path');
const { PolicyStatement, Effect } = require('aws-cdk-lib/aws-iam');

class TestCdkStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    if (!process.env.TEST_TABLE_NAME || !process.env.TEST_ORGANIZATIONAL_TABLE_NAME || !process.env.AES_SECRET_KEY) {
      throw new Error('Missing required environment variables.');
    }

    // === DynamoDB Tables ===
    const testTable = new dynamodb.Table(this, 'TestTable', {
      tableName: process.env.TEST_TABLE_NAME,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const organizationalTable = new dynamodb.Table(this, 'OrganizationalTable', {
      tableName: process.env.TEST_ORGANIZATIONAL_TABLE_NAME,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const lambdaEnvironment = {
      TEST_TABLE_NAME: testTable.tableName,
      TEST_ORGANIZATIONAL_TABLE_NAME: organizationalTable.tableName,
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

    const addMethod = (resource, method, integration) => {
      resource.addMethod(method, integration, {
        authorizationType: apigateway.AuthorizationType.NONE,
      });
    };

    const functionProps = (entryPath) => ({
      entry: path.join(__dirname, entryPath),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: lambdaEnvironment,
    });

    // === Personnel Lambdas ===
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

    // === Organization Lambdas ===
    const testcreateDepartmentLambda = new NodejsFunction(this, 'CreateDepartmentLambda', functionProps('../lambda/organization/dev-department/createDepartment.js'));
    const testgetDepartmentLambda = new NodejsFunction(this, 'GetDepartmentLambda', functionProps('../lambda/organization/dev-department/getDepartment.js'));
    const listDepartmentLambda = new NodejsFunction(this, 'ListDepartmentLambda', functionProps('../lambda/organization/dev-department/listDepartment.js'));

    const testcreatePositionLambda = new NodejsFunction(this, 'CreatePositionLambda', functionProps('../lambda/organization/dev-position/createPosition.js'));
    const testgetPositionLambda = new NodejsFunction(this, 'GetPositionLambda', functionProps('../lambda/organization/dev-position/getPosition.js'));
    const testcreatePositionMethodLambda = new NodejsFunction(this, 'CreatePositionMethodLambda', functionProps('../lambda/organization/dev-position/createPositionMethod.js'));
    const testcreateOrgUnitLambda = new NodejsFunction(this, 'CreateOrgUnitLambda', functionProps('../lambda/organization/dev-orgUnit/createOrgUnit.js'));
    const testcreateJobClassificationLambda = new NodejsFunction(this, 'CreateJobClassificationLambda', functionProps('../lambda/organization/dev-jobClassification/createJobClassification.js'));

    // === Permissions ===
    testTable.grantReadWriteData(testcreateEmployeeLambda);
    testTable.grant(testupdateEmployeeLambda, 'dynamodb:TransactWriteItems', 'dynamodb:PutItem');
    testTable.grant(testdeleteEmployeeLambda, 'dynamodb:UpdateItem');
    testTable.grant(testgetEmployeeDetailsLambda, 'dynamodb:Query');
    testTable.grant(testgetPersonalDataLambda, 'dynamodb:GetItem');
    testTable.grant(testupdatePersonalDataLambda, 'dynamodb:UpdateItem');
    testTable.grant(testgetContactInfoLambda, 'dynamodb:GetItem');
    testTable.grant(testupdateContactInfoLambda, 'dynamodb:TransactWriteItems', 'dynamodb:UpdateItem', 'dynamodb:ConditionCheckItem');
    testTable.grant(testgetContractDetailsLambda, 'dynamodb:GetItem');
    testTable.grant(testupdateContractDetailsLambda, 'dynamodb:TransactWriteItems', 'dynamodb:UpdateItem', 'dynamodb:ConditionCheckItem');
    testTable.grant(testlistEmployeesLambda, 'dynamodb:Scan');
    testTable.grant(testsearchEmployeesLambda, 'dynamodb:Scan');

    organizationalTable.grantReadWriteData(testcreateDepartmentLambda);
    organizationalTable.grantReadData(testgetDepartmentLambda);
    organizationalTable.grantReadData(listDepartmentLambda);
    organizationalTable.grantReadWriteData(testcreatePositionLambda);
    organizationalTable.grantReadData(testgetPositionLambda);
    organizationalTable.grantReadWriteData(testcreateOrgUnitLambda);
    organizationalTable.grantReadWriteData(testcreateJobClassificationLambda);
    organizationalTable.grantReadWriteData(testcreatePositionMethodLambda);

    testcreateDepartmentLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
      resources: [testTable.tableArn],
    }));

    testcreatePositionLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
      resources: [testTable.tableArn, organizationalTable.tableArn],
    }));

    // === API Routes ===
    const employees = api.root.addResource('personnel').addResource('employees');
    const employeeId = employees.addResource('{employeeId}');

    addMethod(employees, 'POST', new apigateway.LambdaIntegration(testcreateEmployeeLambda));
    addMethod(employees, 'GET', new apigateway.LambdaIntegration(testlistEmployeesLambda));
    addMethod(employeeId, 'GET', new apigateway.LambdaIntegration(testgetEmployeeDetailsLambda));
    addMethod(employeeId, 'PUT', new apigateway.LambdaIntegration(testupdateEmployeeLambda));
    addMethod(employeeId, 'DELETE', new apigateway.LambdaIntegration(testdeleteEmployeeLambda));

    const personalData = employeeId.addResource('personal-data');
    addMethod(personalData, 'GET', new apigateway.LambdaIntegration(testgetPersonalDataLambda));
    addMethod(personalData, 'PUT', new apigateway.LambdaIntegration(testupdatePersonalDataLambda));

    const contactInfo = employeeId.addResource('contact-info');
    addMethod(contactInfo, 'GET', new apigateway.LambdaIntegration(testgetContactInfoLambda));
    addMethod(contactInfo, 'PUT', new apigateway.LambdaIntegration(testupdateContactInfoLambda));

    const contractDetails = employeeId.addResource('contract-details');
    addMethod(contractDetails, 'GET', new apigateway.LambdaIntegration(testgetContractDetailsLambda));
    addMethod(contractDetails, 'PUT', new apigateway.LambdaIntegration(testupdateContractDetailsLambda));

    employees.addResource('search').addMethod('GET', new apigateway.LambdaIntegration(testsearchEmployeesLambda), {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    const organization = api.root.addResource('organization');
    const department = organization.addResource('department');
    addMethod(department, 'POST', new apigateway.LambdaIntegration(testcreateDepartmentLambda));
    addMethod(department, 'GET', new apigateway.LambdaIntegration(listDepartmentLambda)); 

    const departmentId = department.addResource('{departmentId}');
    addMethod(departmentId, 'GET', new apigateway.LambdaIntegration(testgetDepartmentLambda));

    const position = organization.addResource('position');
    addMethod(position, 'POST', new apigateway.LambdaIntegration(testcreatePositionLambda));
    const positionId = position.addResource('{positionId}');
    addMethod(positionId, 'GET', new apigateway.LambdaIntegration(testgetPositionLambda));

    const orgUnitParent = organization.addResource('{id}');
    const orgUnit = orgUnitParent.addResource('org-unit');
    addMethod(orgUnit, 'POST', new apigateway.LambdaIntegration(testcreateOrgUnitLambda));

    const jobClassification = organization.addResource('job-classification');
    addMethod(jobClassification, 'POST', new apigateway.LambdaIntegration(testcreateJobClassificationLambda));

    const positionMethod = orgUnitParent.addResource('position-method');
    addMethod(positionMethod, 'POST', new apigateway.LambdaIntegration(testcreatePositionMethodLambda));
  }
}

module.exports = { TestCdkStack };
