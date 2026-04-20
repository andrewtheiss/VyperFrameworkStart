import { Fragment, useEffect, useMemo, useState } from 'react'
import type { Abi, Address, Chain } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { contracts, type ContractName } from '../abis'
import { ArgParseError, parseConstructorArgs } from '../contracts/args'
import {
  clearDeployment,
  getAllDeployments,
  setDeployment,
} from '../contracts/deployments'
import {
  clearPending,
  getAllPending,
  getPending,
  setPending,
} from '../contracts/pendingDeploys'
import {
  autoCsvFor,
  currentFocus,
  deploymentPlan,
  findAlternativeContaining,
  findStep,
  flattenSteps,
  orderedContractNames,
  statusOf,
  topoSort,
  type AtomicStep,
  type StepStatus,
} from '../contracts/deploymentPlan'
import { explorerAddressUrl, explorerName, explorerTxUrl } from '../utils/explorer'
import { DeploymentFlowDiagram } from './DeploymentFlowDiagram'
import { DeploymentProgress } from './DeploymentProgress'

type DeployState = {
  status: 'idle' | 'pending' | 'mining' | 'done' | 'error'
  statusMessage?: string
  txHash?: `0x${string}`
  deployedAddress?: Address
}

type UserOverrides = { selected?: boolean; csv?: string }

const EMPTY_DEPLOY: DeployState = { status: 'idle' }

function constructorInputsOf(abi: Abi) {
  const c = abi.find((e) => e.type === 'constructor')
  if (!c || c.type !== 'constructor') return []
  return c.inputs ?? []
}

export function DeploymentPanel() {
  const { address: account, chain } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [existing, setExisting] = useState<Record<string, Address>>({})
  const [overrides, setOverrides] = useState<Record<string, UserOverrides>>({})
  const [deployStates, setDeployStates] = useState<Record<string, DeployState>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const refresh = () => setExisting(getAllDeployments(chain?.id))
    refresh()
    window.addEventListener('deployments-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('deployments-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [chain?.id])

  // Per-row draft state for "set address manually" input (row name -> draft).
  const [manualDrafts, setManualDrafts] = useState<Record<string, string>>({})

  // Reset panel state on chain change AND resume any pending receipts for
  // this chain. When the user navigates away mid-mine, the component unmounts
  // and its waitForTransactionReceipt promise is orphaned; we re-attach here.
  useEffect(() => {
    setOverrides({})
    setDeployStates({})
    setManualDrafts({})
    setBusy(false)
    if (!chain || !publicClient) return

    const pending = getAllPending(chain.id)
    const entries = Object.entries(pending)
    if (entries.length === 0) return

    // Show them as mining immediately while we poll.
    const resumeStates: Record<string, DeployState> = {}
    for (const [name, info] of entries) {
      resumeStates[name] = {
        status: 'mining',
        statusMessage: 'resuming previous tx…',
        txHash: info.txHash,
      }
    }
    setDeployStates(resumeStates)

    let cancelled = false
    for (const [name, info] of entries) {
      publicClient
        .waitForTransactionReceipt({ hash: info.txHash, timeout: 180_000 })
        .then((receipt) => {
          if (cancelled) return
          if (receipt.status === 'reverted') {
            clearPending(chain.id, name)
            setDeployStates((s) => ({
              ...s,
              [name]: { status: 'error', statusMessage: 'tx reverted' },
            }))
            return
          }
          if (!receipt.contractAddress) {
            clearPending(chain.id, name)
            setDeployStates((s) => ({
              ...s,
              [name]: { status: 'error', statusMessage: 'no contractAddress in receipt' },
            }))
            return
          }
          setDeployment(chain.id, name as ContractName, receipt.contractAddress)
          clearPending(chain.id, name)
          setDeployStates((s) => ({
            ...s,
            [name]: {
              status: 'done',
              statusMessage: `deployed in block ${receipt.blockNumber}`,
              deployedAddress: receipt.contractAddress!,
              txHash: info.txHash,
            },
          }))
        })
        .catch((e) => {
          if (cancelled) return
          // Timeout or dropped tx. Leave the pending entry so the user can
          // retry via "check now" — if it's truly dropped, they'll clear it
          // manually or set the address by hand.
          setDeployStates((s) => ({
            ...s,
            [name]: {
              status: 'error',
              statusMessage: `receipt not received — try "check now" or set address manually. (${(e as Error).message})`,
              txHash: info.txHash,
            },
          }))
        })
    }
    return () => {
      cancelled = true
    }
  }, [chain?.id, publicClient])

  const ordered = useMemo(() => orderedContractNames(), [])
  const focus = useMemo(() => currentFocus(existing), [existing])

  const rows = useMemo(() => {
    return ordered.map((name) => {
      const o = overrides[name] ?? {}
      const step = findStep(name)
      const stat = statusOf(name, existing)
      const isCurrent = focus === name
      const autoSelected = isCurrent
      const autoCsv = autoCsvFor(name, existing)
      return {
        name,
        step,
        inputs: constructorInputsOf(contracts[name].abi as unknown as Abi),
        status: stat,
        isCurrent,
        selected: o.selected ?? autoSelected,
        csvArgs: o.csv ?? autoCsv,
        csvOverridden: o.csv !== undefined,
        autoCsv,
        existingAddress: existing[name],
        deploy: deployStates[name] ?? EMPTY_DEPLOY,
      }
    })
  }, [ordered, overrides, deployStates, existing, focus])

  const rowsByName = useMemo(() => {
    const m: Record<string, (typeof rows)[number]> = {}
    for (const r of rows) m[r.name] = r
    return m
  }, [rows])

  const plannedNames = useMemo(() => new Set(flattenSteps().map((s) => s.name)), [])
  const unplannedRows = rows.filter((r) => !plannedNames.has(r.name))

  const patchOverride = (name: string, p: Partial<UserOverrides>) =>
    setOverrides((o) => ({ ...o, [name]: { ...(o[name] ?? {}), ...p } }))
  const clearOverride = (name: string, key: keyof UserOverrides) =>
    setOverrides((o) => {
      const next = { ...(o[name] ?? {}) }
      delete next[key]
      return { ...o, [name]: next }
    })
  const patchDeploy = (name: string, p: Partial<DeployState>) =>
    setDeployStates((s) => ({ ...s, [name]: { ...(s[name] ?? EMPTY_DEPLOY), ...p } }))

  // Radio-like: ticking an alternative option unticks its siblings.
  const onSelect = (name: ContractName, v: boolean) => {
    patchOverride(name, { selected: v })
    if (v) {
      const alt = findAlternativeContaining(name)
      if (alt) {
        for (const sibling of alt.options) {
          if (sibling.name !== name) patchOverride(sibling.name, { selected: false })
        }
      }
    }
  }

  const deploySelected = async () => {
    if (!walletClient || !publicClient || !account || !chain) return
    const selected = rows.filter((r) => r.selected).map((r) => r.name as ContractName)
    const order = topoSort(selected)
    if (order.length === 0) return

    setBusy(true)
    const batchAddresses: Record<string, Address> = {}
    try {
      for (const name of order) {
        const step = findStep(name)
        const entry = contracts[name]
        const inputs = constructorInputsOf(entry.abi as unknown as Abi)
        const o = overrides[name] ?? {}
        const liveAddresses = { ...existing, ...batchAddresses }
        const effectiveCsv =
          o.csv !== undefined
            ? o.csv
            : autoCsvWith(inputs, step, liveAddresses)

        let parsedArgs: unknown[]
        try {
          parsedArgs = parseConstructorArgs(effectiveCsv, inputs)
        } catch (e) {
          const msg = e instanceof ArgParseError ? e.message : String(e)
          patchDeploy(name, { status: 'error', statusMessage: `arg error: ${msg}` })
          continue
        }

        patchDeploy(name, {
          status: 'pending',
          statusMessage: 'awaiting wallet…',
          txHash: undefined,
          deployedAddress: undefined,
        })
        let hash: `0x${string}` | undefined
        try {
          hash = await walletClient.deployContract({
            abi: entry.abi as unknown as Abi,
            bytecode: entry.bytecode,
            args: parsedArgs as never,
            account,
          })
          // Persist the tx hash so we can resume polling if the user tab-
          // switches or reloads before the receipt arrives.
          setPending(chain.id, name, hash)
          patchDeploy(name, { status: 'mining', statusMessage: 'mining…', txHash: hash })

          const receipt = await publicClient.waitForTransactionReceipt({
            hash,
            timeout: 180_000,
          })
          if (receipt.status === 'reverted') {
            clearPending(chain.id, name)
            patchDeploy(name, { status: 'error', statusMessage: 'tx reverted' })
            continue
          }
          if (!receipt.contractAddress) {
            clearPending(chain.id, name)
            throw new Error('no contractAddress in receipt')
          }

          batchAddresses[name] = receipt.contractAddress
          setDeployment(chain.id, name, receipt.contractAddress)
          clearPending(chain.id, name)
          patchDeploy(name, {
            status: 'done',
            statusMessage: `deployed in block ${receipt.blockNumber}`,
            deployedAddress: receipt.contractAddress,
            txHash: hash,
          })
          clearOverride(name, 'selected')
        } catch (e) {
          // If we have a hash, pending stays set so the user can "check now"
          // later. Otherwise clear to avoid a ghost pending entry.
          if (!hash) clearPending(chain.id, name)
          patchDeploy(name, {
            status: 'error',
            statusMessage: (e as Error).message,
            txHash: hash,
          })
        }
      }
    } finally {
      setBusy(false)
    }
  }

  // Manual receipt check — useful when the tx actually mined but our
  // polling state got orphaned or the RPC is slow.
  const checkTx = async (name: string) => {
    if (!chain || !publicClient) return
    const pending = getPending(chain.id, name)
    const storedHash = (deployStates[name]?.txHash ?? pending?.txHash) as
      | `0x${string}`
      | undefined
    if (!storedHash) {
      patchDeploy(name, { status: 'error', statusMessage: 'no tx hash to check' })
      return
    }
    patchDeploy(name, {
      status: 'mining',
      statusMessage: 'checking…',
      txHash: storedHash,
    })
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: storedHash })
      if (receipt.status === 'reverted') {
        clearPending(chain.id, name)
        patchDeploy(name, { status: 'error', statusMessage: 'tx reverted' })
        return
      }
      if (receipt.contractAddress) {
        setDeployment(chain.id, name as ContractName, receipt.contractAddress)
        clearPending(chain.id, name)
        patchDeploy(name, {
          status: 'done',
          statusMessage: `deployed in block ${receipt.blockNumber}`,
          deployedAddress: receipt.contractAddress,
          txHash: storedHash,
        })
        clearOverride(name, 'selected')
      }
    } catch (e) {
      // viem throws TransactionReceiptNotFoundError when the tx isn't mined yet.
      const msg = (e as Error).message
      if (/not\s*found|receipt/i.test(msg)) {
        patchDeploy(name, {
          status: 'mining',
          statusMessage: 'still pending — try again in a few seconds',
          txHash: storedHash,
        })
      } else {
        patchDeploy(name, { status: 'error', statusMessage: `check failed: ${msg}` })
      }
    }
  }

  // Manual address entry — used when the user knows the contract was deployed
  // but the UI state is stale or the tx was sent outside our flow.
  const openManual = (name: string) => setManualDrafts((d) => ({ ...d, [name]: '' }))
  const updateManual = (name: string, v: string) =>
    setManualDrafts((d) => ({ ...d, [name]: v }))
  const cancelManual = (name: string) =>
    setManualDrafts((d) => {
      const { [name]: _drop, ...rest } = d
      return rest
    })
  const saveManual = (name: ContractName) => {
    const raw = (manualDrafts[name] ?? '').trim()
    if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
      patchDeploy(name, {
        status: 'error',
        statusMessage: `invalid address "${raw}" — expected 0x + 40 hex chars`,
      })
      return
    }
    if (!chain) return
    setDeployment(chain.id, name, raw as Address)
    clearPending(chain.id, name)
    patchDeploy(name, {
      status: 'done',
      statusMessage: 'address set manually',
      deployedAddress: raw as Address,
    })
    clearOverride(name, 'selected')
    cancelManual(name)
  }

  const selectedRows = rows.filter((r) => r.selected)
  const canDeploy = !!walletClient && !!account && !!chain && selectedRows.length > 0 && !busy
  const deployingRow = rows.find(
    (r) => r.deploy.status === 'pending' || r.deploy.status === 'mining',
  )
  const deployBtnLabel = busy
    ? deployingRow
      ? `Deploying ${deployingRow.name}…`
      : 'Deploying…'
    : selectedRows.length === 0
      ? 'Pick a contract below'
      : selectedRows.length === 1
        ? `Deploy ${selectedRows[0].name}`
        : `Deploy ${selectedRows.length} contracts`

  return (
    <section className="panel">
      <h2>Deploy contracts</h2>
      {!chain ? (
        <p className="hint">Connect a wallet to deploy.</p>
      ) : (
        <p className="hint">
          Deploying from <code>{account}</code> to <strong>{chain.name}</strong>. The next
          required step is auto-checked; dependent args auto-fill from prior deploys. You
          can override anything by clicking the row.
        </p>
      )}

      <DeploymentFlowDiagram active={busy} />

      <div className="deploy-sticky">
        <DeploymentProgress existing={existing} focus={focus} />
        <button
          className="deploy-btn-primary"
          disabled={!canDeploy}
          onClick={deploySelected}
        >
          {deployBtnLabel}
        </button>
      </div>

      {deploymentPlan.length > 0 && (
        <div className="group">
          <div className="group-header">
            <h3>App setup</h3>
            <p className="hint">Deploy in order. The next step auto-selects as each lands.</p>
          </div>
          <table className="deploy-table">
            <thead>
              <tr>
                <th />
                <th>Contract</th>
                <th>Constructor args (CSV)</th>
                <th>Current address</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {deploymentPlan.map((step) => {
                if (step.kind === 'atomic') {
                  const row = rowsByName[step.name]
                  if (!row) return null
                  return (
                    <ContractRow
                      key={step.name}
                      row={row}
                      chain={chain}
                      busy={busy}
                      manualDraft={manualDrafts[step.name]}
                      onSelect={onSelect}
                      onCsv={(n, v) => patchOverride(n, { csv: v })}
                      onResetCsv={(n) => clearOverride(n, 'csv')}
                      onClearAddress={(n) => {
                        if (!chain) return
                        clearDeployment(chain.id, n as ContractName)
                        clearPending(chain.id, n)
                      }}
                      onCheckTx={checkTx}
                      onOpenManual={openManual}
                      onUpdateManual={updateManual}
                      onCancelManual={cancelManual}
                      onSaveManual={saveManual}
                    />
                  )
                }
                // Alternative — header, options, OR divider.
                return (
                  <Fragment key={step.id}>
                    <tr className="alt-header">
                      <td colSpan={5}>
                        <div className="alt-header-body">
                          <strong>{step.label}</strong>
                          {step.description && <span className="hint"> · {step.description}</span>}
                        </div>
                      </td>
                    </tr>
                    {step.options.map((opt, i) => {
                      const row = rowsByName[opt.name]
                      if (!row) return null
                      return (
                        <Fragment key={opt.name}>
                          {i > 0 && (
                            <tr className="or-divider" aria-hidden>
                              <td colSpan={5}>
                                <span>OR</span>
                              </td>
                            </tr>
                          )}
                          <ContractRow
                            row={row}
                            chain={chain}
                            busy={busy}
                            altOption
                            manualDraft={manualDrafts[opt.name]}
                            onSelect={onSelect}
                            onCsv={(n, v) => patchOverride(n, { csv: v })}
                            onResetCsv={(n) => clearOverride(n, 'csv')}
                            onClearAddress={(n) => {
                              if (!chain) return
                              clearDeployment(chain.id, n as ContractName)
                              clearPending(chain.id, n)
                            }}
                            onCheckTx={checkTx}
                            onOpenManual={openManual}
                            onUpdateManual={updateManual}
                            onCancelManual={cancelManual}
                            onSaveManual={saveManual}
                          />
                        </Fragment>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {unplannedRows.length > 0 && (
        <div className="group">
          <div className="group-header">
            <h3>Other contracts</h3>
            <p className="hint">Unrelated to the main app flow — deploy manually if needed.</p>
          </div>
          <table className="deploy-table">
            <thead>
              <tr>
                <th />
                <th>Contract</th>
                <th>Constructor args (CSV)</th>
                <th>Current address</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {unplannedRows.map((row) => (
                <ContractRow
                  key={row.name}
                  row={row}
                  chain={chain}
                  busy={busy}
                  manualDraft={manualDrafts[row.name]}
                  onSelect={onSelect}
                  onCsv={(n, v) => patchOverride(n, { csv: v })}
                  onResetCsv={(n) => clearOverride(n, 'csv')}
                  onClearAddress={(n) => {
                    if (!chain) return
                    clearDeployment(chain.id, n as ContractName)
                    clearPending(chain.id, n)
                  }}
                  onCheckTx={checkTx}
                  onOpenManual={openManual}
                  onUpdateManual={updateManual}
                  onCancelManual={cancelManual}
                  onSaveManual={saveManual}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

    </section>
  )
}

function autoCsvWith(
  inputs: readonly { name?: string; type: string }[],
  step: AtomicStep | undefined,
  deployed: Record<string, Address | undefined>,
): string {
  if (inputs.length === 0) return ''
  const slots = new Array<string>(inputs.length).fill('')
  for (const dep of step?.dependsOn ?? []) {
    const idx = inputs.findIndex((i) => i.name === dep.argName)
    if (idx >= 0 && deployed[dep.contract]) slots[idx] = deployed[dep.contract]!
  }
  return slots.join(', ')
}

// --- Row rendering ---------------------------------------------------------

type Row = {
  name: string
  step: AtomicStep | undefined
  inputs: readonly { name?: string; type: string }[]
  status: StepStatus
  isCurrent: boolean
  selected: boolean
  csvArgs: string
  csvOverridden: boolean
  autoCsv: string
  existingAddress?: Address
  deploy: DeployState
}

function ContractRow({
  row,
  chain,
  busy,
  altOption,
  manualDraft,
  onSelect,
  onCsv,
  onResetCsv,
  onClearAddress,
  onCheckTx,
  onOpenManual,
  onUpdateManual,
  onCancelManual,
  onSaveManual,
}: {
  row: Row
  chain: Chain | undefined
  busy: boolean
  altOption?: boolean
  manualDraft: string | undefined
  onSelect: (name: ContractName, v: boolean) => void
  onCsv: (name: string, v: string) => void
  onResetCsv: (name: string) => void
  onClearAddress: (name: string) => void
  onCheckTx: (name: string) => void
  onOpenManual: (name: string) => void
  onUpdateManual: (name: string, v: string) => void
  onCancelManual: (name: string) => void
  onSaveManual: (name: ContractName) => void
}) {
  const isMining = row.deploy.status === 'pending' || row.deploy.status === 'mining'
  const canCheckTx = !!row.deploy.txHash && !busy
  const isManualOpen = manualDraft !== undefined
  const classes: string[] = []
  if (row.isCurrent) classes.push('row-current')
  if (altOption) classes.push('alt-option')
  return (
    <tr className={classes.join(' ') || undefined}>
      <td>
        <input
          type="checkbox"
          checked={row.selected}
          disabled={busy}
          onChange={(e) => onSelect(row.name as ContractName, e.target.checked)}
        />
      </td>
      <td>
        <div className="contract-cell">
          <strong>{row.name}</strong>
          <StatusBadge status={row.status} isCurrent={row.isCurrent} />
        </div>
        {row.step?.description && (
          <div className="hint contract-desc">{row.step.description}</div>
        )}
        {row.status === 'blocked' && row.step?.dependsOn && (
          <div className="hint contract-desc">
            Waiting on: {row.step.dependsOn.map((d) => d.contract).join(', ')}
          </div>
        )}
        {row.status === 'done-stale' && (
          <div className="hint contract-desc warn">
            A dependency was cleared — consider redeploying.
          </div>
        )}
      </td>
      <td>
        {row.inputs.length === 0 ? (
          <span className="hint">no args</span>
        ) : (
          <>
            <input
              type="text"
              className="csv-input"
              placeholder={row.inputs.map((i) => `${i.name ?? '_'}:${i.type}`).join(', ')}
              value={row.csvArgs}
              disabled={busy}
              onChange={(e) => onCsv(row.name, e.target.value)}
            />
            {row.csvOverridden && row.csvArgs !== row.autoCsv && row.autoCsv && (
              <button
                className="linklike"
                disabled={busy}
                onClick={() => onResetCsv(row.name)}
              >
                reset to auto
              </button>
            )}
          </>
        )}
      </td>
      <td>
        {row.existingAddress ? (
          <span className="mono">
            <AddressLink chain={chain} address={row.existingAddress} />{' '}
            <button
              className="linklike"
              disabled={busy}
              onClick={() => onClearAddress(row.name)}
            >
              clear
            </button>
          </span>
        ) : isManualOpen ? (
          <div className="address-edit">
            <input
              type="text"
              className="csv-input"
              placeholder="0x... (paste deployed address)"
              value={manualDraft ?? ''}
              autoFocus
              onChange={(e) => onUpdateManual(row.name, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveManual(row.name as ContractName)
                if (e.key === 'Escape') onCancelManual(row.name)
              }}
            />
            <div className="address-edit-actions">
              <button
                className="linklike"
                onClick={() => onSaveManual(row.name as ContractName)}
              >
                save
              </button>
              <button className="linklike" onClick={() => onCancelManual(row.name)}>
                cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="address-empty">
            <span className="hint">—</span>
            <button
              className="linklike"
              disabled={busy}
              onClick={() => onOpenManual(row.name)}
              title="If you know this contract is already deployed, paste its address to skip the tx flow."
            >
              set manually
            </button>
          </div>
        )}
      </td>
      <td>
        <StatusCell row={row.deploy} chain={chain} />
        {isMining && canCheckTx && (
          <div>
            <button
              className="linklike"
              onClick={() => onCheckTx(row.name)}
              title="Re-query the RPC for this tx's receipt."
            >
              check now
            </button>
          </div>
        )}
        {row.deploy.status === 'error' && row.deploy.txHash && (
          <div>
            <button className="linklike" onClick={() => onCheckTx(row.name)}>
              retry check
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

function StatusBadge({ status, isCurrent }: { status: StepStatus; isCurrent: boolean }) {
  const label =
    status === 'done'
      ? 'deployed'
      : status === 'done-stale'
        ? 'deployed (stale)'
        : isCurrent
          ? 'next'
          : status === 'ready'
            ? 'ready'
            : 'blocked'
  const cls =
    status === 'done'
      ? 'ok'
      : status === 'blocked'
        ? 'muted'
        : status === 'done-stale'
          ? 'warn'
          : isCurrent
            ? 'accent'
            : 'warn'
  return <span className={`badge ${cls}`}>{label}</span>
}

function StatusCell({ row, chain }: { row: DeployState; chain: Chain | undefined }) {
  const cls =
    row.status === 'done'
      ? 'ok'
      : row.status === 'error'
        ? 'err'
        : row.status === 'pending' || row.status === 'mining'
          ? 'warn'
          : 'muted'
  const label = row.statusMessage ?? row.status
  const txUrl = explorerTxUrl(chain, row.txHash)
  return (
    <span className={`status ${cls}`}>
      {label}
      {row.txHash && txUrl && (
        <>
          <br />
          <a href={txUrl} target="_blank" rel="noreferrer">
            view tx on {explorerName(chain)} ↗
          </a>
        </>
      )}
    </span>
  )
}

function AddressLink({ chain, address }: { chain: Chain | undefined; address: Address }) {
  const url = explorerAddressUrl(chain, address)
  const short = shortAddr(address)
  if (!url) return <code>{short}</code>
  return (
    <a href={url} target="_blank" rel="noreferrer" title={address}>
      <code>{short}</code> ↗
    </a>
  )
}

function shortAddr(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}
