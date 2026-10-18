#!/usr/bin/env bash
# Installs the pinned tool versions used for the committed test evidence
# (docs/test-evidence/). Linux/macOS, amd64/arm64. Each download is checked
# against the vendor's published SHA-256 checksum file before it is used.
#
#   PREFIX=$HOME/.local/bin scripts/install-tools.sh    # default PREFIX
#   SKIP_CHECKOV=1 scripts/install-tools.sh             # terraform + tflint only
set -euo pipefail

TERRAFORM_VERSION="1.9.8"   # same as .github/workflows/terraform.yml and infra/.terraform.lock.hcl
TFLINT_VERSION="0.64.0"
CHECKOV_VERSION="3.3.29"
PREFIX="${PREFIX:-$HOME/.local/bin}"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$(uname -m)" in x86_64 | amd64) arch=amd64 ;; aarch64 | arm64) arch=arm64 ;; *) echo "unsupported arch" >&2; exit 1 ;; esac
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$PREFIX"

sha_check() { # file, checksums file
  (cd "$tmp" && grep " $(basename "$1")\$" "$2" | sha256sum -c -)
}

echo "== terraform $TERRAFORM_VERSION"
tf_zip="terraform_${TERRAFORM_VERSION}_${os}_${arch}.zip"
curl -fsSL -o "$tmp/$tf_zip" "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/${tf_zip}"
curl -fsSL -o "$tmp/tf_SHA256SUMS" "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_SHA256SUMS"
sha_check "$tmp/$tf_zip" tf_SHA256SUMS
unzip -o -q "$tmp/$tf_zip" terraform -d "$PREFIX"

echo "== tflint $TFLINT_VERSION"
tl_zip="tflint_${os}_${arch}.zip"
curl -fsSL -o "$tmp/$tl_zip" "https://github.com/terraform-linters/tflint/releases/download/v${TFLINT_VERSION}/${tl_zip}"
curl -fsSL -o "$tmp/tl_checksums.txt" "https://github.com/terraform-linters/tflint/releases/download/v${TFLINT_VERSION}/checksums.txt"
sha_check "$tmp/$tl_zip" tl_checksums.txt
unzip -o -q "$tmp/$tl_zip" tflint -d "$PREFIX"

if [ "${SKIP_CHECKOV:-0}" != "1" ]; then
  echo "== checkov $CHECKOV_VERSION (pip, user install)"
  python3 -m pip install --user --quiet "checkov==${CHECKOV_VERSION}"
fi

"$PREFIX/terraform" version | head -1
"$PREFIX/tflint" --version | head -1
echo "Installed into $PREFIX (add it to PATH). The AWS tflint ruleset is fetched by 'tflint --init'."
