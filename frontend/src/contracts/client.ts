import { contracts, type ContractName } from '../abis'
import { ContractSignatureError } from './errors'

type AbiEntry = { type: string; name?: string; inputs?: readonly { type: string }[] }

function formatTried(contractName: string, method: string, argCount: number) {
  const placeholders = Array.from({ length: argCount }, (_, i) => `arg${i}`).join(',')
  return `${contractName}.${method}(${placeholders})`
}

function listFunctionSignatures(name: ContractName): string[] {
  const sigs = contracts[name]?.signatures.functions ?? {}
  return Object.values(sigs)
}

/**
 * Validates that `method` exists on `contractName`'s generated ABI and that the
 * supplied argument count matches. Returns the ABI entry on success; throws
 * `ContractSignatureError` otherwise so callers (or an error boundary) can
 * surface a friendly message listing the tried vs. available signatures.
 */
export function validateFunction(
  contractName: ContractName,
  method: string,
  argCount = 0,
): AbiEntry {
  const entry = contracts[contractName]
  if (!entry) {
    throw new ContractSignatureError({
      contractName,
      triedSignature: formatTried(contractName, method, argCount),
      availableSignatures: Object.keys(contracts),
      kind: 'unknown-contract',
    })
  }
  const available = listFunctionSignatures(contractName)
  const abiFn = (entry.abi as readonly AbiEntry[]).find(
    (e) => e.type === 'function' && e.name === method,
  )
  if (!abiFn) {
    throw new ContractSignatureError({
      contractName,
      triedSignature: formatTried(contractName, method, argCount),
      availableSignatures: available,
      kind: 'unknown-method',
    })
  }
  const expected = abiFn.inputs?.length ?? 0
  if (expected !== argCount) {
    throw new ContractSignatureError({
      contractName,
      triedSignature: formatTried(contractName, method, argCount),
      availableSignatures: available,
      kind: 'arity-mismatch',
    })
  }
  return abiFn
}

/** ABI lookup without validation — use after validateFunction has passed. */
export function getAbi<N extends ContractName>(name: N) {
  return contracts[name].abi
}
