'use client'

import { createConfig, http } from 'wagmi'
import { celo, celoAlfajores } from 'viem/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [celo, celoAlfajores],
  connectors: [
    injected(), // picks up window.ethereum (MiniPay, MetaMask, etc.)
  ],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
    [celoAlfajores.id]: http('https://alfajores-forno.celo-testnet.org'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
