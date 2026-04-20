import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { counterAbi } from '../abis'
import { validateFunction } from '../contracts/client'
import { getDeployment } from '../contracts/deployments'
import { explorerName, explorerTxUrl } from '../utils/explorer'

export function CounterPanel() {
  const { chain } = useAccount()

  // Render-time signature checks: if the ABI no longer has one of these
  // functions (or the arity drifted), this throws and the error boundary
  // surfaces the mismatch before any RPC call is attempted.
  validateFunction('Counter', 'count', 0)
  validateFunction('Counter', 'increment', 0)
  validateFunction('Counter', 'reset', 0)

  const address = getDeployment(chain?.id, 'Counter')

  const { data: count, refetch, isFetching } = useReadContract({
    address,
    abi: counterAbi,
    functionName: 'count',
    query: { enabled: !!address },
  })

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract()
  const { isLoading: mining } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  })

  const busy = isPending || mining
  const txUrl = explorerTxUrl(chain, txHash)

  if (!chain) {
    return <section className="panel"><p>Connect a wallet to interact with Counter.</p></section>
  }

  if (!address) {
    return (
      <section className="panel">
        <h2>Counter</h2>
        <p className="hint">
          No deployment configured for <strong>{chain.name}</strong>. Deploy it from the
          Deployment tab, or add the address to <code>src/contracts/deployments.ts</code>.
        </p>
      </section>
    )
  }

  const call = (fn: 'increment' | 'reset') => {
    writeContract(
      { address, abi: counterAbi, functionName: fn },
      { onSuccess: () => setTimeout(() => refetch(), 1500) },
    )
  }

  return (
    <section className="panel">
      <h2>Counter</h2>
      <p>
        Contract: <code>{address}</code>
      </p>
      <p className="count">
        count = <strong>{count !== undefined ? String(count) : '—'}</strong>{' '}
        {isFetching && <span className="hint">(refreshing)</span>}
      </p>
      <div className="row">
        <button disabled={busy} onClick={() => call('increment')}>
          {busy ? 'waiting…' : 'increment()'}
        </button>
        <button disabled={busy} onClick={() => call('reset')}>
          reset()
        </button>
        <button disabled={isFetching} onClick={() => refetch()}>
          refresh
        </button>
      </div>
      {txHash && (
        <p className="hint tx-link">
          Last tx:{' '}
          {txUrl ? (
            <a href={txUrl} target="_blank" rel="noreferrer">
              view on {explorerName(chain)} ↗
            </a>
          ) : (
            <code>{txHash}</code>
          )}{' '}
          {mining && <span>· mining…</span>}
        </p>
      )}
      {writeError && <pre className="error-inline">{writeError.message}</pre>}
    </section>
  )
}
