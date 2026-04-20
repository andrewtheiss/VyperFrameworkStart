import { foundry, mainnet, sepolia } from 'wagmi/chains'

// Per-chain image-payload limits, in bytes.
//
// Numbers below are *empirical* — theoretical gas math (calldata + SSTOREs)
// undercounts the real cost because Vyper copies the Bytes[N] payload from
// calldata → memory → storage, and wallets tack on a 1.5–2x gas-estimate
// buffer. On Sepolia mints around ~15 KB tend to go through; beyond that,
// wallets often refuse or the tx fails on insufficient-gas.
//
// `MAX` is the slider's upper bound for a chain (what we let the user push to).
// `BUDGET` is the default — the slider lands here unless the user moves it.

export const CHAIN_IMAGE_MAX: Record<number, number> = {
  [mainnet.id]: 10_000, // discourage mainnet — gas is real money
  [sepolia.id]: 15_000, // empirically the ceiling where txs consistently mine
  [foundry.id]: 45_000, // local, free, no realistic constraint
}

export const CHAIN_IMAGE_BUDGETS: Record<number, number> = {
  [mainnet.id]: 5_000,
  [sepolia.id]: 12_000,
  [foundry.id]: 12_000, // match sepolia by default so dev experience matches
}

export const MIN_BUDGET = 4_000
export const FALLBACK_BUDGET = 10_000
export const FALLBACK_MAX = 15_000

// Absolute contract-side ceiling (matches Bytes[45000] in NFTGraphic.vy).
// Per-chain MAX should never exceed this.
export const HARD_MAX = 45_000

export function defaultBudgetFor(chainId: number | undefined): number {
  if (chainId == null) return FALLBACK_BUDGET
  return CHAIN_IMAGE_BUDGETS[chainId] ?? FALLBACK_BUDGET
}

export function maxBudgetFor(chainId: number | undefined): number {
  if (chainId == null) return FALLBACK_MAX
  return Math.min(HARD_MAX, CHAIN_IMAGE_MAX[chainId] ?? FALLBACK_MAX)
}
