<?php
declare(strict_types=1);

namespace App\Controllers\Traits;

use App\Core\Auth;
use App\Services\EventViewHelper;

/**
 * Спільні вимоги ресурсів, привʼязаних до події.
 *
 * Очікує наявність властивості $events з методом getById().
 * Також очікує метод json() (ApiCommonTrait).
 */
trait ApiEventResourceTrait
{
    private function eventResourceCurrentUser(): array
    {
        $user = Auth::user();
        return is_array($user) ? $user : [];
    }

    private function eventResourceOwnerUserId(string $ownerRaw): int
    {
        try {
            $parsed = EventViewHelper::parseOwnerField($ownerRaw);
            if (($parsed['type'] ?? '') === 'user') {
                return (int)($parsed['user_id'] ?? 0);
            }
        } catch (\Throwable $e) {
        }
        return 0;
    }

    protected function canCurrentUserAccessEvent(array $event): bool
    {
        $user = $this->eventResourceCurrentUser();
        $userId = (int)($user['id'] ?? 0);
        if ($userId <= 0) {
            return false;
        }

        $role = strtolower((string)($user['role'] ?? ''));
        $isAdmin = ($role === 'admin') || !empty($user['is_admin']);
        if ($isAdmin) {
            return true;
        }

        $authorId = (int)($event['user_id'] ?? 0);
        if ($authorId > 0 && $authorId === $userId) {
            return true;
        }

        $assigneeId = $this->eventResourceOwnerUserId((string)($event['owner'] ?? ''));
        return $assigneeId > 0 && $assigneeId === $userId;
    }

    protected function requireEvent(string $eventId): ?array
    {
        $eventId = trim($eventId);
        if ($eventId === '') {
            $this->json(['ok' => false, 'error' => 'event_id required'], 400);
            return null;
        }

        try {
            /** @var mixed $events */
            $events = $this->events;
            $event = $events->getById($eventId);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
            return null;
        }

        if (!$event) {
            $this->json(['ok' => false, 'error' => 'not_found'], 404);
            return null;
        }

        if (!$this->canCurrentUserAccessEvent((array)$event)) {
            $this->json(['ok' => false, 'error' => 'forbidden'], 403);
            return null;
        }
        return $event;
    }
}
