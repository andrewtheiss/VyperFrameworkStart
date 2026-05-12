import { useEffect, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { ApplicationPage } from './pages/ApplicationPage'
import { DeploymentPage } from './pages/DeploymentPage'
import { getAllDeployments } from './contracts/deployments'
import {
  inferCategoryFromDeployments,
  readActiveCategory,
  writeActiveCategory,
} from './contracts/deploymentPlan'

type Tab = 'app' | 'deploy'

function hashToTab(hash: string): Tab | undefined {
  // `#/mint` is kept as an alias for backward-compat with old bookmarks —
  // the Mint page moved inside ApplicationPage as the NFT category's app.
  if (
    hash === '#/app' ||
    hash === '#app' ||
    hash === '#/mint' ||
    hash === '#mint'
  ) {
    return 'app'
  }
  if (hash === '#/deploy' || hash === '#deploy') return 'deploy'
  return undefined
}

function pickInitialTab(chainId: number | undefined): Tab {
  const fromHash = hashToTab(window.location.hash)
  if (fromHash) return fromHash

  const deployed = getAllDeployments(chainId)
  const hasAny = Object.keys(deployed).length > 0

  // If no active category is set but there ARE deployments (e.g. a returning
  // user whose data predates the category model), infer one and persist it
  // synchronously so the tab default below lands on Application, not Deploy.
  let activeCategory = readActiveCategory()
  if (!activeCategory && hasAny) {
    const inferred = inferCategoryFromDeployments(deployed)
    if (inferred) {
      writeActiveCategory(inferred)
      activeCategory = inferred
    }
  }

  if (!activeCategory) return 'deploy'
  return hasAny ? 'app' : 'deploy'
}

export default function App() {
  const { address, chain } = useAccount()
  const [tab, setTab] = useState<Tab>(() => pickInitialTab(chain?.id))

  useEffect(() => {
    const desired = `#/${tab}`
    if (window.location.hash !== desired) {
      history.replaceState(null, '', desired)
    }
  }, [tab])

  useEffect(() => {
    const onHashChange = () => {
      const next = hashToTab(window.location.hash)
      if (next) setTab(next)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const [autoPicked, setAutoPicked] = useState(false)
  useEffect(() => {
    if (autoPicked || !chain) return
    setTab(pickInitialTab(chain.id))
    setAutoPicked(true)
  }, [chain, autoPicked])

  return (
    <main>
      <header>
        <h1>Vyper Framework</h1>
        <ConnectButton />
      </header>

      <nav className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'app'}
          className={tab === 'app' ? 'tab active' : 'tab'}
          onClick={() => setTab('app')}
        >
          Application
        </button>
        <button
          role="tab"
          aria-selected={tab === 'deploy'}
          className={tab === 'deploy' ? 'tab active' : 'tab'}
          onClick={() => setTab('deploy')}
        >
          Deployment
        </button>
      </nav>

      <section className="status-line">
        {address ? (
          <>
            Connected as <code>{address}</code> on <strong>{chain?.name ?? 'unknown chain'}</strong>.
          </>
        ) : (
          <>Connect a wallet to get started.</>
        )}
      </section>

      {tab === 'app' && <ApplicationPage />}
      {tab === 'deploy' && <DeploymentPage />}
    </main>
  )
}
