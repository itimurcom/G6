<?php
declare(strict_types=1);

namespace App\Services;

use PDO;

/**
 * UserNotificationWriter
 *
 * Small persistence helper for user_notifications writes.
 *
 * Scope intentionally narrow:
 *  - does not choose recipients;
 *  - does not generate kind suffixes;
 *  - does not catch errors;
 *  - only performs upsert with optional payload compatibility fallback.
 */
final class UserNotificationWriter
{
    private PDO $db;
    private ?bool $hasPayloadColumn = null;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function upsertOne(int $userId, string $kind, string $eventId, ?int $actorUserId = null, ?array $payload = null): void
    {
        $this->upsertMany([$userId], $kind, $eventId, $actorUserId, $payload);
    }

    /**
     * @param array<int,mixed> $userIds
     */
    public function upsertMany(array $userIds, string $kind, string $eventId, ?int $actorUserId = null, ?array $payload = null): void
    {
        $eventId = trim($eventId);
        $kind = trim($kind);
        if ($eventId === '' || $kind === '') {
            return;
        }

        $normalizedUserIds = [];
        foreach ($userIds as $rawUserId) {
            $userId = (int)$rawUserId;
            if ($userId > 0) {
                $normalizedUserIds[$userId] = true;
            }
        }
        if (!$normalizedUserIds) {
            return;
        }

        $actor = ($actorUserId !== null && $actorUserId > 0) ? $actorUserId : null;

        if ($this->hasPayloadColumn()) {
            $sql = "INSERT INTO user_notifications (user_id, kind, event_id, actor_user_id, created_at, payload)
".
                   "VALUES (:uid, :kind, :eid, :actor, NOW(), :payload)
".
                   "ON DUPLICATE KEY UPDATE seen_at = NULL, created_at = VALUES(created_at), actor_user_id = VALUES(actor_user_id), payload = VALUES(payload)";
            $st = $this->db->prepare($sql);
            $payloadJson = $payload !== null
                ? json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                : null;

            foreach (array_keys($normalizedUserIds) as $userId) {
                $st->execute([
                    'uid' => $userId,
                    'kind' => $kind,
                    'eid' => $eventId,
                    'actor' => $actor,
                    'payload' => $payloadJson,
                ]);
            }
            return;
        }

        $sql = "INSERT INTO user_notifications (user_id, kind, event_id, actor_user_id, created_at)
".
               "VALUES (:uid, :kind, :eid, :actor, NOW())
".
               "ON DUPLICATE KEY UPDATE seen_at = NULL, created_at = VALUES(created_at), actor_user_id = VALUES(actor_user_id)";
        $st = $this->db->prepare($sql);
        foreach (array_keys($normalizedUserIds) as $userId) {
            $st->execute([
                'uid' => $userId,
                'kind' => $kind,
                'eid' => $eventId,
                'actor' => $actor,
            ]);
        }
    }

    private function hasPayloadColumn(): bool
    {
        if ($this->hasPayloadColumn !== null) {
            return (bool)$this->hasPayloadColumn;
        }

        try {
            $st = $this->db->prepare(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
".
                "WHERE TABLE_SCHEMA = DATABASE()
".
                "  AND TABLE_NAME = 'user_notifications'
".
                "  AND COLUMN_NAME = 'payload'"
            );
            $st->execute();
            $this->hasPayloadColumn = ((int)$st->fetchColumn() > 0);
        } catch (\Throwable $e) {
            $this->hasPayloadColumn = false;
        }

        return (bool)$this->hasPayloadColumn;
    }
}
