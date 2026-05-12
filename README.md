# Vyper Framework

A teaching/production starter for **on-chain image NFTs** and **admin-minted ERC-20 tokens**, built with **Vyper 0.4 + Ape** for the contract layer and **Vite + React + wagmi/viem + RainbowKit** for the dApp.

The intent: a single, opinionated repo that an instructor can deploy once and hand to students. Students connect a wallet, mint NFTs that store image bytes directly on-chain, run an ERC-20 token, and see the entire deploy/mint pipeline laid out visually.

---

## 1. What this app does

| Tab | Role |
|---|---|
| **Application** | End-user surface. Renders the app for the active **category** (NFT mint UI, Coin send/balance UI, Counter playground). |
| **Deployment** | Admin/instructor surface. Picks contracts to deploy, walks through dependency-ordered deploy steps, lets you set addresses manually if a tx got orphaned. |

Both tabs share an **active category** picked once via the Deployment tab's category grid (`NFT`, `CryptoCoin`, `Misc`). The choice persists in `localStorage` so returning users land on their app immediately.

### Categories

| Category | Status | What it deploys | What the app does |
|---|---|---|---|
| **NFT** | active | `NFTGraphic` (image template, cloned per mint) + one of `NFTMinter` (ERC-721, 1-of-1 soulbound) **OR** `NFTMinter1155` (ERC-1155, multi-token soulbound) | Admin uploads/encodes images and mints to specific recipients. Recipients see their NFTs rendered from on-chain bytes. Admin can "remint" the same image to another wallet on the 1155 path. |
| **CryptoCoin** | active | `CoinMintable` (ERC-20, admin-minted, lockable supply) | Admin mints tokens to wallets and can lock supply forever. Holders see balance + can send to anyone. |
| **Misc** | active | `Counter` (example contract). Auto-surfaces any uncategorized `.vy` you add. | Increment/reset playground. |

---

## 2. Stack & pinned versions

- **Python** 3.13 · **Vyper** 0.4.3 · **eth-ape** 0.8.48 · **ape-vyper** 0.8.10 · **ape-foundry** 0.8.x · **Foundry** (`anvil`)
- **Node** 20+ · **Vite** 6 · **React** 18 · **TypeScript** 5.6 · **wagmi** 2.x · **viem** 2.x · **@rainbow-me/rainbowkit** 2.x · **@tanstack/react-query** 5.x

Full pins in `requirements.txt` (Python) and `frontend/package.json` (Node).

---

## 3. Quick start

### Bootstrap

```bash
git clone <this-repo>
cd VyperFrameworkStart
./setup.sh                         # creates venv, installs Python + npm deps, seeds .env.local
```

### Daily commands

```bash
source venv/bin/activate           # Python toolchain
ape compile                        # compile .vy → .build/
ape test                           # run all 50 tests

cd frontend
npm run dev                        # Vite + ABI watcher in parallel — http://localhost:5173
npm run build                      # type-check + production bundle
npm run abis                       # one-shot ABI regeneration from .build/
```

`npm run dev` runs `concurrently` with two processes:
1. `npm run abis:watch` — chokidar watches `contracts/**/*.vy`; on save, runs `ape compile` then re-emits `frontend/src/abis/*.ts`. Vite's HMR reloads the frontend.
2. `vite` — the dev server.

So **save a `.vy`, see the UI update**.

### First-time wallet setup (per browser)

1. Install MetaMask (or any injected wallet).
2. Visit http://localhost:5173, click Connect, accept on Sepolia (default chain).
3. Get free Sepolia ETH from https://sepoliafaucet.com or https://cloud.google.com/application/web3/faucet/ethereum/sepolia.
4. Optional: get a free WalletConnect projectId from https://cloud.walletconnect.com and put it in `frontend/.env.local` to enable mobile QR connections.

---

## 4. Repository layout

```
VyperFrameworkStart/
├── setup.sh                       # idempotent bootstrap: venv + pip + npm install
├── ape-config.yaml                # Vyper 0.4.3 pinned, plugin list
├── requirements.txt               # pinned Python deps
├── README.md                      # ← this file
│
├── contracts/                     # Vyper sources (each is a Bytecode source of truth)
│   ├── Counter.vy
│   ├── NFTGraphic.vy              # clonable image storage; soulbound ERC-721
│   ├── NFTMinter.vy               # ERC-721 admin-minter, deploys NFTGraphic clones
│   ├── NFTMinter1155.vy           # ERC-1155 admin-minter, deploys NFTGraphic clones per token
│   └── CoinMintable.vy            # admin-minted ERC-20 with lockable supply
│
├── tests/                         # pytest + ape — 50 tests
│   ├── conftest.py                # shared `owner`, `alice` fixtures
│   ├── test_counter.py
│   ├── test_coin.py
│   └── test_nft.py
│
├── scripts/
│   └── deploy.py                  # ape run deploy — rarely needed; UI deploys instead
│
├── venv/                          # Python virtual env (gitignored)
└── .build/                        # ape compile output — manifest + per-contract ABI/bytecode
```

```
frontend/
├── package.json                   # Vite, React, wagmi, viem, RainbowKit
├── vite.config.ts
├── tsconfig.{,app,node}.json
├── index.html
├── .env.example                   # env var documentation
├── .gitignore                     # ignores node_modules/, dist/, .env.local, src/abis/
│
├── scripts/
│   └── generate-abis.mjs          # ape compile → src/abis/*.ts (run by npm run abis[/watch])
│
└── src/
    ├── main.tsx                   # WagmiProvider → QueryClientProvider → RainbowKitProvider → App
    ├── App.tsx                    # Tab nav (Application | Deployment), hash routing
    ├── App.css                    # ALL styles (single file — keep in sync with components)
    │
    ├── wagmi.ts                   # chain list, transports (with public RPC fallbacks)
    │
    ├── abis/                      # AUTO-GENERATED — do not edit (gitignored)
    │   ├── Counter.ts             # `counterAbi` + `counterBytecode` `as const`
    │   ├── NFTGraphic.ts          # camelCase: `nftGraphicAbi` (NOT nFTGraphicAbi)
    │   ├── NFTMinter.ts
    │   ├── NFTMinter1155.ts
    │   ├── CoinMintable.ts
    │   ├── index.ts               # `contracts` registry + `ContractName` union type
    │   └── signatures.json        # `function name → signature` map for runtime checks
    │
    ├── contracts/                 # contract-aware logic (no React in plain .ts files)
    │   ├── deploymentPlan.ts      # categories, plan steps, focus/topo helpers, localStorage I/O
    │   ├── deployments.ts         # localStorage map of deployed addresses per chain
    │   ├── pendingDeploys.ts      # localStorage map of in-flight tx hashes (recovery)
    │   ├── client.ts              # validateFunction() — runtime ABI signature guards
    │   ├── errors.ts              # ContractSignatureError thrown by validateFunction
    │   ├── args.ts                # CSV parser → typed constructor args
    │   └── useActiveCategory.ts   # React hook bridging localStorage to component state
    │
    ├── components/                # React UI
    │   ├── CategoryNav.tsx        # CategoryGrid, CategorySwitcher, ComingSoonView, icons
    │   ├── DeploymentPanel.tsx    # category-scoped deploy table; sticky button; recovery actions
    │   ├── DeploymentProgress.tsx # horizontal stepper (per category)
    │   ├── DeploymentFlowDiagram.tsx  # contracts → ape compile → on-chain explainer (toggleable advanced mode)
    │   ├── SignatureErrorBoundary.tsx # catches ContractSignatureError from validateFunction
    │   ├── CounterPanel.tsx       # Misc category app
    │   └── CoinPanel.tsx          # CryptoCoin category app (admin mint + lock + holders, user balance + send)
    │
    ├── pages/
    │   ├── ApplicationPage.tsx    # dispatches to MintPage | CoinPanel | CounterPanel by active category
    │   ├── DeploymentPage.tsx     # thin wrapper around DeploymentPanel
    │   └── MintPage.tsx           # NFT category app (admin/recipient flows for both 721 and 1155)
    │
    └── utils/
        ├── chainLimits.ts         # per-chain image-payload byte budgets
        ├── explorer.ts            # explorerTxUrl/explorerAddressUrl using chain.blockExplorers
        └── imageEncoder.ts        # canvas-based resize + WebP/JPEG re-encoding to budget
```

---

## 5. Smart contracts

All contracts target Vyper `^0.4.0`. All test files mirror the contract names.

### `NFTGraphic.vy` — clonable on-chain image storage

A soulbound ERC-721 single-token NFT. **Stateless when deployed** — used as the implementation behind `create_minimal_proxy_to(...)` (EIP-1167). Each clone holds one image.

- Storage: `tokenURI_data: Bytes[45000]`, `tokenURI_data_format: String[10]` (e.g. `"webp"`), `imageWidth`, `imageHeight`, `title`, `description`, `minter` (= recipient).
- `initialize(...)` — one-shot, callable once per clone.
- ERC-721 surface: `name`, `symbol`, `balanceOf`, `ownerOf`, `tokenURI`, `getApproved`, `isApprovedForAll`, `supportsInterface` (ERC-165, ERC-721, ERC-721-metadata).
- `getImageData()` / `getTokenURIData()` — raw bytes.
- `getDimensions() → (width, height)` — for `<img>` sizing without decode.
- All transfer/approval entrypoints `revert "soulbound: ..."`.

### `NFTMinter.vy` — ERC-721 admin minter (one per wallet)

- Constructor: `_implementation: address` (an `NFTGraphic`).
- `admin = msg.sender` at deploy. `transferAdmin(new)` to hand off.
- `mint(_to, image_data, format, w, h, title, description) → address` — admin-only. Deploys a fresh `NFTGraphic` clone, initializes it for `_to`, asserts `!hasMinted[_to]`.
- `getAllRecipients() → DynArray[address, 1000]` — enumeration in mint order.
- Events: `Minted(recipient, clone, admin, totalMinted)`, `AdminTransferred`.

### `NFTMinter1155.vy` — ERC-1155 admin minter (multi per wallet)

Same pattern, but each `mint(...)` allocates a fresh `tokenId` (`nextTokenId++`). Each token gets its own `NFTGraphic` clone (so on-chain image bytes are per-token, not per-collection).

- Per-wallet cap of 100 tokens (`MAX_TOKENS_PER_WALLET`), bounded by Vyper `DynArray`.
- `getAllRecipients()` is dedup'd (a wallet appears once even after multiple mints).
- Standard ERC-1155 events (`TransferSingle`, `TransferBatch`, `ApprovalForAll`, `URI`) — all transfer/approval entrypoints revert (soulbound).
- `getCloneOf(tokenId)` / `getMintedBy(wallet) → DynArray[uint256, 100]` for off-chain enumeration.

### `CoinMintable.vy` — admin-minted ERC-20

Constructor matches the canonical Vyper example: `_name: String[32], _symbol: String[32], _decimals: uint8, _supply: uint256`. Initial supply is in token units (multiplied by `10**_decimals`) and credited to the deployer.

- `mint(_to, _amount)` — admin-only, raw base units. Reverts if `mintingLocked`.
- `lockMinting()` — irreversible. After this, supply is forever fixed.
- Standard ERC-20: `transfer`, `approve`, `transferFrom`, `allowance`, `balanceOf`, `totalSupply`. **Tokens are transferable** (not soulbound).
- `getAllRecipients()` — dedup'd list of every wallet that's ever held a non-zero balance via mint or transfer.
- Events: `Transfer`, `Approval`, `Minted`, `MintingLocked`, `AdminTransferred`.

### `Counter.vy` — example

Owner-resettable counter. Used by `tests/test_counter.py` and as the Misc category demo.

---

## 6. Frontend architecture

### State lives in three places

| Where | What | Lifetime |
|---|---|---|
| **localStorage** | Deployments per chain · pending tx hashes · active category · advanced-mode flag · WalletConnect session | Indefinite (per-browser) |
| **React state** (per-component) | Form drafts, busy flags, deploy state, image encoding result, transient UI | Component lifetime |
| **wagmi/viem in-memory** | Wallet connection, current chain, query cache | Page lifetime |

**The localStorage keys are stable contracts** — schema changes require a version bump.

```
vyperFramework.deployments.v1         { [chainId]: { [contractName]: address } }
vyperFramework.pendingDeploys.v1      { [chainId]: { [contractName]: { txHash, timestamp } } }
vyperFramework.ui.activeCategory.v1   "nft" | "crypto-coin" | "misc"
vyperFramework.ui.advancedMode.v1     "1" if advanced flow diagram enabled
```

Each module that owns a key exports the read/write helpers (`deployments.ts`, `pendingDeploys.ts`, `deploymentPlan.ts`, `DeploymentFlowDiagram.tsx`).

### Categories and dispatch

`deploymentPlan.ts` declares `categories: DeploymentCategory[]`. Each category has `id`, `label`, `tagline`, `description`, `status`, and `steps: PlanStep[]`. A `PlanStep` is either:
- `{ kind: 'atomic', name, dependsOn?, constructorExamples?, ... }`
- `{ kind: 'alternative', id, label, options: AtomicStep[], defaultOption }` — exactly one option deploys; rendered with an "OR" divider.

`DeploymentPanel` and `ApplicationPage` both call the `useActiveCategory()` hook. If no category is set in localStorage, the hook **auto-infers** by scanning current deployments (e.g. an existing NFTMinter → category `nft` is selected automatically, then persisted).

To add a category: append to the `categories` array. To wire its app surface: add a case in `ApplicationPage.tsx`'s `CategoryAppSurface` switch.

### Deployment dependencies & auto-fill

- `dependsOn: [{ contract: 'NFTGraphic', argName: '_implementation' }]` on a step tells the panel to topologically order deploys *and* prefill the constructor CSV slot for `_implementation` with the dep's address as soon as it's known (including mid-batch).
- Status of any step is one of `done | done-stale | ready | blocked`. The `current` step is the first `ready` step in plan order — auto-checked by default unless the user overrides.

### Recovery from orphaned txs

Every `walletClient.deployContract(...)` writes its hash to `pendingDeploys.v1` immediately. If the user navigates off the Deploy tab while mining (the React component unmounts and orphans the `await waitForTransactionReceipt`), the next mount reads the pending entries and **resumes polling**.

If the resume polling times out, two manual escape hatches appear on the row:
- **Check now** — synchronous `getTransactionReceipt` re-query.
- **Set manually** — paste a known `0x...` address; the panel writes it as if a deploy succeeded. Useful when a deploy went through outside the UI (Etherscan, ape script, etc.).

### Signature drift guard

Every page calls `validateFunction('ContractName', 'methodName', argCount)` at render. It checks that the generated ABI still has that function with that arity. If you rename a Vyper function but forget to update the frontend, the next render throws `ContractSignatureError`. `SignatureErrorBoundary` catches it and shows a friendly "this method moved/renamed" panel listing the actual ABI signatures.

### Image encoder

`utils/imageEncoder.ts` accepts any image File, decodes via `createImageBitmap`, then iteratively resizes (`1024 → 768 → 512 → 384 → 256 → 192 → 128`) and re-encodes (WebP qualities `0.9 → 0.75 → 0.6 → 0.45 → 0.3`, then JPEG fallback) until the output fits a chain-specific budget. Returns `{ bytes: Uint8Array, format, width, height, quality, sourceBytes, durationMs }`.

The byte budget per chain is in `utils/chainLimits.ts`:

| Chain | Default budget | Slider max |
|---|---|---|
| Mainnet | 5 KB | 10 KB |
| Sepolia | 12 KB | 15 KB |
| Arbitrum Sepolia | 12 KB | 15 KB |
| Foundry (local) | 12 KB | 45 KB |

The 15 KB Sepolia max is **empirical** — beyond that, wallet gas estimation balloons (Vyper copies bytes through calldata → memory → storage, plus wallet 1.5–2× safety multiplier) and txs fail or get rejected.

The contract hard cap is `Bytes[45000]`. To raise it, change `MAX_IMAGE_BYTES` in `NFTGraphic.vy` AND in `HARD_MAX` in `chainLimits.ts` AND any per-chain `CHAIN_IMAGE_MAX` you want lifted.

---

## 7. Application flows

### NFT (Application tab, NFT category)

| Connected wallet is… | View |
|---|---|
| **Admin** | Mint composer at top (recipient address + image upload + title + description + Mint button) followed by a **Recipients** grid (newest-first) with each NFT card showing image, title, description, owner, and explorer links. On 1155, each card has a **remint to another wallet →** action that pulls the existing image bytes from the clone and mints a new tokenId to a different recipient (no re-upload). |
| **Anyone else** | Their own NFTs rendered from on-chain bytes. Empty state shows the admin's address as the contact for getting a mint. |

### CryptoCoin (Application tab, CryptoCoin category)

| Connected wallet is… | View |
|---|---|
| **Admin** | Mint form (recipient + amount in token units), **Lock supply** action with two-step confirm, **Holders** table with live balances. |
| **Anyone else** | Big balance readout + send form. Shows admin address if balance is zero. |

Both views share a **Header** with name, symbol, total supply, decimals, lock state, and admin.

### Counter (Application tab, Misc category)

Original starter contract — increment/reset/refresh buttons, count readout, latest tx link.

---

## 8. Chains & networks

`wagmi.ts` declares the chains in this order: **Sepolia (default), Arbitrum Sepolia, Foundry local, Mainnet**.

Mainnet exists for completeness and explicit user opt-in but is intentionally listed last and gets the smallest image-byte budget. We do **not** want students minting expensive on-chain images to mainnet by accident.

### Public RPC fallback

For each non-local chain, `wagmi.ts` builds a `fallback([http(...), http(...), ...])` transport from a curated list of CORS-friendly public RPCs:

- Mainnet: `cloudflare-eth.com`, `ethereum-rpc.publicnode.com`, `eth.llamarpc.com`
- Sepolia: `ethereum-sepolia-rpc.publicnode.com`, `eth-sepolia.public.blastapi.io`
- Arbitrum Sepolia: `sepolia-rollup.arbitrum.io/rpc`, `arbitrum-sepolia-rpc.publicnode.com`, `arbitrum-sepolia.gateway.tenderly.co`

Viem's built-in default for Sepolia includes `eth.merkle.io` which **doesn't set CORS headers** — that's why we override.

### Env overrides (optional)

In `frontend/.env.local` (gitignored, copied from `.env.example` by `setup.sh`):

```
VITE_WC_PROJECT_ID=                  # WalletConnect Cloud projectId — enables QR
VITE_SEPOLIA_RPC_URL=                # e.g. https://eth-sepolia.g.alchemy.com/v2/<KEY>
VITE_ARB_SEPOLIA_RPC_URL=            # e.g. https://arb-sepolia.g.alchemy.com/v2/<KEY>
VITE_MAINNET_RPC_URL=                # only if interacting with mainnet
```

Without any env, the app **still works** — public RPCs handle low traffic. For a classroom of 30 simultaneously, set Alchemy/Infura URLs.

### Adding a chain

1. `import { mychain } from 'wagmi/chains'` in `wagmi.ts`.
2. Add to `chains` tuple and `transports` map (with a `transportFor()` call against a CORS-friendly RPC list).
3. Add entries to `CHAIN_IMAGE_MAX` and `CHAIN_IMAGE_BUDGETS` in `utils/chainLimits.ts` based on the chain's block gas / mempool behavior.
4. Optionally document a `VITE_<CHAIN>_RPC_URL` in `.env.example`.

---

## 9. ABI generation

`frontend/scripts/generate-abis.mjs`:
1. Resolves `ape` from `../venv/bin/ape` (falls back to `$PATH`).
2. Runs `ape compile`.
3. Reads `.build/__local__.json`.
4. For each contract type, emits `frontend/src/abis/<Name>.ts` with `export const <name>Abi = [...] as const` + `export const <name>Bytecode`.
5. Emits `index.ts` (the `contracts` registry + `ContractName` union) and `signatures.json`.

The camelCase helper handles acronyms: `NFTGraphic` → `nftGraphicAbi` (not `nFTGraphicAbi`).

`src/abis/` is **gitignored** — never edit by hand, never commit. Always regenerate.

---

## 10. Tests

```bash
ape test                            # all 50 tests
ape test tests/test_nft.py -v       # one file, verbose
ape test --coverage --network ethereum:local:foundry
```

Coverage by file:
- `test_counter.py` — 4 tests
- `test_nft.py` — 27 tests across NFTGraphic, NFTMinter (721), NFTMinter1155
- `test_coin.py` — 19 tests for CoinMintable

Conventions:
- `conftest.py` provides shared `owner` (deployer/admin), `alice`, and `bob` fixtures.
- Per-file fixtures provide deployed contract instances.
- Tests use `ape.reverts("message")` to assert revert reasons match the contract's `assert ... , "..."`.

---

## 11. Adding a new contract

1. Drop `MyContract.vy` into `contracts/`. Pragma `^0.4.0`.
2. Write `tests/test_my_contract.py` mirroring the style of existing tests.
3. `ape test` — confirm green.
4. (The ABI watcher in `npm run dev` regenerates frontend ABIs on save automatically. Otherwise: `cd frontend && npm run abis`.)
5. Open `frontend/src/contracts/deploymentPlan.ts`. Add the contract as a `PlanStep` inside an existing category (or a new one — see §12). Wire `dependsOn` if it depends on another contract; supply `constructorExamples` for nicer placeholders.
6. If the contract has its own UI surface, create `components/MyContractPanel.tsx` and add a switch case in `pages/ApplicationPage.tsx`'s `CategoryAppSurface`.
7. Add `validateFunction(...)` calls at the top of any component that reads/writes the contract — they catch ABI drift early.

If you skip step 5, the contract still appears in the Misc category's "Other contracts" section (via `getUncategorizedContracts()`), so it's never silently invisible.

---

## 12. Adding a new category

1. Append a `DeploymentCategory` to `categories` in `deploymentPlan.ts`:
   ```ts
   {
     id: 'staking',
     label: 'Staking',
     tagline: 'lock tokens for rewards',
     description: '…',
     status: 'active',          // or 'coming-soon' for a placeholder
     steps: [ /* PlanSteps */ ],
   }
   ```
2. Add a `<CategoryIcon id='staking' />` case in `components/CategoryNav.tsx` (and a corresponding `XIcon()` SVG component).
3. Add a switch case in `ApplicationPage.tsx → CategoryAppSurface` returning the app component.
4. (Optional) Set `constructorExamples` on each atomic step for placeholder UX.

The category appears in the grid, the switcher pills, and the app dispatcher automatically.

---

## 13. Migration to school hosting

This app is a **fully static SPA**. Build it and serve.

```bash
cd frontend
npm run build                       # → frontend/dist/
```

Then host `dist/` from any static server: GitHub Pages, Netlify, Vercel, S3+CloudFront, or your school's webserver. Drop the directory in.

**Things to do before deploying to a public URL:**

1. **Set production env vars** in `.env.local` (which `vite build` bakes into the bundle):
   - `VITE_WC_PROJECT_ID` — required for WalletConnect/mobile.
   - `VITE_SEPOLIA_RPC_URL` and `VITE_ARB_SEPOLIA_RPC_URL` — Alchemy keys recommended for any non-trivial student count.
2. **Deploy contracts to the target chain** using the Deployment tab (or `ape run deploy --network ethereum:sepolia:alchemy`). Note the addresses.
3. **Optionally pin addresses** in `frontend/src/contracts/deployments.ts → staticDeployments` so visitors don't have to rely on their localStorage being prefilled. Anything in `staticDeployments[chainId]` becomes the global default; localStorage entries (per-browser deploys via the UI) override.
4. **Brand**: edit `index.html` `<title>`, `appName` in `wagmi.ts`, the `<h1>` in `App.tsx`. CSS lives in a single `App.css` — adjust the dark theme there.
5. **Lock down which categories appear** by setting `status: 'coming-soon'` on ones you don't want students touching, or removing them from `categories`.

**Per-browser data**: every student has their own deployments, pending txs, and active category in localStorage. Wiping browser data (or using incognito) gives a fresh experience.

**No backend required.** All state is on-chain or in-browser. The static bundle talks directly to public RPCs.

---

## 14. Critical invariants for AI / future development

These are easy to break and hard to detect:

1. **`src/abis/` is generated.** Never edit by hand. If you need to change ABI shape, change the `.vy` source and regenerate.
2. **`deploymentPlan.ts` has no React imports.** Plain TypeScript so it's testable and reusable. Hooks live in `src/contracts/use*.ts` files.
3. **localStorage keys are versioned.** If you change the schema of a stored value, bump the `.v1` to `.v2` and read the old key for migration if needed. Existing keys: see §6 table.
4. **Soulbound NFT contracts revert ALL approvals/transfers** with messages starting `soulbound:`. The frontend doesn't need to implement transfer UI for them. If you make NFTs transferable, also add the UI.
5. **`validateFunction` is mandatory** at the top of any component reading/writing a contract. It's the runtime safety net for ABI drift. Forget it and a renamed Vyper function is a silent bug.
6. **`NFTGraphic` clones are initialized exactly once.** The factory MUST call `initialize(...)` immediately after `create_minimal_proxy_to(...)` in the same tx. Otherwise the clone is hijack-able by anyone calling `initialize` first.
7. **Admin = `msg.sender` at deploy.** The deploying wallet becomes admin. To switch, call `transferAdmin(new)`. To revoke, call `transferAdmin(0x0)` — wait, that reverts (zero address forbidden). To effectively renounce, transfer to a wallet you control but never use, or extend the contract with a `renounceAdmin()` if you want explicit support.
8. **Image bytes go into contract storage**, not the contract's bytecode. So the EIP-170 24,576-byte contract size limit doesn't apply to image data — the binding constraint is **block gas limit** (~30M on Sepolia). See `chainLimits.ts` for the empirical caps.
9. **`Bytes[N]` in Vyper requires N to be a compile-time constant.** Per-chain payload limits live in the FRONTEND, not the contract. The contract accepts up to `MAX_IMAGE_BYTES` (45000); the frontend slider clamps below that based on chain.
10. **Active category persists across chain switches.** A user who picked NFT on Sepolia stays on NFT when they switch to Arbitrum Sepolia. Deployments, however, are per-chain.
11. **Hash routes**: `#/app` and `#/deploy`. `#/mint` is aliased to `#/app` for old bookmarks.
12. **Auto-resume**: any in-flight deploy survives tab unmount via `pendingDeploys.v1`. Don't bypass `setPending`/`clearPending` if you write a new deploy path.

---

## 15. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| **Can't see the application** despite having deployments | Active category not set in localStorage; auto-inference hasn't fired | Reload (the inference runs on mount). Or manually pick a category from the Deploy tab. |
| **`No projectId found`** RainbowKit error | Old build with placeholder `VITE_WC_PROJECT_ID` | Either set a real WalletConnect projectId in `.env.local`, or rely on the injected-only fallback (works without env). |
| **CORS error on `eth.merkle.io`** | Old wagmi config used viem default | Pull latest `wagmi.ts` — uses CORS-friendly public RPCs. |
| **Mint tx pending forever in UI** | Component unmounted while waiting; receipt orphaned | Click the Deploy tab — the resume polling fires on mount. Or use **check now** on the row. |
| **`<img>` shows broken / `FILE_NOT_FOUND`** | Empty bytes returned, wrong MIME, or revoked blob URL | Console logs from MintPage prefixed `[NFT image]` show byte count, format, and load errors. If `0 bytes` shows, the contract holds no image — re-mint. |
| **Image too large to mint** | Slider above chain's gas budget | Check `chainLimits.ts`. On Sepolia, stay ≤15 KB. |
| **Wallet says tx will fail / huge gas** | Image bytes too large for block | Same as above — lower the budget. |
| **`already initialized` revert during mint** | Direct `initialize` call on a clone after factory used it | Don't call `initialize` outside the factory's `mint`. |
| **Category pill missing / wrong contracts shown** | Category id typo, or contract not in any category's steps | Uncategorized contracts surface in Misc as "Other". Add them to a category's `steps` to organize. |

---

## 16. Common commands cheat sheet

```bash
# Python toolchain
source venv/bin/activate
ape compile
ape test
ape test --coverage --network ethereum:local:foundry
ape run deploy
ape run deploy --network ethereum:sepolia:alchemy
ape accounts list
ape console --network ethereum:sepolia:alchemy

# Frontend
cd frontend
npm run dev                         # ABI watcher + Vite
npm run abis                        # regenerate ABIs once
npm run build                       # production bundle
npm run preview                     # serve dist/ locally
npm run typecheck                   # tsc -b --noEmit
```

---

## 17. License & credits

Code samples drawn from `ArtPiece.vy` are © 2025 Andrew Theiss, CC BY-NC 4.0. Everything in this repo follows the same license unless noted.
