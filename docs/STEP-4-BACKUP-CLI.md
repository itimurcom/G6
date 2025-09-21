
# Step 4 — CLI Backup/Restore/Repair (без змін API)

Цей крок додає **CLI-утиліти** для резервних копій, відновлення та «ремонту» стора. **ЖОДНИХ змін у діючому API** — усе працює як і раніше.

## Файли
- `bin/calendar-backup.php` — робить бекап `db.json` у `storage/backups`, підтримує стиснення `gz` і ротацію (daily/weekly/monthly).
- `bin/calendar-restore.php` — відновлює з файлу (json або json.gz) у робочий `db.json`, з автозбереженням `.bak-YYYYmmdd-HHMMSS`.
- `bin/calendar-repair.php` — локально виконує normalize+dedupe так само, як `/api/repair` (без HTTP).

> Всі скрипти вимагають `vendor/autoload.php` та використовують `App\Models\EventStore`.

## Використання

### Бекап
```bash
php bin/calendar-backup.php   --source=storage/data/db.json   --dest=storage/backups   --compress=gz   --keep-daily=7 --keep-weekly=8 --keep-monthly=6
# Дивитись без запису:
php bin/calendar-backup.php --dry-run
```
Вивід — JSON із шляхом створеного файлу та діями ротації.

### Відновлення
```bash
# dry-run (перевірити)
php bin/calendar-restore.php --file storage/backups/db-20250920-101500.json.gz --dry-run

# застосувати
php bin/calendar-restore.php --file storage/backups/db-20250920-101500.json.gz
```
Скрипт робить бекап поточного файлу як `db.json.bak-YYYYmmdd-HHMMSS` і пише нові дані **атомарно** через `EventStore::write()`.

### Ремонт (normalize+dedupe)
```bash
# сухий прогін
php bin/calendar-repair.php

# застосувати зміни
php bin/calendar-repair.php --apply
```

## Cron-приклади
```cron
# Щоденний бекап о 02:10
10 2 * * * php /var/www/html/calendar.localhost/bin/calendar-backup.php >> /var/www/html/calendar.localhost/storage/logs/backup.cron.log 2>&1

# Щотижневий «ремонт» у неділю о 03:00 (dry-run)
0 3 * * 0 php /var/www/html/calendar.localhost/bin/calendar-repair.php >> /var/www/html/calendar.localhost/storage/logs/repair.cron.log 2>&1
# Або застосувати:
# 0 3 * * 0 php /var/www/html/calendar.localhost/bin/calendar-repair.php --apply >> /var/www/html/calendar.localhost/storage/logs/repair.cron.log 2>&1
```

## Нотатки
- **API експорту/імпорту залишено без змін.** Нові CLI — це доповнення для DevOps.
- Ротація: зберігаються останні `N` **денних** бекапів, потім `N` **тижневих** (ISO week), далі `N` **місячних**. Решта — видаляється.
- Формат бекапу: `db-YYYYmmdd-HHMMSS.json[.gz]`.
- Усі скрипти повертають **JSON** на stdout та код завершення `0`/`≠0`.
