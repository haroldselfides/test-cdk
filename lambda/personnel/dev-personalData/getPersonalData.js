exports.handler = async (event) => {
  console.log('getPersonalData Lambda invoked:', event);
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Retrieves employee personal data for the Personal Data tab' }),
  };
};