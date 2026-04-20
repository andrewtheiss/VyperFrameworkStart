import { CounterPanel } from '../components/CounterPanel'
import { SignatureErrorBoundary } from '../components/SignatureErrorBoundary'

export function ApplicationPage() {
  return (
    <SignatureErrorBoundary>
      <CounterPanel />
    </SignatureErrorBoundary>
  )
}
