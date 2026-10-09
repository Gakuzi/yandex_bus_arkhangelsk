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
    // Живые часы.
    this._clockTimer = setInterval(() => {
      const el = this.querySelector('[data-yb-clock]');
      if (el) el.textContent = this._nowTime();
    }, 1000);
  }

  _nowTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

    return { stopName, stopId, routes, mapStopUrl };
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

    const busUrl = route.map_url
      || `https://yandex.ru/maps/20/arkhangelsk/?text=автобус%20${encodeURIComponent(route.route)}&l=masstransit`;

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
      <div class="yb-route ${status.far ? 'far' : ''}" onclick="window.open('${busUrl}','_blank')">
        <div ${numHtml}</div>
        <div class="yb-route-body">
          <div class="yb-route-meta">
            <span class="yb-route-label">${route.route}</span>
            <span class="yb-route-time ${status.far ? 'far' : ''}">${status.time}</span>
          </div>
          ${status.far
            ? `<div class="yb-note"><ha-icon icon="mdi:moon-waning-crescent"></ha-icon><span>${status.note}</span></div>`
            : trackHtml}
        </div>
      </div>`;
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

    const header = `
      <div class="yb-header">
        <div class="yb-stop-title" onclick="window.open('${data.mapStopUrl}','_blank')">
          <ha-icon icon="mdi:bus-stop"></ha-icon>
          <span class="yb-title-text">${data.stopName}</span>
        </div>
        <div class="yb-clock">
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