import { useEffect, useState, type SVGProps } from 'react'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'
import { getAllDeployments } from '../contracts/deployments'
import {
  categories,
  flattenSteps,
  type DeploymentCategory,
} from '../contracts/deploymentPlan'

// --- Shared state: deployments on the current chain, refreshed live. --------

function useChainDeployments(): Record<string, Address> {
  const { chain } = useAccount()
  const [map, setMap] = useState<Record<string, Address>>({})
  useEffect(() => {
    const refresh = () => setMap(getAllDeployments(chain?.id))
    refresh()
    window.addEventListener('deployments-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('deployments-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [chain?.id])
  return map
}

function countDeployed(cat: DeploymentCategory, existing: Record<string, Address>): {
  deployed: number
  total: number
} {
  const atomic = flattenSteps(cat.steps)
  return {
    deployed: atomic.filter((s) => !!existing[s.name]).length,
    total: atomic.length,
  }
}

// --- CategoryGrid: big picker on first visit --------------------------------

export function CategoryGrid({ onPick }: { onPick: (id: string) => void }) {
  const existing = useChainDeployments()
  return (
    <section className="panel">
      <h2>What do you want to deploy?</h2>
      <p className="hint">
        Pick a category to get started. You can switch later from the top of each page.
      </p>
      <div className="category-grid">
        {categories.map((cat) => {
          const { deployed, total } = countDeployed(cat, existing)
          const isActiveCat = cat.status === 'active'
          return (
            <button
              key={cat.id}
              type="button"
              className={`category-card ${!isActiveCat ? 'coming' : ''}`}
              onClick={() => onPick(cat.id)}
            >
              <div className="category-icon" aria-hidden>
                <CategoryIcon id={cat.id} />
              </div>
              <div className="category-label">{cat.label}</div>
              <div className="category-tagline">{cat.tagline}</div>
              <div className="category-desc hint">{cat.description}</div>
              <div className="category-meta">
                {isActiveCat ? (
                  total === 0 ? (
                    <span className="hint">no contracts</span>
                  ) : (
                    <span>
                      {deployed}/{total} deployed on this chain
                    </span>
                  )
                ) : (
                  <span className="hint">coming soon</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// --- CategorySwitcher: pill row shown at the top of category views ----------

export function CategorySwitcher({
  active,
  onSwitch,
}: {
  active: string
  onSwitch: (id: string | null) => void
}) {
  return (
    <div className="category-switcher" role="tablist" aria-label="Category">
      <span className="switcher-label">Category</span>
      <div className="switcher-pills">
        {categories.map((cat) => {
          const isActive = cat.id === active
          const coming = cat.status === 'coming-soon'
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`switcher-pill ${isActive ? 'active' : ''} ${coming ? 'coming' : ''}`}
              onClick={() => onSwitch(cat.id)}
            >
              <span className="switcher-pill-icon" aria-hidden>
                <CategoryIcon id={cat.id} />
              </span>
              <span>{cat.label}</span>
              {coming && <span className="switcher-pill-tag">soon</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// --- ComingSoonView: shared placeholder for 'coming-soon' categories -------

export function ComingSoonView({ category }: { category: DeploymentCategory }) {
  return (
    <section className="panel">
      <div className="coming-soon">
        <div className="category-icon coming-icon" aria-hidden>
          <CategoryIcon id={category.id} />
        </div>
        <h2>{category.label}</h2>
        <p className="category-tagline">{category.tagline}</p>
        <p className="hint">{category.description}</p>
        <p className="hint coming-hint">
          Templates for this category haven't shipped yet. Check back, or pick another
          category above.
        </p>
      </div>
    </section>
  )
}

// --- Icons ------------------------------------------------------------------

export function CategoryIcon({ id }: { id: string }) {
  if (id === 'nft') return <NFTIcon />
  if (id === 'crypto-coin') return <CoinIcon />
  return <MiscIcon />
}

function NFTIcon(props: SVGProps<SVGSVGElement>) {
  // Image frame with a small landscape inside — reads universally as "picture".
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect x="4" y="6" width="24" height="20" rx="2.5" />
      <circle cx="11" cy="13" r="2" />
      <path d="M6 22 L13 15 L18 19 L22 16 L26 20" />
    </svg>
  )
}

function CoinIcon(props: SVGProps<SVGSVGElement>) {
  // Stacked coins, unmistakable as "money" — works across themes.
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <ellipse cx="16" cy="10" rx="10" ry="3" />
      <path d="M6 10 v6 c0 1.65 4.48 3 10 3 s10 -1.35 10 -3 v-6" />
      <path d="M6 16 v6 c0 1.65 4.48 3 10 3 s10 -1.35 10 -3 v-6" />
    </svg>
  )
}

function MiscIcon(props: SVGProps<SVGSVGElement>) {
  // Sparkles-ish — signals "various" / "experimental" without looking broken.
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M11 6 L13 11 L18 13 L13 15 L11 20 L9 15 L4 13 L9 11 Z" />
      <path d="M22 18 L23.5 21 L26.5 22.5 L23.5 24 L22 27 L20.5 24 L17.5 22.5 L20.5 21 Z" />
    </svg>
  )
}
