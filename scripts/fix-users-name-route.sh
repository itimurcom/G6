#!/usr/bin/env bash
set -euo pipefail

# Папка проекту = поточна
ROOT="$(pwd)"
FILE="$ROOT/public/index.php"
TMP="$FILE.__tmp__"

if [[ ! -f "$FILE" ]]; then
  echo "Error: public/index.php not found. Run this from the project root." >&2
  exit 1
fi

# 1) Приберемо будь-які існуючі входження /api/users/name (включно з поламаними)
# Робимо бекап один раз
cp -n "$FILE" "$FILE.bak" 2>/dev/null || true

# Видалити будь-які рядки з /api/users/name
awk '!/\/api\/users\/name/' "$FILE" > "$TMP" && mv "$TMP" "$FILE"

# 2) Вставимо ПРАВИЛЬНИЙ рядок після завершеного /api/users/get (перший збіг)
# шукати повний виклик, який закінчується );
INSERT="$router->get('/api/users/name',         [\\App\\Controllers\\ApiUserNameController::class, 'name']);"

awk -v INS="$INSERT" '
  BEGIN { inserted=0 }
  {
    print $0
    if (inserted==0 && $0 ~ /\$router->get\(..\/api\/users\/get../ && $0 ~ /\)\s*;\s*$/) {
      print INS
      inserted=1
    }
  }
  END {
    if (inserted==0) {
      # якщо не знайшли /api/users/get, тоді просто додаємо у кінець
      print INS
    }
  }
' "$FILE" > "$TMP" && mv "$TMP" "$FILE"

echo "Done. Route fixed in public/index.php"
