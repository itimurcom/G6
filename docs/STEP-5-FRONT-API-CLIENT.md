# STEP 5 — Frontend API Client + Optional Adapter

Цей патч **не ламає** поточний фронтенд. Він додає:
- `public/js/services/api.events.js` — єдиний клієнт до API V2 з fallback на легасі.
- `public/js/data.adapter.js` — НЕобов’язковий шар-сумісності, що дає глобальний `Data` поверх `ApiEvents`.
  - Має той самий набір методів у дусі Data.*, але **асинхронні** (повертають Promise).
  - Показує невеликий індикатор "Saving…/Saved/Failed" (можна прибрати — видаліть нижні ~10 рядків у файлі).

## Як підключити
Вставте ці два `<script>` ПЕРЕД підключенням вашого `calendar.ui.js` (і/або інших модулів, які викликають Data.*):
```html
<script src="/public/js/services/api.events.js?v=1"></script>
<script src="/public/js/data.adapter.js?v=1"></script>

<!-- далі ваші файли -->
<script src="/public/js/calendar.data.js?v=..."></script>
<script src="/public/js/calendar.ui.js?v=..."></script>
```

> Якщо `calendar.ui.js` очікує **синхронні** виклики Data.*, не підключайте `data.adapter.js` — тоді на етапі рефакторингу оновимо UI під async (або додамо внутрішній кеш/прелоад).

## Що вже готово у клієнті
- **byDate/byRange/get/create/update/delete/done/urgent/search**
- **exportStore/importStore** — працюють і через легасі (`/api/events`, `/api/events/store`) і через нові (`/api/backup/*`).
- Пер-денний **кеш** (60 сек) з автоматичним інвалідуванням після записів.

## Інтеграційні підказки
- Для існуючого UI: викликайте `await Data.getEventsFor('2025-09-21')`, `await Data.create(date, evt)` тощо.
- Для індикатора — нічого не треба: події `api:saving:*` вмикають маленький бедж у правому нижньому куті.
  - Хочете свій індикатор: слухайте події `api:saving:start|done|fail` і керуйте власним UI.

## Перевірка
1) Відкрий DevTools → Network.
2) Створення/редагування/drag-n-drop → POST на `/api/events/create|update` (або fallback).
3) Перехід по днях → GET `/api/events/by-date?date=...`; список на Плануванні → `/api/events/by-range?...`.
4) Імпорт/експорт у UI — працює як і раніше (через alias), одночасно готові `/api/backup/*`.
