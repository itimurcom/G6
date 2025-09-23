# Hotfix — Duplicate `use App\Core\Auth` alias (P0 guard)

This hotfix replaces `public/index.php` guard block to use **fully-qualified class names** instead of `use` imports, to avoid:
> Fatal error: Cannot use App\Core\Auth as Auth because the name is already in use

## Apply
1. Copy `public/index.php` from this archive into your project (`calendar.localhost/public/index.php`), replacing the file.
2. No other files changed.
3. Test any POST endpoint — error should be gone.

Generated at: 2025-09-23_080707 (Europe/Kyiv)
