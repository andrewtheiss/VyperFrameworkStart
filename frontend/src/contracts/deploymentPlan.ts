import type { Address } from 'viem'
import { contracts, type ContractName } from '../abis'

// Declare the canonical deployment order and any constructor-argument
// dependencies. The DeploymentPanel consumes this to auto-select the current
// step, prepopulate constructor args with already-deployed addresses, and
// render alternative "pick one" groups.

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
}

export type AlternativeStep = {
  kind: 'alternative'
  id: string
  /** Short UI label for the progress stepper. Defaults to `label` if omitted. */
  title?: string
  label: string
  description?: string
  options: AtomicStep[]
  /** ContractName of the option that should be auto-checked by default. */
  defaultOption: ContractName
}

export type PlanStep = AtomicStep | AlternativeStep

export const deploymentPlan: PlanStep[] = [
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
        description: 'ERC-1155 · multiple soulbound token IDs per wallet, each with its own image.',
        dependsOn: [{ contract: 'NFTGraphic', argName: '_implementation' }],
      },
    ],
  },
]

// --- Traversal helpers -----------------------------------------------------

export function flattenSteps(): AtomicStep[] {
  const out: AtomicStep[] = []
  for (const s of deploymentPlan) {
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

export function orderedContractNames(): ContractName[] {
  const all = Object.keys(contracts) as ContractName[]
  const planned = flattenSteps()
    .map((s) => s.name)
    .filter((n) => all.includes(n))
  const plannedSet = new Set<ContractName>(planned)
  const unplanned = all.filter((n) => !plannedSet.has(n))
  return [...planned, ...unplanned]
}

// --- Status + auto-selection ----------------------------------------------

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

/** A plan step counts as satisfied for flow purposes if *any* of its options is deployed. */
export function isStepSatisfied(
  step: PlanStep,
  deployed: Readonly<Record<string, Address | undefined>>,
): boolean {
  if (step.kind === 'atomic') return !!deployed[step.name]
  return step.options.some((o) => !!deployed[o.name])
}

/** The single contract that should be auto-checked as the "next to deploy". */
export function currentFocus(
  deployed: Readonly<Record<string, Address | undefined>>,
): ContractName | undefined {
  for (const step of deploymentPlan) {
    if (isStepSatisfied(step, deployed)) continue
    if (step.kind === 'atomic') {
      return statusOf(step.name, deployed) === 'ready' ? step.name : undefined
    }
    // Alternative: focus the defaultOption if it's ready; otherwise any ready option.
    if (statusOf(step.defaultOption, deployed) === 'ready') return step.defaultOption
    const any = step.options.find((o) => statusOf(o.name, deployed) === 'ready')
    return any?.name
  }
  return undefined
}

// --- Constructor-arg autofill ---------------------------------------------

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

export function topoSort(names: ContractName[]): ContractName[] {
  const nameSet = new Set(names)
  const planOrder = flattenSteps()
    .map((s) => s.name)
    .filter((n) => nameSet.has(n))
  const plannedSet = new Set(planOrder)
  const rest = names.filter((n) => !plannedSet.has(n))
  return [...planOrder, ...rest]
}
