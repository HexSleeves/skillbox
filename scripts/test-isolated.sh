#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_project="skillbox-test-$$"
trap 'docker compose -p "$test_project" -f compose.test.yml down --volumes >/dev/null' EXIT
docker compose -p "$test_project" -f compose.test.yml up --build --abort-on-container-exit --exit-code-from test
