# Migration to DB-style storage (from full-store JSON)

## Before
- Frontend loaded **entire** `db.json` via `GET /api/events` and saved the whole store via `POST /api/events/store`.
- Rendering and mutations operated on the in-memory store.

## After
- Introduced **table-like** API v2 with single-record CRUD and **daily** reads:
  - `GET /api/events/by-date`, `/by-range`, `/get`, `/search`.
  - `POST /api/events/create`, `/update`, `/delete`, `/done`, `/urgent`.
- Frontend renders **day-by-day** (one day = one fetch + render step).
- In-memory cache becomes **day cache** keyed by `YYYY-MM-DD`.
- Export/import moved to dedicated **Backup API** under `/api/backup/*`.

## Why
- Enables seamless swap of storage transport (file ↔ MySQL) with **no changes** in controllers or UI.
- Reduces payload and accelerates initial render.
- Clears separation of concerns: **business API (v2)** vs **backup subsystem**.

## How it works
- `FileEventRepository` implements `EventRepositoryInterface` and uses `EventStore` for atomic reads/writes to `db.json`.
- Controllers consume the **interface**, not the storage details.
- Frontend `calendar.data.js` uses v2 endpoints to fetch per-day, caches them, and performs single-record mutations.

## Compatibility
- Legacy endpoints kept as **aliases**:
  - `GET /api/events` → `/api/backup/export`
  - `POST /api/events/store` → `/api/backup/import`
  - `GET /api/events/diag` → `/api/backup/diag`

## Swapping to MySQL later
- Provide `MysqlEventRepository` (PDO) implementing `EventRepositoryInterface`.
- Bind it in `ApiEventsController` (constructor) instead of `FileEventRepository`.
- No UI changes required.
