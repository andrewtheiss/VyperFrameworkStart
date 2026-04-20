#!/usr/bin/env bash
# Bootstraps the Vyper + Ape toolchain and the Vite/React frontend.
# Idempotent: safe to re-run. Recreates the Python venv if it's broken.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

say() { printf "\033[1;34m==>\033[0m %s\n" "$*"; }
die() { printf "\033[1;31merror:\033[0m %s\n" "$*" >&2; exit 1; }

# ---------- Prereq checks ----------
command -v python3 >/dev/null || die "python3 not found on PATH"
command -v node    >/dev/null || die "node not found on PATH (install Node 20+ via nvm/brew)"
command -v npm     >/dev/null || die "npm not found on PATH"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" -ge 20 ]] || die "Node 20+ required (found $(node -v))"

# ---------- Python venv ----------
venv_broken() {
  [[ ! -x venv/bin/python3 ]] || ! venv/bin/python3 -V >/dev/null 2>&1
}

if [[ ! -d venv ]] || venv_broken; then
  say "Creating Python venv"
  rm -rf venv
  python3 -m venv venv
else
  say "Reusing existing venv"
fi

say "Installing Python dependencies"
./venv/bin/pip install --quiet --upgrade pip
./venv/bin/pip install --quiet -r requirements.txt

# ---------- Frontend ----------
[[ -d frontend ]] || die "frontend/ directory missing — has the scaffold been committed?"

say "Installing frontend dependencies (npm install)"
(cd frontend && npm install --no-audit --no-fund)

# ---------- Env file ----------
if [[ ! -f frontend/.env.local ]]; then
  cp frontend/.env.example frontend/.env.local
  say "Created frontend/.env.local — set VITE_WC_PROJECT_ID before connecting a wallet"
fi

say "Done."
cat <<'EOF'

Next steps:
  source venv/bin/activate          # activate Python toolchain
  ape compile                       # compile Vyper contracts
  cd frontend && npm run dev        # start the UI at http://localhost:5173

EOF
