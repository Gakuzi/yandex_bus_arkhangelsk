"""Офлайн-стабы зависимостей Home Assistant для юнит-тестов.

Пакет `custom_components/yandex_bus_arkhangelsk` импортирует `homeassistant`
в `__init__.py` и `coordinator.py`. Чтобы исполняемый срез чистых функций
(`extract_stop_id`, `parse_yandex_stop_html`) тестировался без установленного
HA и без сети, подставляем лёгкие заглушки в `sys.modules` до импорта тестов.
"""

import sys
import types


def _stub(name, **attrs):
    module = types.ModuleType(name)
    for key, value in attrs.items():
        setattr(module, key, value)
    sys.modules[name] = module
    return module


class _FakeTimeout:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


# homeassistant.core
core = _stub("homeassistant.core", HomeAssistant=type("HomeAssistant", (), {}))

# homeassistant.config_entries
_stub("homeassistant.config_entries", ConfigEntry=type("ConfigEntry", (), {}))

# homeassistant.helpers (просто пространство имён)
helpers = _stub("homeassistant.helpers")

# homeassistant.helpers.aiohttp_client
_stub(
    "homeassistant.helpers.aiohttp_client",
    async_get_clientsession=lambda *args, **kwargs: None,
)

# homeassistant.helpers.update_coordinator
_stub(
    "homeassistant.helpers.update_coordinator",
    DataUpdateCoordinator=type("DataUpdateCoordinator", (), {}),
    UpdateFailed=type("UpdateFailed", (Exception,), {}),
)

# async_timeout — только для аннотации/декоратора, экземпляры не создаём.
_stub("async_timeout", timeout=lambda *args, **kwargs: _FakeTimeout())
