exports.handler = async (event) => {
  console.log('getContractDetails Lambda invoked:', event);
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Retrieves employee contract details for the Contract Details tab' }),
  };
};