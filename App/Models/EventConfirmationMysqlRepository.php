<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;

/**
 * EventConfirmationMysqlRepository
 *
 * Stores "accept on execution" confirmations for event assignee (owner user).
 *
 * One event can have multiple confirmations over time (e.g., assignee changed),
 * but only one PENDING confirmation per (event_id, assignee_user_id) is expected.
 */
final class EventConfirmationMysqlRepository
{
    private PDO $db;
    private static bool $schemaEnsured = false;
    private static bool $notifySchemaEnsured = false;
    private ?bool $notifyHasPayloadColumn = null;

    public function __construct()
    {
        $this->db = Database::connect();
        $this->ensureSchema();
    }

        private function ensureSchema(): void
    {
        if (self::$schemaEnsured) return;

        // Create base table (new installs)
        $sql = "CREATE TABLE IF NOT EXISTS `event_confirmations` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `event_id` VARCHAR(32) NOT NULL,
            `assignee_user_id` INT NOT NULL,
            `created_by_user_id` INT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `accepted_at` DATETIME NULL,
            `accepted_by_user_id` INT NULL,
            `viewed_at` DATETIME NULL,
            `canceled_at` DATETIME NULL,
            `canceled_by_user_id` INT NULL,
            `pending_slot` TINYINT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_event` (`event_id`),
            KEY `idx_assignee_pending` (`assignee_user_id`, `pending_slot`, `created_at`),
            UNIQUE KEY `ux_pending_event_assignee` (`event_id`, `assignee_user_id`, `pending_slot`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

        $this->db->exec($sql);

        // Ensure notification table exists (some installs may not have executed the SQL migration yet)
        $this->ensureNotifySchema();

        // Migrate older schema (if table existed without pending_slot / proper unique)
        try {
            $st = $this->db->prepare(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS\n".
                "WHERE TABLE_SCHEMA = DATABASE()\n".
                "  AND TABLE_NAME = 'event_confirmations'\n".
                "  AND COLUMN_NAME = 'pending_slot'"
            );
            $st->execute();
            $hasPendingSlot = ((int)$st->fetchColumn() > 0);
            if (!$hasPendingSlot) {
                $this->db->exec("ALTER TABLE event_confirmations ADD COLUMN pending_slot TINYINT NULL");
            }

            // Ensure unique index ux_pending_event_assignee exists and uses pending_slot
            $st2 = $this->db->prepare(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS\n".
                "WHERE TABLE_SCHEMA = DATABASE()\n".
                "  AND TABLE_NAME = 'event_confirmations'\n".
                "  AND INDEX_NAME = 'ux_pending_event_assignee'"
            );
            $st2->execute();
            $hasUx = ((int)$st2->fetchColumn() > 0);

            if ($hasUx) {
                // Drop and recreate to be sure it matches (safe even if already correct)
                try { $this->db->exec("ALTER TABLE event_confirmations DROP INDEX ux_pending_event_assignee"); } catch (\Throwable $e) { }
            }
            $this->db->exec("ALTER TABLE event_confirmations ADD UNIQUE KEY ux_pending_event_assignee (event_id, assignee_user_id, pending_slot)");

            // Backfill pending_slot for existing pending rows (accepted/canceled remain NULL)
            $this->db->exec("UPDATE event_confirmations SET pending_slot = 1 WHERE accepted_at IS NULL AND canceled_at IS NULL");
            $this->db->exec("UPDATE event_confirmations SET pending_slot = NULL WHERE accepted_at IS NOT NULL OR canceled_at IS NOT NULL");
        } catch (\Throwable $e) {
            // Migration failure should not block app
        }

        self::$schemaEnsured = true;
    }

    private function ensureNotifySchema(): void
    {
        if (self::$notifySchemaEnsured) return;

        try {
            $sql = "CREATE TABLE IF NOT EXISTS `user_notifications` (
              `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
              `user_id` INT NOT NULL,
              `kind` VARCHAR(32) NOT NULL DEFAULT 'event_new',
              `event_id` VARCHAR(32) NOT NULL,
              `actor_user_id` INT NULL,
              `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              `seen_at` DATETIME NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `ux_user_kind_event` (`user_id`, `kind`, `event_id`),
              KEY `idx_user_seen` (`user_id`, `seen_at`),
              KEY `idx_event_id` (`event_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
            $this->db->exec($sql);

            // If table existed without the UNIQUE key, ensure it exists.
            try {
                $st = $this->db->prepare(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS\n".
                    "WHERE TABLE_SCHEMA = DATABASE()\n".
                    "  AND TABLE_NAME = 'user_notifications'\n".
                    "  AND INDEX_NAME = 'ux_user_kind_event'"
                );
                $st->execute();
                $hasUx = ((int)$st->fetchColumn() > 0);
                if (!$hasUx) {
                    try { $this->db->exec("ALTER TABLE user_notifications ADD UNIQUE KEY ux_user_kind_event (user_id, kind, event_id)"); } catch (\Throwable $e) { }
                }
            } catch (\Throwable $e) {
                // ignore
            }
        } catch (\Throwable $e) {
            // Do not block the app if schema cannot be created
        }

        self::$notifySchemaEnsured = true;
    }

private function notifyHasPayloadColumn(): bool
    {
        if ($this->notifyHasPayloadColumn !== null) {
            return (bool)$this->notifyHasPayloadColumn;
        }

        try {
            $st = $this->db->prepare(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS\n".
                "WHERE TABLE_SCHEMA = DATABASE()\n".
                "  AND TABLE_NAME = 'user_notifications'\n".
                "  AND COLUMN_NAME = 'payload'"
            );
            $st->execute();
            $this->notifyHasPayloadColumn = ((int)$st->fetchColumn() > 0);
        } catch (\Throwable $e) {
            $this->notifyHasPayloadColumn = false;
        }

        return (bool)$this->notifyHasPayloadColumn;
    }

    /**
     * Create (or refresh) pending confirmation for assignee.
     * Returns the pending row (id, created_at) if created/refreshed.
     */
    public function ensurePending(string $eventId, int $assigneeUserId, ?int $createdByUserId = null, ?array $notifyPayload = null): array
    {
        $eventId = trim($eventId);
        if ($eventId === '') throw new \InvalidArgumentException('event_id required');
        if ($assigneeUserId <= 0) throw new \InvalidArgumentException('assignee_user_id required');

        // Cancel any other pending confirmations for this event (other assignees)
        $sqlCancel = "UPDATE event_confirmations
                      SET canceled_at = NOW(), canceled_by_user_id = :actor, pending_slot = NULL
                      WHERE event_id = :eid AND accepted_at IS NULL AND canceled_at IS NULL AND assignee_user_id <> :uid";
        $stCancel = $this->db->prepare($sqlCancel);
        $stCancel->execute([
            'actor' => ($createdByUserId && $createdByUserId > 0) ? $createdByUserId : null,
            'eid' => $eventId,
            'uid' => $assigneeUserId,
        ]);

        // If assignee changed, hide stale execution-confirm notifications from previous assignees.
        // (They must not be able to "Прийняв" a task that is no longer assigned to them.)
        try {
            $stHide = $this->db->prepare(
                "UPDATE user_notifications\n".
                "SET seen_at = NOW()\n".
                "WHERE kind = :kind AND event_id = :eid AND user_id <> :uid AND seen_at IS NULL"
            );
            $stHide->execute([
                'kind' => 'event_exec_confirm',
                'eid' => $eventId,
                'uid' => $assigneeUserId,
            ]);
        } catch (\Throwable $e) {
            // ignore
        }

        // Insert new pending if absent; otherwise refresh created_at and reset viewed/seen
        $sql = "INSERT INTO event_confirmations (event_id, assignee_user_id, created_by_user_id, created_at, pending_slot)
                VALUES (:eid, :uid, :actor, NOW(), 1)
                ON DUPLICATE KEY UPDATE
                    created_by_user_id = VALUES(created_by_user_id),
                    created_at = VALUES(created_at),
                    viewed_at = NULL,
                    accepted_at = NULL,
                    accepted_by_user_id = NULL,
                    canceled_at = NULL,
                    canceled_by_user_id = NULL,
                    pending_slot = 1";
        $st = $this->db->prepare($sql);
        $st->execute([
            'eid' => $eventId,
            'uid' => $assigneeUserId,
            'actor' => ($createdByUserId && $createdByUserId > 0) ? $createdByUserId : null,
        ]);

        $id = (int)$this->db->lastInsertId();
        if ($id <= 0) {
            // fetch existing pending id
            $stGet = $this->db->prepare("SELECT id, created_at FROM event_confirmations WHERE event_id = :eid AND assignee_user_id = :uid AND pending_slot = 1 AND accepted_at IS NULL AND canceled_at IS NULL ORDER BY id DESC LIMIT 1");
            $stGet->execute(['eid'=>$eventId,'uid'=>$assigneeUserId]);
            $row = $stGet->fetch(PDO::FETCH_ASSOC);
            $id = (int)($row['id'] ?? 0);
            $createdAt = (string)($row['created_at'] ?? '');
        } else {
            $createdAt = '';
        }

        // Create/refresh a persistent notification only for this user
        $this->notifyAssignee($assigneeUserId, $eventId, $createdByUserId, $notifyPayload);

        return ['id' => $id, 'event_id' => $eventId, 'assignee_user_id' => $assigneeUserId, 'created_at' => $createdAt];
    }

    /**
     * Accept pending confirmation for assignee (only the assignee can accept).
     */
    public function accept(string $eventId, int $assigneeUserId): array
    {
        $eventId = trim($eventId);
        if ($eventId === '') throw new \InvalidArgumentException('event_id required');
        if ($assigneeUserId <= 0) throw new \InvalidArgumentException('assignee_user_id required');

        $sql = "UPDATE event_confirmations
                SET accepted_at = NOW(),
                    accepted_by_user_id = :uid_set,
                    viewed_at = NOW(),
                    pending_slot = NULL
                WHERE event_id = :eid AND assignee_user_id = :uid_where AND pending_slot = 1 AND accepted_at IS NULL AND canceled_at IS NULL";
        $st = $this->db->prepare($sql);
        $st->execute(['eid'=>$eventId, 'uid_set'=>$assigneeUserId, 'uid_where'=>$assigneeUserId]);

        if ($st->rowCount() <= 0) {
            return ['ok' => false, 'error' => 'not_pending'];
        }

        // mark notification as seen for this user (must not break accept)
        $notifySeen = true;
        try {
            $this->markNotifySeen($assigneeUserId, $eventId);
        } catch (\Throwable $e) {
            $notifySeen = false;
        }

        $stGet = $this->db->prepare("SELECT accepted_at FROM event_confirmations WHERE event_id = :eid AND assignee_user_id = :uid ORDER BY id DESC LIMIT 1");
        $stGet->execute(['eid'=>$eventId, 'uid'=>$assigneeUserId]);
        $row = $stGet->fetch(PDO::FETCH_ASSOC);

        return ['ok' => true, 'accepted_at' => (string)($row['accepted_at'] ?? ''), 'notify_seen' => $notifySeen];
    }

    public function listPendingForUser(int $userId, int $limit = 200): array
    {
        if ($userId <= 0) return [];
        $limit = max(1, min(500, $limit));
        $sql = "SELECT id, event_id, assignee_user_id, created_by_user_id, created_at
                FROM event_confirmations
                WHERE assignee_user_id = :uid AND pending_slot = 1 AND accepted_at IS NULL AND canceled_at IS NULL
                ORDER BY created_at DESC
                LIMIT {$limit}";
        $st = $this->db->prepare($sql);
        $st->execute(['uid'=>$userId]);
        return $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function cancelPendingForEvent(string $eventId, ?int $actorUserId = null): void
    {
        $eventId = trim($eventId);
        if ($eventId === '') return;
        $st = $this->db->prepare("UPDATE event_confirmations SET canceled_at = NOW(), canceled_by_user_id = :actor, pending_slot = NULL WHERE event_id = :eid AND accepted_at IS NULL AND canceled_at IS NULL");
        $st->execute(['eid'=>$eventId, 'actor'=> ($actorUserId && $actorUserId>0) ? $actorUserId : null]);

        // Also hide the persistent notification for all users for this event.
        try {
            $stHide = $this->db->prepare(
                "UPDATE user_notifications\n".
                "SET seen_at = NOW()\n".
                "WHERE kind = :kind AND event_id = :eid AND seen_at IS NULL"
            );
            $stHide->execute([
                'kind' => 'event_exec_confirm',
                'eid' => $eventId,
            ]);
        } catch (\Throwable $e) {
            // ignore
        }
    }

    private function notifyAssignee(int $assigneeUserId, string $eventId, ?int $actorId = null, ?array $payload = null): void
    {
        $kind = 'event_exec_confirm';
        if ($this->notifyHasPayloadColumn()) {
            $sql = "INSERT INTO user_notifications (user_id, kind, event_id, actor_user_id, created_at, payload)
                    VALUES (:uid, :kind, :eid, :actor, NOW(), :payload)
                    ON DUPLICATE KEY UPDATE seen_at = NULL, created_at = VALUES(created_at), actor_user_id = VALUES(actor_user_id), payload = VALUES(payload)";
            $st = $this->db->prepare($sql);
            $payloadJson = $payload !== null ? json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
            $st->execute([
                'uid' => $assigneeUserId,
                'kind' => $kind,
                'eid' => $eventId,
                'actor' => ($actorId && $actorId > 0) ? $actorId : null,
                'payload' => $payloadJson,
            ]);
            return;
        }

        $sql = "INSERT INTO user_notifications (user_id, kind, event_id, actor_user_id, created_at)
                VALUES (:uid, :kind, :eid, :actor, NOW())
                ON DUPLICATE KEY UPDATE seen_at = NULL, created_at = VALUES(created_at), actor_user_id = VALUES(actor_user_id)";
        $st = $this->db->prepare($sql);
        $st->execute([
            'uid' => $assigneeUserId,
            'kind' => $kind,
            'eid' => $eventId,
            'actor' => ($actorId && $actorId > 0) ? $actorId : null,
        ]);
    }

    private function markNotifySeen(int $assigneeUserId, string $eventId): void
    {
        $sql = "UPDATE user_notifications SET seen_at = NOW()
                WHERE user_id = :uid AND kind = :kind AND event_id = :eid";
        $st = $this->db->prepare($sql);
        $st->execute([
            'uid' => $assigneeUserId,
            'kind' => 'event_exec_confirm',
            'eid' => $eventId,
        ]);
    }
}
