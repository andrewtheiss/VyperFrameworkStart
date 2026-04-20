import type { Address } from 'viem'
import { foundry, mainnet, sepolia } from 'wagmi/chains'
import type { ContractName } from '../abis'

// Baked-in addresses (fallback). Live deployments from the in-app deploy panel
// take precedence via localStorage. To pin a deployment, paste its address here.
export const staticDeployments: Record<
  number,
  Partial<Record<ContractName, Address>>
> = {
  [foundry.id]: {},
  [sepolia.id]: {},
  [mainnet.id]: {},
}

const LS_KEY = 'vyperFramework.deployments.v1'

type Overrides = Record<string, Record<string, Address>> // chainId -> name -> address

function readOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Overrides) : {}
  } catch {
    return {}
  }
}

function writeOverrides(o: Overrides) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(o))
    // Notify listeners in the same tab (storage event only fires cross-tab).
    window.dispatchEvent(new Event('deployments-changed'))
  } catch {
    /* ignore quota errors */
  }
}

export function getDeployment(
  chainId: number | undefined,
  name: ContractName,
): Address | undefined {
  if (chainId == null) return undefined
  const o = readOverrides()
  return (o[String(chainId)]?.[name] as Address | undefined) ?? staticDeployments[chainId]?.[name]
}

export function setDeployment(
  chainId: number,
  name: ContractName,
  address: Address,
) {
  const o = readOverrides()
  const key = String(chainId)
  o[key] ??= {}
  o[key][name] = address
  writeOverrides(o)
}

export function clearDeployment(chainId: number, name: ContractName) {
  const o = readOverrides()
  const key = String(chainId)
  if (o[key]) {
    delete o[key][name]
    writeOverrides(o)
  }
}

export function getAllDeployments(chainId: number | undefined): Record<string, Address> {
  if (chainId == null) return {}
  return {
    ...(staticDeployments[chainId] as Record<string, Address> | undefined ?? {}),
    ...(readOverrides()[String(chainId)] ?? {}),
  }
}
