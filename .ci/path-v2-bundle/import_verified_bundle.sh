#!/usr/bin/env bash
set -euo pipefail

BASE_COMMIT="6e78c3a62d2c493081c94114bea0e1fa0cb79590"
EXPECTED_COMMIT="5d57520ac36b9a41e80b8932d84bbad38aec2a5d"
EXPECTED_TREE="10c8600e71ef706c451b2459ed09d49e9d1ac7b4"
EXPECTED_BUNDLE_SHA256="9387039e5bbbbaa5c8e318505786f0ecc6b8ba4b1c408ca786643a83025ba840"
TARGET_BRANCH="feature/v5-4-fase3-hardening"
PART_DIR=".ci/path-v2-bundle"
B64_FILE="${RUNNER_TEMP:-/tmp}/valistruct-path-v2.bundle.b64"
BUNDLE_FILE="${RUNNER_TEMP:-/tmp}/valistruct-path-v2-commit-5d57520.bundle"

printf '== PATH v2 verified bundle import ==\n'

# Require contiguous staged parts starting at part00. The final SHA gate prevents
# a partial or altered payload from ever reaching the target branch.
mapfile -t PARTS < <(find "$PART_DIR" -maxdepth 1 -type f -name 'part[0-9][0-9]' | sort)
if [[ ${#PARTS[@]} -lt 5 ]]; then
  echo "ERROR: bundle incompleto; solo hay ${#PARTS[@]} partes."
  exit 20
fi

: > "$B64_FILE"
for p in "${PARTS[@]}"; do
  cat "$p" >> "$B64_FILE"
done
base64 --decode "$B64_FILE" > "$BUNDLE_FILE"

ACTUAL_SHA="$(sha256sum "$BUNDLE_FILE" | awk '{print $1}')"
echo "bundle sha256: $ACTUAL_SHA"
[[ "$ACTUAL_SHA" == "$EXPECTED_BUNDLE_SHA256" ]] || {
  echo "ERROR: SHA-256 del bundle no coincide."
  exit 21
}

git bundle verify "$BUNDLE_FILE"
git fetch "$BUNDLE_FILE" "$TARGET_BRANCH"

IMPORTED="$(git rev-parse FETCH_HEAD)"
[[ "$IMPORTED" == "$EXPECTED_COMMIT" ]] || {
  echo "ERROR: commit importado $IMPORTED != $EXPECTED_COMMIT"
  exit 22
}

TREE="$(git rev-parse "$IMPORTED^{tree}")"
[[ "$TREE" == "$EXPECTED_TREE" ]] || {
  echo "ERROR: tree $TREE != $EXPECTED_TREE"
  exit 23
}

PARENT="$(git rev-parse "$IMPORTED^")"
[[ "$PARENT" == "$BASE_COMMIT" ]] || {
  echo "ERROR: padre $PARENT != $BASE_COMMIT"
  exit 24
}

REMOTE_TARGET="$(git ls-remote origin "refs/heads/$TARGET_BRANCH" | awk '{print $1}')"
[[ "$REMOTE_TARGET" == "$BASE_COMMIT" ]] || {
  echo "ERROR: la rama objetivo cambió: $REMOTE_TARGET"
  exit 25
}

# Ensure exact fast-forward only. Never force.
git merge-base --is-ancestor "$BASE_COMMIT" "$IMPORTED"
git push origin "$IMPORTED:refs/heads/$TARGET_BRANCH"

FINAL="$(git ls-remote origin "refs/heads/$TARGET_BRANCH" | awk '{print $1}')"
[[ "$FINAL" == "$EXPECTED_COMMIT" ]] || {
  echo "ERROR: HEAD remoto final inesperado: $FINAL"
  exit 26
}

echo "OK: PATH v2 publicado por fast-forward exacto en $TARGET_BRANCH -> $FINAL"
