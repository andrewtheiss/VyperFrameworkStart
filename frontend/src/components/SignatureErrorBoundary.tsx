import { Component, type ReactNode } from 'react'
import { ContractSignatureError } from '../contracts/errors'

type Props = { children: ReactNode }
type State = { error: ContractSignatureError | Error | null }

export class SignatureErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (error instanceof ContractSignatureError) {
      console.error(
        `%c[ContractSignatureError] ${error.message}`,
        'color:#ff6b6b;font-weight:bold',
      )
      console.error('Tried:    ', error.triedSignature)
      console.error('Available:', error.availableSignatures)
    } else {
      console.error(error)
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const isSig = error instanceof ContractSignatureError
    const dev = import.meta.env.DEV

    return (
      <div className="error-panel">
        <h2>{isSig ? 'Contract signature mismatch' : 'Something went wrong'}</h2>

        {isSig && (
          <>
            <p>
              Tried to call <code>{error.triedSignature}</code> on contract{' '}
              <strong>{error.contractName}</strong>, but the generated ABI doesn't match.
            </p>
            <p className="error-kind">Reason: {humanKind(error.kind)}</p>

            {dev && (
              <div className="error-dev">
                <p>
                  <strong>Did the signature change?</strong> If you updated{' '}
                  <code>contracts/{error.contractName}.vy</code>, regenerate ABIs and
                  update the frontend call to match — otherwise revert the contract.
                </p>
                <details open>
                  <summary>Available methods on {error.contractName}</summary>
                  <ul>
                    {error.availableSignatures.length === 0 ? (
                      <li>
                        <em>(none — is this contract registered?)</em>
                      </li>
                    ) : (
                      error.availableSignatures.map((s) => (
                        <li key={s}>
                          <code>{s}</code>
                        </li>
                      ))
                    )}
                  </ul>
                </details>
                <pre className="error-hint">npm run abis   # regenerate from .vy sources</pre>
              </div>
            )}
          </>
        )}

        {!isSig && <pre>{error.message}</pre>}

        <button onClick={this.reset}>Dismiss</button>
      </div>
    )
  }
}

function humanKind(kind: ContractSignatureError['kind']) {
  switch (kind) {
    case 'unknown-contract':
      return 'contract is not in the generated ABI registry'
    case 'unknown-method':
      return 'method name was not found in the ABI'
    case 'arity-mismatch':
      return 'number of arguments does not match the ABI'
  }
}
