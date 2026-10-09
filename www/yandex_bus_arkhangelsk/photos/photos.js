// ============================================================================
// Встроенный набор фото-заглушек мест/районов Архангельска.
// Маппинг «место → файл фото» + ключевые слова для определения по названию
// остановки. Располагается рядом с карточкой и подключается как ресурс.
//
// Файлы: <placeholder>/www/yandex_bus_arkhangelsk/photos/
// (в HA — /local/yandex_bus_arkhangelsk/photos/)
// ============================================================================

// Базовый путь до папки с фото. Карточка может переопределить через конфиг.
const YB_PHOTOS_BASE = '/local/yandex_bus_arkhangelsk/photos/';

// Маппинг место -> ключевые слова (поиск по названию остановки, регистронезависимо).
// Порядок важен: первые записи перекрывают более общие.
const YB_DISTRICT_MAP = [
  { id: 'solombala',      file: 'solombala.jpg',      words: ['соломбал', 'соломба'],          label: 'Соломбала' },
  { id: 'mayskaya-gorka', file: 'mayskaya-gorka.jpg', words: ['майск'],                         label: 'Майская горка' },
  { id: 'varavino',       file: 'varavino.jpg',       words: ['варавино', 'фактория'],          label: 'Варавино-Фактория' },
  { id: 'isakogorka',     file: 'isakogorka.jpg',     words: ['исакогор'],                      label: 'Исакогорка' },
  { id: 'tsiglomen',      file: 'tsiglomen.jpg',      words: ['цигломен'],                      label: 'Цигломень' },
  { id: 'krasnoflotsky',  file: 'krasnoflotsky.jpg',  words: ['краснофлот', 'остров', 'острова'], label: 'Краснофлотский' },
  { id: 'lomonosovsky',   file: 'lomonosovsky.jpg',   words: ['ломоносов', 'троицк'],           label: 'Ломоносовский' },
  { id: 'pomorskaya',     file: 'pomorskaya.jpg',     words: ['поморск', 'октябрьск'],          label: 'Октябрьский' },
  { id: 'center',         file: 'center.jpg',         words: ['гостин', 'площадь ленина', 'набережн'], label: 'Центр' },
  { id: 'naberezhnaya',   file: 'naberezhnaya.jpg',   words: ['набережн', 'северн', 'речн'],     label: 'Набережная' },
  { id: 'vokzal',         file: 'vokzal.jpg',         words: ['вокзал', 'ж/д'],                 label: 'Вокзал' },
  { id: 'aeroport',       file: 'aeroport.jpg',       words: ['аэропорт', 'талаг'],             label: 'Аэропорт' },
  { id: 'dvinskoi',       file: 'dvinskoi.jpg',       words: ['двинск', 'березник'],            label: 'Двинской' },
  { id: 'novoeflat',      file: 'novoeflat.jpg',      words: ['новых', 'микрорайон'],           label: 'Новые кварталы' },
];

// Фолбэк — общий вид города.
const YB_CITY = { id: 'city', file: 'city.jpg', label: 'Архангельск' };

// Определить место по названию остановки. Возвращает {id, file, label, full}
// или NULL, если ничего не подошло.
function ybMatchDistrict(name) {
  if (!name) return null;
  const n = String(name).toLowerCase();
  for (const d of YB_DISTRICT_MAP) {
    for (const w of d.words) {
      if (n.includes(w.toLowerCase())) {
        return { ...d, full: YB_PHOTOS_BASE + d.file };
      }
    }
  }
  return null;
}

// Получить URL фото места. Учитывает ручной оверрайд района из конфига.
function ybPlacePhotoUrl(name, districtOverride) {
  // 1. Явный оверрайд района (district_override из конфига карточки).
  if (districtOverride) {
    const ov = ybMatchDistrict(districtOverride);
    if (ov) return ov.full;
  }
  // 2. Автоопределение по названию остановки.
  const m = ybMatchDistrict(name);
  if (m) return m.full;
  // 3. Фолбэк — город.
  return YB_PHOTOS_BASE + YB_CITY.file;
}

// Список всех доступных мест (для наглядности/настроек).
function ybAllPlaces() {
  return YB_DISTRICT_MAP.map((d) => ({ id: d.id, label: d.label, file: YB_PHOTOS_BASE + d.file }))
    .concat([{ id: YB_CITY.id, label: YB_CITY.label, file: YB_PHOTOS_BASE + YB_CITY.file }]);
}

// Экспорт для подключения как ES-модуля.
if (typeof window !== 'undefined') {
  window.YBDistrictMap = YB_DISTRICT_MAP;
  window.YBPhotosBase = YB_PHOTOS_BASE;
  window.ybMatchDistrict = ybMatchDistrict;
  window.ybPlacePhotoUrl = ybPlacePhotoUrl;
  window.ybAllPlaces = ybAllPlaces;
}

export { YB_DISTRICT_MAP, YB_PHOTOS_BASE, YB_CITY, ybMatchDistrict, ybPlacePhotoUrl, ybAllPlaces };