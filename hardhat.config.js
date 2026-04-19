require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config() // fallback to .env

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x' + '0'.repeat(64)
const CELOSCAN_API_KEY = process.env.CELOSCAN_API_KEY || ''

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    alfajores: {
      url: 'https://alfajores-forno.celo-testnet.org',
      chainId: 44787,
      accounts: [PRIVATE_KEY],
      gasPrice: 5_000_000_000,
    },
    celo: {
      url: 'https://forno.celo.org',
      chainId: 42220,
      accounts: [PRIVATE_KEY],
      gasPrice: 100_000_000_000, // 100 gwei — above current base fee
    },
  },
  etherscan: {
    apiKey: {
      alfajores: CELOSCAN_API_KEY,
      celo: CELOSCAN_API_KEY,
    },
    customChains: [
      {
        network: 'alfajores',
        chainId: 44787,
        urls: {
          apiURL: 'https://api-alfajores.celoscan.io/api',
          browserURL: 'https://alfajores.celoscan.io',
        },
      },
      {
        network: 'celo',
        chainId: 42220,
        urls: {
          apiURL: 'https://api.celoscan.io/api',
          browserURL: 'https://celoscan.io',
        },
      },
    ],
  },
}
