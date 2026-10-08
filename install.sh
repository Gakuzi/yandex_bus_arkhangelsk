#!/usr/bin/env bash
#
# Установщик «Транспорт Архангельск» на Raspberry Pi (Home Assistant в Docker).
#
# Использование:
#   ./install.sh [ssh-user@host] [путь-к-конфигу-HA]
#
# Примеры:
#   ./install.sh pi@192.168.0.6                       # конфиг по умолчанию ~/homeassistant
#   ./install.sh pi@192.168.0.6 /path/to/config
#
# Что делает:
#   - заливает на Pi: custom_components/yandex_bus_arkhangelsk/ и www/yandex-bus-card.js
#   - выполняет на Pi scripts/remote_install.sh (бэкапы, установка, рестарт HA)
#
set -euo pipefail

HOST="${1:-}"
HA_CONFIG="${2:-homeassistant}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_INT="$SCRIPT_DIR/custom_components/yandex_bus_arkhangelsk"
SRC_CARD="$SCRIPT_DIR/www/yandex-bus-card.js"
REMOTE_SCRIPT="$SCRIPT_DIR/scripts/remote_install.sh"
VERSION="$(cat "$SCRIPT_DIR/VERSION" 2>/dev/null || echo unknown)"

# Опциональный явный SSH-ключ (иначе берётся из ~/.ssh/config / агента)
SSH_OPT=( -o BatchMode=yes )
if [ -n "${TRANSPORT_SSH_KEY:-}" ]; then
  SSH_OPT+=( -i "$TRANSPORT_SSH_KEY" -o IdentitiesOnly=yes )
fi

if [ -z "$HOST" ]; then
  echo "Ошибка: укажите хост, например ./install.sh pi@192.168.0.6" >&2
  exit 1
fi
for p in "$SRC_INT" "$SRC_CARD" "$REMOTE_SCRIPT"; do
  if [ ! -e "$p" ]; then echo "Ошибка: не найден $p" >&2; exit 1; fi
done

echo "== Транспорт Архангельск, версия $VERSION =="
echo "   хост:      $HOST"
echo "   конфиг HA: $HA_CONFIG"

# ---- стейджинг ----
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/custom_components" "$STAGE/www"
cp -r "$SRC_INT" "$STAGE/custom_components/"
cp "$SRC_CARD" "$STAGE/www/yandex-bus-card.js"

# ---- заливка ----
ssh "${SSH_OPT[@]}" "$HOST" "rm -rf /tmp/transport_arhangelsk_stage && mkdir -p /tmp/transport_arhangelsk_stage"
scp -q "${SSH_OPT[@]}" -r "$STAGE/." "$HOST:/tmp/transport_arhangelsk_stage/"
scp -q "${SSH_OPT[@]}" "$REMOTE_SCRIPT" "$HOST:/tmp/transport_arhangelsk_stage/remote_install.sh"

# ---- выполнение на Pi ----
ssh "${SSH_OPT[@]}" "$HOST" "bash /tmp/transport_arhangelsk_stage/remote_install.sh \"$HA_CONFIG\""
echo; echo "Готово."