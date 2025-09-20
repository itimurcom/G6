# Calendar API v2 (table-like, storage-agnostic)

All endpoints return/accept JSON. Date format: `YYYY-MM-DD`. Time format: `HH:MM` or empty.

## Event shape
```json
{
  "id": "uuid",
  "time": "HH:MM",
  "title": "…",
  "owner": "…",
  "type": "evt|mi|nas|other",
  "urgent": false,
  "done": false,
  "user_id": 0,
  "incoming_no": "",
  "outgoing_no": "",
  "description": ""
}
```

> Note: `date` is not stored inside the event in `db.json`; it is the key of the day bucket. Endpoints that return a single event include a `date` field for convenience.

## Endpoints

- `GET /api/events/by-date?date=YYYY-MM-DD` → `[{event}, ...]`
- `GET /api/events/by-range?start=YYYY-MM-DD&end=YYYY-MM-DD` → `{ "YYYY-MM-DD": [ ... ] }`
- `GET /api/events/get?id=UUID` → `{event-with-date}`
- `POST /api/events/create` (body `{ date, ...event }`) → `{ "id": "uuid" }`
- `POST /api/events/update` (body `{ id, ...patch }`) → `{ "ok": true }`
- `POST /api/events/delete` (body `{ id }`) → `{ "ok": true }`
- `POST /api/events/done` (body `{ id, done }`) → `{ "ok": true }`
- `POST /api/events/urgent` (body `{ id, urgent }`) → `{ "ok": true }`
- `GET /api/events/search?[text=&type=&owner=&urgent=&done=&date=&start=&end=]` → `[{event-with-date}, ...]`

### Errors
- 400 `{ "error": "..." }` for missing/invalid params
- 404 `{ "error": "not_found" }`

## Storage
The current implementation uses `FileEventRepository` on top of `db.json`. It can be swapped for MySQL by providing `MysqlEventRepository` that implements `EventRepositoryInterface`.
