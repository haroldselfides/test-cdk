//lambda/organization/dev-orgUnit/createOrgUnit.js

const {DynamoDBClient} = require('@aws-sdk/client-dynamodb');
const {marshall} = require('@aws-sdk/util-dynamodb');
const {v4: uuidv4} = require('uuid');
const {encrypt} = require('../../utils/cryptoUtil');
const {validateBody} = require('../../utils/validationUtil');

const dbClient = new DynamoDBClient({region: process.env.AWS_REGION});
const tableName = process.env.TEST_TABLE_NAME;  

exports.handler = async (event) => {
    try{
        const body = JSON.parse(event.body);
        const orgUnitId = uuidv4();
        const unitName = encrypt(body.unitName);
        const effectiveDate = body.effectiveDate || new Date().toISOString();
        const description = encrypt(body.description || null);
        constCenterInfo = encrypt(body.centerInfo || null);
        createdBy = encrypt(body.createdBy);
        createdAt = new Date().toISOString();

    }catch(error){
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({message: 'Error creating organization unit',
                error: error.message,
            })
        };
    }   
}
