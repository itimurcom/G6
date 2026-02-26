<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Models\EventMessageMysqlRepository;
use App\Models\EventMysqlRepository;
use App\Services\Audit\ActionLogger;

final class ApiEventMessagesController
{
    private EventMessageMysqlRepository $messages;
    private EventMysqlRepository $events;
    private ActionLogger $logger;
    private ?bool $notifyHasPayloadColumn = null;

    public function __construct()
    {
        $this->messages = new EventMessageMysqlRepository();
        $this->events = new EventMysqlRepository();
        $this->logger = new ActionLogger();
    }

    private function json(array $data, int $code = 200): void
    {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            http_response_code($code);
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function parseJson(): ?array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') return [];
        $payload = json_decode($raw, true);
        return is_array($payload) ? $payload : null;
    }

    private function requireCsrf(): bool
    {
        if (\App\Security\Csrf::validateHeader()) {
            return true;
        }
        $this->json([
            'ok'      => false,
            'error'   => 'csrf',
            'message' => 'Invalid or missing CSRF token',
        ], 403);
        return false;
    }

    private function currentUser(): array
    {
        return Auth::user() ?? [];
    }

    private function isAdmin(array $user): bool
    {
        $role = strtolower((string)($user['role'] ?? ''));
        return $role === 'admin' || !empty($user['is_admin']);
    }

    private function requireEvent(string $eventId): ?array
    {
        $eventId = trim($eventId);
        if ($eventId === '') {
            $this->json(['ok' => false, 'error' => 'event_id required'], 400);
            return null;
        }

        try {
            $event = $this->events->getById($eventId);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
            return null;
        }

        if (!$event) {
            $this->json(['ok' => false, 'error' => 'not_found'], 404);
            return null;
        }
        return $event;
    }

    private function currentUserDisplay(array $user): string
    {
        $name = trim((string)($user['name'] ?? ''));
        if ($name !== '') return $name;
        $login = trim((string)($user['login'] ?? ''));
        if ($login !== '') return $login;
        $id = (int)($user['id'] ?? 0);
        return $id > 0 ? ('User #' . $id) : 'Користувач';
    }

    private function messagePreview(string $text, int $limit = 160): string
    {
        $text = str_replace(["\r\n", "\r", "\n", "\t"], ' ', $text);
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
        if ($text === '') return '';

        if (function_exists('mb_strlen') && function_exists('mb_substr')) {
            if (mb_strlen($text, 'UTF-8') <= $limit) return $text;
            return rtrim(mb_substr($text, 0, $limit - 1, 'UTF-8')) . '…';
        }

        if (strlen($text) <= $limit) return $text;
        return rtrim(substr($text, 0, $limit - 1)) . '…';
    }

    private function eventSnapshot(array $event): array
    {
        return [
            'id' => (string)($event['id'] ?? ''),
            'title' => (string)($event['title'] ?? ''),
            'description' => (string)($event['description'] ?? ''),
            'start_date' => (string)($event['start_date'] ?? ''),
            'end_date' => (string)($event['end_date'] ?? ''),
            'time' => (string)($event['time'] ?? ''),
            'owner' => (string)($event['owner'] ?? ''),
            'type' => (string)($event['type'] ?? 'other'),
            'urgent' => !empty($event['urgent']) ? 1 : 0,
            'done' => !empty($event['done']) ? 1 : 0,
        ];
    }

    private function messageSnapshot(?array $row): ?array
    {
        if (!is_array($row)) return null;
        $author = is_array($row['author'] ?? null) ? $row['author'] : [];
        return [
            'id' => (int)($row['id'] ?? 0),
            'event_id' => (string)($row['event_id'] ?? ''),
            'user_id' => (int)($row['user_id'] ?? 0),
            'author_display' => (string)($author['display'] ?? ''),
            'preview' => $this->messagePreview((string)($row['message_text'] ?? '')),
            'created_at' => (string)($row['created_at'] ?? ''),
            'edited_at' => $row['edited_at'] ?? null,
            'deleted_at' => $row['deleted_at'] ?? null,
        ];
    }

    private function auditMessage(string $action, array $event, ?array $message, array $extra = []): void
    {
        try {
            $messageSnap = $this->messageSnapshot($message);
            $meta = [
                'entity_type' => 'event',
                'entity_id' => (string)($event['id'] ?? ''),
                'event_id' => (string)($event['id'] ?? ''),
                'event_title' => (string)($event['title'] ?? ''),
            ];
            if ($messageSnap) {
                $meta['message_id'] = $messageSnap['id'];
                $meta['message_preview'] = $messageSnap['preview'];
                $meta['message_author'] = $messageSnap['author_display'];
                $meta['message_user_id'] = $messageSnap['user_id'];
            }
            $this->logger->log($action, 'success', array_merge($meta, $extra));
        } catch (\Throwable $e) {
            // audit must never break API response
        }
    }

    private function notifyHasPayloadColumn(): bool
    {
        if ($this->notifyHasPayloadColumn !== null) {
            return (bool)$this->notifyHasPayloadColumn;
        }

        try {
            $db = Database::connect();
            $st = $db->prepare(
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

    private function notifyFanout(string $kind, string $eventId, ?array $payload = null): void
    {
        $eventId = trim($eventId);
        $kind = trim($kind);
        if ($eventId === '' || $kind === '') {
            return;
        }

        $repeatableKinds = [
            'event_message_created',
            'event_message_updated',
            'event_message_deleted',
        ];
        if (in_array($kind, $repeatableKinds, true)) {
            $ts = date('His');
            $ms = (int)round((microtime(true) - floor(microtime(true))) * 1000);
            $kind = $kind . '@' . $ts . sprintf('%03d', $ms);
            if (strlen($kind) > 32) {
                $kind = substr($kind, 0, 32);
            }
        }

        try {
            $db = Database::connect();
            $actorId = (int)(Auth::id() ?? 0);
            $stUsers = $db->query('SELECT id FROM users');
            $users = $stUsers ? $stUsers->fetchAll(\PDO::FETCH_ASSOC) : [];
            if (!$users) return;

            if ($this->notifyHasPayloadColumn()) {
                $sql = "INSERT INTO user_notifications (user_id, kind, event_id, actor_user_id, created_at, payload)\n".
                       "VALUES (:uid, :kind, :eid, :actor, NOW(), :payload)\n".
                       "ON DUPLICATE KEY UPDATE seen_at = NULL, created_at = VALUES(created_at), actor_user_id = VALUES(actor_user_id), payload = VALUES(payload)";
                $st = $db->prepare($sql);
                $payloadJson = $payload !== null
                    ? json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    : null;

                foreach ($users as $u) {
                    $uid = (int)($u['id'] ?? 0);
                    if ($uid <= 0) continue;
                    $st->execute([
                        'uid' => $uid,
                        'kind' => $kind,
                        'eid' => $eventId,
                        'actor' => $actorId,
                        'payload' => $payloadJson,
                    ]);
                }
                return;
            }

            $sql = "INSERT INTO user_notifications (user_id, kind, event_id, actor_user_id, created_at)\n".
                   "VALUES (:uid, :kind, :eid, :actor, NOW())\n".
                   "ON DUPLICATE KEY UPDATE seen_at = NULL, created_at = VALUES(created_at), actor_user_id = VALUES(actor_user_id)";
            $st = $db->prepare($sql);
            foreach ($users as $u) {
                $uid = (int)($u['id'] ?? 0);
                if ($uid <= 0) continue;
                $st->execute([
                    'uid' => $uid,
                    'kind' => $kind,
                    'eid' => $eventId,
                    'actor' => $actorId,
                ]);
            }
        } catch (\Throwable $e) {
            // notifications must never break message flow
        }
    }

    public function list(): void
    {
        $eventId = trim((string)($_GET['event_id'] ?? ''));
        $event = $this->requireEvent($eventId);
        if (!$event) {
            return;
        }

        $limit = max(1, min(500, (int)($_GET['limit'] ?? 200)));
        $offset = max(0, (int)($_GET['offset'] ?? 0));
        $includeDeleted = !empty($_GET['include_deleted']) && $this->isAdmin($this->currentUser());

        try {
            $items = $this->messages->listByEvent($eventId, $includeDeleted, $limit, $offset);
            $total = $this->messages->countByEvent($eventId, $includeDeleted);
            $this->json([
                'ok' => true,
                'event_id' => $eventId,
                'items' => $items,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
                'include_deleted' => $includeDeleted,
            ]);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
        }
    }

    public function create(): void
    {
        if (!$this->requireCsrf()) { return; }
        $payload = $this->parseJson();
        if ($payload === null) {
            $this->json(['ok' => false, 'error' => 'invalid json'], 400);
            return;
        }

        $eventId = trim((string)($payload['event_id'] ?? ''));
        $event = $this->requireEvent($eventId);
        if (!$event) {
            return;
        }

        $user = $this->currentUser();
        $userId = (int)($user['id'] ?? 0);
        if ($userId <= 0) {
            $this->json(['ok' => false, 'error' => 'unauthorized'], 401);
            return;
        }

        try {
            $row = $this->messages->create($eventId, $userId, (string)($payload['message_text'] ?? ''));

            $this->auditMessage('event.message.create', $event, $row, [
                'thread_scope' => 'event_sheet',
            ]);
            $this->notifyFanout('event_message_created', $eventId, [
                'event' => $this->eventSnapshot($event),
                'message' => $this->messageSnapshot($row),
                'actor' => [
                    'user_id' => $userId,
                    'display' => $this->currentUserDisplay($user),
                ],
            ]);

            $this->json(['ok' => true, 'message' => $row], 201);
        } catch (\InvalidArgumentException $e) {
            $this->json(['ok' => false, 'error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
        }
    }

    public function update(): void
    {
        if (!$this->requireCsrf()) { return; }
        $payload = $this->parseJson();
        if ($payload === null) {
            $this->json(['ok' => false, 'error' => 'invalid json'], 400);
            return;
        }

        $id = (int)($payload['id'] ?? 0);
        if ($id <= 0) {
            $this->json(['ok' => false, 'error' => 'id required'], 400);
            return;
        }

        $current = $this->messages->getById($id);
        if (!$current) {
            $this->json(['ok' => false, 'error' => 'not_found'], 404);
            return;
        }

        $event = $this->requireEvent((string)($current['event_id'] ?? ''));
        if (!$event) {
            return;
        }

        $user = $this->currentUser();
        $userId = (int)($user['id'] ?? 0);
        $isAdmin = $this->isAdmin($user);
        if ($userId <= 0) {
            $this->json(['ok' => false, 'error' => 'unauthorized'], 401);
            return;
        }
        if (!$isAdmin && (int)($current['user_id'] ?? 0) !== $userId) {
            $this->json(['ok' => false, 'error' => 'forbidden'], 403);
            return;
        }

        try {
            $before = $current;
            $row = $this->messages->updateById($id, (string)($payload['message_text'] ?? ''), $userId);
            if (!$row) {
                $this->json(['ok' => false, 'error' => 'not_found'], 404);
                return;
            }

            $this->auditMessage('event.message.update', $event, $row, [
                'thread_scope' => 'event_sheet',
                'before_preview' => $this->messagePreview((string)($before['message_text'] ?? '')),
                'after_preview' => $this->messagePreview((string)($row['message_text'] ?? '')),
            ]);
            $this->notifyFanout('event_message_updated', (string)($current['event_id'] ?? ''), [
                'event' => $this->eventSnapshot($event),
                'message' => $this->messageSnapshot($row),
                'before' => $this->messageSnapshot($before),
                'actor' => [
                    'user_id' => $userId,
                    'display' => $this->currentUserDisplay($user),
                ],
            ]);

            $this->json(['ok' => true, 'message' => $row]);
        } catch (\InvalidArgumentException $e) {
            $this->json(['ok' => false, 'error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
        }
    }

    public function delete(): void
    {
        if (!$this->requireCsrf()) { return; }
        $payload = $this->parseJson();
        if ($payload === null) {
            $this->json(['ok' => false, 'error' => 'invalid json'], 400);
            return;
        }

        $id = (int)($payload['id'] ?? 0);
        if ($id <= 0) {
            $this->json(['ok' => false, 'error' => 'id required'], 400);
            return;
        }

        $current = $this->messages->getById($id);
        if (!$current) {
            $this->json(['ok' => false, 'error' => 'not_found'], 404);
            return;
        }

        $event = $this->requireEvent((string)($current['event_id'] ?? ''));
        if (!$event) {
            return;
        }

        $user = $this->currentUser();
        $userId = (int)($user['id'] ?? 0);
        $isAdmin = $this->isAdmin($user);
        if ($userId <= 0) {
            $this->json(['ok' => false, 'error' => 'unauthorized'], 401);
            return;
        }
        if (!$isAdmin && (int)($current['user_id'] ?? 0) !== $userId) {
            $this->json(['ok' => false, 'error' => 'forbidden'], 403);
            return;
        }

        try {
            $before = $current;
            $row = $this->messages->softDeleteById($id, $userId);
            if (!$row) {
                $this->json(['ok' => false, 'error' => 'not_found'], 404);
                return;
            }

            $this->auditMessage('event.message.delete', $event, $before, [
                'thread_scope' => 'event_sheet',
                'deleted_message_id' => (int)($before['id'] ?? 0),
                'deleted_message_preview' => $this->messagePreview((string)($before['message_text'] ?? '')),
            ]);
            $this->notifyFanout('event_message_deleted', (string)($current['event_id'] ?? ''), [
                'event' => $this->eventSnapshot($event),
                'message' => $this->messageSnapshot($before),
                'actor' => [
                    'user_id' => $userId,
                    'display' => $this->currentUserDisplay($user),
                ],
            ]);

            $this->json(['ok' => true, 'message' => $row]);
        } catch (\InvalidArgumentException $e) {
            $this->json(['ok' => false, 'error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
        }
    }
}
