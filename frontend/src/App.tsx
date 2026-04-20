import { useEffect, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { ApplicationPage } from './pages/ApplicationPage'
import { DeploymentPage } from './pages/DeploymentPage'
import { MintPage } from './pages/MintPage'
import { getAllDeployments } from './contracts/deployments'

type Tab = 'mint' | 'app' | 'deploy'

function hashToTab(hash: string): Tab | undefined {
  if (hash === '#/mint' || hash === '#mint') return 'mint'
  if (hash === '#/app' || hash === '#app') return 'app'
  if (hash === '#/deploy' || hash === '#deploy') return 'deploy'
  return undefined
}

function pickInitialTab(chainId: number | undefined): Tab {
  const fromHash = hashToTab(window.location.hash)
  if (fromHash) return fromHash
  const deployed = getAllDeployments(chainId)
  // Nothing deployed? Land on Deploy so the user can set things up.
  // Otherwise Mint is the primary end-user surface.
  return Object.keys(deployed).length === 0 ? 'deploy' : 'mint'
}

export default function App() {
  const { address, chain } = useAccount()
  const [tab, setTab] = useState<Tab>(() => pickInitialTab(chain?.id))

  // Keep the URL hash in sync so reloads / bookmarks land on the same tab.
  useEffect(() => {
    const desired = `#/${tab}`
    if (window.location.hash !== desired) {
      history.replaceState(null, '', desired)
    }
  }, [tab])

  // Listen for external hash changes (back/forward, anchor clicks like
  // <a href="#/deploy">) and mirror them into tab state so the UI updates.
  useEffect(() => {
    const onHashChange = () => {
      const next = hashToTab(window.location.hash)
      if (next) setTab(next)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Re-pick the default when the chain changes AND the user hasn't manually
  // navigated (hash still matches current tab). We only auto-switch on first
  // chain load — never pull the user off a tab they intentionally opened.
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
          aria-selected={tab === 'mint'}
          className={tab === 'mint' ? 'tab active' : 'tab'}
          onClick={() => setTab('mint')}
        >
          Mint
        </button>
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

      {tab === 'mint' && <MintPage />}
      {tab === 'app' && <ApplicationPage />}
      {tab === 'deploy' && <DeploymentPage />}
    </main>
  )
}
