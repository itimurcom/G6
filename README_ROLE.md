# Role selection during registration

Adds a secure way to select role ('user' or 'admin') at registration time, with **three safety modes**:

- `dev`: allow any role from `allow_roles` (use only internally)
- `invite`: allow 'admin' only with matching `admin_invite_code`
- `bootstrap`: allow 'admin' only if there are **no existing admins**

## Files
- NEW `config/auth.php` — configuration for registration modes.
- MOD `App/Core/Auth.php` — `adminsExist()` helper.
- MOD `public/index.php` — enforces/sanitizes `$_POST['role']` on `/register` POST according to config.
- MOD `App/Views/auth/register.php` — UI: role dropdown + optional "Admin invite code".
  - If your register view path differs, use `_partials/register.role.snippet.php`.

## How to apply
1. Copy files into your project root (`calendar.localhost/`) preserving paths.
2. Edit `config/auth.php`:
   - Set `mode` to `invite` (recommended) and change `admin_invite_code`.
   - Or set `mode` to `bootstrap` for one-time first admin signup.
   - Or set `mode` to `dev` for internal/dev environments.
3. Clear OPCache (if enabled) and run:
   ```bash
   composer dump-autoload -o
   ```
4. Test flows:
   - **invite**: registering as `admin` without correct code → role downgraded to `user`.
   - **bootstrap**: first signup with admin → ok; subsequent → 'admin' disabled/downgraded.
   - **dev**: selecting 'admin' works immediately.

Generated: 2025-09-23_082307 Europe/Kyiv
