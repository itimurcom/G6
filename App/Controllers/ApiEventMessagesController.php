<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Models\DocumentMysqlRepository;
use App\Models\EventMessageMysqlRepository;
use App\Models\EventMysqlRepository;
use App\Services\EventViewHelper;
use App\Services\Audit\ActionLogger;
use App\Services\UserNotificationWriter;
use App\Controllers\Traits\ApiCommonTrait;
use App\Controllers\Traits\ApiEventResourceTrait;

final class ApiEventMessagesController
{
    use ApiCommonTrait;
    use ApiEventResourceTrait;

    private EventMessageMysqlRepository $messages;
    private DocumentMysqlRepository $documents;
    private EventMysqlRepository $events;
    private ActionLogger $logger;

    public function __construct()
    {
        $this->messages = new EventMessageMysqlRepository();
        $this->documents = new DocumentMysqlRepository();
        $this->events = new EventMysqlRepository();
        $this->logger = new ActionLogger();
    }

    // json/parseJson/requireCsrf/currentUser/isAdmin/currentUserDisplay -> ApiCommonTrait

    // requireEvent() is provided by ApiEventResourceTrait

    // currentUserDisplay() moved to trait

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


    /** @return array<int> */
    private function collectNotificationUserIds(string $eventId, int $actorId): array
    {
        $ids = [];
        if ($actorId > 0) {
            $ids[$actorId] = true;
        }

        try {
            $event = $this->events->getById($eventId);
            if (is_array($event)) {
                $authorId = (int)($event['user_id'] ?? 0);
                if ($authorId > 0) {
                    $ids[$authorId] = true;
                }

                $ownerRaw = (string)($event['owner'] ?? '');
                if ($ownerRaw !== '') {
                    try {
                        $owner = EventViewHelper::parseOwnerField($ownerRaw);
                        if (($owner['type'] ?? '') === 'user') {
                            $assigneeId = (int)($owner['user_id'] ?? 0);
                            if ($assigneeId > 0) {
                                $ids[$assigneeId] = true;
                            }
                        }
                    } catch (\Throwable $e) {
                    }
                }
            }
        } catch (\Throwable $e) {
        }

        try {
            $db = Database::connect();
            $st = $db->prepare('SELECT DISTINCT user_id FROM event_messages WHERE event_id = :eid AND deleted_at IS NULL AND user_id IS NOT NULL AND user_id > 0');
            $st->execute(['eid' => $eventId]);
            foreach (($st->fetchAll(\PDO::FETCH_ASSOC) ?: []) as $row) {
                $uid = (int)($row['user_id'] ?? 0);
                if ($uid > 0) {
                    $ids[$uid] = true;
                }
            }
        } catch (\Throwable $e) {
        }

        $out = array_map('intval', array_keys($ids));
        sort($out, SORT_NUMERIC);
        return $out;
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
            $userIds = $this->collectNotificationUserIds($eventId, $actorId);
            if (!$userIds) return;

            $writer = new UserNotificationWriter($db);
            $writer->upsertMany($userIds, $kind, $eventId, $actorId, $payload);
        } catch (\Throwable $e) {
            // notifications must never break message flow
            error_log('[activity-notify] ApiEventMessagesController::notifyFanout failed for kind=' . $kind . ' event_id=' . $eventId . ': ' . $e->getMessage());
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
            $db = Database::connect();
            $db->beginTransaction();
            try {
                $deletedDocuments = $this->documents->softDeleteByMessageId($id, $userId);
                $row = $this->messages->softDeleteById($id, $userId);
                if (!$row) {
                    $db->rollBack();
                    $this->json(['ok' => false, 'error' => 'not_found'], 404);
                    return;
                }
                $db->commit();
            } catch (\Throwable $txe) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                throw $txe;
            }

            $this->auditMessage('event.message.delete', $event, $before, [
                'thread_scope' => 'event_sheet',
                'deleted_message_id' => (int)($before['id'] ?? 0),
                'deleted_message_preview' => $this->messagePreview((string)($before['message_text'] ?? '')),
                'deleted_document_count' => $deletedDocuments,
            ]);
            $this->notifyFanout('event_message_deleted', (string)($current['event_id'] ?? ''), [
                'event' => $this->eventSnapshot($event),
                'message' => $this->messageSnapshot($before),
                'actor' => [
                    'user_id' => $userId,
                    'display' => $this->currentUserDisplay($user),
                ],
                'deleted_document_count' => $deletedDocuments,
            ]);

            $this->json(['ok' => true, 'message' => $row, 'deleted_document_count' => $deletedDocuments]);
        } catch (\InvalidArgumentException $e) {
            $this->json(['ok' => false, 'error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
        }
    }
}
