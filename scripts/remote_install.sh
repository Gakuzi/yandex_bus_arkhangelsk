#!/usr/bin/env bash
#
# Удалённая часть установщика «Транспорт Архангельск».
# Выполняется НА Raspberry Pi (по ssh), в контексте конфига Home Assistant.
#
# Аргументы:
#   $1 — путь к конфигу HA (по умолчанию ~/homeassistant)
#
set -euo pipefail

TARGET="${1:-${HA_CONFIG:-~/homeassistant}}"
SRC=/tmp/transport_arhangelsk_stage
TS="$(date +%Y%m%d_%H%M%S)"

echo "== Целевой конфиг HA: $TARGET =="
sudo mkdir -p "$TARGET/custom_components" "$TARGET/www"

DEST_INT="$TARGET/custom_components/yandex_bus_arkhangelsk"
DEST_CARD="$TARGET/www/yandex-bus-card.js"

# бэкапы архивом ВНЕ custom_components/ (папка вида x.bak_Y в custom_components/
# ломает импорт Home Assistant)
BK="/home/pi/ha_backup_transport_${TS}"
sudo mkdir -p "$BK"
if [ -d "$DEST_INT" ]; then
  sudo tar czf "$BK/yandex_bus_arkhangelsk.tar.gz" -C "$(dirname "$DEST_INT")" yandex_bus_arkhangelsk 2>/dev/null || true
  echo "бэкап интеграции: $BK/yandex_bus_arkhangelsk.tar.gz"
fi
if [ -f "$DEST_CARD" ]; then
  sudo cp -a "$DEST_CARD" "$BK/yandex-bus-card.js.mine" 2>/dev/null || true
  echo "бэкап карточки: $BK/yandex-bus-card.js.mine"
fi

# 1) интеграция: полная чистая замена
sudo rm -rf "$DEST_INT"
sudo cp -r "$SRC/custom_components/yandex_bus_arkhangelsk" "$DEST_INT"
sudo find "$DEST_INT" -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true

# 2) карточка
sudo cp -f "$SRC/www/yandex-bus-card.js" "$DEST_CARD"

# права на пользователя pi
sudo chown -R pi:pi "$DEST_INT" "$DEST_CARD"

echo
echo "== Перезапуск Home Assistant =="
sudo docker restart homeassistant
echo "== Установка завершена. HA перезапущен. =="