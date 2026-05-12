import { arbitrumSepolia, foundry, mainnet, sepolia } from 'wagmi/chains'

// Per-chain image-payload limits, in bytes.
//
// The binding constraint is the block gas limit, not contract code size.
// A mint pays ~16 gas/byte for calldata plus ~22,100 gas per SSTORE for
// each 32-byte storage slot. Vyper also copies Bytes[N] calldata → memory →
// storage, and wallets add a 1.5–2x gas-estimate buffer on top, so the
// practical ceiling lands well below the naive calculation.
//
// Arbitrum Sepolia uses the same per-SSTORE gas cost as L1 (L2 gas, just
// priced cheaper), so the block-limit constraint is comparable to Sepolia.
//
// `MAX` is the slider's upper bound for a chain; `BUDGET` is the default.

export const CHAIN_IMAGE_MAX: Record<number, number> = {
  [mainnet.id]: 10_000,
  [sepolia.id]: 15_000,
  [arbitrumSepolia.id]: 15_000,
  [foundry.id]: 45_000,
}

export const CHAIN_IMAGE_BUDGETS: Record<number, number> = {
  [mainnet.id]: 5_000,
  [sepolia.id]: 12_000,
  [arbitrumSepolia.id]: 12_000,
  [foundry.id]: 12_000,
}

export const MIN_BUDGET = 4_000
export const FALLBACK_BUDGET = 10_000
export const FALLBACK_MAX = 15_000

// Absolute contract-side ceiling (matches Bytes[45000] in NFTGraphic.vy).
export const HARD_MAX = 45_000

export function defaultBudgetFor(chainId: number | undefined): number {
  if (chainId == null) return FALLBACK_BUDGET
  return CHAIN_IMAGE_BUDGETS[chainId] ?? FALLBACK_BUDGET
}

export function maxBudgetFor(chainId: number | undefined): number {
  if (chainId == null) return FALLBACK_MAX
  return Math.min(HARD_MAX, CHAIN_IMAGE_MAX[chainId] ?? FALLBACK_MAX)
}
