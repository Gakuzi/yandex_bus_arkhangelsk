"""Initialization of Yandex Bus Arkhangelsk component."""
import logging
from datetime import timedelta
from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    CONF_SCAN_INTERVAL,
    CONF_STOP_ID,
    CONF_STOP_NAME,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
)
from .coordinator import YandexBusCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Инициализация интеграции из конфига."""
    hass.data.setdefault(DOMAIN, {})

    if "card_registered" not in hass.data[DOMAIN]:
        await async_register_card_resources(hass)
        hass.data[DOMAIN]["card_registered"] = True

    stop_id = entry.data[CONF_STOP_ID]
    stop_name = entry.data.get(CONF_STOP_NAME, f"Остановка {stop_id}")

    interval_sec = entry.options.get(
        CONF_SCAN_INTERVAL, entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
    )

    coordinator = YandexBusCoordinator(hass, stop_id, stop_name, interval_sec)
    await coordinator.async_config_entry_first_refresh()

    hass.data[DOMAIN][entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    entry.async_on_unload(entry.add_update_listener(update_listener))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Выгрузка интеграции."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unload_ok


async def update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Срабатывает при изменении параметров через 'Настроить'."""
    coordinator = hass.data[DOMAIN].get(entry.entry_id)
    if coordinator:
        new_interval = entry.options.get(
            CONF_SCAN_INTERVAL, entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
        )
        coordinator.update_interval = timedelta(seconds=new_interval)

    await hass.config_entries.async_reload(entry.entry_id)


async def async_register_card_resources(hass: HomeAssistant) -> None:
    """Регистрируем статический путь и ресурс карточки для Lovelace."""
    www_dir = Path(__file__).parent / "www"
    if not www_dir.is_dir():
        return

    url_base = f"/{DOMAIN}"
    card_url = f"{url_base}/yandex-bus-card.js"

    # 1. Регистрация статического пути для раздачи карточки и фото
    try:
        if hasattr(hass.http, "async_register_static_paths"):
            from homeassistant.components.http import StaticPathConfig

            await hass.http.async_register_static_paths(
                [StaticPathConfig(url_base, str(www_dir), cache_headers=False)]
            )
        elif hasattr(hass.http, "register_static_path"):
            await hass.async_add_executor_job(
                hass.http.register_static_path,
                url_base,
                str(www_dir),
                False,
            )
        _LOGGER.debug("Статический путь для карточки зарегистрирован: %s -> %s", url_base, www_dir)
    except Exception as err:
        _LOGGER.warning("Не удалось зарегистрировать статический путь %s: %s", url_base, err)

    # 2. Регистрация в frontend (add_extra_js_url)
    try:
        from homeassistant.components.frontend import add_extra_js_url

        add_extra_js_url(hass, card_url)
        _LOGGER.debug("Карточка добавлена во frontend через add_extra_js_url: %s", card_url)
    except Exception as err:
        _LOGGER.debug("Не удалось добавить карточку через add_extra_js_url: %s", err)

    # 3. Регистрация в ресурсах Lovelace (Settings -> Dashboards -> Resources)
    try:
        await _async_register_lovelace_resource(hass, card_url)
    except Exception as err:
        _LOGGER.debug("Не удалось зарегистрировать ресурс Lovelace: %s", err)


async def _async_register_lovelace_resource(hass: HomeAssistant, url: str) -> None:
    """Добавляет ресурс в хранилище ресурсов Lovelace, если он ещё не добавлен."""
    lovelace = hass.data.get("lovelace")
    if not lovelace:
        return

    resources = getattr(lovelace, "resources", None)
    if not resources:
        return

    if hasattr(resources, "loaded") and not resources.loaded:
        await resources.async_load()
        resources.loaded = True

    url_base = url.split("?")[0]
    items = (
        resources.async_items()
        if hasattr(resources, "async_items")
        else getattr(resources, "data", [])
    )
    for item in items:
        item_url = item.get("url", "")
        if item_url.split("?")[0] == url_base:
            return

    if hasattr(resources, "async_create_item"):
        await resources.async_create_item({"res_type": "module", "url": url})
    elif hasattr(resources, "data") and isinstance(resources.data, list):
        resources.data.append({"type": "module", "url": url})
