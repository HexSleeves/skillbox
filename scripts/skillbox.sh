#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command=${1:-help}
if [ "$#" -gt 0 ]; then shift; fi
runtime='oven/bun:1.3.1@sha256:9c5d3c92b234b4708198577d2f39aab7397a242a40da7c2f059e51b9dc62b408'
compose() { docker compose "$@"; }
case "$command" in
  setup)
    # Docker only; no Bun, Node, curl-pipe-shell or host package installation.
    docker run --rm --network none --user "$(id -u):$(id -g)" \
      --volume "$PWD:/work" --workdir /work "$runtime" \
      bun scripts/setup-env.ts "$@"
    ;;
  start)
    compose config --quiet
    compose up -d --build --wait
    ;;
  start-image|upgrade-image)
    compose config --quiet
    # Never silently pull an unrelated image when the release image is unset.
    if compose config --images | grep -qx 'skillbox:local'; then
      echo 'Set SKILLBOX_IMAGE to a trusted versioned image in .env first.' >&2
      exit 1
    fi
    if [ "$command" = upgrade-image ]; then bash scripts/backup.sh; fi
    compose pull app db
    compose up -d --no-build --wait
    ;;
  stop) compose stop ;;
  status) compose ps ;;
  logs) compose logs --tail 100 "$@" ;;
  doctor)
    docker info >/dev/null
    compose version
    compose config --quiet # Never print expanded configuration/secrets.
    compose ps
    ;;
  backup) bash scripts/backup.sh ;;
  upgrade)
    # Review/check out the intended source release before invoking this command.
    bash scripts/backup.sh
    compose build --pull app
    compose up -d --no-deps --wait app
    ;;
  restore)
    dump=${1:-}
    if [ ! -f "$dump" ] || [ "${2:-}" != '--confirm-replace-database' ]; then
      echo 'Usage: scripts/skillbox.sh restore DUMP --confirm-replace-database' >&2
      echo 'Restore replaces this Compose project database. Back up first and retain its matching owner token.' >&2
      exit 1
    fi
    compose exec -T db pg_restore --list < "$dump" >/dev/null
    compose stop app
    if ! compose exec -T db pg_restore --clean --if-exists --exit-on-error --no-owner -U skillbox -d skillbox < "$dump"; then
      echo 'Restore failed; app left stopped. Inspect the database before restarting.' >&2
      exit 1
    fi
    compose up -d --no-deps --wait app
    ;;
  help|--help|-h)
    echo 'Usage: bash scripts/skillbox.sh setup|start|start-image|stop|status|logs|doctor|backup|upgrade|upgrade-image|restore'
    echo 'setup options: --origin https://skills.example.com --bind 127.0.0.1 --port 4791'
    ;;
  *) echo 'Unknown command; use help.' >&2; exit 1 ;;
esac
