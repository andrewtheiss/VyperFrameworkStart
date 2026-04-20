export class ContractSignatureError extends Error {
  readonly contractName: string
  readonly triedSignature: string
  readonly availableSignatures: string[]
  readonly kind: 'unknown-contract' | 'unknown-method' | 'arity-mismatch'

  constructor(params: {
    contractName: string
    triedSignature: string
    availableSignatures: string[]
    kind: 'unknown-contract' | 'unknown-method' | 'arity-mismatch'
  }) {
    super(
      `[${params.contractName}] tried ${params.triedSignature} — ${
        params.kind === 'unknown-contract'
          ? 'contract not in ABI registry'
          : params.kind === 'unknown-method'
            ? 'method not found in ABI'
            : 'argument count does not match ABI'
      }`,
    )
    this.name = 'ContractSignatureError'
    this.contractName = params.contractName
    this.triedSignature = params.triedSignature
    this.availableSignatures = params.availableSignatures
    this.kind = params.kind
  }
}
