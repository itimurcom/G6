# Users module (MVP, file-based)

This patch adds a minimal session + auth system using a JSON file at `storage/data/users.json`.

## New files

- `App/Core/Session.php` — safe session wrapper
- `App/Core/Auth.php` — simple auth facade
- `App/Models/UserRepositoryInterface.php`
- `App/Models/UserFileRepository.php`
- `App/Controllers/AuthController.php`
- `App/Views/auth/login.php`
- `App/Views/auth/register.php`

## Wire routes (edit `public/index.php`)

Add near other routes:

```php
use App\Controllers\AuthController;
use App\Core\Auth;

// Auth pages
$router->get('/login',    [AuthController::class, 'loginForm']);
$router->post('/login',   [AuthController::class, 'login']);
$router->get('/register', [AuthController::class, 'registerForm']);
$router->post('/register',[AuthController::class, 'register']);
$router->post('/logout',  [AuthController::class, 'logout']);

// Protect cabinet
$router->get('/cabinet', function($req){
    if (!\App\Core\Auth::check()) { header('Location: /login', true, 302); return ''; }
    return (new \App\Controllers\CabinetController())->cabinet($req);
});
```

## Attach user_id to events

Optionally, default `user_id` when creating events on the server side (`App/Models/FileEventRepository.php`, in `create()`):

```php
$userId = \App\Core\Auth::id() ?? 0;
$event['user_id'] = $event['user_id'] ?? $userId;
```

And filter by current user in `search()` if you want per-user isolation:

```php
$currentUid = \App\Core\Auth::id();
if ($currentUid !== null && isset($filters['user_id'])) {
    // enforce current user
    $filters['user_id'] = $currentUid;
}
```

> Frontend currently sets `user_id: 0`. You may remove that so the server injects the real user id.

## Roadmap to MySQL

- Add `App/Core/Database.php` (PDO) and `.env` with DB creds (or `config/db.php`).
- Implement `UserMysqlRepository` with the same interface.
- Migrate users to a `users` table:

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
Then swap the repo in `Auth`:

```php
// self::$repo = new UserMysqlRepository(Database::pdo());
```

## Security notes

- Uses `password_hash()/verify()` (bcrypt/argon2id depending on PHP build).
- Session cookie: HttpOnly + SameSite=Lax (+Secure on HTTPS).
- For CSRF, add a token to forms and verify it in POST handlers.
- Rate-limit login attempts if exposing publicly.
