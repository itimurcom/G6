# Admin tools (v4) — supports {'rows':[...]} structure

Now detects your current users.json shape (with `rows`) and works out of the box.

## Examples
```bash
php bin/user-promote.php --list
php bin/user-promote.php --id 1 --role admin
php bin/user-promote.php --email info@itimur.com --role=admin
```
- Preserves original JSON, including `last_id`
- Creates a timestamped backup before writing

Generated at: 2025-09-23_084633 Europe/Kyiv
