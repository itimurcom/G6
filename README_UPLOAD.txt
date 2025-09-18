# Auth upload package (additive files only)

This package contains ONLY new files. No existing files are overwritten.

## Where to copy
Copy the contents into your project root, preserving paths:

- auth/auth.php
- login.php
- logout.php
- protected/example.php
- public/css/login.css
- tools/make_user.php
- config/users.json
- config/.htaccess

## After upload
1) Create a user (CLI):
   ```bash
   php tools/make_user.php admin "StrongPassword123!" admin
   ```
2) Protect any page at the very top of PHP:
   ```php
   <?php
   require __DIR__ . '/../auth/auth.php'; // adjust relative path
   auth_require_login();
   ```
3) Login page: /login.php
   Logout: /logout.php
   Example protected page: /protected/example.php

## Notes
- /config is protected by .htaccess (Apache). For Nginx, deny /config in your server config.
- Passwords are stored only as password_hash() values in config/users.json.
