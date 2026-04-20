import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { bytesToHex, hexToBytes, type Address } from 'viem'
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { nftGraphicAbi, nftMinterAbi, nftMinter1155Abi } from '../abis'
import { validateFunction } from '../contracts/client'
import { getDeployment } from '../contracts/deployments'
import {
  encodeToBudget,
  ImageTooLargeError,
  type EncodedImage,
} from '../utils/imageEncoder'
import { MIN_BUDGET, defaultBudgetFor, maxBudgetFor } from '../utils/chainLimits'
import { explorerAddressUrl, explorerName, explorerTxUrl } from '../utils/explorer'

type Flow = '721' | '1155'

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const isAddr = (s: string | undefined | null): s is Address =>
  !!s && ADDRESS_RE.test(s)
const sameAddr = (a: string | undefined, b: string | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase()

export function MintPage() {
  const { address: user, chain } = useAccount()
  const minter721 = getDeployment(chain?.id, 'NFTMinter')
  const minter1155 = getDeployment(chain?.id, 'NFTMinter1155')

  const autoFlow: Flow = minter721 ? '721' : '1155'
  const [manualFlow, setManualFlow] = useState<Flow | null>(null)
  useEffect(() => {
    if (manualFlow === '721' && !minter721) setManualFlow(null)
    if (manualFlow === '1155' && !minter1155) setManualFlow(null)
  }, [manualFlow, minter721, minter1155])
  const flow: Flow = manualFlow ?? autoFlow

  // Signature guards — catches ABI drift early.
  validateFunction('NFTMinter', 'mint', 7)
  validateFunction('NFTMinter', 'admin', 0)
  validateFunction('NFTMinter', 'hasMinted', 1)
  validateFunction('NFTMinter', 'cloneOf', 1)
  validateFunction('NFTMinter', 'getAllRecipients', 0)
  validateFunction('NFTMinter1155', 'mint', 7)
  validateFunction('NFTMinter1155', 'admin', 0)
  validateFunction('NFTMinter1155', 'totalMinted', 0)
  validateFunction('NFTMinter1155', 'getCloneOf', 1)
  validateFunction('NFTMinter1155', 'ownerOfToken', 1)
  validateFunction('NFTMinter1155', 'getMintedBy', 1)
  validateFunction('NFTMinter1155', 'getAllRecipients', 0)
  validateFunction('NFTGraphic', 'getImageData', 0)
  validateFunction('NFTGraphic', 'getDimensions', 0)

  if (!chain) {
    return (
      <section className="panel">
        <p>Connect a wallet to get started.</p>
      </section>
    )
  }
  if (!minter721 && !minter1155) {
    return (
      <section className="panel">
        <h2>Mint</h2>
        <p className="hint">
          No minter is deployed on <strong>{chain.name}</strong> yet. Head to the{' '}
          <a href="#/deploy">Deployment</a> tab — deploy <code>NFTGraphic</code> first,
          then either <code>NFTMinter</code> (ERC-721) or <code>NFTMinter1155</code>{' '}
          (ERC-1155).
        </p>
      </section>
    )
  }

  return (
    <>
      {minter721 && minter1155 && (
        <FlowSwitcher flow={flow} onChange={setManualFlow} />
      )}
      {flow === '721' && minter721 ? (
        <Mint721Flow factory={minter721} user={user} chainId={chain.id} />
      ) : minter1155 ? (
        <Mint1155Flow factory={minter1155} user={user} chainId={chain.id} />
      ) : null}
    </>
  )
}

function FlowSwitcher({ flow, onChange }: { flow: Flow; onChange: (f: Flow) => void }) {
  return (
    <div className="pill-switch" role="tablist" aria-label="Pick NFT standard">
      <button
        role="tab"
        aria-selected={flow === '721'}
        className={flow === '721' ? 'active' : ''}
        onClick={() => onChange('721')}
      >
        ERC-721 <span className="hint"> · one per wallet</span>
      </button>
      <button
        role="tab"
        aria-selected={flow === '1155'}
        className={flow === '1155' ? 'active' : ''}
        onClick={() => onChange('1155')}
      >
        ERC-1155 <span className="hint"> · many per wallet</span>
      </button>
    </div>
  )
}

// ============================================================================
// ERC-721 flow
// ============================================================================

function Mint721Flow({
  factory,
  user,
  chainId,
}: {
  factory: Address
  user: Address | undefined
  chainId: number
}) {
  const { data: admin } = useReadContract({
    address: factory,
    abi: nftMinterAbi,
    functionName: 'admin',
  })
  const isAdmin = sameAddr(user, admin as string | undefined)

  return isAdmin ? (
    <Admin721View factory={factory} chainId={chainId} />
  ) : (
    <Recipient721View
      factory={factory}
      user={user}
      chainId={chainId}
      admin={admin as Address | undefined}
    />
  )
}

function Admin721View({ factory, chainId }: { factory: Address; chainId: number }) {
  const { data: recipients, refetch } = useReadContract({
    address: factory,
    abi: nftMinterAbi,
    functionName: 'getAllRecipients',
  })
  const list = [...((recipients as readonly Address[] | undefined) ?? [])].reverse()

  const [recipient, setRecipient] = useState('')
  const submitBlocked = !isAddr(recipient.trim())

  return (
    <>
      <MintComposer
        title="Mint a 1-of-1 NFT (ERC-721)"
        subtitle={(c) => `Admin mint on ${c}. Each wallet can receive exactly one.`}
        chainId={chainId}
        clearOnSuccess={false}
        topField={
          <RecipientField
            value={recipient}
            onChange={setRecipient}
            placeholder="0x... recipient wallet"
          />
        }
        submitLabel={(canMint) =>
          canMint && isAddr(recipient.trim())
            ? `Mint to ${shortAddr(recipient.trim())}`
            : 'Enter recipient and image'
        }
        submitDisabled={submitBlocked}
        onSubmit={(encoded, title, description, write) => {
          write({
            address: factory,
            abi: nftMinterAbi,
            functionName: 'mint',
            args: [
              recipient.trim() as Address,
              bytesToHex(encoded.bytes),
              encoded.format,
              BigInt(encoded.width),
              BigInt(encoded.height),
              title.slice(0, 100),
              description.slice(0, 400),
            ],
          })
        }}
        onSuccess={() => {
          refetch()
          setRecipient('')
        }}
      />

      <section className="panel">
        <h2>Recipients ({list.length})</h2>
        {list.length === 0 ? (
          <p className="hint">No recipients yet — mint the first one above.</p>
        ) : (
          <>
            <p className="hint">Newest first. Click an address to view on the block explorer.</p>
            <div className="card-grid">
              {list.map((addr) => (
                <Recipient721Card
                  key={addr}
                  factory={factory}
                  recipient={addr}
                  chainId={chainId}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  )
}

function Recipient721Card({
  factory,
  recipient,
  chainId,
}: {
  factory: Address
  recipient: Address
  chainId: number
}) {
  const { data: clone } = useReadContract({
    address: factory,
    abi: nftMinterAbi,
    functionName: 'cloneOf',
    args: [recipient],
  })
  if (!clone || clone === '0x0000000000000000000000000000000000000000') {
    return <div className="card card-skel" />
  }
  return <GraphicCard clone={clone as Address} chainId={chainId} recipientHint={recipient} />
}

function Recipient721View({
  factory,
  user,
  chainId,
  admin,
}: {
  factory: Address
  user: Address | undefined
  chainId: number
  admin: Address | undefined
}) {
  const { data: hasMinted, isLoading } = useReadContract({
    address: factory,
    abi: nftMinterAbi,
    functionName: 'hasMinted',
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  })
  const { data: clone } = useReadContract({
    address: factory,
    abi: nftMinterAbi,
    functionName: 'cloneOf',
    args: user ? [user] : undefined,
    query: { enabled: !!user && !!hasMinted },
  })

  if (!user) {
    return (
      <section className="panel">
        <p>Connect a wallet to see your NFTs.</p>
      </section>
    )
  }
  if (isLoading) {
    return (
      <section className="panel">
        <p className="hint">Checking…</p>
      </section>
    )
  }

  if (hasMinted && clone) {
    return (
      <section className="panel">
        <h2>Your reward (ERC-721)</h2>
        <p className="hint">Soulbound to <code>{user}</code>.</p>
        <div className="card-grid card-grid-single">
          <GraphicCard clone={clone as Address} chainId={chainId} recipientHint={user} />
        </div>
      </section>
    )
  }

  return <EmptyRecipientPanel user={user} admin={admin} />
}

// ============================================================================
// ERC-1155 flow
// ============================================================================

function Mint1155Flow({
  factory,
  user,
  chainId,
}: {
  factory: Address
  user: Address | undefined
  chainId: number
}) {
  const { data: admin } = useReadContract({
    address: factory,
    abi: nftMinter1155Abi,
    functionName: 'admin',
  })
  const isAdmin = sameAddr(user, admin as string | undefined)

  return isAdmin ? (
    <Admin1155View factory={factory} chainId={chainId} />
  ) : (
    <Recipient1155View
      factory={factory}
      user={user}
      chainId={chainId}
      admin={admin as Address | undefined}
    />
  )
}

function Admin1155View({ factory, chainId }: { factory: Address; chainId: number }) {
  const { data: total, refetch } = useReadContract({
    address: factory,
    abi: nftMinter1155Abi,
    functionName: 'totalMinted',
  })
  const totalN = Number((total as bigint | undefined) ?? 0n)
  const idsNewestFirst = Array.from({ length: totalN }, (_, i) => BigInt(totalN - i))

  const [recipient, setRecipient] = useState('')
  const submitBlocked = !isAddr(recipient.trim())

  return (
    <>
      <MintComposer
        title="Mint an ERC-1155 token"
        subtitle={(c) => `Admin mint on ${c}. A fresh token ID per mint; wallets can hold many.`}
        chainId={chainId}
        clearOnSuccess={false}
        topField={
          <RecipientField
            value={recipient}
            onChange={setRecipient}
            placeholder="0x... recipient wallet"
          />
        }
        submitLabel={(canMint) =>
          canMint && isAddr(recipient.trim())
            ? `Mint to ${shortAddr(recipient.trim())}`
            : 'Enter recipient and image'
        }
        submitDisabled={submitBlocked}
        onSubmit={(encoded, title, description, write) => {
          write({
            address: factory,
            abi: nftMinter1155Abi,
            functionName: 'mint',
            args: [
              recipient.trim() as Address,
              bytesToHex(encoded.bytes),
              encoded.format,
              BigInt(encoded.width),
              BigInt(encoded.height),
              title.slice(0, 100),
              description.slice(0, 400),
            ],
          })
        }}
        onSuccess={() => {
          refetch()
        }}
      />

      <section className="panel">
        <h2>All mints ({totalN})</h2>
        {totalN === 0 ? (
          <p className="hint">No mints yet — mint the first one above.</p>
        ) : (
          <>
            <p className="hint">
              Newest first. Each card has <em>remint</em> — paste another wallet to mint a
              new token with the same image.
            </p>
            <div className="card-grid">
              {idsNewestFirst.map((id) => (
                <Admin1155TokenCard
                  key={String(id)}
                  factory={factory}
                  tokenId={id}
                  chainId={chainId}
                  onRemintSuccess={() => refetch()}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  )
}

function Admin1155TokenCard({
  factory,
  tokenId,
  chainId,
  onRemintSuccess,
}: {
  factory: Address
  tokenId: bigint
  chainId: number
  onRemintSuccess: () => void
}) {
  const { data: clone } = useReadContract({
    address: factory,
    abi: nftMinter1155Abi,
    functionName: 'getCloneOf',
    args: [tokenId],
  })
  const { data: owner } = useReadContract({
    address: factory,
    abi: nftMinter1155Abi,
    functionName: 'ownerOfToken',
    args: [tokenId],
  })

  // Pull the image + metadata from the clone so we can remint without re-uploading.
  const { data: bytesHex } = useReadContract({
    address: clone as Address,
    abi: nftGraphicAbi,
    functionName: 'getImageData',
    query: { enabled: !!clone },
  })
  const { data: format } = useReadContract({
    address: clone as Address,
    abi: nftGraphicAbi,
    functionName: 'tokenURI_data_format',
    query: { enabled: !!clone },
  })
  const { data: title } = useReadContract({
    address: clone as Address,
    abi: nftGraphicAbi,
    functionName: 'title',
    query: { enabled: !!clone },
  })
  const { data: description } = useReadContract({
    address: clone as Address,
    abi: nftGraphicAbi,
    functionName: 'description',
    query: { enabled: !!clone },
  })
  const { data: dims } = useReadContract({
    address: clone as Address,
    abi: nftGraphicAbi,
    functionName: 'getDimensions',
    query: { enabled: !!clone },
  })

  const [remintOpen, setRemintOpen] = useState(false)
  const [remintTo, setRemintTo] = useState('')
  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract()
  const { isLoading: mining, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  })
  const busy = isPending || mining
  const { chain } = useAccount()
  const txUrl = explorerTxUrl(chain, txHash)

  useEffect(() => {
    if (receipt?.status === 'success') {
      onRemintSuccess()
      setRemintOpen(false)
      setRemintTo('')
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt])

  const canRemint = !!bytesHex && !!format && !!dims && isAddr(remintTo.trim()) && !busy

  const handleRemint = () => {
    if (!canRemint) return
    const [w, h] = dims as readonly [bigint, bigint]
    writeContract({
      address: factory,
      abi: nftMinter1155Abi,
      functionName: 'mint',
      args: [
        remintTo.trim() as Address,
        bytesHex as `0x${string}`,
        format as string,
        w,
        h,
        (title as string) ?? '',
        (description as string) ?? '',
      ],
    })
  }

  if (!clone || clone === '0x0000000000000000000000000000000000000000') {
    return <div className="card card-skel" />
  }

  return (
    <div className="card">
      <GraphicCardInner
        clone={clone as Address}
        chainId={chainId}
        recipientHint={owner as Address | undefined}
        tokenIdHint={Number(tokenId)}
        bytesHex={bytesHex as `0x${string}` | undefined}
        format={format as string | undefined}
        title={title as string | undefined}
        description={description as string | undefined}
        dims={dims as readonly [bigint, bigint] | undefined}
      />
      <div className="card-footer">
        {remintOpen ? (
          <div className="remint-form">
            <input
              type="text"
              className="csv-input"
              placeholder="0x... new recipient"
              value={remintTo}
              autoFocus
              disabled={busy}
              onChange={(e) => setRemintTo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canRemint) handleRemint()
                if (e.key === 'Escape') {
                  setRemintOpen(false)
                  setRemintTo('')
                }
              }}
            />
            <div className="remint-actions">
              <button
                className="mint-btn remint-btn-go"
                disabled={!canRemint}
                onClick={handleRemint}
              >
                {isPending ? 'awaiting wallet…' : mining ? 'mining…' : 'Remint'}
              </button>
              <button
                className="linklike"
                disabled={busy}
                onClick={() => {
                  setRemintOpen(false)
                  setRemintTo('')
                }}
              >
                cancel
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
          </div>
        ) : (
          <button
            className="linklike remint-open"
            onClick={() => setRemintOpen(true)}
          >
            remint to another wallet →
          </button>
        )}
      </div>
    </div>
  )
}

function Recipient1155View({
  factory,
  user,
  chainId,
  admin,
}: {
  factory: Address
  user: Address | undefined
  chainId: number
  admin: Address | undefined
}) {
  const { data: tokens } = useReadContract({
    address: factory,
    abi: nftMinter1155Abi,
    functionName: 'getMintedBy',
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  })
  const ids = [...((tokens as readonly bigint[] | undefined) ?? [])].reverse()

  if (!user) {
    return (
      <section className="panel">
        <p>Connect a wallet to see your NFTs.</p>
      </section>
    )
  }

  if (ids.length === 0) {
    return <EmptyRecipientPanel user={user} admin={admin} />
  }

  return (
    <section className="panel">
      <h2>Your collection ({ids.length})</h2>
      <p className="hint">Soulbound to <code>{user}</code>. Newest first.</p>
      <div className="card-grid">
        {ids.map((id) => (
          <Recipient1155TokenCard
            key={String(id)}
            factory={factory}
            tokenId={id}
            chainId={chainId}
          />
        ))}
      </div>
    </section>
  )
}

function Recipient1155TokenCard({
  factory,
  tokenId,
  chainId,
}: {
  factory: Address
  tokenId: bigint
  chainId: number
}) {
  const { data: clone } = useReadContract({
    address: factory,
    abi: nftMinter1155Abi,
    functionName: 'getCloneOf',
    args: [tokenId],
  })
  if (!clone || clone === '0x0000000000000000000000000000000000000000') {
    return <div className="card card-skel" />
  }
  return (
    <GraphicCard
      clone={clone as Address}
      chainId={chainId}
      tokenIdHint={Number(tokenId)}
    />
  )
}

// ============================================================================
// Empty recipient state: tells the user who to ask for a mint.
// ============================================================================

function EmptyRecipientPanel({
  user,
  admin,
}: {
  user: Address
  admin: Address | undefined
}) {
  const { chain } = useAccount()
  const adminLink = admin ? explorerAddressUrl(chain, admin) : undefined
  return (
    <section className="panel">
      <h2>No NFTs yet</h2>
      <p className="hint">
        Your wallet (<code>{user}</code>) hasn't been minted to on this contract yet.
      </p>
      {admin && (
        <p className="hint">
          Ask the contract admin to mint you one:{' '}
          {adminLink ? (
            <a href={adminLink} target="_blank" rel="noreferrer">
              <code>{admin}</code> ↗
            </a>
          ) : (
            <code>{admin}</code>
          )}
        </p>
      )}
    </section>
  )
}

// ============================================================================
// Shared graphic card — reads a clone and renders its on-chain image + meta.
// ============================================================================

function GraphicCard({
  clone,
  chainId,
  recipientHint,
  tokenIdHint,
}: {
  clone: Address
  chainId: number
  recipientHint?: Address
  tokenIdHint?: number
}) {
  const { data: bytesHex } = useReadContract({
    address: clone,
    abi: nftGraphicAbi,
    functionName: 'getImageData',
  })
  const { data: format } = useReadContract({
    address: clone,
    abi: nftGraphicAbi,
    functionName: 'tokenURI_data_format',
  })
  const { data: title } = useReadContract({
    address: clone,
    abi: nftGraphicAbi,
    functionName: 'title',
  })
  const { data: description } = useReadContract({
    address: clone,
    abi: nftGraphicAbi,
    functionName: 'description',
  })
  const { data: dims } = useReadContract({
    address: clone,
    abi: nftGraphicAbi,
    functionName: 'getDimensions',
  })
  const { data: ownerFromClone } = useReadContract({
    address: clone,
    abi: nftGraphicAbi,
    functionName: 'minter',
    query: { enabled: !recipientHint },
  })

  return (
    <div className="card">
      <GraphicCardInner
        clone={clone}
        chainId={chainId}
        recipientHint={recipientHint ?? (ownerFromClone as Address | undefined)}
        tokenIdHint={tokenIdHint}
        bytesHex={bytesHex as `0x${string}` | undefined}
        format={format as string | undefined}
        title={title as string | undefined}
        description={description as string | undefined}
        dims={dims as readonly [bigint, bigint] | undefined}
      />
    </div>
  )
}

function GraphicCardInner({
  clone,
  recipientHint,
  tokenIdHint,
  bytesHex,
  format,
  title,
  description,
  dims,
}: {
  clone: Address
  chainId: number
  recipientHint?: Address
  tokenIdHint?: number
  bytesHex: `0x${string}` | undefined
  format: string | undefined
  title: string | undefined
  description: string | undefined
  dims: readonly [bigint, bigint] | undefined
}) {
  const url = useMemo(() => {
    if (!bytesHex || !format) return null
    const src = hexToBytes(bytesHex)
    const buf = new ArrayBuffer(src.byteLength)
    new Uint8Array(buf).set(src)
    const blob = new Blob([buf], { type: `image/${format}` })
    return URL.createObjectURL(blob)
  }, [bytesHex, format])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const { chain } = useAccount()
  const addrUrl = explorerAddressUrl(chain, clone)
  const recipientUrl = recipientHint ? explorerAddressUrl(chain, recipientHint) : undefined
  const [w, h] = dims ?? [0n, 0n]
  const bytesLen = bytesHex ? (bytesHex.length - 2) / 2 : 0

  return (
    <>
      <div className="card-img">
        {url ? (
          <img src={url} alt={title ?? 'token'} />
        ) : (
          <div className="card-loading">loading…</div>
        )}
      </div>
      <div className="card-body">
        <div className="card-title">
          {tokenIdHint != null && <span className="card-id">#{tokenIdHint}</span>}
          <strong>{title || <em>(untitled)</em>}</strong>
        </div>
        {description && <p className="card-desc">{description}</p>}
        <div className="card-meta">
          <span><code>{String(w)}×{String(h)}</code></span>
          <span><code>{String(format ?? '?')}</code></span>
          <span>{formatBytes(bytesLen)}</span>
        </div>
        {recipientHint && (
          <div className="card-owner">
            owned by{' '}
            {recipientUrl ? (
              <a href={recipientUrl} target="_blank" rel="noreferrer" title={recipientHint}>
                <code>{shortAddr(recipientHint)}</code> ↗
              </a>
            ) : (
              <code>{shortAddr(recipientHint)}</code>
            )}
          </div>
        )}
        <div className="card-addr">
          contract{' '}
          {addrUrl ? (
            <a href={addrUrl} target="_blank" rel="noreferrer" title={clone}>
              <code>{shortAddr(clone)}</code> ↗
            </a>
          ) : (
            <code>{shortAddr(clone)}</code>
          )}
        </div>
      </div>
    </>
  )
}

// ============================================================================
// Shared mint composer (image picker + optional recipient field + budget +
// title/desc + mint button + preview)
// ============================================================================

function MintComposer({
  title: heading,
  subtitle,
  chainId,
  topField,
  submitLabel,
  submitDisabled,
  clearOnSuccess = true,
  onSubmit,
  onSuccess,
}: {
  title: string
  subtitle: (chainName: string) => string
  chainId: number
  topField?: ReactNode
  submitLabel?: (canMintPlus: boolean) => string
  submitDisabled?: boolean
  clearOnSuccess?: boolean
  onSubmit: (
    encoded: EncodedImage,
    title: string,
    description: string,
    writeContract: ReturnType<typeof useWriteContract>['writeContract'],
  ) => void
  onSuccess: () => void
}) {
  const { chain } = useAccount()

  const chainDefault = defaultBudgetFor(chainId)
  const chainMax = maxBudgetFor(chainId)
  const [budget, setBudget] = useState<number>(chainDefault)
  const [userOverrode, setUserOverrode] = useState(false)
  useEffect(() => {
    if (!userOverrode) setBudget(chainDefault)
  }, [chainDefault, userOverrode])
  useEffect(() => {
    if (budget > chainMax) setBudget(chainMax)
  }, [chainMax, budget])

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [encoding, setEncoding] = useState(false)
  const [result, setResult] = useState<EncodedImage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const runRef = useRef(0)

  useEffect(() => {
    if (!file) {
      setResult(null)
      setError(null)
      return
    }
    const token = ++runRef.current
    setEncoding(true)
    setError(null)
    encodeToBudget(file, budget)
      .then((r) => { if (runRef.current === token) setResult(r) })
      .catch((e) => {
        if (runRef.current !== token) return
        setResult(null)
        setError(
          e instanceof ImageTooLargeError
            ? e.message
            : `encode failed: ${(e as Error).message}`,
        )
      })
      .finally(() => { if (runRef.current === token) setEncoding(false) })
  }, [file, budget])

  const previewUrl = useMemo(
    () => (result ? URL.createObjectURL(result.blob) : null),
    [result],
  )
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const { writeContract, data: txHash, isPending, error: mintError, reset } = useWriteContract()
  const { isLoading: mining, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  })

  useEffect(() => {
    if (receipt?.status === 'success') {
      onSuccess()
      if (clearOnSuccess) {
        setFile(null)
        setTitle('')
        setDescription('')
        setResult(null)
      }
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt])

  const utilization = result ? result.bytes.length / budget : 0
  const txUrl = explorerTxUrl(chain, txHash)
  const hasImage = !!result && !encoding
  const canMintBase =
    hasImage && !isPending && !mining && title.trim().length > 0 && !submitDisabled
  const label = isPending
    ? 'awaiting wallet…'
    : mining
      ? 'mining…'
      : submitLabel
        ? submitLabel(canMintBase)
        : 'Mint'

  const handleMint = () => {
    if (!result || !canMintBase) return
    reset()
    onSubmit(result, title, description, writeContract)
  }

  return (
    <section className="panel">
      <h2>{heading}</h2>
      <p className="hint">{subtitle(chain?.name ?? `chain ${chainId}`)}</p>

      <div className="mint-grid">
        <div className="mint-controls">
          {topField}

          <label className="file-drop">
            <input
              type="file"
              accept="image/*"
              disabled={isPending || mining}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span>{file ? file.name : 'Click to choose image…'}</span>
            {file && (
              <span className="hint source-size">source: {formatBytes(file.size)}</span>
            )}
          </label>

          <div className="budget">
            <div className="budget-header">
              <label htmlFor="budget">
                Size budget: <strong>{formatBytes(budget)}</strong>
              </label>
              {!userOverrode ? (
                <span className="hint">default for {chain?.name ?? 'current chain'}</span>
              ) : (
                <button
                  className="linklike"
                  onClick={() => {
                    setUserOverrode(false)
                    setBudget(chainDefault)
                  }}
                >
                  reset
                </button>
              )}
            </div>
            <input
              id="budget"
              type="range"
              min={MIN_BUDGET}
              max={chainMax}
              step={500}
              value={budget}
              disabled={isPending || mining}
              onChange={(e) => {
                setBudget(Number(e.target.value))
                setUserOverrode(true)
              }}
            />
            <div className="hint budget-scale">
              <span>{formatBytes(MIN_BUDGET)}</span>
              <span>{formatBytes(chainMax)} max for {chain?.name ?? 'this chain'}</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="title">Title <span className="hint">(max 100)</span></label>
            <input
              id="title"
              type="text"
              maxLength={100}
              value={title}
              placeholder="e.g. Class of 2026 Badge"
              disabled={isPending || mining}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="description">Description <span className="hint">(max 400)</span></label>
            <textarea
              id="description"
              maxLength={400}
              rows={3}
              value={description}
              placeholder="Why this reward exists."
              disabled={isPending || mining}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button className="mint-btn" disabled={!canMintBase} onClick={handleMint}>
            {label}
          </button>

          {mintError && <pre className="error-inline">{mintError.message}</pre>}

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
        </div>

        <div className="preview">
          {!file && <p className="hint">Drop an image on the left to preview →</p>}
          {encoding && <p className="hint">Encoding…</p>}
          {error && <pre className="error-inline">{error}</pre>}
          {result && previewUrl && (
            <>
              <img src={previewUrl} alt="preview" className="mint-preview" />
              <div className="mint-meter">
                <div
                  className={`fill ${utilization > 0.95 ? 'hot' : ''}`}
                  style={{ width: `${Math.min(100, utilization * 100)}%` }}
                />
              </div>
              <dl className="mint-stats">
                <dt>format</dt>
                <dd><code>{result.format}</code></dd>
                <dt>dimensions</dt>
                <dd><code>{result.width}×{result.height}</code></dd>
                <dt>encoded</dt>
                <dd>
                  <code>{formatBytes(result.bytes.length)}</code>{' '}
                  <span className="hint">
                    ({((result.bytes.length / result.sourceBytes) * 100).toFixed(1)}% of source)
                  </span>
                </dd>
                <dt>quality</dt>
                <dd><code>{result.quality.toFixed(2)}</code></dd>
                <dt>took</dt>
                <dd><code>{Math.round(result.durationMs)} ms</code></dd>
              </dl>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function RecipientField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const trimmed = value.trim()
  const valid = trimmed.length === 0 || isAddr(trimmed)
  return (
    <div className="field">
      <label htmlFor="recipient">
        Recipient <span className="hint">(wallet that will own the NFT)</span>
      </label>
      <input
        id="recipient"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={valid ? undefined : { borderColor: '#ff8a98' }}
        spellCheck={false}
        autoCapitalize="off"
      />
      {!valid && (
        <span className="hint" style={{ color: '#ff8a98' }}>
          must be 0x + 40 hex characters
        </span>
      )}
    </div>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}
