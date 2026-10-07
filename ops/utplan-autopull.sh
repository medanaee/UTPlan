#!/usr/bin/env bash
set -u

REPO=/opt/medanaee-site/app
BRANCH=Armin
STATE_DIR=/home/arminam/.local/state/utplan
LOCK_FILE="$STATE_DIR/autopull.lock"
LOCK_HASH="$STATE_DIR/package-lock.sha256"
DEPLOYED_COMMIT="$STATE_DIR/deployed.commit"
LOG_FILE="$STATE_DIR/autopull.log"
NODE_BIN=/home/arminam/.local/node-runtime/node_modules/node/bin

mkdir -p "$STATE_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

log() {
  printf '%s %s\n' "$(date --iso-8601=seconds)" "$*" >> "$LOG_FILE"
}

cd "$REPO" || { log "repository is unavailable"; exit 1; }

if [ -n "$(git status --porcelain)" ]; then
  log "local changes detected; skipping deployment"
  exit 0
fi

if ! git fetch --quiet origin "$BRANCH"; then
  log "git fetch failed"
  exit 1
fi

CURRENT=$(git rev-parse HEAD)
TARGET=$(git rev-parse "origin/$BRANCH")

LAST_DEPLOYED=$(cat "$DEPLOYED_COMMIT" 2>/dev/null || true)
if [ "$CURRENT" = "$TARGET" ] && [ "$LAST_DEPLOYED" = "$TARGET" ]; then
  exit 0
fi

if ! git merge-base --is-ancestor HEAD "origin/$BRANCH"; then
  log "branch diverged; refusing automatic deployment"
  exit 1
fi

if ! git pull --ff-only --quiet origin "$BRANCH"; then
  log "fast-forward pull failed"
  exit 1
fi

export PATH="$NODE_BIN:/usr/local/bin:/usr/bin:/bin"

LOCK_CURRENT=$(sha256sum package-lock.json | awk '{print $1}')
LOCK_INSTALLED=$(cat "$LOCK_HASH" 2>/dev/null || true)
if [ "$LOCK_CURRENT" != "$LOCK_INSTALLED" ] || [ ! -x node_modules/.bin/vinext ]; then
  log "installing dependencies"
  if ! npm ci --no-audit --no-fund; then
    log "dependency installation failed"
    exit 1
  fi
  printf '%s\n' "$LOCK_CURRENT" > "$LOCK_HASH"
fi

log "building $CURRENT -> $TARGET"
if ! npm run build >> "$LOG_FILE" 2>&1; then
  log "build failed"
  exit 1
fi

if ! systemctl --user restart medanaee-site; then
  log "service restart failed"
  exit 1
fi

printf '%s\n' "$TARGET" > "$DEPLOYED_COMMIT"
log "deployed $(git rev-parse --short HEAD)"
