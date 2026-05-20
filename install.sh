#!/bin/sh
set -eu

PKG="@joinc/hi"
MIN_NODE_MAJOR=18

say() {
  printf '%s\n' "$*"
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

have() {
  command -v "$1" >/dev/null 2>&1
}

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" 2>/dev/null && pwd || printf '')
MODE="${HI_INSTALL_MODE:-auto}"
REPO_DIR=""

if ! have node; then
  fail "node not found on PATH (need Node >=18)"
fi

if ! have npm; then
  fail "npm not found on PATH"
fi

NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || printf '0')
case "$NODE_MAJOR" in
  ''|*[!0-9]*) NODE_MAJOR=0 ;;
esac

if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  fail "Node $(node -v 2>/dev/null || printf 'unknown') is too old; need Node >=18"
fi

is_hi_repo() {
  dir=$1
  [ -n "$dir" ] || return 1
  [ -f "$dir/package.json" ] || return 1
  [ "$(node -p "require(process.argv[1]).name" "$dir/package.json" 2>/dev/null || printf '')" = "$PKG" ]
}

if [ "$MODE" = "auto" ]; then
  if is_hi_repo "$SCRIPT_DIR"; then
    MODE="local"
    REPO_DIR="$SCRIPT_DIR"
  elif is_hi_repo "$PWD"; then
    MODE="local"
    REPO_DIR="$PWD"
  else
    MODE="npm"
  fi
fi

case "$MODE" in
  local)
    if [ -z "$REPO_DIR" ]; then
      if is_hi_repo "$SCRIPT_DIR"; then
        REPO_DIR="$SCRIPT_DIR"
      elif is_hi_repo "$PWD"; then
        REPO_DIR="$PWD"
      else
        fail "HI_INSTALL_MODE=local requires running from the hi repo checkout"
      fi
    fi
    VERSION=$(node -p "require(process.argv[1]).version" "$REPO_DIR/package.json" 2>/dev/null || printf 'unknown')
    say "Installing hi ${VERSION} from local checkout..."
    (cd "$REPO_DIR" && npm link)
    ;;
  npm)
    VERSION="${HI_VERSION:-latest}"
    SPEC="$PKG"
    if [ "$VERSION" != "latest" ]; then
      SPEC="$PKG@$VERSION"
    fi
    say "Installing ${SPEC}..."
    npm install -g "$SPEC"
    ;;
  *)
    fail "unsupported HI_INSTALL_MODE '$MODE' (expected: auto|local|npm)"
    ;;
esac

GLOBAL_PREFIX=$(npm prefix -g 2>/dev/null || printf '')
BIN_DIR=""
if [ -n "$GLOBAL_PREFIX" ]; then
  BIN_DIR="$GLOBAL_PREFIX/bin"
fi

say ""
if have hi; then
  say "Installed: $(command -v hi)"
  say "Version: $(hi --version 2>/dev/null || printf 'unknown')"
else
  say "hi was installed, but it is not on PATH in this shell yet."
fi

if [ -n "$BIN_DIR" ]; then
  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
      say ""
      say "PATH hint:"
      say "  export PATH=\"$BIN_DIR:\$PATH\""
      ;;
  esac
fi

say ""
say "Try:"
say "  hi"
say "  hi status"
