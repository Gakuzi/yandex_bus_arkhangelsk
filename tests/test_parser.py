"""Офлайн-юнит-тесты чистых функций парсера Яндекс.Карт.

Покрывают исполняемый срез без сети и без зависимостей HA:
`extract_stop_id` и `parse_yandex_stop_html` из coordinator.py.
"""

import json

import pytest

from custom_components.yandex_bus_arkhangelsk.coordinator import (
    extract_stop_id,
    parse_yandex_stop_html,
)


# ---------------------------------------------------------------------------
# extract_stop_id
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (
            "https://yandex.ru/maps/20/arkhangelsk/stops/stop__9831201/?l=masstransit",
            "9831201",
        ),
        ("9831201", "9831201"),
        ("", ""),
        (None, ""),
        ("stop__123456/", "123456"),
        ("не число, но строка", "не число, но строка"),
    ],
)
def test_extract_stop_id(raw, expected):
    assert extract_stop_id(raw) == expected


# ---------------------------------------------------------------------------
# parse_yandex_stop_html
# ---------------------------------------------------------------------------

def _mock_transport(name, line_id, times, first_stop, last_stop, departure_time,
                    thread_id="thr_1"):
    """Собирает объект транспорта в формате, который ожидает парсер."""
    events = []
    for t in times:
        events.append({"Estimated": {"text": t}})
    essential = []
    if first_stop:
        essential.append({"name": first_stop, "info": {"firstStop": True}})
    if last_stop:
        essential.append({"name": last_stop, "info": {"lastStop": True}})
    return {
        "name": name,
        "lineId": line_id,
        "threads": [
            {
                "threadId": thread_id,
                "EssentialStops": essential,
                "BriefSchedule": {
                    "departureTime": departure_time,
                    "Events": events,
                },
            }
        ],
    }


def _html_with(transports, stop_name="Таймырская улица"):
    # Парсер ищет <script>, содержимое которого валидный JSON БЕЗ обёртки.
    # В реальной странице Яндекс.Карт это сырой объект BriefSchedule.
    payload = json.dumps({"BriefSchedule": {"transports": transports}})
    return (
        f'<html><head><title>Остановка «{stop_name}»</title></head>'
        f"<body>Остановка «{stop_name}»</body>"
        f"<script>{payload}</script>"
        f"</html>"
    )


def test_parses_stop_name():
    html = _html_with([])
    result = parse_yandex_stop_html(html, "Fallback")
    assert result["stop_name"] == "Таймырская улица"


def test_fallback_name_when_no_title():
    html = "<html><body>нет заголовка</body></html>"
    result = parse_yandex_stop_html(html, "Остановка по умолчанию")
    assert result["stop_name"] == "Остановка по умолчанию"


def test_parses_single_route_times():
    transport = _mock_transport(
        name="12",
        line_id="line_12",
        times=["3 мин", "28 мин"],
        first_stop="ул. Победы",
        last_stop="Автовокзал",
        departure_time="08:15",
    )
    result = parse_yandex_stop_html(_html_with([transport]), "Таймырская")

    assert len(result["routes"]) == 1
    route = result["routes"][0]
    assert route["route"] == "12"
    assert route["line_id"] == "line_12"
    assert route["next"] == "3 мин"
    assert route["times"] == ["3 мин", "28 мин"]
    assert route["first_stop"] == "ул. Победы"
    assert route["last_stop"] == "Автовокзал"
    assert route["departure_time"] == "08:15"
    assert route["thread_id"] == "thr_1"
    assert "lineId" in route["map_url"]


def test_routes_sorted_by_next_time():
    # ВАЖНО: парсер сортирует по строке next (лексикографически), а не по числу минут.
    # Для однозначных минут ("5 мин" < "8 мин") порядок корректный, что и фиксируем.
    later = _mock_transport(
        "10", "l1", times=["8 мин"], first_stop="C", last_stop="D", departure_time=""
    )
    sooner = _mock_transport(
        "2", "l2", times=["5 мин"], first_stop="A", last_stop="B", departure_time=""
    )
    result = parse_yandex_stop_html(_html_with([sooner, later]), "Таймырская")

    order = [r["next"] for r in result["routes"]]
    assert order == ["5 мин", "8 мин"]


def test_nearest_bus_found():
    t1 = _mock_transport(
        "5", "l1", times=["9 мин"], first_stop="A", last_stop="B", departure_time=""
    )
    t2 = _mock_transport(
        "7", "l2", times=["2 мин"], first_stop="C", last_stop="D", departure_time=""
    )
    result = parse_yandex_stop_html(_html_with([t1, t2]), "Таймырская")
    assert result["nearest"] == "№7 в 2 мин"


def test_routes_dict_is_accessible():
    transport = _mock_transport(
        "42", "l42", times=["1 мин"], first_stop="A", last_stop="B", departure_time="07:00"
    )
    result = parse_yandex_stop_html(_html_with([transport]), "Таймырская")
    assert "42" in result["routes_dict"]
    assert result["routes_dict"]["42"]["next"] == "1 мин"


def test_no_routes_when_transport_empty():
    transport = _mock_transport(
        "", "line_x", times=[], first_stop="", last_stop="", departure_time=""
    )
    result = parse_yandex_stop_html(_html_with([transport]), "Таймырская")
    assert result["routes"] == []
    assert result["nearest"] == "Нет рейсов"


def test_handles_malformed_script_json():
    html = "<html><body>сломанный скрипт<script>{not valid json</script></body></html>"
    result = parse_yandex_stop_html(html, "Остановка")
    # Парсер обязан не падать и вернуть структуру «нет рейсов».
    assert result["routes"] == []
    assert result["stop_name"] == "Остановка"


def test_uses_scheduled_when_estimated_missing():
    transport = {
        "name": "9",
        "lineId": "l9",
        "threads": [
            {
                "threadId": "t9",
                "EssentialStops": [],
                "BriefSchedule": {
                    "departureTime": "06:40",
                    "Events": [{"Scheduled": {"text": "06:40"}}],
                },
            }
        ],
    }
    result = parse_yandex_stop_html(_html_with([transport]), "Ост")
    assert result["routes"][0]["next"] == "06:40"
