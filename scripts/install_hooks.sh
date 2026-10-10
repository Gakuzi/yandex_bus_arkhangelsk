#!/usr/bin/env sh
# install_hooks.sh — включает git-hooks репозитория (.githooks) для локальных ворот качества.
# Использование: sh scripts/install_hooks.sh (или bash scripts/install_hooks.sh).
set -e
cd "$(git rev-parse --show-toplevel)"

git config core.hooksPath .githooks
echo "git hooks enabled → core.hooksPath = $(git config core.hooksPath)"
ls -1 .githooks