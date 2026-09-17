#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
cd "$(dirname "$0")/.."
umask 077
task_export_repo="${SKILLBOX_GIT_EXPORT_DIR:?Set SKILLBOX_GIT_EXPORT_DIR to the dedicated private export checkout}"
test -d "$task_export_repo/.git"
task_stage="$(mktemp -d)"
trap 'rm -rf "$task_stage"' EXIT
docker compose exec -T app bun scripts/export.ts
docker compose cp app:/app/data/export/. "$task_stage/" > /dev/null
test -f "$task_stage/.skillbox-export"
# This dedicated checkout contains generated library content, never app source.
if [ ! -f "$task_export_repo/.skillbox-export" ] && [ -n "$(git -C "$task_export_repo" ls-files)" ]; then
  echo 'Refusing to overwrite a repository not marked as a Skillbox export' >&2
  exit 1
fi
rsync -a --delete --exclude=.git "$task_stage/" "$task_export_repo/"
git -C "$task_export_repo" add -- skills archive disabled manifest.json .skillbox-export
if ! git -C "$task_export_repo" diff --cached --quiet; then
  git -C "$task_export_repo" commit -m 'Export published Skillbox library'
fi
git -C "$task_export_repo" push -u origin HEAD
echo 'Skillbox export pushed to GitHub'
