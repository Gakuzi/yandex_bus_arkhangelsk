// Универсальный редактор
class YandexBusBaseEditor extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  setConfig(config) {
    this._config = config ? JSON.parse(JSON.stringify(config)) : {};
    if (!Array.isArray(this._config.selected_buses)) {
      this._config.selected_buses = [];
    }
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
          composed: true
        }));

        this.render();
      });
    }

    if (this._hass) {
      this._form.hass = this._hass;
    }

    const conf = this._config || {};
    const curEntity = conf.entity || '';
    const stateObj = (curEntity && this._hass && this._hass.states) ? this._hass.states[curEntity] : null;
    
    let availableRoutes = [];
    if (stateObj && stateObj.attributes && Array.isArray(stateObj.attributes.routes)) {
      availableRoutes = stateObj.attributes.routes.map(r => String(r.route));
    }

    this._form.data = {
      entity: curEntity,
      title: conf.title || '',
      selected_buses: Array.isArray(conf.selected_buses) ? conf.selected_buses.map(String) : [],
      show_prefix: conf.show_prefix === true,
      show_subtext: conf.show_subtext === true,
      max_height: conf.max_height || '',
      card_width: conf.card_width || ''
    };

    const schema = [
      {
        name: 'entity',
        required: true,
        selector: { entity: { domain: 'sensor' } }
      },
      {
        name: 'title',
        selector: { text: {} }
      }
    ];

    if (availableRoutes.length > 0) {
      schema.push({
        name: 'selected_buses',
        selector: {
          select: {
            multiple: true,
            mode: 'dropdown',
            options: availableRoutes.map(r => ({ value: r, label: `Автобус №${r}` }))
          }
        }
      });
    }

    schema.push(
      {
        name: 'max_height',
        selector: { text: {} }
      },
      {
        name: 'card_width',
        selector: { text: {} }
      },
      {
        name: 'show_prefix',
        selector: { boolean: {} }
      },
      {
        name: 'show_subtext',
        selector: { boolean: {} }
      }
    );

    this._form.schema = schema;

    this._form.computeLabel = (s) => {
      const labels = {
        entity: 'Остановка (сенсор)',
        title: 'Свое название остановки',
        selected_buses: 'Маршруты (мультивыбор)',
        max_height: 'Макс. высота карточки (напр. 350px)',
        card_width: 'Фиксированная ширина (напр. 400px или 100%)',
        show_prefix: 'Писать слово "Прибытие в"',
        show_subtext: 'Показывать нижние подписи точек трека'
      };
      return labels[s.name] || s.name;
    };
  }
}

// Форматирование количества остановок и проверка ночного рейса
function getRouteStatus(r, minsLeft, nextTime) {
  const isFarAway = minsLeft > 60;

  if (isFarAway) {
    let subStatus = 'Не на линии';
    if (nextTime && nextTime.includes(':')) {
      const h = parseInt(nextTime.split(':')[0], 10);
      if (h >= 4 && h <= 11) {
        subStatus = 'Первый рейс';
      }
    }
    return {
      isFarAway: true,
      badgeTime: nextTime,
      stopsText: subStatus,
      arrivalLabel: `Первый рейс в ${nextTime}`
    };
  }

  let count = 0;
  if (r.stops_left !== undefined && r.stops_left !== null) {
    count = parseInt(r.stops_left, 10);
  } else if (r.stops_count !== undefined && r.stops_count !== null) {
    count = parseInt(r.stops_count, 10);
  } else {
    if (minsLeft <= 1) count = 1;
    else count = Math.max(1, Math.round(minsLeft / 2.5));
  }

  const mod10 = count % 10;
  const mod100 = count % 100;
  let word = 'остановок';
  if (mod10 === 1 && mod100 !== 11) {
    word = 'остановка';
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    word = 'остановки';
  }

  return {
    isFarAway: false,
    badgeTime: minsLeft > 0 ? `${minsLeft} мин` : 'сейчас',
    stopsText: `${count} ${word}`,
    arrivalLabel: `Прибытие в ${nextTime}`
  };
}

// Карточка 1: Темный стекломорфизм
class YandexBusDarkGlassCard extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      const card = document.createElement('ha-card');
      this.content = document.createElement('div');
      card.appendChild(this.content);
      this.appendChild(card);
      this._startTimeTicker();
    }
    this.updateView();
  }

  setConfig(config) {
    this._config = config ? JSON.parse(JSON.stringify(config)) : {};
    this.updateView();
  }

  disconnectedCallback() {
    if (this._timeTicker) clearInterval(this._timeTicker);
  }

  _startTimeTicker() {
    if (this._timeTicker) clearInterval(this._timeTicker);
    this._timeTicker = setInterval(() => {
      const timeElem = this.querySelector('#yb_clock_glass');
      if (timeElem) {
        const now = new Date();
        timeElem.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }, 1000);
  }

  _getMinutesLeft(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const parts = timeStr.split(':');
    const targetH = parseInt(parts[0], 10);
    const targetM = parseInt(parts[1], 10);

    const now = new Date();
    let diff = (targetH * 60 + targetM) - (now.getHours() * 60 + now.getMinutes());
    if (diff < 0) diff += 1440;
    return diff;
  }

  updateView() {
    if (!this._hass || !this._config || !this.content) return;
    const entityId = this._config.entity;
    
    if (!entityId) {
      this.content.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #94a3b8; font-family: sans-serif;">
          <ha-icon icon="mdi:bus-stop" style="--mdc-icon-size: 38px; color: #38bdf8; margin-bottom: 6px;"></ha-icon>
          <div style="font-size: 15px; font-weight: 600; color: #f8fafc;">Остановка не выбрана</div>
        </div>`;
      return;
    }

    const stateObj = this._hass.states[entityId];
    if (!stateObj) {
      this.content.innerHTML = `<div style="padding: 16px; color: #ef4444; font-family: sans-serif;">Сущность <b>${entityId}</b> не найдена</div>`;
      return;
    }

    const attrs = stateObj.attributes || {};
    const stopName = this._config.title || attrs.stop_name || attrs.friendly_name || 'Остановка';
    const stopId = attrs.stop_id || '';
    
    let routes = attrs.routes || [];
    let selected = this._config.selected_buses || [];
    if (typeof selected === 'string') {
      selected = selected.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (Array.isArray(selected) && selected.length > 0) {
      routes = routes.filter(r => selected.includes(String(r.route)));
    }

    const mapStopUrl = stopId 
      ? `https://yandex.ru/maps/20/arkhangelsk/?masstransit%5BstopId%5D=stop__${stopId}&l=masstransit`
      : 'https://yandex.ru/maps/20/arkhangelsk/?l=masstransit';

    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const routeColors = ['#f59e0b', '#38bdf8', '#34d399', '#a855f7', '#fb7185'];
    const showWord = this._config.show_prefix === true;
    const showSubtext = this._config.show_subtext === true;
    const maxHeightStyle = this._config.max_height ? `max-height: ${this._config.max_height}; overflow-y: auto;` : '';
    const widthStyle = this._config.card_width ? `width: ${this._config.card_width}; margin: 0 auto;` : '';

    this.content.innerHTML = `
      <style>
        .yb-dashboard-card {
          background: #11141c;
          border-radius: 20px;
          padding: 14px 16px;
          color: #ffffff;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
          box-sizing: border-box;
          ${widthStyle}
        }
        .yb-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding: 0 2px;
        }
        .yb-stop-header {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .yb-stop-main-title {
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.2px;
        }
        .yb-clock-box {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 15px;
          font-weight: 600;
          color: #e2e8f0;
        }
        .yb-pulse-dot {
          width: 7px;
          height: 7px;
          background: #38bdf8;
          border-radius: 50%;
          box-shadow: 0 0 8px #38bdf8;
          animation: ybPulse 2s infinite;
        }
        @keyframes ybPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        .yb-items-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          ${maxHeightStyle}
          padding-right: ${this._config.max_height ? '4px' : '0'};
        }
        .yb-items-list::-webkit-scrollbar { width: 4px; }
        .yb-items-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }
        .yb-route-box {
          background: rgba(255, 255, 255, 0.035);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .yb-route-box:hover { background: rgba(255, 255, 255, 0.07); transform: translateY(-1px); }
        .yb-route-box.idle { opacity: 0.65; }
        .yb-left-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 48px;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          padding-right: 10px;
        }
        .yb-badge-num { font-size: 24px; font-weight: 800; line-height: 1; letter-spacing: -0.5px; }
        .yb-badge-time { font-size: 10px; color: #94a3b8; font-weight: 600; margin-top: 3px; text-transform: uppercase; text-align: center; }
        .yb-track-container { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .yb-route-meta { display: flex; align-items: center; justify-content: space-between; }
        .yb-route-dest { font-size: 13px; font-weight: 600; color: #f1f5f9; }
        .yb-route-stops { font-size: 11px; font-weight: 600; color: #94a3b8; }
        .yb-line-wrap { position: relative; height: 28px; display: flex; align-items: center; }
        .yb-track-bg { position: absolute; left: 0; right: 0; height: 3px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; }
        .yb-track-progress { position: absolute; left: 0; height: 3px; border-radius: 3px; overflow: hidden; }
        .yb-light-drop {
          position: absolute; top: 0; left: -40%; width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.95) 50%, transparent 100%);
          animation: ybDropRun 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes ybDropRun { 0% { left: -40%; } 100% { left: 115%; } }
        .yb-points-row { position: absolute; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; }
        .yb-stop-point { width: 6px; height: 6px; border-radius: 50%; background: #334155; border: 1.5px solid #11141c; }
        .yb-stop-point.passed { background: #ffffff; }
        .yb-bus-runner {
          position: absolute; top: -1px; transform: translateX(-50%);
          display: flex; align-items: center; justify-content: center;
          transition: left 0.4s ease; pointer-events: none;
        }
        .yb-bus-runner ha-icon { --mdc-icon-size: 25px; filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.8)); }
        .yb-subtext-points { display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; font-weight: 500; margin-top: -1px; }
        
        .yb-sleep-banner {
          font-size: 11px;
          color: #94a3b8;
          background: rgba(255,255,255,0.05);
          padding: 4px 8px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
      </style>

      <div class="yb-dashboard-card">
        <div class="yb-top-bar">
          <div class="yb-stop-header" onclick="window.open('${mapStopUrl}', '_blank')">
            <span class="yb-stop-main-title">Остановка "${stopName}"</span>
            <ha-icon icon="mdi:open-in-new" style="--mdc-icon-size: 15px; color: #64748b;"></ha-icon>
          </div>
          <div class="yb-clock-box">
            <div class="yb-pulse-dot"></div>
            <span id="yb_clock_glass">${nowTimeStr}</span>
          </div>
        </div>

        <div class="yb-items-list">
          ${routes.length === 0 ? '<div style="color: #64748b; text-align: center; padding: 14px;">Нет активных маршрутов</div>' : ''}
          ${routes.map((r, idx) => {
            const color = routeColors[idx % routeColors.length];
            const nextTime = r.next || (r.times && r.times[0]) || '--:--';
            const minsLeft = this._getMinutesLeft(nextTime);
            const status = getRouteStatus(r, minsLeft, nextTime);

            let progressPercent = 88 - (minsLeft * 4);
            if (progressPercent < 15) progressPercent = 15;
            if (progressPercent > 92) progressPercent = 92;

            const busUrl = r.map_url || `https://yandex.ru/maps/20/arkhangelsk/?text=автобус%20${encodeURIComponent(r.route)}&l=masstransit`;
            const headerLabel = showWord ? status.arrivalLabel : nextTime;

            return `
              <div class="yb-route-box ${status.isFarAway ? 'idle' : ''}" onclick="window.open('${busUrl}', '_blank')">
                <div class="yb-left-badge">
                  <div class="yb-badge-num" style="color: ${status.isFarAway ? '#64748b' : color};">${r.route}</div>
                  <div class="yb-badge-time">${status.badgeTime}</div>
                </div>

                <div class="yb-track-container">
                  <div class="yb-route-meta">
                    <span class="yb-route-dest">${headerLabel}</span>
                    <span class="yb-route-stops" style="color: ${status.isFarAway ? '#f59e0b' : '#94a3b8'};">${status.stopsText}</span>
                  </div>

                  ${status.isFarAway ? `
                    <div class="yb-sleep-banner">
                      <ha-icon icon="mdi:moon-waning-crescent" style="--mdc-icon-size: 14px; color: #f59e0b;"></ha-icon>
                      <span>Движение приостановлено до утра. Следующий рейс по расписанию.</span>
                    </div>
                  ` : `
                    <div class="yb-line-wrap">
                      <div class="yb-track-bg"></div>
                      <div class="yb-track-progress" style="width: ${progressPercent}%; background: ${color};">
                        <div class="yb-light-drop"></div>
                      </div>

                      <div class="yb-points-row">
                        <div class="yb-stop-point passed"></div>
                        <div class="yb-stop-point ${progressPercent > 35 ? 'passed' : ''}"></div>
                        <div class="yb-stop-point ${progressPercent > 65 ? 'passed' : ''}"></div>
                        <div class="yb-stop-point ${progressPercent > 80 ? 'passed' : ''}"></div>
                        <div class="yb-stop-point" style="background: ${color};"></div>
                      </div>

                      <div class="yb-bus-runner" style="left: ${progressPercent}%;">
                        <ha-icon icon="mdi:bus-side" style="color: ${color};"></ha-icon>
                      </div>
                    </div>

                    ${showSubtext ? `
                      <div class="yb-subtext-points">
                        <span>ПРЕДЫДУЩАЯ</span>
                        <span>В ПУТИ</span>
                        <span>ОСТАНОВКА</span>
                      </div>
                    ` : ''}
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  static getConfigElement() {
    return document.createElement('yandex-bus-card-editor');
  }

  static getStubConfig() {
    return {
      entity: '',
      title: '',
      selected_buses: [],
      show_prefix: false,
      show_subtext: false,
      max_height: '',
      card_width: ''
    };
  }
}

// Карточка 2: Городская стела
class YandexBusCityPylonCard extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      const card = document.createElement('ha-card');
      this.content = document.createElement('div');
      card.appendChild(this.content);
      this.appendChild(card);
    }
    this.updateView();
  }

  setConfig(config) {
    this._config = config ? JSON.parse(JSON.stringify(config)) : {};
    this.updateView();
  }

  _getMinutesLeft(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const parts = timeStr.split(':');
    const targetH = parseInt(parts[0], 10);
    const targetM = parseInt(parts[1], 10);

    const now = new Date();
    let diff = (targetH * 60 + targetM) - (now.getHours() * 60 + now.getMinutes());
    if (diff < 0) diff += 1440;
    return diff;
  }

  updateView() {
    if (!this._hass || !this._config || !this.content) return;
    const entityId = this._config.entity;
    
    if (!entityId) {
      this.content.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #475569; font-family: sans-serif;">
          <ha-icon icon="mdi:bus-stop" style="--mdc-icon-size: 38px; color: #3b82f6; margin-bottom: 6px;"></ha-icon>
          <div style="font-size: 15px; font-weight: 700; color: #1e293b;">Остановка не выбрана</div>
        </div>`;
      return;
    }

    const stateObj = this._hass.states[entityId];
    if (!stateObj) {
      this.content.innerHTML = `<div style="padding: 16px; color: #ef4444; font-family: sans-serif;">Сущность <b>${entityId}</b> не найдена</div>`;
      return;
    }

    const attrs = stateObj.attributes || {};
    const stopName = this._config.title || attrs.stop_name || attrs.friendly_name || 'Остановка';
    const stopId = attrs.stop_id || '';
    
    let routes = attrs.routes || [];
    let selected = this._config.selected_buses || [];
    if (typeof selected === 'string') {
      selected = selected.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (Array.isArray(selected) && selected.length > 0) {
      routes = routes.filter(r => selected.includes(String(r.route)));
    }

    const mapStopUrl = stopId 
      ? `https://yandex.ru/maps/20/arkhangelsk/?masstransit%5BstopId%5D=stop__${stopId}&l=masstransit`
      : 'https://yandex.ru/maps/20/arkhangelsk/?l=masstransit';

    const palette = ['#10b981', '#3b82f6', '#f97316', '#6366f1', '#eab308'];
    const maxHeightStyle = this._config.max_height ? `max-height: ${this._config.max_height}; overflow-y: auto;` : '';
    const widthStyle = this._config.card_width ? `width: ${this._config.card_width}; margin: 0 auto;` : '';

    this.content.innerHTML = `
      <style>
        .yb-pylon-card {
          background: linear-gradient(180deg, #9ca8b7 0%, #bdc8d5 100%);
          border-radius: 28px;
          padding: 16px 14px 20px 14px;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.7), 0 15px 35px rgba(0,0,0,0.3);
          border: 4px solid #475569;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          box-sizing: border-box;
          ${widthStyle}
        }
        .yb-pylon-title {
          text-align: center;
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 1px;
          text-transform: uppercase;
          text-shadow: 0 1px 2px rgba(0,0,0,0.25);
          margin-bottom: 14px;
          cursor: pointer;
        }
        .yb-pylon-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          ${maxHeightStyle}
        }
        .yb-pylon-list::-webkit-scrollbar { width: 4px; }
        .yb-pylon-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 4px; }
        .yb-pylon-item {
          background: linear-gradient(180deg, #edf1f6 0%, #d8e0ea 100%);
          border-radius: 16px;
          padding: 12px 14px 14px 14px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.08), inset 0 1px 1px #ffffff;
          border: 1px solid rgba(255,255,255,0.6);
          cursor: pointer;
        }
        .yb-pylon-item.idle { opacity: 0.75; }
        .yb-pylon-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .yb-pylon-left { display: flex; align-items: center; gap: 10px; }
        .yb-pylon-badge {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }
        .yb-pylon-routename {
          font-size: 15px;
          font-weight: 800;
          color: #1e293b;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .yb-pylon-right { text-align: right; }
        .yb-pylon-time { font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.1; }
        .yb-pylon-stops-count { font-size: 11px; font-weight: 700; color: #64748b; margin-top: 2px; }
        .yb-pylon-track-wrap { position: relative; height: 22px; display: flex; align-items: center; }
        .yb-pylon-track-bar {
          position: absolute; left: 0; right: 0; height: 6px;
          background: #c3cedb; border-radius: 6px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
        }
        .yb-pylon-progress-bar { position: absolute; left: 0; height: 6px; border-radius: 6px; overflow: hidden; }
        .yb-pylon-dots {
          position: absolute; left: 0; right: 0; display: flex;
          justify-content: space-between; align-items: center; padding: 0 4px;
        }
        .yb-pylon-dot {
          width: 6px; height: 6px; background: #ffffff;
          border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        .yb-pylon-dot.end { background: #0f172a; width: 7px; height: 7px; }
        .yb-pylon-runner {
          position: absolute; top: -3px; transform: translateX(-50%);
          display: flex; align-items: center; justify-content: center; transition: left 0.4s ease;
        }
        .yb-pylon-bus-box {
          width: 26px; height: 26px; border-radius: 7px;
          display: flex; align-items: center; justify-content: center; color: #ffffff;
          border: 1px solid rgba(255,255,255,0.7);
        }
        .yb-pylon-sleep-bar {
          background: rgba(15, 23, 42, 0.06);
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          display: flex;
          align-items: center;
          gap: 6px;
        }
      </style>

      <div class="yb-pylon-card">
        <div class="yb-pylon-title" onclick="window.open('${mapStopUrl}', '_blank')">${stopName}</div>
        <div class="yb-pylon-list">
          ${routes.length === 0 ? '<div style="color: #475569; text-align: center; padding: 14px;">Нет активных маршрутов</div>' : ''}
          ${routes.map((r, idx) => {
            const color = palette[idx % palette.length];
            const nextTime = r.next || (r.times && r.times[0]) || '--:--';
            const minsLeft = this._getMinutesLeft(nextTime);
            const status = getRouteStatus(r, minsLeft, nextTime);

            let progressPercent = 88 - (minsLeft * 4);
            if (progressPercent < 15) progressPercent = 15;
            if (progressPercent > 90) progressPercent = 90;

            const busUrl = r.map_url || `https://yandex.ru/maps/20/arkhangelsk/?text=автобус%20${encodeURIComponent(r.route)}&l=masstransit`;
            const labelText = isNaN(r.route) ? r.route : `АВТОБУС ${r.route}`;

            return `
              <div class="yb-pylon-item ${status.isFarAway ? 'idle' : ''}" onclick="window.open('${busUrl}', '_blank')">
                <div class="yb-pylon-top">
                  <div class="yb-pylon-left">
                    <div class="yb-pylon-badge" style="background: ${status.isFarAway ? '#64748b' : color}; box-shadow: 0 3px 8px ${status.isFarAway ? '#00000022' : color + '88'};">
                      <ha-icon icon="mdi:bus" style="--mdc-icon-size: 19px;"></ha-icon>
                    </div>
                    <span class="yb-pylon-routename">${labelText}</span>
                  </div>
                  <div class="yb-pylon-right">
                    <div class="yb-pylon-time">${status.badgeTime}</div>
                    <div class="yb-pylon-stops-count" style="color: ${status.isFarAway ? '#d97706' : '#64748b'};">${status.stopsText}</div>
                  </div>
                </div>

                ${status.isFarAway ? `
                  <div class="yb-pylon-sleep-bar">
                    <ha-icon icon="mdi:moon-waning-crescent" style="--mdc-icon-size: 16px; color: #d97706;"></ha-icon>
                    <span>Ожидание утреннего рейса по графику</span>
                  </div>
                ` : `
                  <div class="yb-pylon-track-wrap">
                    <div class="yb-pylon-track-bar"></div>
                    <div class="yb-pylon-progress-bar" style="width: ${progressPercent}%; background: ${color};">
                      <div style="position:absolute; top:0; left:-40%; width:40%; height:100%; background:linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent); animation: ybDropRun 2s infinite;"></div>
                    </div>
                    <div class="yb-pylon-dots">
                      <div class="yb-pylon-dot"></div>
                      <div class="yb-pylon-dot"></div>
                      <div class="yb-pylon-dot"></div>
                      <div class="yb-pylon-dot"></div>
                      <div class="yb-pylon-dot end"></div>
                    </div>
                    <div class="yb-pylon-runner" style="left: ${progressPercent}%;">
                      <div class="yb-pylon-bus-box" style="background: ${color}; box-shadow: 0 4px 10px ${color}aa;">
                        <ha-icon icon="mdi:bus" style="--mdc-icon-size: 17px;"></ha-icon>
                      </div>
                    </div>
                  </div>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
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
      card_width: ''
    };
  }
}

// Регистрация кастомных элементов
if (!customElements.get('yandex-bus-card-editor')) {
  customElements.define('yandex-bus-card-editor', YandexBusBaseEditor);
}

if (!customElements.get('yandex-bus-card')) {
  customElements.define('yandex-bus-card', YandexBusDarkGlassCard);
}

if (!customElements.get('yandex-bus-pylon-card')) {
  customElements.define('yandex-bus-pylon-card', YandexBusCityPylonCard);
}

window.customCards = window.customCards || [];

if (!window.customCards.some(card => card.type === 'yandex-bus-card')) {
  window.customCards.push({
    type: 'yandex-bus-card',
    name: 'Яндекс Автобусы (Тёмное стекло)',
    description: 'Компактное темное неоновое табло с часами и бегущим лучом'
  });
}

if (!window.customCards.some(card => card.type === 'yandex-bus-pylon-card')) {
  window.customCards.push({
    type: 'yandex-bus-pylon-card',
    name: 'Яндекс Автобусы (Городская стела)',
    description: 'Светлое уличное информационное табло в алюминиевом корпусе'
  });
}
