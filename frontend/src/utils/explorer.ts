import type { Chain } from 'viem'

/** Returns `${explorer}/tx/${hash}` for chains that expose a block explorer. */
export function explorerTxUrl(
  chain: Chain | undefined,
  hash: `0x${string}` | undefined,
): string | undefined {
  if (!chain || !hash) return undefined
  const base = chain.blockExplorers?.default?.url
  if (!base) return undefined
  return `${base.replace(/\/$/, '')}/tx/${hash}`
}

export function explorerAddressUrl(
  chain: Chain | undefined,
  address: `0x${string}` | undefined,
): string | undefined {
  if (!chain || !address) return undefined
  const base = chain.blockExplorers?.default?.url
  if (!base) return undefined
  return `${base.replace(/\/$/, '')}/address/${address}`
}

export function explorerName(chain: Chain | undefined): string {
  return chain?.blockExplorers?.default?.name ?? 'explorer'
}
