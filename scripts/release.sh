#!/usr/bin/env bash
#
# Создание релиза с v-tag для автообновления HACS.
#
# Использование:
#   ./scripts/release.sh <new-version>   например: ./scripts/release.sh 1.1.0
#
# Что делает:
#   1. Проверяет, что рабочая копия чистая и ветка == main
#   2. Синхронизирует версию в VERSION и custom_components/*/manifest.json
#   3. Коммитит и создаёт git-тег вида v<version>
#   4. (опционально) пушит в remote — по умолчанию НЕ пушит
#
set -euo pipefail

VERSION="${1:-}"
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Ошибка: укажите версию в формате X.Y.Z (например 1.1.0)" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# чистота
if [ -n "$(git status --porcelain)" ]; then
  echo "Ошибка: есть незакоммиченные изменения. Сначала закоммитьте." >&2
  exit 1
fi
BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "main" ]; then
  echo "Внимание: вы на ветке '$BRANCH' (ожидается main)." >&2
fi

# версия в manifest
MANIFEST="custom_components/yandex_bus_arkhangelsk/manifest.json"
echo "$VERSION" > VERSION
python3 - "$VERSION" <<'PY'
import json, sys
ver = sys.argv[1]
p = "custom_components/yandex_bus_arkhangelsk/manifest.json"
d = json.load(open(p, encoding="utf-8"))
d["version"] = ver
json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(p, "a", encoding="utf-8").write("\n")
print(f"manifest version -> {ver}")
PY

git add VERSION "$MANIFEST"
git commit -m "release: v$VERSION"

git tag "v$VERSION"
echo
echo "== Готово. Тег v$VERSION создан. =="
echo "Для публикации (вручную, осознанно):"
echo "  git push origin main --tags"