#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="../backups/"
KEEP_DAYS=21

DB_NAME="g6"
DB_USER="user"
DB_PASS="WsxCde765"
DB_HOST="127.0.0.1"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

TS="$(date +%F_%H%M%S)"
OUT="$BACKUP_DIR/${DB_NAME}_${TS}.sql.gz"

mysqldump \
  --host="$DB_HOST" \
  --user="$DB_USER" \
  --password="$DB_PASS" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  "$DB_NAME" | gzip -9 > "$OUT"

find "$BACKUP_DIR" -type f -name "${DB_NAME}_*.sql.gz" -mtime "+$KEEP_DAYS" -delete
