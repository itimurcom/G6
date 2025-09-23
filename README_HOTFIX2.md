# HOTFIX2 — Autoload before CSRF/Auth guard + Csrf.php include

**Problem fixed:** `Class "App\Security\Csrf" not found` — guard ran before Composer autoload.

## What changed
- `public/index.php`: we now require Composer autoload **before** using Csrf/Auth.
- `App/Security/Csrf.php`: included again for convenience (if not merged previously).

## How to apply
1. Copy files to your project root (`calendar.localhost/`) preserving paths:
   - `public/index.php`
   - `App/Security/Csrf.php`
2. Run:
   ```bash
   composer dump-autoload -o
   ```
3. Test POST endpoints:
   - Without CSRF → 403
   - Without auth (except `/login`, `/register`) → 401
   - With both OK → 200

Generated at: 2025-09-23_080914 Europe/Kyiv
