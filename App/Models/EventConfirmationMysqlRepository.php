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

    public function __construct()
    {
        $this->db = Database::connect();
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
