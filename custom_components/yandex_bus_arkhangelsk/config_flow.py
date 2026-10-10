"""Config flow and Options flow for Yandex Bus Arkhangelsk."""
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import config_validation as cv

from .const import (
    CONF_SCAN_INTERVAL,
    CONF_STOP_ID,
    CONF_STOP_NAME,
    CONF_TRACKED_ROUTES,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    MIN_SCAN_INTERVAL,
)
from .coordinator import YandexBusCoordinator, extract_stop_id


class YandexBusConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Визуальная настройка добавления остановки."""

    VERSION = 1

    def __init__(self) -> None:
        self._discovered_stop_id: str = ""
        self._discovered_stop_name: str = ""
        self._available_routes: list[str] = []

    async def async_step_user(self, user_input=None):
        """Шаг 1: Пользователь вводит ссылку на остановку или её ID."""
        errors: dict[str, str] = {}
        description_placeholders: dict[str, str] = {}

        if user_input is not None:
            raw_input = str(user_input.get(CONF_STOP_ID, "")).strip()
            stop_id = extract_stop_id(raw_input)

            if not stop_id:
                errors["base"] = "empty_stop_id"
            elif not stop_id.isdigit():
                errors["base"] = "invalid_stop_id"
            else:
                await self.async_set_unique_id(stop_id)
                self._abort_if_unique_id_configured()

                manual_name = (
                    str(user_input.get(CONF_STOP_NAME, "")).strip()
                    or f"Остановка {stop_id}"
                )
                coordinator = YandexBusCoordinator(
                    self.hass, stop_id, manual_name, DEFAULT_SCAN_INTERVAL
                )

                fetch_ok = False
                try:
                    await coordinator.async_refresh()
                    fetch_ok = coordinator.data is not None
                except Exception:
                    fetch_ok = False

                self._discovered_stop_id = stop_id
                self._discovered_stop_name = (
                    coordinator.data.get("stop_name") if coordinator.data else manual_name
                )
                self._available_routes = (
                    sorted(list(coordinator.data.get("routes_dict", {}).keys()))
                    if fetch_ok and coordinator.data
                    else []
                )

                if not fetch_ok:
                    # Остановку не удалось получить — можно продолжить в ручном режиме,
                    # но честно предупредим и дадим попробовать снова.
                    errors["base"] = "cannot_fetch"
                    description_placeholders["stop_id"] = stop_id
                    return self.async_show_form(
                        step_id="user",
                        data_schema=self._user_schema(),
                        errors=errors,
                        description_placeholders=description_placeholders,
                    )

                if self._available_routes:
                    return await self.async_step_routes()

                # Остановка получена, но маршрутов нет — создаём запись с пустым списком.
                return self.async_create_entry(
                    title=self._discovered_stop_name,
                    data={
                        CONF_STOP_ID: self._discovered_stop_id,
                        CONF_STOP_NAME: self._discovered_stop_name,
                        CONF_TRACKED_ROUTES: [],
                        CONF_SCAN_INTERVAL: DEFAULT_SCAN_INTERVAL,
                    },
                )

        return self.async_show_form(
            step_id="user",
            data_schema=self._user_schema(),
            errors=errors,
            description_placeholders=description_placeholders,
        )

    def _user_schema(self) -> vol.Schema:
        """Схема первого шага с подсказками."""
        return vol.Schema(
            {
                vol.Required(
                    CONF_STOP_ID,
                    description={
                        "suggested_value": "https://yandex.ru/maps/...",
                    },
                ): cv.string,
                vol.Optional(
                    CONF_STOP_NAME,
                    description={
                        "suggested_value": "",
                    },
                ): cv.string,
            }
        )

    async def async_step_routes(self, user_input=None):
        """Шаг 2: Выбор маршрутов чекбоксами."""
        if user_input is not None:
            selected = user_input.get(CONF_TRACKED_ROUTES, self._available_routes)
            return self.async_create_entry(
                title=self._discovered_stop_name,
                data={
                    CONF_STOP_ID: self._discovered_stop_id,
                    CONF_STOP_NAME: self._discovered_stop_name,
                    CONF_TRACKED_ROUTES: selected,
                    CONF_SCAN_INTERVAL: DEFAULT_SCAN_INTERVAL,
                },
            )

        return self.async_show_form(
            step_id="routes",
            data_schema=self._routes_schema(),
        )

    def _routes_schema(self) -> vol.Schema:
        return vol.Schema(
            {
                vol.Optional(
                    CONF_TRACKED_ROUTES,
                    default=self._available_routes,
                ): cv.multi_select(
                    {r: f"Автобус №{r}" for r in self._available_routes}
                ),
            }
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return YandexBusOptionsFlow(config_entry)


class YandexBusOptionsFlow(config_entries.OptionsFlow):
    """Настройка уже добавленной остановки через шестерёнку."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        coordinator = self.hass.data[DOMAIN].get(self.config_entry.entry_id)
        current_data = (
            self.config_entry.options if self.config_entry.options else self.config_entry.data
        )

        current_routes = current_data.get(CONF_TRACKED_ROUTES, [])
        scan_interval = current_data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)

        known_routes = []
        if coordinator and coordinator.data:
            known_routes = sorted(list(coordinator.data.get("routes_dict", {}).keys()))
        if not known_routes:
            known_routes = current_routes

        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_TRACKED_ROUTES,
                    default=current_routes,
                ): cv.multi_select({r: f"Автобус №{r}" for r in known_routes}),
                vol.Optional(
                    CONF_SCAN_INTERVAL,
                    default=scan_interval,
                    description={
                        "suggested_minimum": MIN_SCAN_INTERVAL,
                    },
                ): vol.All(
                    vol.Coerce(int),
                    vol.Clamp(min=MIN_SCAN_INTERVAL),
                ),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
