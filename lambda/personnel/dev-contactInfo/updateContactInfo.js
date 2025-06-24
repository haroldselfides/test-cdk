exports.handler = async (event) => {
  console.log('updateContactInfo Lambda invoked:', event);
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Updates employee contact information fields' }),
  };
};