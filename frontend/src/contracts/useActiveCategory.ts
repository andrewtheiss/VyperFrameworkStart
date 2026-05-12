import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { getAllDeployments } from './deployments'
import {
  findCategoryById,
  inferCategoryFromDeployments,
  readActiveCategory,
  writeActiveCategory,
  type DeploymentCategory,
} from './deploymentPlan'

/**
 * React hook that mirrors the `vyperFramework.ui.activeCategory.v1` localStorage
 * value. Returns the id, the resolved category object (undefined if none or
 * unknown), and a setter. Updates fire across components via a synthetic
 * `active-category-changed` window event plus the native `storage` event for
 * cross-tab propagation.
 */
export function useActiveCategory(): [
  string | null,
  DeploymentCategory | undefined,
  (id: string | null) => void,
] {
  const [id, setId] = useState<string | null>(() => readActiveCategory())
  const { chain } = useAccount()

  useEffect(() => {
    const handler = () => setId(readActiveCategory())
    window.addEventListener('active-category-changed', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('active-category-changed', handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  // Auto-infer the category from existing deployments when none is set.
  // Handles the "I deployed NFT yesterday, why is Application empty?" case:
  // we look at what's already on-chain (via localStorage) and pick the
  // category whose contracts match. The pick is persisted so the user only
  // sees the CategoryGrid on a truly fresh start.
  useEffect(() => {
    if (id) return
    if (!chain) return
    const existing = getAllDeployments(chain.id)
    const inferred = inferCategoryFromDeployments(existing)
    if (inferred) {
      writeActiveCategory(inferred)
      setId(inferred)
    }
  }, [id, chain?.id])

  const category = findCategoryById(id)

  const set = (next: string | null) => {
    writeActiveCategory(next)
    setId(next)
  }

  return [id, category, set]
}
