exports.handler = async (event) => {
  console.log('listEmployees Lambda invoked:', event);
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Lists all employees with pagination and filtering options' }),
  };
};