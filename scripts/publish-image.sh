#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
image=${1:-}
source_url=${2:-}
if [ "${3:-}" != '--push' ] || [ "$#" -ne 3 ]; then
  echo 'Usage: scripts/publish-image.sh REGISTRY/OWNER/skillbox:VERSION https://public-source.example/repo --push' >&2
  echo 'Publishes an amd64/arm64 image using your existing registry login. No login, registry visibility or GitHub Actions changes are made.' >&2
  exit 1
fi
[[ "$image" =~ ^[a-zA-Z0-9._:/-]+$ && "$image" == *:* && "$image" != *://* ]]
case "${image##*:}" in latest|main|master|dev|edge|nightly|stable) echo 'Use a version or commit tag.' >&2; exit 1 ;; esac
[[ "$source_url" == https://* && "$source_url" != *'@'* && "$source_url" != *'?'* && "$source_url" != *'#'* && "$source_url" != *$'\n'* ]]
test -z "$(git status --porcelain)" || { echo 'Commit/clean the source tree before publishing.' >&2; exit 1; }
platforms=$(docker buildx inspect | grep 'Platforms:' || true)
if [[ "$platforms" != *linux/amd64* || "$platforms" != *linux/arm64* ]]; then
  echo 'Select a Buildx builder supporting linux/amd64 and linux/arm64. Native or explicitly configured emulation is required; this script does not alter host binfmt or create builders.' >&2
  exit 1
fi
sha=$(git rev-parse HEAD)
docker buildx build --platform linux/amd64,linux/arm64 \
  --label "org.opencontainers.image.source=$source_url" \
  --label "org.opencontainers.image.revision=$sha" \
  --label 'org.opencontainers.image.licenses=MIT' \
  --tag "$image" --push .
docker buildx imagetools inspect "$image" --format '{{.Manifest.Digest}}'
echo 'Before Umbrel packaging, make the intended image publicly pullable and verify it anonymously. A successful authenticated push does not prove public access.'
