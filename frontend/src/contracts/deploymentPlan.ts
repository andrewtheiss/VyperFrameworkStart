import type { Address } from 'viem'
import { contracts, type ContractName } from '../abis'

// Declare the canonical deployment plan, grouped into categories. The
// DeploymentPanel and ApplicationPage read the user's active category from
// localStorage and render only the surface relevant to that category.

export type PlanDependency = {
  contract: ContractName
  argName: string
}

export type AtomicStep = {
  kind: 'atomic'
  name: ContractName
  /** Short UI label for the progress stepper. Defaults to `name` if omitted. */
  title?: string
  description?: string
  dependsOn?: PlanDependency[]
  /**
   * One example CSV value per constructor input, shown as placeholder text in
   * the deploy form. Wrap strings in double-quotes. Fall back to auto-generated
   * samples (via samplePlaceholderFor) when omitted.
   */
  constructorExamples?: string[]
}

export type AlternativeStep = {
  kind: 'alternative'
  id: string
  /** Short UI label for the progress stepper. Defaults to `label` if omitted. */
  title?: string
  label: string
  description?: string
  options: AtomicStep[]
  /** ContractName of the option auto-checked by default. */
  defaultOption: ContractName
}

export type PlanStep = AtomicStep | AlternativeStep

export type CategoryStatus = 'active' | 'coming-soon'

export type DeploymentCategory = {
  id: string
  label: string
  /** Short one-liner shown in the category grid card and pill switcher. */
  tagline: string
  /** Full description shown on the category grid card. */
  description: string
  status: CategoryStatus
  steps: PlanStep[]
}

export const categories: DeploymentCategory[] = [
  {
    id: 'nft',
    label: 'NFT',
    tagline: '1-of-1 or multi-edition soulbound',
    description:
      'Admin-minted on-chain image NFTs. Deploy the image storage template, then pick ERC-721 (1-of-1) or ERC-1155 (many per wallet).',
    status: 'active',
    steps: [
      {
        kind: 'atomic',
        name: 'NFTGraphic',
        title: 'Graphic',
        description: 'Clonable on-chain image storage template. Deploy once per chain.',
      },
      {
        kind: 'alternative',
        id: 'minter',
        title: 'Minter',
        label: 'Pick a minter standard — choose one',
        description:
          'ERC-721 (default): one mint per wallet. ERC-1155: multiple mints per wallet, each with its own image and token ID.',
        defaultOption: 'NFTMinter',
        options: [
          {
            kind: 'atomic',
            name: 'NFTMinter',
            description: 'ERC-721 · one soulbound mint per wallet.',
            dependsOn: [{ contract: 'NFTGraphic', argName: '_implementation' }],
          },
          {
            kind: 'atomic',
            name: 'NFTMinter1155',
            description:
              'ERC-1155 · multiple soulbound token IDs per wallet, each with its own image.',
            dependsOn: [{ contract: 'NFTGraphic', argName: '_implementation' }],
          },
        ],
      },
    ],
  },
  {
    id: 'crypto-coin',
    label: 'CryptoCoin',
    tagline: 'ERC-20 admin-minted token',
    description:
      'A mintable ERC-20. Admin can mint to any wallet and lock supply permanently when ready. Recipients can transfer freely.',
    status: 'active',
    steps: [
      {
        kind: 'atomic',
        name: 'CoinMintable',
        title: 'Coin',
        description: 'ERC-20 with admin-controlled minting, transferable tokens, and a supply lock.',
        constructorExamples: ['"My Coin"', '"MYC"', '18', '1000000'],
      },
    ],
  },
  {
    id: 'misc',
    label: 'Misc',
    tagline: 'examples and utilities',
    description:
      "Standalone contracts that aren't part of a bundled app flow. Any newly-added .vy not placed in another category shows up here as 'Other'.",
    status: 'active',
    steps: [
      {
        kind: 'atomic',
        name: 'Counter',
        title: 'Counter',
        description: 'Example contract used by the starter tests.',
      },
    ],
  },
]

// Flattened, all-categories plan. Kept for backward compatibility with helpers
// that don't care about categorization.
export const deploymentPlan: PlanStep[] = categories.flatMap((c) => c.steps)

// --- Category lookup --------------------------------------------------------

export function findCategoryById(id: string | null | undefined): DeploymentCategory | undefined {
  return id ? categories.find((c) => c.id === id) : undefined
}

export function findCategoryContaining(name: ContractName): DeploymentCategory | undefined {
  for (const c of categories) {
    if (flattenSteps(c.steps).some((s) => s.name === name)) return c
  }
  return undefined
}

/**
 * Pick the category that best matches an existing set of deployments — used
 * when the user visits the app with contracts already deployed but no active
 * category set (e.g. from an older session before categories existed, or
 * after clearing their localStorage). Ranks by count of deployed contracts
 * in each category; ties break in plan declaration order.
 */
export function inferCategoryFromDeployments(
  deployed: Readonly<Record<string, Address | undefined>>,
): string | null {
  let best: { id: string; count: number } | null = null
  for (const cat of categories) {
    if (cat.status !== 'active') continue
    const count = flattenSteps(cat.steps).filter((s) => !!deployed[s.name]).length
    if (count > 0 && (!best || count > best.count)) {
      best = { id: cat.id, count }
    }
  }
  return best?.id ?? null
}

// Contracts present in the generated ABI registry but not placed in any
// category. Misc surfaces these as an "Other" section so a newly-added .vy
// doesn't silently disappear.
export function getUncategorizedContracts(): ContractName[] {
  const all = Object.keys(contracts) as ContractName[]
  const placed = new Set<ContractName>(
    categories.flatMap((c) => flattenSteps(c.steps).map((s) => s.name)),
  )
  return all.filter((n) => !placed.has(n))
}

// --- Plan traversal (all helpers accept an optional `steps` scope) ---------

export function flattenSteps(steps: PlanStep[] = deploymentPlan): AtomicStep[] {
  const out: AtomicStep[] = []
  for (const s of steps) {
    if (s.kind === 'atomic') out.push(s)
    else out.push(...s.options)
  }
  return out
}

export function findStep(name: ContractName): AtomicStep | undefined {
  for (const s of deploymentPlan) {
    if (s.kind === 'atomic' && s.name === name) return s
    if (s.kind === 'alternative') {
      const opt = s.options.find((o) => o.name === name)
      if (opt) return opt
    }
  }
  return undefined
}

export function findAlternativeContaining(name: ContractName): AlternativeStep | undefined {
  for (const s of deploymentPlan) {
    if (s.kind === 'alternative' && s.options.some((o) => o.name === name)) return s
  }
  return undefined
}

export function orderedContractNames(steps: PlanStep[] = deploymentPlan): ContractName[] {
  const all = Object.keys(contracts) as ContractName[]
  return flattenSteps(steps)
    .map((s) => s.name)
    .filter((n) => all.includes(n))
}

// --- Status + focus --------------------------------------------------------

export type StepStatus = 'done' | 'done-stale' | 'ready' | 'blocked'

export function statusOf(
  name: ContractName,
  deployed: Readonly<Record<string, Address | undefined>>,
): StepStatus {
  const step = findStep(name)
  const hasAddr = !!deployed[name]
  const depsOk = (step?.dependsOn ?? []).every((d) => !!deployed[d.contract])
  if (hasAddr) return depsOk ? 'done' : 'done-stale'
  return depsOk ? 'ready' : 'blocked'
}

export function isStepSatisfied(
  step: PlanStep,
  deployed: Readonly<Record<string, Address | undefined>>,
): boolean {
  if (step.kind === 'atomic') return !!deployed[step.name]
  return step.options.some((o) => !!deployed[o.name])
}

export function currentFocus(
  deployed: Readonly<Record<string, Address | undefined>>,
  steps: PlanStep[] = deploymentPlan,
): ContractName | undefined {
  for (const step of steps) {
    if (isStepSatisfied(step, deployed)) continue
    if (step.kind === 'atomic') {
      return statusOf(step.name, deployed) === 'ready' ? step.name : undefined
    }
    if (statusOf(step.defaultOption, deployed) === 'ready') return step.defaultOption
    const any = step.options.find((o) => statusOf(o.name, deployed) === 'ready')
    return any?.name
  }
  return undefined
}

export function autoCsvFor(
  name: ContractName,
  deployed: Readonly<Record<string, Address | undefined>>,
): string {
  const step = findStep(name)
  const ctor = (
    contracts[name].abi as readonly {
      type: string
      inputs?: readonly { name?: string; type: string }[]
    }[]
  ).find((e) => e.type === 'constructor')
  const inputs = ctor?.inputs ?? []
  if (inputs.length === 0) return ''
  const slots = new Array<string>(inputs.length).fill('')
  for (const dep of step?.dependsOn ?? []) {
    const idx = inputs.findIndex((i) => i.name === dep.argName)
    if (idx >= 0 && deployed[dep.contract]) slots[idx] = deployed[dep.contract]!
  }
  return slots.join(', ')
}

/**
 * Build placeholder text for a contract's constructor CSV field. Uses the
 * step's `constructorExamples` when provided; otherwise falls back to a
 * type-based sample per input. Returns '' for zero-arg constructors.
 */
export function samplePlaceholderFor(
  name: ContractName,
  inputs: readonly { name?: string; type: string }[],
): string {
  if (inputs.length === 0) return ''
  const step = findStep(name)
  if (
    step?.constructorExamples &&
    step.constructorExamples.length === inputs.length
  ) {
    return step.constructorExamples.join(', ')
  }
  return inputs.map((i) => sampleForType(i.type)).join(', ')
}

function sampleForType(type: string): string {
  if (type === 'address') return '0x0000000000000000000000000000000000000000'
  if (type === 'bool') return 'true'
  if (type === 'string') return '"example"'
  if (type.startsWith('uint') || type.startsWith('int')) return '0'
  if (type.startsWith('bytes')) return '0x'
  return `<${type}>`
}

/** Compact `name:type, name:type, ...` schema string — shown under the input. */
export function schemaHintFor(
  inputs: readonly { name?: string; type: string }[],
): string {
  if (inputs.length === 0) return ''
  return inputs.map((i) => `${i.name ?? '_'}:${i.type}`).join(', ')
}

export function topoSort(
  names: ContractName[],
  steps: PlanStep[] = deploymentPlan,
): ContractName[] {
  const nameSet = new Set(names)
  const planOrder = flattenSteps(steps)
    .map((s) => s.name)
    .filter((n) => nameSet.has(n))
  const plannedSet = new Set(planOrder)
  const rest = names.filter((n) => !plannedSet.has(n))
  return [...planOrder, ...rest]
}

// --- localStorage-backed active-category -----------------------------------

const ACTIVE_CATEGORY_KEY = 'vyperFramework.ui.activeCategory.v1'

export function readActiveCategory(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CATEGORY_KEY)
  } catch {
    return null
  }
}

export function writeActiveCategory(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_CATEGORY_KEY, id)
    else localStorage.removeItem(ACTIVE_CATEGORY_KEY)
    window.dispatchEvent(new Event('active-category-changed'))
  } catch {
    /* ignore quota errors */
  }
}
