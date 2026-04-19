/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_ESCROW_ADDRESS_MAINNET:
      process.env.NEXT_PUBLIC_ESCROW_ADDRESS_MAINNET || '0x4204b3c3e4414cab70b73ba583fb608d5e1dcec0',
    NEXT_PUBLIC_ESCROW_ADDRESS_TESTNET:
      process.env.NEXT_PUBLIC_ESCROW_ADDRESS_TESTNET || '0x',
    NEXT_PUBLIC_CHAIN_ID:
      process.env.NEXT_PUBLIC_CHAIN_ID || '42220',
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    // Stub optional peer deps that aren't installed
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    }
    return config
  },
}

module.exports = nextConfig
