# HOTFIX3 — Admin bypass + Global CSRF fetch shim

## What's inside
- `public/index.php`: admin bypass for CSRF/Auth (if `Auth::check()` and `Auth::isAdmin()`).
- `App/Core/Auth.php`: helper `isAdmin()`.
- `public/js/bootstrap.csrf.js`: global fetch shim that auto-adds `X-CSRF-Token` for same-origin POST/PUT/PATCH/DELETE.
- Layout updated to include the shim.

## Apply
1. Copy files to your project root (`calendar.localhost/`), preserving paths:
   - `public/index.php`
   - `App/Core/Auth.php`
   - `public/js/bootstrap.csrf.js`
   - `App/Views/layouts/...` (or include `_partials/bootstrap.csrf.include.php`)
2. Clear OPCache (if enabled) and run:
   ```bash
   composer dump-autoload -o
   ```
3. Test:
   - **Admin**: будь-який POST проходить без CSRF/Auth блокувань.
   - **User**: POST без заголовка → shim додасть `X-CSRF-Token`, має працювати.
   - Без сесії: POST (крім `/login`, `/register`) → 401.
   - Без CSRF cookie: POST → 403.

Generated at: 2025-09-23_081452 Europe/Kyiv
