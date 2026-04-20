import { CounterPanel } from '../components/CounterPanel'
import { DeploymentPanel } from '../components/DeploymentPanel'
import { SignatureErrorBoundary } from '../components/SignatureErrorBoundary'

export function DeploymentPage() {
  return (
    <SignatureErrorBoundary>
      <DeploymentPanel />
      <CounterPanel />
    </SignatureErrorBoundary>
  )
}
