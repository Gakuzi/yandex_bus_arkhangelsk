"""DataUpdateCoordinator for Yandex Bus Arkhangelsk."""
import asyncio
import json
import logging
import re
from datetime import timedelta

import async_timeout
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DEFAULT_SCAN_INTERVAL, DOMAIN

_LOGGER = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
}


def extract_stop_id(raw_input: str) -> str:
    """Извлекает числовой ID остановки из строки или ссылки."""
    if not raw_input:
        return ""
    match = re.search(r"(\d{6,12})", raw_input)
    if match:
        return match.group(1)
    return raw_input.strip()


def parse_yandex_stop_html(html: str, default_name: str) -> dict:
    """Парсинг данных по остановке из HTML-кода Яндекс.Карт."""
    parsed_name = default_name
    title_m = re.search(r"Остановка [«\"]([^»\"]+)[»\"]", html)
    if title_m:
        parsed_name = title_m.group(1)

    scripts = re.findall(r"<script[^>]*>(.*?)</script>", html, re.DOTALL)
    transports = None

    for s in scripts:
        if "BriefSchedule" in s and "transports" in s:
            try:
                data = json.loads(s)

                def extract(d):
                    if isinstance(d, dict):
                        if "transports" in d and isinstance(d["transports"], list):
                            return d["transports"]
                        for v in d.values():
                            res = extract(v)
                            if res:
                                return res
                    elif isinstance(d, list):
                        for item in d:
                            res = extract(item)
                            if res:
                                return res
                    return None

                transports = extract(data)
                if transports:
                    break
            except Exception:
                continue

    routes_dict = {}
    routes_list = []
    nearest_bus = "Нет рейсов"
    nearest_time = "99:99"

    if transports:
        for t in transports:
            name = str(t.get("name", "")).strip()
            if not name:
                continue
            line_id = str(t.get("lineId", ""))
            times = []

            # Первая/конечная остановки и время отправления из потока (thread).
            first_stop = None
            last_stop = None
            departure_time = None
            thread_id = None
            for thread in t.get("threads", []):
                essence = thread.get("EssentialStops", []) or []
                for st in essence:
                    info = st.get("info", {}) or {}
                    if st.get("name"):
                        if info.get("firstStop"):
                            first_stop = st.get("name")
                        if info.get("lastStop"):
                            last_stop = st.get("name")
                if not departure_time:
                    departure_time = thread.get("BriefSchedule", {}).get("departureTime")
                if not thread_id:
                    thread_id = thread.get("threadId")
                for ev in thread.get("BriefSchedule", {}).get("Events", []):
                    time_val = ev.get("Estimated", {}).get("text") or ev.get("Scheduled", {}).get("text")
                    if time_val and time_val not in times:
                        times.append(time_val)

            if not times and not first_stop:
                continue

            next_time = times[0] if times else departure_time or ""

            route_data = {
                "route": name,
                "next": next_time,
                "times": times[:5],
                "line_id": line_id,
                "thread_id": thread_id or "",
                "first_stop": first_stop or "",
                "last_stop": last_stop or "",
                "departure_time": departure_time or "",
                "map_url": f"https://yandex.ru/maps/20/arkhangelsk/?masstransit%5BlineId%5D={line_id}&l=masstransit",
            }
            routes_dict[name] = route_data
            routes_list.append(route_data)

            if next_time and next_time < nearest_time:
                nearest_time = next_time
                nearest_bus = f"№{name} в {next_time}"

    routes_list.sort(key=lambda x: x["next"])

    return {
        "stop_name": parsed_name,
        "nearest": nearest_bus,
        "routes": routes_list,
        "routes_dict": routes_dict,
    }


class YandexBusCoordinator(DataUpdateCoordinator):
    """Координатор опроса Яндекс.Карт без блокировки потоков."""

    def __init__(self, hass: HomeAssistant, stop_id: str, stop_name: str, scan_interval: int) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=f"{DOMAIN}_{stop_id}",
            update_interval=timedelta(seconds=scan_interval),
        )
        self.stop_id = extract_stop_id(stop_id)
        self.stop_name = stop_name
        self.session = async_get_clientsession(hass)
        self._last_good: dict | None = None
        self._consecutive_failures = 0

    async def _async_update_data(self) -> dict:
        url = f"https://yandex.ru/maps/20/arkhangelsk/stops/{self.stop_id}/?l=masstransit"

        # Несколько попыток с коротким интервалом между ними (ретраи при сбое сети).
        last_err: Exception | None = None
        for attempt in range(3):
            try:
                async with async_timeout.timeout(12):
                    response = await self.session.get(url, headers=HEADERS)
                    if response.status != 200:
                        raise UpdateFailed(f"Ошибка Яндекс.Карт: HTTP {response.status}")
                    html = await response.text()
            except Exception as err:  # noqa: BLE001
                last_err = err
                _LOGGER.warning(
                    "yandex_bus_arkhangelsk: сетевая ошибка (попытка %s/%s): %s",
                    attempt + 1, 3, err,
                )
                if attempt < 2:
                    await asyncio.sleep(1.5 * (attempt + 1))
                continue

            # HTTP 200, но содержательно мусор (капча/редирект/пустая страница).
            if not html or len(html) < 500 or "Яндекс" not in html:
                last_err = ValueError("Пустой или не-сервисный ответ Яндекс.Карт")
                _LOGGER.warning("yandex_bus_arkhangelsk: подозрительный ответ (len=%s)", len(html))
                if attempt < 2:
                    await asyncio.sleep(1.5 * (attempt + 1))
                continue

            data = parse_yandex_stop_html(html, self.stop_name)

            # Если подозрительно пусто (0 маршрутов) — возможно, изменилась структура
            # или яндекс вернул не то. Не перезаписываем последние хорошие данные.
            if not data.get("routes"):
                _LOGGER.warning(
                    "yandex_bus_arkhangelsk: парсер вернул пустой список маршрутов (stop %s)",
                    self.stop_id,
                )
                if self._last_good:
                    return self._last_good
                # Нет последних данных — вернём структуру с «нет рейсов», не падаем.
                return data

            if data.get("stop_name"):
                self.stop_name = data["stop_name"]

            self._last_good = data
            self._consecutive_failures = 0
            return data

        self._consecutive_failures += 1
        _LOGGER.warning(
            "yandex_bus_arkhangelsk: %s подряд неудачных опросов (stop %s)",
            self._consecutive_failures, self.stop_id,
        )
        # Отдаём последние хорошие данные, если были — сенсор не «умирает».
        if self._last_good:
            return self._last_good
        raise UpdateFailed(f"Ошибка запроса данных Яндекс.Карт: {last_err}")
