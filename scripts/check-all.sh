#!/usr/bin/env bash
# Runs every automated check for this repo on your own machine (no GitHub
# Actions needed):
#
#   1. Terraform: fmt, init (no backend), validate (root + bootstrap)
#   2. tflint (terraform recommended preset + AWS ruleset, infra/.tflint.hcl)
#   3. checkov security scan (accepted risks are inline #checkov:skip with reasons)
#   4. terraform test (offline, mock providers, infra/tests/*.tftest.hcl)
#   5. Playwright end-to-end suite against the live OutSystems app
#
# Usage:
#   scripts/check-all.sh                 # everything
#   SKIP_E2E=1 scripts/check-all.sh      # infrastructure checks only
#   APP_BASE_URL=https://.../SGFamilySupportFinder/ scripts/check-all.sh
#
# Needs: terraform >= 1.7 (for mock_provider), tflint, checkov, node + npm.
# scripts/install-tools.sh installs the pinned versions used for the
# committed evidence. Exit code is non-zero if any step fails.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA="$ROOT/infra"
APP_BASE_URL="${APP_BASE_URL:-https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/}"
STEP_TIMEOUT="${STEP_TIMEOUT:-300}"   # seconds per step / per Playwright batch
export CHECKPOINT_DISABLE=1 TF_IN_AUTOMATION=1

declare -a NAMES=() RESULTS=() DETAILS=()
FAILED=0

record() { NAMES+=("$1"); RESULTS+=("$2"); DETAILS+=("$3"); [ "$2" = "PASS" ] || FAILED=1; }

run_step() { # name, dir, command...
  local name="$1" dir="$2"; shift 2
  echo
  echo "=== $name"
  echo "\$ (cd ${dir#"$ROOT"/} && $*)"
  local out rc
  out="$(cd "$dir" && timeout -k 5 "$STEP_TIMEOUT" "$@" 2>&1)"; rc=$?
  echo "$out"
  echo "--- exit code: $rc"
  LAST_OUT="$out"
  return $rc
}

echo "SG Family Support Finder: local checks"
echo "Started: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
if git -C "$ROOT" rev-parse HEAD >/dev/null 2>&1; then
  echo "Commit:  $(git -C "$ROOT" rev-parse HEAD) (uncommitted changes: $(git -C "$ROOT" status --porcelain | grep -vc '^ D'))"
else
  echo "Commit:  not a git checkout"
fi
echo
echo "Tool versions:"
first_line() { local v; v="$("$@" 2>/dev/null)" && echo "${v%%$'\n'*}" || echo "$1: MISSING"; }
first_line terraform version
first_line tflint --version
echo "checkov $(first_line checkov --version)"
echo "node $(first_line node --version)"

# 1. Terraform format / init / validate ----------------------------------
if run_step "terraform fmt -check -recursive" "$INFRA" terraform fmt -check -recursive -diff; then
  record "terraform fmt" PASS "no formatting changes"
else record "terraform fmt" FAIL "files need terraform fmt"; fi

run_step "terraform init (root, no backend)" "$INFRA" terraform init -backend=false -input=false -no-color >/dev/null \
  && run_step "terraform init (bootstrap, no backend)" "$INFRA/bootstrap" terraform init -backend=false -input=false -no-color >/dev/null \
  && record "terraform init" PASS "root + bootstrap" || record "terraform init" FAIL "see log"

if run_step "terraform validate (root)" "$INFRA" terraform validate -no-color; then
  record "terraform validate (root)" PASS "$(echo "$LAST_OUT" | grep -m1 Success)"
else record "terraform validate (root)" FAIL "see log"; fi
if run_step "terraform validate (bootstrap)" "$INFRA/bootstrap" terraform validate -no-color; then
  record "terraform validate (bootstrap)" PASS "$(echo "$LAST_OUT" | grep -m1 Success)"
else record "terraform validate (bootstrap)" FAIL "see log"; fi

# 2. tflint ----------------------------------------------------------------
run_step "tflint --init" "$INFRA" tflint --init >/dev/null
if run_step "tflint --recursive" "$INFRA" tflint --recursive --format compact; then
  record "tflint" PASS "0 issues (recommended preset + aws ruleset)"
else record "tflint" FAIL "issues found, see log"; fi

# 3. checkov ---------------------------------------------------------------
if run_step "checkov (terraform)" "$INFRA" checkov -d . --framework terraform --quiet --compact -o cli; then
  record "checkov" PASS "$(echo "$LAST_OUT" | grep -m1 'Passed checks')"
else
  record "checkov" FAIL "$(echo "$LAST_OUT" | grep -m1 'Passed checks' || echo 'see log')"
fi

# 4. terraform test --------------------------------------------------------
if run_step "terraform test (offline, mock providers)" "$INFRA" terraform test -no-color; then
  record "terraform test" PASS "$(echo "$LAST_OUT" | grep -m1 -E 'Success!|Failure!')"
else
  record "terraform test" FAIL "$(echo "$LAST_OUT" | grep -m1 -E 'Success!|Failure!' || echo 'see log')"
fi

# 5. Playwright against the live app ----------------------------------------
if [ "${SKIP_E2E:-0}" = "1" ]; then
  record "Playwright e2e" SKIP "SKIP_E2E=1"
else
  TESTS="$ROOT/tests"
  [ -d "$TESTS/node_modules/@playwright/test" ] || (cd "$TESTS" && npm ci --no-audit --no-fund >/dev/null)
  export APP_BASE_URL
  # Serial (--workers=1) in batches so each stays under STEP_TIMEOUT on a
  # throttled personal environment. Any spec not named below (a new one) runs
  # in a final batch, so nothing is silently left out.
  BATCHES=(
    "app-loads.spec.ts hotline.spec.ts timezone.spec.ts translations.spec.ts api-error-retry.mock.spec.ts admin.spec.ts"
    "centre-details-panel.spec.ts directory.spec.ts search.spec.ts dropdowns.spec.ts contact-directions.spec.ts no-results.spec.ts real-records.spec.ts"
    "persistence-refresh.spec.ts findsupport.spec.ts nearest.spec.ts"
    "wizard.spec.ts share-print.spec.ts ux-responsive.spec.ts"
  )
  LISTED=" ${BATCHES[*]} "
  REST=""
  for f in $(cd "$TESTS" && ls -1 *.spec.ts); do
    case "$LISTED" in *" $f "*) ;; *) REST="$REST $f" ;; esac
  done
  [ -n "$REST" ] && BATCHES+=("${REST# }")
  TOTAL_P=0; TOTAL_F=0; TOTAL_S=0; TOTAL_FL=0; i=0; E2E_OK=1; N=${#BATCHES[@]}
  for b in "${BATCHES[@]}"; do
    i=$((i + 1))
    json="$(mktemp)"
    # shellcheck disable=SC2086
    PLAYWRIGHT_JSON_OUTPUT_NAME="$json" run_step "Playwright batch $i/$N" "$TESTS" \
      npx playwright test $b --project=chromium --workers=1 --reporter=list,json || E2E_OK=0
    read -r p f s fl < <(node -e '
      const fs=require("fs"); let s={expected:0,unexpected:0,skipped:0,flaky:0};
      try { s=Object.assign(s, JSON.parse(fs.readFileSync(process.argv[1],"utf8")).stats); } catch (e) {}
      console.log(s.expected, s.unexpected, s.skipped, s.flaky);' "$json")
    rm -f "$json"
    echo "--- batch $i: $p passed, $f failed, $s skipped, $fl flaky"
    TOTAL_P=$((TOTAL_P + p)); TOTAL_F=$((TOTAL_F + f)); TOTAL_S=$((TOTAL_S + s)); TOTAL_FL=$((TOTAL_FL + fl))
  done
  SUMMARY="$TOTAL_P passed, $TOTAL_F failed, $TOTAL_S skipped, $TOTAL_FL flaky"
  if [ "$E2E_OK" = "1" ] && [ "$TOTAL_F" = "0" ]; then record "Playwright e2e (live app)" PASS "$SUMMARY"
  else record "Playwright e2e (live app)" FAIL "$SUMMARY"; fi
fi

echo
echo "=== Summary ($(date -u '+%Y-%m-%d %H:%M:%S UTC'))"
for idx in "${!NAMES[@]}"; do
  printf '%-30s %-5s %s\n' "${NAMES[$idx]}" "${RESULTS[$idx]}" "${DETAILS[$idx]}"
done
echo
echo "Not run here: a real 'terraform plan' / 'apply' against AWS (needs an AWS account)."
exit $FAILED
