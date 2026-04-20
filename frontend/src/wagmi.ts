import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { createConfig, fallback, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { foundry, mainnet, sepolia } from 'wagmi/chains'

const projectId = import.meta.env.VITE_WC_PROJECT_ID
const sepoliaRpc = import.meta.env.VITE_SEPOLIA_RPC_URL
const mainnetRpc = import.meta.env.VITE_MAINNET_RPC_URL

// Viem's built-in public defaults include endpoints (eth.merkle.io etc.) that
// don't set CORS headers, which breaks ENS lookups from the browser. We
// override with a curated list of CORS-friendly public RPCs, wrapped in viem's
// fallback() so a single endpoint outage doesn't break the app.
const MAINNET_PUBLIC_RPCS = [
  'https://cloudflare-eth.com',
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
]
const SEPOLIA_PUBLIC_RPCS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://eth-sepolia.public.blastapi.io',
]

function transportFor(envUrl: string | undefined, publicList: string[]) {
  if (envUrl) return http(envUrl)
  return fallback(publicList.map((u) => http(u)))
}

// Sepolia first = default chain selected by RainbowKit on first connect.
// Foundry stays available for local dev; mainnet last to discourage accidental use.
const chains = [sepolia, foundry, mainnet] as const

export const defaultChain = sepolia

const transports = {
  [sepolia.id]: transportFor(sepoliaRpc, SEPOLIA_PUBLIC_RPCS),
  [foundry.id]: http('http://127.0.0.1:8545'),
  [mainnet.id]: transportFor(mainnetRpc, MAINNET_PUBLIC_RPCS),
}

export const wagmiConfig = projectId
  ? getDefaultConfig({
      appName: 'Vyper Framework',
      projectId,
      chains,
      transports,
      ssr: false,
    })
  : (() => {
      if (import.meta.env.DEV) {
        console.warn(
          '[wagmi] VITE_WC_PROJECT_ID not set — falling back to injected-only connector. ' +
            'Set it in frontend/.env.local to enable WalletConnect / mobile QR connections.',
        )
      }
      return createConfig({
        chains,
        connectors: [injected()],
        transports,
      })
    })()
