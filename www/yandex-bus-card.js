// ============================================================================
// Yandex Bus Arkhangelsk — frontend-карточки
// Минималистичный "liquid glass" стиль: карточка сама подстраивается под тему
// Home Assistant (тёмную и светлую) через системные CSS-переменные тем.
//
// Элементы:
//   yandex-bus-card          — основная карточка (табло остановки)
//   yandex-bus-pylon-card    — лёгкий вариант в стиле уличной стелы
//   yandex-bus-card-editor   — общий редактор конфигурации
// ============================================================================

// ---------------------------------------------------------------------------
// Общие утилиты
// ---------------------------------------------------------------------------

// Минут до ближайшего времени "HH:MM" (с учётом перехода через полночь).
function ybMinutesUntil(timeStr) {
  if (!timeStr || !String(timeStr).includes(':')) return 0;
  const [h, m] = String(timeStr).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  const now = new Date();
  let diff = (h * 60 + m) - (now.getHours() * 60 + now.getMinutes());
  if (diff < 0) diff += 1440;
  return diff;
}

// Аккуратное склонение: 1 остановка, 2 остановки, 5 остановок.
function ybPluralize(count, one, few, many) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 === 1) return one;
  if (n1 >= 2 && n1 <= 4) return few;
  return many;
}

// Статус маршрута по времени прибытия.
function ybRouteStatus(r, minsLeft, nextTime) {
  if (minsLeft >= 45) {
    const isMorning = Number.isInteger(nextTime) || String(nextTime).includes(':');
    let label = 'Первый рейс';
    if (nextTime && String(nextTime).includes(':')) {
      const h = parseInt(String(nextTime).split(':')[0], 10);
      label = (h >= 4 && h <= 11) ? 'Первый рейс' : 'Следующий рейс';
    }
    if (!isMorning) label = 'Следующий рейс';
    return {
      far: true,
      time: nextTime,
      note: label,
      stopsText: label,
    };
  }

let stops = 0;
  if (r.stops_left !== undefined && r.stops_left !== null) {
    stops = parseInt(r.stops_left, 10);
  } else if (r.stops_count !== undefined && r.stops_count !== null) {
    stops = parseInt(r.stops_count, 10);
  } else {
    stops = minsLeft <= 1 ? 1 : Math.max(1, Math.round(minsLeft / 2.5));
  }
  stops = Number.isFinite(stops) ? stops : 1;

  return {
    far: false,
    time: minsLeft <= 0 ? 'сейчас' : `${minsLeft} мин`,
    note: `${stops} ${ybPluralize(stops, 'остановка', 'остановки', 'остановок')}`,
    stopsText: `${stops} ${ybPluralize(stops, 'остановка', 'остановки', 'остановок')}`,
  };
}

// Мягкая палитра акцентов, читаемая и на тёмном, и на светлом фоне.
const YB_ROUTE_COLORS = [
  '#3b82f6', // синий
  '#0e9488', // бирюзовый
  '#e5732a', // тёплый оранжевый
  '#8b5cf6', // фиолетовый
  '#e14b6a', // розово-красный
  '#65a30d', // зелёный
];

// Класс общих стилей, одинаковых для обеих карточек.
const YB_COMMON_STYLE = `
  :host { display: block; }
  .yb-root {
    font-family: var(--primary-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
    background: var(--ha-card-background, var(--card-background-color, rgba(20, 24, 33, 0.6)));
    color: var(--primary-text-color, var(--text-primary-color, #e6e9ef));
    border-radius: var(--ha-card-border-radius, 16px);
    border: 1px solid var(--hairline-color, var(--divider-color, rgba(128, 128, 160, 0.2)));
    box-shadow: var(--ha-card-box-shadow, none);
    box-sizing: border-box;
    overflow: hidden;
  }
  .yb-card {
    padding: 14px 16px;
  }
  .yb-card.slim { padding: 10px 14px; }
  /* Шапка с фото места (пейзаж района/города) */
  .yb-hero {
    position: relative;
    margin: -14px -16px 12px;
    padding: 14px 16px 34px;
    background-color: #1c2434;
    background-size: cover;
    background-position: center;
    filter: saturate(0.9);
  }
  .yb-hero-grad { background: linear-gradient(180deg, #313c52, #1c2434); }
  .yb-hero-shade {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(10,12,18,0.10), rgba(10,12,18,0.45) 55%, rgba(10,12,18,0.86));
    pointer-events: none;
  }
  .yb-hero .yb-header, .yb-hero .yb-stop-title, .yb-hero .yb-clock {
    position: relative; z-index: 1;
  }
  .yb-hero .yb-stop-title { color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.4); }
  .yb-hero .yb-stop-title ha-icon { color: rgba(255,255,255,0.8); }
  .yb-hero .yb-clock { color: rgba(255,255,255,0.9); }
  .yb-hero-label {
    position: absolute; left: 16px; bottom: 10px; z-index: 1;
    font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
    color: rgba(255,255,255,0.92);
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    display: inline-flex; align-items: center; gap: 5px;
    max-width: calc(100% - 32px);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .yb-hero-label::before {
    content: "";
    width: 6px; height: 6px; border-radius: 50%; flex: none;
    background: var(--state-icon-color, var(--primary-color, #4f9cf9));
    box-shadow: 0 0 6px var(--state-icon-color, #4f9cf9);
  }
  .yb-header, .yb-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .yb-stop-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 15px;
    line-height: 1.2;
    font-weight: 700;
    color: var(--primary-text-color, #e6e9ef);
    letter-spacing: -0.1px;
    cursor: pointer;
    min-width: 0;
    user-select: none;
  }
  .yb-stop-title .yb-title-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .yb-stop-title ha-icon { --mdc-icon-size: 15px; color: var(--secondary-text-color, #8b93a7); flex: none; }
  .yb-clock {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 14px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--secondary-text-color, #8b93a7);
    flex: none;
  }
  .yb-live-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--state-icon-color, var(--primary-color, #4f9cf9));
    box-shadow: 0 0 0 0 rgba(79, 156, 249, 0.5);
    animation: ybPulse 2.2s ease-out infinite;
  }
  @keyframes ybPulse {
    0%   { box-shadow: 0 0 0 0 rgba(79, 156, 249, 0.45); }
    70%  { box-shadow: 0 0 0 7px rgba(79, 156, 249, 0); }
    100% { box-shadow: 0 0 0 0 rgba(79, 156, 249, 0); }
  }
  .yb-list {
    display: flex;
    flex-direction: column;
    gap: 9px;
    margin-top: 12px;
  }
  .yb-list.scrollable {
    max-height: var(--yb-max-height, none);
    overflow-y: auto;
    padding-right: 3px;
  }
  .yb-list::-webkit-scrollbar { width: 4px; }
  .yb-list::-webkit-scrollbar-thumb { background: var(--divider-color, rgba(128,128,160,0.35)); border-radius: 4px; }
  .yb-empty {
    color: var(--secondary-text-color, #8b93a7);
    text-align: center;
    padding: 16px 8px;
    font-size: 13px;
  }
  .yb-route {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 12px;
    border-radius: 12px;
    border: 1px solid var(--hairline-color, var(--divider-color, rgba(128,128,160,0.14)));
    background: var(--card-background-color, rgba(255, 255, 255, 0.04));
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
    min-width: 0;
  }
  .yb-route:hover {
    background: var(--secondary-background-color, rgba(128, 128, 160, 0.1));
  }
  .yb-route:active { transform: scale(0.99); }
  .yb-route.far { opacity: 0.78; }
  .yb-route-num-wrap {
    flex: none;
    min-width: 46px;
    height: 42px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: var(--yb-accent, #4f9cf9);
    box-shadow: 0 2px 8px var(--yb-accent-shadow, rgba(79, 156, 249, 0.25));
    font-size: 19px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }
  .yb-route-num-wrap .yb-num { line-height: 1; }
  .yb-route-num-wrap.far {
    background: var(--secondary-background-color, rgba(128,128,160,0.25));
    box-shadow: none;
    color: var(--secondary-text-color, #8b93a7);
  }
  .yb-route-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .yb-route-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .yb-route-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--primary-text-color, #e6e9ef);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
  .yb-route-time {
    flex: none;
    font-size: 14px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--primary-text-color, #e6e9ef);
  }
  .yb-route-time.far { color: var(--warning-color, #f0a14a); }
  .yb-track { position: relative; height: 16px; display: flex; align-items: center; }
  .yb-track-bg {
    position: absolute; left: 1px; right: 1px; height: 3px;
    border-radius: 3px;
    background: var(--divider-color, rgba(128,128,160,0.25));
  }
  .yb-track-fill {
    position: absolute; left: 1px; height: 3px;
    border-radius: 3px;
    background: var(--yb-accent, #4f9cf9);
  }
  .yb-dot {
    position: absolute;
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--card-background-color, rgba(20,24,33,0.9));
    border: 2px solid var(--secondary-text-color, #8b93a7);
    transform: translateX(-50%);
    top: 50%;
    margin-top: -4px;
    box-sizing: border-box;
  }
  .yb-dot.start { left: 0; }
  .yb-dot.end { left: 100%; }
  .yb-bus {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px; height: 22px;
    background: var(--yb-accent, #4f9cf9);
    border-radius: 8px;
    color: #fff;
    box-shadow: 0 3px 8px var(--yb-accent-shadow, rgba(79,156,249,0.35));
    transition: left 0.4s ease;
    z-index: 2;
  }
  .yb-bus ha-icon { --mdc-icon-size: 18px; }
  .yb-note {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--warning-color, #f0a14a);
    margin-top: 1px;
  }
  .yb-note ha-icon { --mdc-icon-size: 13px; }
  .yb-subtext {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.4px;
    color: var(--secondary-text-color, #8b93a7);
    text-transform: uppercase;
  }
`;

// ---------------------------------------------------------------------------
// Общий редактор конфигурации
// ---------------------------------------------------------------------------
class YandexBusBaseEditor extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  setConfig(config) {
    this._config = config ? JSON.parse(JSON.stringify(config)) : {};
    if (!Array.isArray(this._config.selected_buses)) this._config.selected_buses = [];
    this.render();
  }

  render() {
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this.appendChild(this._form);
      this._form.addEventListener('value-changed', (ev) => {
        ev.stopPropagation();
        const value = ev.detail.value || {};
        const oldEntity = this._config ? this._config.entity : '';
        const newEntity = value.entity || '';
        if (oldEntity && newEntity && oldEntity !== newEntity) {
          value.selected_buses = [];
        }
        this._config = { ...(this._config || {}), ...value };
        this.dispatchEvent(new CustomEvent('config-changed', {
          detail: { config: this._config },
          bubbles: true,
          composed: true,
        }));
        this.render();
      });
    }
    if (this._hass) this._form.hass = this._hass;

    const conf = this._config || {};
    const curEntity = conf.entity || '';
    const stateObj = (curEntity && this._hass && this._hass.states)
      ? this._hass.states[curEntity]
      : null;

    let availableRoutes = [];
    if (stateObj && stateObj.attributes && Array.isArray(stateObj.attributes.routes)) {
      availableRoutes = stateObj.attributes.routes.map((r) => String(r.route));
    }

    this._form.data = {
      entity: curEntity,
      title: conf.title || '',
      selected_buses: Array.isArray(conf.selected_buses) ? conf.selected_buses.map(String) : [],
      max_height: conf.max_height || '',
      card_width: conf.card_width || '',
    };

    const schema = [
      { name: 'entity', required: true, selector: { entity: { domain: 'sensor' } } },
      { name: 'title', selector: { text: {} } },
    ];

    if (availableRoutes.length > 0) {
      schema.push({
        name: 'selected_buses',
        selector: {
          select: {
            multiple: true,
            mode: 'dropdown',
            options: availableRoutes.map((r) => ({ value: r, label: `Автобус №${r}` })),
          },
        },
      });
    }

    schema.push(
      { name: 'max_height', selector: { text: {} } },
      { name: 'card_width', selector: { text: {} } },
    );

    this._form.schema = schema;
    this._form.computeLabel = (s) => ({
      entity: 'Остановка (сенсор)',
      title: 'Свое название остановки',
      selected_buses: 'Маршруты (мультивыбор)',
      max_height: 'Макс. высота списка (напр. 340px)',
      card_width: 'Фиксированная ширина (напр. 400px)',
    }[s.name] || s.name);
  }
}

// ---------------------------------------------------------------------------
// Базовый класс карточки: общая логика данных и рендер стилей
// ---------------------------------------------------------------------------
class YandexBusCardBase extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    this._mount();
    this.updateView();
  }

  setConfig(config) {
    this._config = config ? JSON.parse(JSON.stringify(config)) : {};
    this.updateView();
  }

  disconnectedCallback() {
    if (this._clockTimer) clearInterval(this._clockTimer);
  }

  _mount() {
    if (this._root) return;
    const root = document.createElement('ha-card');
    this._inner = document.createElement('div');
    root.appendChild(this._inner);
    this.appendChild(root);
    this._root = root;
    // Пытаемся подгрузить модуль фото-заглушек мест (если не подключён ресурсом).
    this._loadPhotoModule();
    // Живые часы.
    this._clockTimer = setInterval(() => {
      const el = this.querySelector('[data-yb-clock]');
      if (el) el.textContent = this._nowTime();
    }, 1000);
  }

  _nowTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

// Фото-заглушка места: по названию остановки подбираем пейзаж района/города.
  // Если модуль photos.js не подключён как ресурс — пытаемся загрузить динамически.
  _loadPhotoModule() {
    if (window.ybMatchDistrict && window.ybPlacePhotoUrl) return true;
    try {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = '/local/yandex_bus_arkhangelsk/photos/photos.js';
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { /* тихий фолбэк на градиент */ }
    return false;
  }

  // Определяем URL фото-заглушки и подпись места.
  _placePhoto(stopName) {
    const config = this._config || {};
    const distOverride = config.district_override || '';
    // Своё фото из конфига — приоритет.
    if (config.photo_mode === 'custom' && config.photo) {
      return { url: config.photo, label: (config.photo_label || ''), custom: true };
    }
    // Фото-заглушка по району/городу.
    if (window.ybPlacePhotoUrl) {
      const url = window.ybPlacePhotoUrl(stopName, distOverride);
      const m = window.ybMatchDistrict(distOverride || stopName);
      const label = (m && m.label) || 'Архангельск';
      return { url, label, custom: false };
    }
    return { url: '', label: '', custom: false };
  }

  // Собираем данные остановки: имя, маршруты, фильтр, ссылка на карту.
  _collect() {
    const config = this._config || {};
    const entityId = config.entity;
    if (!entityId) {
      return { missing: true };
    }
    const stateObj = this._hass && this._hass.states ? this._hass.states[entityId] : null;
    if (!stateObj) {
      return { missingEntity: entityId };
    }

    const attrs = stateObj.attributes || {};
    const stopName = config.title || attrs.stop_name || attrs.friendly_name || 'Остановка';
    const stopId = attrs.stop_id || '';

    let routes = Array.isArray(attrs.routes) ? [...attrs.routes] : [];
    let selected = config.selected_buses || [];
    if (typeof selected === 'string') {
      selected = selected.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (Array.isArray(selected) && selected.length > 0) {
      routes = routes.filter((r) => selected.includes(String(r.route)));
    }

    // Стабильная палитра: цвет маршрута не меняется при обновлении.
    if (!this._routeColors) this._routeColors = {};
    const allRoutes = Array.isArray(attrs.routes) ? attrs.routes : routes;
    allRoutes.forEach((r, i) => {
      if (!(r.route in this._routeColors)) {
        this._routeColors[String(r.route)] = YB_ROUTE_COLORS[i % YB_ROUTE_COLORS.length];
      }
    });

    const mapStopUrl = stopId
      ? `https://yandex.ru/maps/20/arkhangelsk/?masstransit%5BstopId%5D=stop__${stopId}&l=masstransit`
      : 'https://yandex.ru/maps/20/arkhangelsk/?l=masstransit';

return { stopName, stopId, routes, mapStopUrl, placePhoto: this._placePhoto(stopName) };
  }

  _cardWidth() {
    const config = this._config || {};
    return config.card_width ? `width: ${config.card_width}; margin: 0 auto;` : '';
  }

  _renderShell(headerHtml, listHtml) {
    const width = this._cardWidth();
    return `
      <style>${YB_COMMON_STYLE}</style>
      <style>${this._ownStyles()}</style>
      <div class="yb-root" style="${width}">
        <div class="yb-card">
          ${headerHtml}
          ${listHtml}
        </div>
      </div>
    `;
  }

  // ---- Инвариантная разметка строки маршрута ----
  _routeRow(route) {
    const outerColor = this._routeColors[String(route.route)] || '#4f9cf9';
    const nextTime = route.next || (Array.isArray(route.times) && route.times[0]) || '--:--';
    const minsLeft = ybMinutesUntil(nextTime);
    const status = ybRouteStatus(route, minsLeft, nextTime);
    // Визуальный прогресс автобуса по пути к остановке.
    let progress = 92 - (minsLeft * 4.2);
    progress = Math.max(14, Math.min(88, progress));
const numHtml = status.far
      ? `class="yb-route-num-wrap far"><span class="yb-num">${route.route}</span>`
      : `class="yb-route-num-wrap" style="--yb-accent:${outerColor}; --yb-accent-shadow:${outerColor}55;"><span class="yb-num">${route.route}</span>`;

    const trackHtml = status.far ? '' : `
      <div class="yb-track">
        <div class="yb-track-bg"></div>
        <div class="yb-track-fill" style="width:${progress}%; --yb-accent:${outerColor};"></div>
        <div class="yb-dot start"></div>
        <div class="yb-dot end"></div>
        <div class="yb-bus" style="left:${progress}%; --yb-accent:${outerColor}; --yb-accent-shadow:${outerColor}55;">
          <ha-icon icon="mdi:bus"></ha-icon>
        </div>
      </div>`;

    return `
      <div class="yb-route ${status.far ? 'far' : ''}" data-route="${encodeURIComponent(route.route)}">
        <div ${numHtml}</div>
        <div class="yb-route-body">
          <div class="yb-route-meta">
            <span class="yb-route-label">Автобус №${route.route}</span>
            <span class="yb-route-time ${status.far ? 'far' : ''}">${status.time}</span>
          </div>
          ${status.far
            ? `<div class="yb-note"><ha-icon icon="mdi:moon-waning-crescent"></ha-icon><span>${status.note}</span></div>`
            : trackHtml}
        </div>
      </div>`;
  }

  // ---- Модальные окна через встроенный ha-dialog Home Assistant ----
  // ha-dialog сам затемняет фон, центрирует, закрывается по Esc/клику по фону.

  _openDialog(headHtml, bodyHtml, wide) {
    const dlg = document.createElement('ha-dialog');
    dlg.setAttribute('open', '');
    dlg.setAttribute('hideactions', '');

    // Стили применяем inline, т.к. диалог встраивается в <body>, вне shadow DOM.
    if (wide) dlg.style.setProperty('--ha-dialog-width', 'min(880px, 94vw)');
    else dlg.style.setProperty('--ha-dialog-width', 'min(520px, 94vw)');

    const style = document.createElement('style');
    style.textContent = `
      .yb-dlg {
        --yb-dlg-radius: 18px;
        color: var(--primary-text-color, #e6e9ef);
        font-family: var(--primary-font-family, -apple-system, "Segoe UI", Roboto, sans-serif);
        overflow: hidden;
        border-radius: var(--yb-dlg-radius);
      }
      /* Фото-шапка */
      .yb-dlg-hero {
        position: relative;
        height: 132px;
        background: linear-gradient(180deg, #2a3348, #171d2a);
        background-size: cover;
        background-position: center;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 12px 16px 14px;
      }
      .yb-dlg-hero-shade {
        position: absolute; inset: 0;
        background: linear-gradient(180deg, rgba(10,12,18,0.05), rgba(10,12,18,0.55) 60%, rgba(10,12,18,0.88));
        pointer-events: none;
      }
      .yb-dlg-close {
        position: absolute; top: 10px; right: 10px;
        z-index: 2;
        width: 30px; height: 30px; border-radius: 50%;
        border: none; cursor: pointer; font-size: 15px; line-height: 1;
        color: #fff;
        background: rgba(15,23,42,0.35);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        transition: background 0.15s;
      }
      .yb-dlg-close:hover { background: rgba(15,23,42,0.55); }
      .yb-dlg-badge {
        position: relative; z-index: 1;
        align-self: flex-start;
        min-width: 48px; padding: 5px 10px; border-radius: 11px;
        color: #fff; font-weight: 800; font-size: 17px; text-align: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      }
      .yb-dlg-title {
        position: relative; z-index: 1;
        margin-top: 8px;
        font-size: 19px; font-weight: 800; letter-spacing: -0.3px; line-height: 1.15;
        color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.4);
      }
      .yb-dlg-sub {
        position: relative; z-index: 1;
        font-size: 11.5px; color: rgba(255,255,255,0.8); margin-top: 2px;
      }
      .yb-dlg-body { padding: 14px 16px 16px; }

      .yb-dlg-stops { display: flex; flex-direction: column; gap: 2px; }
      .yb-dlg-stop { display: flex; align-items: center; gap: 12px; padding: 8px 4px; }
      .yb-dlg-dot { flex: none; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 0 3px var(--card-background-color, rgba(128,128,160,0.06)); }
      .yb-dlg-stop-name { flex: 1; font-size: 14px; font-weight: 700; }
      .yb-dlg-stop-role { flex: none; font-size: 10.5px; color: var(--secondary-text-color, #8b93a7); text-transform: uppercase; letter-spacing: 0.3px; }
      .yb-dlg-line { flex: none; width: 2px; height: 16px; margin-left: 17px; border-radius: 2px; opacity: 0.75; }
      .yb-dlg-sub-line { margin-top: 12px; font-size: 13px; color: var(--secondary-text-color, #8b93a7); }
      .yb-dlg-eta {
        display: flex; flex-direction: column; gap: 5px;
        margin-top: 14px; padding: 11px 13px; border-radius: 12px;
        background: var(--state-icon-color, var(--primary-color, #4f9cf9))1f;
        border: 1px solid var(--divider-color, rgba(128,128,160,0.15));
      }
      .yb-dlg-eta-item { font-size: 13.5px; }
      .yb-dlg-eta-item b { font-weight: 800; }
      .yb-dlg-times { margin-top: 14px; }
      .yb-dlg-times-label {
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px;
        color: var(--secondary-text-color, #8b93a7); margin-bottom: 8px;
      }
      .yb-dlg-times-chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .yb-dlg-time {
        padding: 5px 10px; border-radius: 9px; font-size: 13px; font-weight: 700;
        font-variant-numeric: tabular-nums;
        background: var(--secondary-background-color, rgba(128,128,160,0.14));
      }
      .yb-dlg-map {
        display: flex; align-items: center; justify-content: center; gap: 8px;
        margin-top: 16px; padding: 11px 14px; border-radius: 12px;
        background: var(--primary-color, #4f9cf9);
        color: var(--text-primary-color, #fff);
        font-size: 13.5px; font-weight: 700; text-decoration: none;
        transition: filter 0.15s, transform 0.1s;
      }
      .yb-dlg-map:hover { filter: brightness(1.08); }
      .yb-dlg-map:active { transform: scale(0.98); }
      .yb-dlg-map ha-icon { --mdc-icon-size: 18px; }
    `;

    const content = document.createElement('div');
    content.className = 'yb-dlg';
    content.innerHTML = `${headHtml}${bodyHtml}`;

    const close = () => dlg.remove();

    // Кнопка закрытия в шапке (если есть .yb-dlg-close)
    content.querySelector('.yb-dlg-close')?.addEventListener('click', close);
    dlg.addEventListener('closed', close);

    dlg.appendChild(style);
    dlg.appendChild(content);
    document.body.appendChild(dlg);
    return dlg;
  }

  _openRouteDetails(route, stopCtx) {
    const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const name = esc(route.route);
    const firstStop = esc(route.first_stop || '—');
    const lastStop = esc(route.last_stop || '—');
    const dep = esc(route.departure_time || '');
    const times = Array.isArray(route.times) ? route.times : [];
    const color = this._routeColors[String(route.route)] || '#4f9cf9';

    // Ссылка на маршрут на Яндекс.Картах (из данных маршрута или по умолчанию).
    const routeUrl = esc(route.map_url
      || `https://yandex.ru/maps/20/arkhangelsk/?text=автобус%20${encodeURIComponent(route.route)}&l=masstransit`);

    // Фото-шапка: своё фото из конфига, либо градиент-заглушка с названием остановки.
    const ctx = stopCtx || {};
    const photo = (this._config && this._config.photo_mode === 'custom' && this._config.photo)
      ? `url('${this._config.photo}') center/cover`
      : '';

    const timesHtml = (times.length ? times : [route.next])
      .filter(Boolean)
      .slice(0, 6)
      .map((t) => `<span class="yb-dlg-time">${esc(t)}</span>`)
      .join('');

    // Сколько минут до ближайшего автобуса в этом маршруте (для нашей остановки).
    const nextTime = route.next || (Array.isArray(route.times) && route.times[0]) || '';
    let minsLeft = 0;
    if (nextTime && String(nextTime).includes(':')) {
      const [h, m] = String(nextTime).split(':').map(Number);
      const now = new Date();
      let diff = (h * 60 + m) - (now.getHours() * 60 + now.getMinutes());
      if (diff < 0) diff += 1440;
      minsLeft = diff;
    }

    // Оценка числа остановок до ближайшего автобуса по времени прибытия
    // (Яндекс не отдаёт реальное число остановок в закрытых данных).
    const stopsLeft = minsLeft > 0 ? Math.max(1, Math.round(minsLeft / 2.5)) : null;
    const stopsText = stopsLeft !== null
      ? `${stopsLeft} ${ybPluralize(stopsLeft, 'остановка', 'остановки', 'остановок')}`
      : '';

    const head = `
      <div class="yb-dlg-hero" style="${photo ? `background-image:${photo};` : (ctx.placePhoto && ctx.placePhoto.url ? `background-image:url('${ctx.placePhoto.url}');` : '')}">
        <div class="yb-dlg-hero-shade"></div>
        <button class="yb-dlg-close" aria-label="Закрыть">✕</button>
        <div class="yb-dlg-badge" style="background:${color};">№${name}</div>
        <div class="yb-dlg-title">Маршрут ${name}</div>
        <div class="yb-dlg-sub">${ctx.stopName ? esc(ctx.stopName) : 'Остановка'}${ctx.placePhoto && ctx.placePhoto.label ? ` · ${esc(ctx.placePhoto.label)}` : ''}</div>
      </div>`;

    const body = `
      <div class="yb-dlg-body">
        <div class="yb-dlg-stops">
          <div class="yb-dlg-stop">
            <span class="yb-dlg-dot" style="background:${color};"></span>
            <span class="yb-dlg-stop-name">${firstStop}</span>
            <span class="yb-dlg-stop-role">начало</span>
          </div>
          <div class="yb-dlg-line" style="background:${color};"></div>
          <div class="yb-dlg-stop">
            <span class="yb-dlg-dot" style="background:${color};"></span>
            <span class="yb-dlg-stop-name">${lastStop}</span>
            <span class="yb-dlg-stop-role">конечная</span>
          </div>
        </div>
        <div class="yb-dlg-eta">
          ${nextTime ? `<span class="yb-dlg-eta-item"><b>${esc(nextTime)}</b> — ближайший автобус</span>` : ''}
          ${stopsText ? `<span class="yb-dlg-eta-item">до него ~<b>${stopsText}</b></span>` : ''}
        </div>
        ${dep ? `<div class="yb-dlg-sub-line">Первый рейс маршрута: <b>${esc(dep)}</b></div>` : ''}
        ${timesHtml ? `<div class="yb-dlg-times"><div class="yb-dlg-times-label">Ближайшие отправления</div><div class="yb-dlg-times-chips">${timesHtml}</div></div>` : ''}
        <a class="yb-dlg-map" href="${routeUrl}" target="_blank" rel="noopener">
          <ha-icon icon="mdi:map-marker-radius"></ha-icon>
          <span>Открыть на Яндекс.Картах</span>
        </a>
      </div>`;

    this._openDialog(head, body, false);
  }

  // Делегирование кликов по строкам маршрутов внутри карточки.
  _bindRouteClicks() {
    const root = this._root;
    if (!root) return;
    const data = this._collect();
    const map = new Map();
    (data.routes || []).forEach((r) => map.set(String(r.route), r));

    root.querySelectorAll('.yb-route[data-route]').forEach((el) => {
      el.onclick = (ev) => {
        ev.stopPropagation();
        const route = map.get(decodeURIComponent(el.dataset.route));
        if (route) this._openRouteDetails(route, data);
      };
    });
  }
}

// ---------------------------------------------------------------------------
// Карточка 1: yandex-bus-card — минималистичное стеклянное табло
// ---------------------------------------------------------------------------
class YandexBusCard extends YandexBusCardBase {
  updateView() {
    if (!this._hass || !this._config) return;
    const data = this._collect();
    if (!this._inner) return;

    if (data.missing) {
      this._inner.innerHTML = `
        <div style="padding:22px; text-align:center; color:var(--secondary-text-color,#8b93a7); font-family:var(--primary-font-family,sans-serif);">
          <ha-icon icon="mdi:bus-stop" style="--mdc-icon-size:34px; color:var(--state-icon-color,var(--primary-color,#4f9cf9));"></ha-icon>
          <div style="font-size:14px; font-weight:600; margin-top:6px;">Остановка не выбрана</div>
        </div>`;
      return;
    }
    if (data.missingEntity) {
      this._inner.innerHTML = `
        <div style="padding:16px; color:var(--error-color,#ef5350); font-family:var(--primary-font-family,sans-serif);">
          Сущность <b>${data.missingEntity}</b> не найдена
        </div>`;
      return;
    }

const ph = data.placePhoto || {};
    const heroBg = ph.url ? `style="background-image:url('${ph.url}')"` : '';
    const header = `
      <div class="yb-hero ${ph.url ? '' : 'yb-hero-grad'}" ${heroBg}>
        <div class="yb-hero-shade"></div>
        <div class="yb-header">
          <div class="yb-stop-title" onclick="window.open('${data.mapStopUrl}','_blank')">
            <ha-icon icon="mdi:bus-stop"></ha-icon>
            <span class="yb-title-text">${data.stopName}</span>
          </div>
          <div class="yb-clock">
            <span class="yb-live-dot"></span>
            <span data-yb-clock>${this._nowTime()}</span>
          </div>
        </div>
        ${ph.label ? `<div class="yb-hero-label" title="Место остановки">${ph.label}</div>` : ''}
      </div>`;

    const rows = data.routes.map((r) => this._routeRow(r));
    const listHtml = `
      <div class="yb-list ${this._config.max_height ? 'scrollable' : ''}" style="${this._config.max_height ? '--yb-max-height:' + this._config.max_height + ';' : ''}">
        ${data.routes.length === 0
          ? '<div class="yb-empty">Нет активных маршрутов</div>'
          : rows.join('')}
      </div>`;

    this._inner.innerHTML = this._renderShell(header, listHtml);
    this._bindRouteClicks();
  }

  _ownStyles() {
    return '';
  }

  static getConfigElement() {
    return document.createElement('yandex-bus-card-editor');
  }

  static getStubConfig() {
    return {
      entity: '',
      title: '',
      selected_buses: [],
      max_height: '',
      card_width: '',
    };
  }
}

// ---------------------------------------------------------------------------
// Карточка 2: yandex-bus-pylon-card — лёгкое табло в стиле стелы.
// Подстраивается под светлую тему: используем тёмный текст на светлых акцентах.
// ---------------------------------------------------------------------------
class YandexBusPylonCard extends YandexBusCardBase {
  _ownStyles() {
    return `
      .yb-root {
        background: var(--ha-card-background, var(--card-background-color, #f8fafc));
        border-radius: 18px;
        border: 1px solid var(--hairline-color, rgba(128,128,160,0.18));
        box-shadow: var(--ha-card-box-shadow, 0 6px 22px rgba(15, 23, 42, 0.12));
      }
      .yb-pylon-title {
        text-align: left;
        font-size: 17px;
        font-weight: 800;
        letter-spacing: 0.2px;
        color: var(--primary-text-color, #0f172a);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
      }
      .yb-pylon-title .yb-pylon-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .yb-pylon-title ha-icon { --mdc-icon-size:17px; color: var(--secondary-text-color,#64748b); flex:none; }
      .yb-route {
        background: var(--card-background-color, rgba(15,23,42,0.035));
        border: 1px solid var(--hairline-color, rgba(128,128,160,0.16));
        border-radius: 13px;
      }
      .yb-route:hover { background: var(--secondary-background-color, rgba(15,23,42,0.06)); }
      .yb-route-num-wrap {
        background: var(--yb-accent,#3b82f6);
        box-shadow: 0 3px 10px var(--yb-accent-shadow, rgba(59,130,246,0.25));
      }
      .yb-bus { background: var(--yb-accent,#3b82f6); box-shadow: 0 3px 8px var(--yb-accent-shadow, rgba(59,130,246,0.3)); }
    `;
  }

  updateView() {
    if (!this._hass || !this._config) return;
    const data = this._collect();
    if (!this._inner) return;

    if (data.missing) {
      this._inner.innerHTML = `
        <div style="padding:22px; text-align:center; color:var(--secondary-text-color,#64748b); font-family:var(--primary-font-family,sans-serif);">
          <ha-icon icon="mdi:bus-stop" style="--mdc-icon-size:34px; color:var(--primary-color,#3b82f6);"></ha-icon>
          <div style="font-size:14px; font-weight:700; margin-top:6px;">Остановка не выбрана</div>
        </div>`;
      return;
    }
    if (data.missingEntity) {
      this._inner.innerHTML = `
        <div style="padding:16px; color:var(--error-color,#ef4444); font-family:var(--primary-font-family,sans-serif);">
          Сущность <b>${data.missingEntity}</b> не найдена
        </div>`;
      return;
    }

    const header = `
      <div class="yb-stop-title yb-pylon-title" onclick="window.open('${data.mapStopUrl}','_blank')">
        <ha-icon icon="mdi:bus-stop"></ha-icon>
        <span class="yb-pylon-name">${data.stopName}</span>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <div class="yb-clock" style="font-size:13px;">
          <span class="yb-live-dot"></span>
          <span data-yb-clock>${this._nowTime()}</span>
        </div>
      </div>`;

    const rows = data.routes.map((r) => this._routeRow(r));
    const listHtml = `
      <div class="yb-list ${this._config.max_height ? 'scrollable' : ''}" style="${this._config.max_height ? '--yb-max-height:' + this._config.max_height + ';' : ''}">
        ${data.routes.length === 0
          ? '<div class="yb-empty">Нет активных маршрутов</div>'
          : rows.join('')}
      </div>`;

    this._inner.innerHTML = this._renderShell(header, listHtml);
    this._bindRouteClicks();
  }

  static getConfigElement() {
    return document.createElement('yandex-bus-card-editor');
  }

  static getStubConfig() {
    return {
      entity: '',
      title: '',
      selected_buses: [],
      max_height: '',
      card_width: '',
    };
  }
}

// ---------------------------------------------------------------------------
// Регистрация
// ---------------------------------------------------------------------------
if (!customElements.get('yandex-bus-card-editor')) {
  customElements.define('yandex-bus-card-editor', YandexBusBaseEditor);
}
if (!customElements.get('yandex-bus-card')) {
  customElements.define('yandex-bus-card', YandexBusCard);
}
if (!customElements.get('yandex-bus-pylon-card')) {
  customElements.define('yandex-bus-pylon-card', YandexBusPylonCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'yandex-bus-card')) {
  window.customCards.push({
    type: 'yandex-bus-card',
    name: 'Яндекс Автобусы (Стекло)',
    description: 'Минималистичное табло остановки, подстраивается под тему Home Assistant',
  });
}
if (!window.customCards.some((c) => c.type === 'yandex-bus-pylon-card')) {
  window.customCards.push({
    type: 'yandex-bus-pylon-card',
    name: 'Яндекс Автобусы (Стела)',
    description: 'Лёгкое табло остановки, подстраивается под светлую тему',
  });
}