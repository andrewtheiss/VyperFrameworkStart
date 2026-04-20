// Minimal CSV -> typed-constructor-args parser. Intentionally narrow:
// handles the scalar types most Vyper constructors use. Arrays/tuples/bytesN
// arrays require JSON today — we throw a clear error pointing the user to
// per-input fields if they hit those cases.

export class ArgParseError extends Error {}

type AbiInput = { name?: string; type: string }

export function splitCsv(input: string): string[] {
  const parts: string[] = []
  let cur = ''
  let inQuote = false
  let quoteChar = ''
  for (const ch of input) {
    if (inQuote) {
      cur += ch
      if (ch === quoteChar) inQuote = false
    } else if (ch === '"' || ch === "'") {
      inQuote = true
      quoteChar = ch
      cur += ch
    } else if (ch === ',') {
      parts.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.length > 0 || parts.length > 0) parts.push(cur)
  return parts.map((p) => p.trim())
}

function unquote(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1)
  }
  return s
}

function parseOne(raw: string, type: string): unknown {
  if (type.endsWith(']')) {
    throw new ArgParseError(
      `array type "${type}" is not supported in the CSV field — use JSON`,
    )
  }
  if (type.startsWith('uint') || type.startsWith('int')) {
    try {
      return BigInt(raw)
    } catch {
      throw new ArgParseError(`expected ${type}, got "${raw}"`)
    }
  }
  if (type === 'address') {
    if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
      throw new ArgParseError(`invalid address "${raw}"`)
    }
    return raw as `0x${string}`
  }
  if (type === 'bool') {
    if (raw === 'true') return true
    if (raw === 'false') return false
    throw new ArgParseError(`expected bool (true|false), got "${raw}"`)
  }
  if (type === 'string') {
    return unquote(raw)
  }
  if (type.startsWith('bytes')) {
    if (!/^0x[0-9a-fA-F]*$/.test(raw)) {
      throw new ArgParseError(`bytes must be hex-encoded (0x...), got "${raw}"`)
    }
    return raw as `0x${string}`
  }
  throw new ArgParseError(`unsupported ABI type "${type}" — extend args.ts to handle it`)
}

export function parseConstructorArgs(csv: string, inputs: readonly AbiInput[]): unknown[] {
  if (inputs.length === 0) {
    if (csv.trim().length > 0) {
      throw new ArgParseError('constructor takes no arguments, but CSV was non-empty')
    }
    return []
  }
  const raw = splitCsv(csv)
  if (raw.length !== inputs.length) {
    throw new ArgParseError(
      `expected ${inputs.length} arg(s) [${inputs.map((i) => i.type).join(',')}], got ${raw.length}`,
    )
  }
  return raw.map((v, i) => parseOne(v, inputs[i].type))
}
