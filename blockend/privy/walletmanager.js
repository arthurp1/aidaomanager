
const { PrivyClient } = require('privy');

const privyClient = new PrivyClient({
  apiKey: process.env.PRIVY_API_KEY,
});

const createWallet = async () => {
  const wallet = await privyClient.createWallet();
  return wallet;
};

module.exports = { createWallet };