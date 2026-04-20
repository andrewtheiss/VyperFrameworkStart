import { Fragment, useEffect, useState, type SVGProps } from 'react'

const ADVANCED_KEY = 'vyperFramework.ui.advancedMode.v1'

function readAdvanced(): boolean {
  try {
    return localStorage.getItem(ADVANCED_KEY) === '1'
  } catch {
    return false
  }
}

function writeAdvanced(v: boolean) {
  try {
    if (v) localStorage.setItem(ADVANCED_KEY, '1')
    else localStorage.removeItem(ADVANCED_KEY)
  } catch {
    /* ignore */
  }
}

export function DeploymentFlowDiagram({ active }: { active: boolean }) {
  const [advanced, setAdvanced] = useState<boolean>(() => readAdvanced())
  useEffect(() => {
    writeAdvanced(advanced)
  }, [advanced])

  const nodes = advanced
    ? [
        {
          key: 'src',
          Icon: ContractIcon,
          label: 'Vyper source',
          tip: 'Your .vy files in /contracts. This is what you edit.',
        },
        {
          key: 'compile',
          Icon: BinaryIcon,
          label: 'Ape compile',
          tip:
            'Ape turns .vy source into EVM bytecode behind the scenes. ' +
            'This runs automatically via `npm run dev` whenever you save a contract — ' +
            'you never have to invoke it manually.',
        },
        {
          key: 'chain',
          Icon: BlockchainIcon,
          label: 'On-chain',
          tip: 'The bytecode is sent to the blockchain. Once confirmed, anyone can interact with the contract.',
        },
      ]
    : [
        {
          key: 'src',
          Icon: ContractIcon,
          label: 'Your contracts',
          tip: 'Your .vy files. Compiled to bytecode behind the scenes by Ape — switch on Advanced to see that step.',
        },
        {
          key: 'chain',
          Icon: BlockchainIcon,
          label: 'On-chain',
          tip: 'The contract is sent to the blockchain. Once confirmed, anyone can interact with it.',
        },
      ]

  return (
    <div className="flow">
      <div className="flow-header">
        <div className="flow-intro">
          <h3>How deployment works</h3>
          <p className="hint">
            Your <code>.vy</code> source is compiled by{' '}
            <a href="https://apeworx.io" target="_blank" rel="noreferrer">
              Ape
            </a>{' '}
            into EVM bytecode, then sent on-chain.{' '}
            {advanced
              ? 'The compile step is shown explicitly below.'
              : 'Tick Advanced to see the compile step.'}
          </p>
        </div>
        <div className="flow-controls">
          <label className="toggle" data-tooltip="Show the compile step that Ape runs automatically.">
            <input
              type="checkbox"
              checked={advanced}
              onChange={(e) => setAdvanced(e.target.checked)}
            />
            <span>Advanced</span>
          </label>
          <button
            type="button"
            className="icon-btn"
            data-tooltip="Reset advanced view to default."
            aria-label="Reset advanced mode"
            onClick={() => {
              try {
                localStorage.removeItem(ADVANCED_KEY)
              } catch {
                /* ignore */
              }
              setAdvanced(false)
            }}
          >
            <ResetIcon />
          </button>
        </div>
      </div>

      <div className={`flow-track ${active ? 'flow-active' : ''}`}>
        {nodes.map((n, i) => (
          <Fragment key={n.key}>
            <div className="flow-node" data-tooltip={n.tip} tabIndex={0}>
              <div className="flow-icon">
                <n.Icon />
              </div>
              <div className="flow-label">{n.label}</div>
            </div>
            {i < nodes.length - 1 && (
              <div
                className="flow-arrow"
                data-tooltip={
                  i === 0 && advanced
                    ? 'Ape reads your .vy source and emits EVM bytecode.'
                    : 'A deploy transaction puts the bytecode on-chain.'
                }
                tabIndex={0}
              >
                <ArrowIcon />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

// --- Icons ------------------------------------------------------------------

function ContractIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <line x1="9" y1="12.5" x2="15" y2="12.5" />
      <line x1="9" y1="15.5" x2="14" y2="15.5" />
      <line x1="9" y1="18.5" x2="13" y2="18.5" />
    </svg>
  )
}

function BinaryIcon(props: SVGProps<SVGSVGElement>) {
  // A small chip/box with binary digits — universally reads as "compiled bytecode"
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect x="4" y="4.5" width="16" height="15" rx="2.5" />
      <text
        x="12"
        y="11.8"
        textAnchor="middle"
        fontSize="4.6"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill="currentColor"
        stroke="none"
      >
        0110
      </text>
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontSize="4.6"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill="currentColor"
        stroke="none"
      >
        1001
      </text>
    </svg>
  )
}

function BlockchainIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect x="1.5" y="9" width="6" height="6" rx="1" />
      <path d="M7.5 12h1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M15 12h1.5" />
      <rect x="16.5" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}

function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <line x1="6" y1="12" x2="54" y2="12" />
      <polyline points="46,6 54,12 46,18" />
    </svg>
  )
}

function ResetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M3 12a9 9 0 1 0 3.5-7.1" />
      <polyline points="3 3 3 9 9 9" />
    </svg>
  )
}
