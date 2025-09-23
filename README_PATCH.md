# Calendar P0 Patch — 2025-09-23_075123

This archive contains **new and modified files** implementing P0:
- CSRF double-submit cookie + global POST guard
- POST Auth guard
- userHash → localStorage → payload
- ApiEventsController DI + typed property
- EventRepository interface + factory
- Front-end `apiFetch` wrapper, CSRF headers, and user_hash injection
- CSRF hidden inputs in login/register forms (if present)

Project root detected at: `/mnt/data/unpacked_2025-09-23_075123/calendar.localhost`

## Files
- NEW `App/Security/Csrf.php`
- MOD `public/index.php` (global CSRF + Auth guards)
- MOD `App/Core/Auth.php` (`userHash()`)
- MOD `App/Views/layouts/main.php` (set `localStorage['calendar.userHash']`)
- NEW `public/js/api.js`
- MOD `public/js/services/api.events.js` (switch to `apiFetch`, inject `user_hash`)
- MOD `App/Views/auth/login.php` (hidden `_csrf`) — if exists
- MOD `App/Views/auth/register.php` (hidden `_csrf`) — if exists
- NEW `App/Models/EventRepositoryInterface.php`
- NEW `App/Models/EventRepositoryFactory.php`
- MOD `App/Models/FileEventRepository.php` (implements interface) — if exists
- MOD `App/Controllers/ApiEventsController.php` (typed property + DI) — if exists

## Apply
1. Copy files into your project root (`calendar.localhost/`), preserving paths.
2. Run `composer dump-autoload -o`
3. Verify:
   - POST without CSRF → 403
   - POST without auth (except login/register) → 401
   - After login, `localStorage['calendar.userHash']` exists
   - Event create/update sends `user_hash` and persists `user_id != 0`
