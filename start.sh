#!/usr/bin/env bash
# Set up and start CareBridge (SwasthyaSetu AI) on macOS / Linux.
#
#   ./start.sh               set up if needed (backend/.venv, npm packages, .env), then start all servers
#   ./start.sh --setup-data  also download + import ICD-11, RxNorm and DDInter (~95 MB, once)
#   ./start.sh --reinstall   rebuild the Python virtual environment
#
# Backend (8000), Doctor portal (5173) and Patient app web build (8081) run in this terminal; Ctrl+C stops them.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
DOCTOR_APP="$ROOT/frontend Doctor"
PATIENT_APP="$ROOT/frontend Patient"
VENV="$BACKEND/.venv"
VENV_PY="$VENV/bin/python"
BACKEND_PORT=8000
DOCTOR_PORT=5173
PATIENT_PORT=8081
SETUP_DATA=0
REINSTALL=0
for arg in "$@"; do
  case "$arg" in
    --setup-data) SETUP_DATA=1 ;;
    --reinstall) REINSTALL=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

step() { printf '\033[36m==> %s\033[0m\n' "$1"; }
info() { printf '    %s\n' "$1"; }
fail() { printf '\033[31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }
sha() { if command -v sha256sum >/dev/null; then sha256sum "$@" | cut -d' ' -f1 | tr -d '\n'; else shasum -a 256 "$@" | cut -d' ' -f1 | tr -d '\n'; fi; }

# 1. Python virtual environment + backend dependencies (Python 3.11+ required)
step "Python virtual environment (backend/.venv)"
[[ $REINSTALL == 1 && -d "$VENV" ]] && { info "Removing the old virtual environment"; rm -rf "$VENV"; }
if [[ ! -x "$VENV_PY" ]]; then
  PY=""
  for c in python3.12 python3.11 python3 python; do
    if command -v "$c" >/dev/null && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then PY="$c"; break; fi
  done
  [[ -n "$PY" ]] || fail "Python 3.11 or newer is required (https://www.python.org/downloads/)."
  info "Creating with: $PY"
  "$PY" -m venv "$VENV"
fi
REQ_HASH="$(sha "$BACKEND/requirements.txt")"
if [[ "$(cat "$VENV/.requirements.sha256" 2>/dev/null || true)" != "$REQ_HASH" ]]; then
  step "Installing backend requirements into the virtual environment"
  "$VENV_PY" -m pip install --disable-pip-version-check --quiet --upgrade pip
  "$VENV_PY" -m pip install --disable-pip-version-check -r "$BACKEND/requirements.txt"
  printf '%s' "$REQ_HASH" > "$VENV/.requirements.sha256"
else
  info "Backend requirements already installed"
fi

# 2. Packages for both apps
command -v npm >/dev/null || fail "Node.js (with npm) is required (https://nodejs.org/)."
for APP in "$DOCTOR_APP" "$PATIENT_APP"; do
  step "Packages ($(basename "$APP")/node_modules)"
  PKG_HASH="$(sha "$APP/package.json")$( [[ -f "$APP/package-lock.json" ]] && sha "$APP/package-lock.json" || true)"
  if [[ "$(cat "$APP/node_modules/.install.sha256" 2>/dev/null || true)" != "$PKG_HASH" ]]; then
    info "Running npm install (first run takes a few minutes)"
    (cd "$APP" && npm install --no-fund --no-audit)
    printf '%s' "$PKG_HASH" > "$APP/node_modules/.install.sha256"
  else
    info "Packages already installed"
  fi
done

# 3. Configuration
step "Configuration (.env)"
if [[ ! -f "$ROOT/.env" ]]; then
  SECRET="$("$VENV_PY" -c 'import secrets; print(secrets.token_hex(32))')"
  sed "s/^SECRET_KEY=.*/SECRET_KEY=$SECRET/" "$ROOT/.env.example" > "$ROOT/.env"
  info "Created .env with a new random SECRET_KEY"
else
  info ".env present"
fi

# 4. Clinical terminology data
step "Clinical terminology data"
if [[ $SETUP_DATA == 1 ]]; then
  (cd "$BACKEND" && "$VENV_PY" scripts/fetch_open_datasets.py) || info "Some datasets failed to import; the app still starts."
elif [[ -f "$BACKEND/data/terminology.db" ]]; then
  info "terminology.db present"
else
  info "Not set up yet: run ./start.sh --setup-data once for official codes and interaction checks."
fi

# 5. Start servers
step "Starting servers"
for port in $BACKEND_PORT $DOCTOR_PORT $PATIENT_PORT; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then fail "Port $port is already in use; stop the old server first."; fi
done
cleanup() { trap - INT TERM EXIT; kill 0 2>/dev/null || true; }
trap cleanup INT TERM EXIT
(cd "$BACKEND" && "$VENV_PY" -m uvicorn app.main:app --reload --port $BACKEND_PORT --timeout-graceful-shutdown 3) &
(cd "$DOCTOR_APP" && npx vite --port $DOCTOR_PORT --strictPort) &
(cd "$PATIENT_APP" && BROWSER=none npx expo start --web --port $PATIENT_PORT) &
for _ in $(seq 1 60); do
  if curl -fs "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
printf '\n\033[32mCareBridge is running:\033[0m\n'
printf '  Doctor portal:     http://localhost:%s  (login NMC-KA-581920 / password123)\n' "$DOCTOR_PORT"
printf '  Patient app (web): http://localhost:%s  (tap "Demo 1-Click"; first load bundles for ~30 s)\n' "$PATIENT_PORT"
printf '  API docs:          http://localhost:%s/docs\n  Press Ctrl+C to stop.\n\n' "$BACKEND_PORT"
wait
