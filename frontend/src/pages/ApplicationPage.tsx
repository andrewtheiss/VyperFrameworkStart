import { CategorySwitcher, ComingSoonView } from '../components/CategoryNav'
import { CoinPanel } from '../components/CoinPanel'
import { CounterPanel } from '../components/CounterPanel'
import { SignatureErrorBoundary } from '../components/SignatureErrorBoundary'
import { useActiveCategory } from '../contracts/useActiveCategory'
import type { DeploymentCategory } from '../contracts/deploymentPlan'
import { MintPage } from './MintPage'

// The Application tab dispatches its content based on the currently-active
// category picked on the Deployment tab. The pill switcher at the top lets the
// user jump between categories without leaving the App tab.
export function ApplicationPage() {
  const [, category, setActive] = useActiveCategory()

  if (!category) {
    return (
      <section className="panel">
        <h2>Pick a category</h2>
        <p className="hint">
          Head to the <a href="#/deploy">Deployment</a> tab to choose what kind of
          contracts you want to work with. Your choice persists across both tabs.
        </p>
      </section>
    )
  }

  if (category.status === 'coming-soon') {
    return (
      <>
        <CategorySwitcher active={category.id} onSwitch={setActive} />
        <ComingSoonView category={category} />
      </>
    )
  }

  return (
    <>
      <CategorySwitcher active={category.id} onSwitch={setActive} />
      <CategoryAppSurface category={category} />
    </>
  )
}

function CategoryAppSurface({ category }: { category: DeploymentCategory }) {
  switch (category.id) {
    case 'nft':
      return <MintPage />
    case 'crypto-coin':
      return <CoinPanel />
    case 'misc':
      return (
        <SignatureErrorBoundary>
          <CounterPanel />
        </SignatureErrorBoundary>
      )
    default:
      return (
        <section className="panel">
          <p className="hint">No application view has been built for this category yet.</p>
        </section>
      )
  }
}
