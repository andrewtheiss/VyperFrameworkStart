import { Fragment, type SVGProps } from 'react'
import type { Address } from 'viem'
import {
  deploymentPlan,
  type AlternativeStep,
  type AtomicStep,
  type PlanStep,
} from '../contracts/deploymentPlan'
import type { ContractName } from '../abis'

type Status = 'done' | 'current' | 'blocked' | 'upcoming'

type StepView = {
  key: string
  title: string
  status: Status
  sub?: string
}

function titleOf(step: PlanStep): string {
  if (step.kind === 'atomic') return step.title ?? step.name
  return step.title ?? step.label
}

function classify(
  step: PlanStep,
  existing: Readonly<Record<string, Address | undefined>>,
  focus: ContractName | undefined,
): StepView {
  if (step.kind === 'atomic') {
    if (existing[step.name]) {
      return { key: step.name, title: titleOf(step), status: 'done', sub: 'deployed' }
    }
    if (focus === step.name) {
      return { key: step.name, title: titleOf(step), status: 'current', sub: 'next up' }
    }
    const depsMet = (step.dependsOn ?? []).every((d) => !!existing[d.contract])
    return {
      key: step.name,
      title: titleOf(step),
      status: depsMet ? 'upcoming' : 'blocked',
      sub: depsMet ? 'ready' : `waiting on ${step.dependsOn?.[0]?.contract ?? 'prev'}`,
    }
  }
  // alternative
  const alt = step as AlternativeStep
  const deployedOpt = alt.options.find((o) => !!existing[o.name])
  if (deployedOpt) {
    return { key: alt.id, title: titleOf(step), status: 'done', sub: deployedOpt.name }
  }
  const focusedOpt = alt.options.find((o) => o.name === focus)
  if (focusedOpt) {
    return {
      key: alt.id,
      title: titleOf(step),
      status: 'current',
      sub: `${focusedOpt.name} by default`,
    }
  }
  const depsMet = alt.options.some((o) =>
    (o.dependsOn ?? []).every((d) => !!existing[d.contract]),
  )
  return {
    key: alt.id,
    title: titleOf(step),
    status: depsMet ? 'upcoming' : 'blocked',
    sub: depsMet ? 'choose one' : `waiting on ${alt.options[0].dependsOn?.[0]?.contract ?? 'prev'}`,
  }
}

export function DeploymentProgress({
  existing,
  focus,
}: {
  existing: Readonly<Record<string, Address | undefined>>
  focus: ContractName | undefined
}) {
  const views = deploymentPlan.map((s) => classify(s, existing, focus))

  return (
    <ol className="progress-stepper" aria-label="Deployment progress">
      {views.map((v, i) => (
        <Fragment key={v.key}>
          {i > 0 && (
            <li
              aria-hidden
              className={`step-line ${views[i - 1].status === 'done' ? 'done' : ''}`}
            />
          )}
          <li className={`step step-${v.status}`}>
            <span className="step-marker">
              {v.status === 'done' ? (
                <CheckCircle />
              ) : v.status === 'current' ? (
                <DotCircle />
              ) : v.status === 'blocked' ? (
                <DashedCircle />
              ) : (
                <HollowCircle />
              )}
            </span>
            <span className="step-text">
              <span className="step-title">
                <span className="step-num">{i + 1}</span>
                {v.title}
              </span>
              {v.sub && <span className="step-sub">{v.sub}</span>}
            </span>
          </li>
        </Fragment>
      ))}
    </ol>
  )
}

function CheckCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width="22" height="22" fill="none" aria-hidden {...props}>
      <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.18" />
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6 10.2 L9 13.2 L14 7.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DotCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width="22" height="22" fill="none" aria-hidden {...props}>
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="3.8" fill="currentColor" />
    </svg>
  )
}

function DashedCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width="22" height="22" fill="none" aria-hidden {...props}>
      <circle
        cx="10"
        cy="10"
        r="9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="2 2.5"
        opacity="0.75"
      />
    </svg>
  )
}

function HollowCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width="22" height="22" fill="none" aria-hidden {...props}>
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

// Silence TS unused-import warning when PlanStep/AtomicStep types aren't read at runtime.
void ({} as AtomicStep)
