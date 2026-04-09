# vyperFrameworkStartup

A minimal, working starter for writing **Vyper 0.4.3** smart contracts with the
**Ape Framework**. Includes one example contract, passing tests, and a deploy
script.

## Versions pinned

- Python 3.13
- Vyper 0.4.3
- eth-ape 0.8.48
- ape-vyper 0.8.10
- ape-foundry 0.8.x (for tracing / coverage)
- Foundry (`anvil`) — local EVM node

Full pinned set is in `requirements.txt`.

---

## 1. One-time machine setup

You only ever do this once per computer.

```bash
# Python 3.13 (macOS)
brew install python@3.13

# Foundry (gives you `anvil`, the local Ethereum node Ape uses for tests)
brew install foundry          # macOS
# OR, any OS:
# curl -L https://foundry.paradigm.xyz | bash && foundryup
```

## 2. Project setup

```bash
git clone andrewtheiss/vyperFrameworkStart
cd vyperFrameworkStart

python3 -m venv venv
source venv/bin/activate           # Windows: venv\Scripts\activate

pip install -r requirements.txt
ape plugins install .              # installs vyper + foundry plugins from ape-config.yaml
```

## 3. Compile and test

```bash
source venv/bin/activate

ape compile                        # compile contracts/

ape test -v                        # run tests on Ape's built-in test chain
ape test --coverage --network ethereum:local:foundry   # with coverage (uses anvil)
```

You should see **4 passed** and **100% function coverage** on `Counter.vy`.

## 4. Deploy locally

```bash
ape run deploy                     # deploys Counter to the local test chain
```

---

## 5. Deploying to a real testnet (Sepolia)

To talk to a real Ethereum network you need two things: an **RPC provider**
(Alchemy) and a **funded account**.

### 5a. Get a free Alchemy API key

1. Go to <https://www.alchemy.com/> and click **Sign up** (free tier is fine).
2. After signing in, click **Create new app**.
3. Chain: **Ethereum**. Network: **Ethereum Sepolia**. Name it anything.
4. Open the app, click **API Key**, copy the key.
5. Export it in your shell (Ape's alchemy plugin reads this env var):

   ```bash
   export WEB3_ALCHEMY_API_KEY=your_key_here
   # or, equivalently:
   export WEB3_ALCHEMY_PROJECT_ID=your_key_here
   ```

   Put that line in `~/.zshrc` (or `~/.bashrc`) so it persists.

### 5b. Get free Sepolia ETH

You need a tiny amount of test ETH to pay gas. Use any of:

- <https://sepoliafaucet.com/> (Alchemy's own faucet — sign in with your Alchemy account)
- <https://www.infura.io/faucet/sepolia>
- <https://cloud.google.com/application/web3/faucet/ethereum/sepolia>

Send the ETH to the address of the account you'll import in the next step.

### 5c. Import a deployer account into Ape

**Never use a wallet that holds real money.** Make a brand-new throwaway
account in MetaMask, export its private key, and import it into Ape:

```bash
ape accounts import deployer
# Paste the private key when prompted
# Set a passphrase you will remember
ape accounts list
```

### 5d. Deploy to Sepolia

```bash
ape run deploy --network ethereum:sepolia:alchemy
```

Ape will ask for the passphrase you set above, then broadcast the deploy.
Copy the printed contract address — that's your live contract on Sepolia.
You can view it on <https://sepolia.etherscan.io/>.

---

## Code coverage notes

- `ape test --coverage` works best with the **foundry** provider, because it
  needs transaction tracing:
  ```bash
  ape test --coverage --network ethereum:local:foundry
  ```
- This starter targets **100% function coverage**. Statement coverage in the
  current `ape-vyper` release is incomplete (it under-counts constructors and
  pure-view getters), so don't be alarmed if `Stmts` shows ~60% even when every
  line is exercised — `Funcs` is the metric to chase.

## Layout

```
contracts/Counter.vy     # example Vyper contract
tests/conftest.py        # shared fixtures (owner, alice, deployed counter)
tests/test_counter.py    # 4 tests, 100% function coverage
scripts/deploy.py        # `ape run deploy`
ape-config.yaml          # vyper 0.4.3 pinned, plugins listed
requirements.txt         # pinned Python deps
```

## Common commands cheat sheet

```bash
ape compile
ape test -v
ape test tests/test_counter.py::test_increment -v
ape test --coverage --network ethereum:local:foundry
ape run deploy
ape run deploy --network ethereum:sepolia:alchemy
ape accounts list
ape console --network ethereum:sepolia:alchemy
```
