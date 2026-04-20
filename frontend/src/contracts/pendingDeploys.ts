// Persists deploy-tx hashes across tab switches and reloads so we can resume
// receipt polling when the DeploymentPanel remounts. An entry is written when
// wallet.deployContract() returns a hash and cleared on final outcome
// (success, revert, or user-initiated clear/manual address).

const LS_KEY = 'vyperFramework.pendingDeploys.v1'

export type PendingDeploy = {
  txHash: `0x${string}`
  timestamp: number
}

type Store = Record<string, Record<string, PendingDeploy>> // chainId -> name -> pending

function read(): Store {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function write(s: Store) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
    window.dispatchEvent(new Event('pending-deploys-changed'))
  } catch {
    /* ignore quota errors */
  }
}

export function setPending(chainId: number, name: string, txHash: `0x${string}`) {
  const s = read()
  const k = String(chainId)
  s[k] ??= {}
  s[k][name] = { txHash, timestamp: Date.now() }
  write(s)
}

export function clearPending(chainId: number, name: string) {
  const s = read()
  const k = String(chainId)
  if (s[k]) {
    delete s[k][name]
    if (Object.keys(s[k]).length === 0) delete s[k]
    write(s)
  }
}

export function getPending(chainId: number, name: string): PendingDeploy | undefined {
  return read()[String(chainId)]?.[name]
}

export function getAllPending(chainId: number): Record<string, PendingDeploy> {
  return { ...(read()[String(chainId)] ?? {}) }
}
