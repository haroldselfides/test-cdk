exports.handler = async (event) => {
  console.log('updatePersonalData Lambda invoked:', event);
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Updates employee personal data fields' }),
  };
};