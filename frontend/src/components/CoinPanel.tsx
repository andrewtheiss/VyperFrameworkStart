import { useEffect, useState } from 'react'
import { formatUnits, parseUnits, type Address } from 'viem'
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { coinMintableAbi } from '../abis'
import { validateFunction } from '../contracts/client'
import { getDeployment } from '../contracts/deployments'
import { SignatureErrorBoundary } from './SignatureErrorBoundary'
import { explorerAddressUrl, explorerName, explorerTxUrl } from '../utils/explorer'

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const isAddr = (s: string | undefined | null): s is Address =>
  !!s && ADDRESS_RE.test(s)
const sameAddr = (a: string | undefined, b: string | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase()
const shortAddr = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)

export function CoinPanel() {
  // Runtime guards — the error boundary catches these if ABI drifts.
  validateFunction('CoinMintable', 'admin', 0)
  validateFunction('CoinMintable', 'mint', 2)
  validateFunction('CoinMintable', 'lockMinting', 0)
  validateFunction('CoinMintable', 'transfer', 2)
  validateFunction('CoinMintable', 'balanceOf', 1)
  validateFunction('CoinMintable', 'getAllRecipients', 0)

  return (
    <SignatureErrorBoundary>
      <CoinDispatcher />
    </SignatureErrorBoundary>
  )
}

function CoinDispatcher() {
  const { address: user, chain } = useAccount()
  const coinAddress = getDeployment(chain?.id, 'CoinMintable')

  if (!chain) {
    return (
      <section className="panel">
        <p>Connect a wallet to interact with the coin.</p>
      </section>
    )
  }
  if (!coinAddress) {
    return (
      <section className="panel">
        <h2>Coin</h2>
        <p className="hint">
          <code>CoinMintable</code> isn't deployed on <strong>{chain.name}</strong> yet.
          Head to the <a href="#/deploy">Deployment</a> tab to deploy it.
        </p>
      </section>
    )
  }

  return <CoinApp coinAddress={coinAddress} user={user} />
}

function CoinApp({
  coinAddress,
  user,
}: {
  coinAddress: Address
  user: Address | undefined
}) {
  const { data: admin } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'admin',
  })
  const isAdmin = sameAddr(user, admin as string | undefined)

  return (
    <>
      <CoinHeader coinAddress={coinAddress} user={user} admin={admin as Address | undefined} />
      {isAdmin ? (
        <AdminCoinView coinAddress={coinAddress} />
      ) : (
        <UserCoinView
          coinAddress={coinAddress}
          user={user}
          admin={admin as Address | undefined}
        />
      )}
    </>
  )
}

// --- Header --------------------------------------------------------------

function CoinHeader({
  coinAddress,
  user,
  admin,
}: {
  coinAddress: Address
  user: Address | undefined
  admin: Address | undefined
}) {
  const { data: name } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'name',
  })
  const { data: symbol } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'symbol',
  })
  const { data: decimals } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'decimals',
  })
  const { data: totalSupply } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'totalSupply',
  })
  const { data: mintingLocked } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'mintingLocked',
  })
  const { chain } = useAccount()
  const addrUrl = explorerAddressUrl(chain, coinAddress)

  const decN = Number((decimals as number | undefined) ?? 18)
  const supply = (totalSupply as bigint | undefined) ?? 0n
  const supplyLabel =
    decN > 0
      ? `${formatUnits(supply, decN)} ${(symbol as string) ?? ''}`
      : `${String(supply)} ${(symbol as string) ?? ''}`

  return (
    <section className="panel">
      <h2>
        {(name as string) ?? '…'}{' '}
        <span className="coin-symbol">({(symbol as string) ?? '…'})</span>
      </h2>
      <div className="coin-header-meta">
        <dl className="coin-meta">
          <dt>Contract</dt>
          <dd>
            {addrUrl ? (
              <a href={addrUrl} target="_blank" rel="noreferrer" title={coinAddress}>
                <code>{shortAddr(coinAddress)}</code> ↗
              </a>
            ) : (
              <code>{coinAddress}</code>
            )}
          </dd>
          <dt>Total supply</dt>
          <dd>
            <strong>{supplyLabel}</strong>
          </dd>
          <dt>Decimals</dt>
          <dd>
            <code>{decN}</code>
          </dd>
          <dt>Minting</dt>
          <dd>
            {mintingLocked ? (
              <span className="badge warn">locked</span>
            ) : (
              <span className="badge accent">open</span>
            )}
          </dd>
          <dt>Admin</dt>
          <dd>
            {admin ? (
              <code>{shortAddr(admin)}</code>
            ) : (
              <span className="hint">—</span>
            )}
            {sameAddr(admin, user) && <span className="hint"> · you</span>}
          </dd>
        </dl>
      </div>
    </section>
  )
}

// --- Admin view: mint + lock + recipients --------------------------------

function AdminCoinView({ coinAddress }: { coinAddress: Address }) {
  const { data: decimals } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'decimals',
  })
  const { data: mintingLocked, refetch: refetchLocked } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'mintingLocked',
  })
  const { data: recipients, refetch: refetchRecipients } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'getAllRecipients',
  })
  const list = [...((recipients as readonly Address[] | undefined) ?? [])].reverse()

  const decN = Number((decimals as number | undefined) ?? 18)
  const locked = !!mintingLocked

  return (
    <>
      {!locked && <MintForm coinAddress={coinAddress} decimals={decN} onMinted={() => refetchRecipients()} />}
      {locked && (
        <section className="panel">
          <p className="hint">Supply is locked — no new tokens can be minted.</p>
        </section>
      )}

      {!locked && (
        <LockMintingBox coinAddress={coinAddress} onLocked={() => refetchLocked()} />
      )}

      <section className="panel">
        <h2>Holders ({list.length})</h2>
        {list.length === 0 ? (
          <p className="hint">Nobody holds tokens yet. Mint some above.</p>
        ) : (
          <>
            <p className="hint">Newest first. Balances read live from the chain.</p>
            <table className="holders-table">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {list.map((addr) => (
                  <HolderRow
                    key={addr}
                    coinAddress={coinAddress}
                    holder={addr}
                    decimals={decN}
                  />
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </>
  )
}

function MintForm({
  coinAddress,
  decimals,
  onMinted,
}: {
  coinAddress: Address
  decimals: number
  onMinted: () => void
}) {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract()
  const { isLoading: mining, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  })
  const { chain } = useAccount()
  const txUrl = explorerTxUrl(chain, txHash)

  useEffect(() => {
    if (receipt?.status === 'success') {
      onMinted()
      setAmount('')
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt])

  const recipTrimmed = recipient.trim()
  const parsedAmount = safeParse(amount, decimals)
  const canMint =
    isAddr(recipTrimmed) && parsedAmount != null && parsedAmount > 0n && !isPending && !mining

  const handleMint = () => {
    if (!canMint || parsedAmount == null) return
    reset()
    writeContract({
      address: coinAddress,
      abi: coinMintableAbi,
      functionName: 'mint',
      args: [recipTrimmed as Address, parsedAmount],
    })
  }

  return (
    <section className="panel">
      <h2>Mint tokens</h2>
      <p className="hint">Admin-only. Amount is in token units (converted internally using {decimals} decimals).</p>
      <div className="coin-form">
        <div className="field">
          <label htmlFor="recipient">Recipient</label>
          <input
            id="recipient"
            type="text"
            placeholder="0x... wallet"
            value={recipient}
            spellCheck={false}
            autoCapitalize="off"
            onChange={(e) => setRecipient(e.target.value)}
            style={
              recipTrimmed.length > 0 && !isAddr(recipTrimmed)
                ? { borderColor: '#ff8a98' }
                : undefined
            }
          />
        </div>
        <div className="field">
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <button className="mint-btn" disabled={!canMint} onClick={handleMint}>
          {isPending ? 'awaiting wallet…' : mining ? 'mining…' : 'Mint'}
        </button>
      </div>
      {writeError && <pre className="error-inline">{writeError.message}</pre>}
      {txHash && (
        <p className="hint tx-link">
          Tx:{' '}
          {txUrl ? (
            <a href={txUrl} target="_blank" rel="noreferrer">
              view on {explorerName(chain)} ↗
            </a>
          ) : (
            <code>{txHash}</code>
          )}
        </p>
      )}
    </section>
  )
}

function LockMintingBox({
  coinAddress,
  onLocked,
}: {
  coinAddress: Address
  onLocked: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract()
  const { isLoading: mining, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  })
  useEffect(() => {
    if (receipt?.status === 'success') {
      onLocked()
      setConfirming(false)
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt])

  const busy = isPending || mining

  return (
    <section className="panel">
      <h2>Lock supply</h2>
      <p className="hint">
        Irreversibly disables <code>mint()</code>. After locking, total supply can never
        grow. Use this once you've distributed all the tokens you plan to.
      </p>
      {!confirming ? (
        <button
          className="mint-btn lock-btn"
          disabled={busy}
          onClick={() => setConfirming(true)}
        >
          Lock minting…
        </button>
      ) : (
        <div className="coin-form-inline">
          <span className="hint">This can't be undone. Confirm?</span>
          <button
            className="mint-btn lock-btn"
            disabled={busy}
            onClick={() => {
              reset()
              writeContract({
                address: coinAddress,
                abi: coinMintableAbi,
                functionName: 'lockMinting',
                args: [],
              })
            }}
          >
            {isPending ? 'awaiting wallet…' : mining ? 'locking…' : 'Yes, lock permanently'}
          </button>
          <button
            className="linklike"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            cancel
          </button>
        </div>
      )}
      {writeError && <pre className="error-inline">{writeError.message}</pre>}
    </section>
  )
}

function HolderRow({
  coinAddress,
  holder,
  decimals,
}: {
  coinAddress: Address
  holder: Address
  decimals: number
}) {
  const { data: balance } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'balanceOf',
    args: [holder],
  })
  const { chain } = useAccount()
  const url = explorerAddressUrl(chain, holder)
  const raw = (balance as bigint | undefined) ?? 0n
  const display = decimals > 0 ? formatUnits(raw, decimals) : String(raw)
  return (
    <tr>
      <td className="mono">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" title={holder}>
            <code>{shortAddr(holder)}</code> ↗
          </a>
        ) : (
          <code>{holder}</code>
        )}
      </td>
      <td className="mono">{display}</td>
    </tr>
  )
}

// --- Non-admin view: balance + transfer ----------------------------------

function UserCoinView({
  coinAddress,
  user,
  admin,
}: {
  coinAddress: Address
  user: Address | undefined
  admin: Address | undefined
}) {
  const { data: decimals } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'decimals',
  })
  const { data: symbol } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'symbol',
  })
  const { data: balance, refetch } = useReadContract({
    address: coinAddress,
    abi: coinMintableAbi,
    functionName: 'balanceOf',
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  })

  if (!user) {
    return (
      <section className="panel">
        <p>Connect a wallet to see your balance.</p>
      </section>
    )
  }

  const decN = Number((decimals as number | undefined) ?? 18)
  const raw = (balance as bigint | undefined) ?? 0n
  const display = decN > 0 ? formatUnits(raw, decN) : String(raw)

  return (
    <>
      <section className="panel">
        <h2>Your balance</h2>
        <p className="balance-display">
          <strong>{display}</strong>{' '}
          <span className="coin-symbol">{(symbol as string) ?? ''}</span>
        </p>
        {raw === 0n && (
          <p className="hint">
            You have no tokens yet.
            {admin && (
              <>
                {' '}Ask the admin to mint you some: <code>{admin}</code>
              </>
            )}
          </p>
        )}
      </section>

      {raw > 0n && (
        <TransferForm
          coinAddress={coinAddress}
          decimals={decN}
          symbol={(symbol as string) ?? ''}
          onTransferred={() => refetch()}
        />
      )}
    </>
  )
}

function TransferForm({
  coinAddress,
  decimals,
  symbol,
  onTransferred,
}: {
  coinAddress: Address
  decimals: number
  symbol: string
  onTransferred: () => void
}) {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract()
  const { isLoading: mining, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  })
  const { chain } = useAccount()
  const txUrl = explorerTxUrl(chain, txHash)

  useEffect(() => {
    if (receipt?.status === 'success') {
      onTransferred()
      setAmount('')
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt])

  const recipTrimmed = recipient.trim()
  const parsedAmount = safeParse(amount, decimals)
  const canSend =
    isAddr(recipTrimmed) && parsedAmount != null && parsedAmount > 0n && !isPending && !mining

  return (
    <section className="panel">
      <h2>Send {symbol}</h2>
      <div className="coin-form">
        <div className="field">
          <label htmlFor="transfer-recipient">To</label>
          <input
            id="transfer-recipient"
            type="text"
            placeholder="0x..."
            value={recipient}
            spellCheck={false}
            autoCapitalize="off"
            onChange={(e) => setRecipient(e.target.value)}
            style={
              recipTrimmed.length > 0 && !isAddr(recipTrimmed)
                ? { borderColor: '#ff8a98' }
                : undefined
            }
          />
        </div>
        <div className="field">
          <label htmlFor="transfer-amount">Amount</label>
          <input
            id="transfer-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <button
          className="mint-btn"
          disabled={!canSend}
          onClick={() => {
            if (!canSend || parsedAmount == null) return
            reset()
            writeContract({
              address: coinAddress,
              abi: coinMintableAbi,
              functionName: 'transfer',
              args: [recipTrimmed as Address, parsedAmount],
            })
          }}
        >
          {isPending ? 'awaiting wallet…' : mining ? 'mining…' : 'Send'}
        </button>
      </div>
      {writeError && <pre className="error-inline">{writeError.message}</pre>}
      {txHash && (
        <p className="hint tx-link">
          Tx:{' '}
          {txUrl ? (
            <a href={txUrl} target="_blank" rel="noreferrer">
              view on {explorerName(chain)} ↗
            </a>
          ) : (
            <code>{txHash}</code>
          )}
        </p>
      )}
    </section>
  )
}

// Parse a human-readable amount like "1.5" into a raw BigInt using the token's
// decimals. Returns null if the input isn't a valid decimal number.
function safeParse(input: string, decimals: number): bigint | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  try {
    return parseUnits(trimmed, decimals)
  } catch {
    return null
  }
}
