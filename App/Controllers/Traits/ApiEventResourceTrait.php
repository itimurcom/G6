<?php
declare(strict_types=1);

namespace App\Controllers\Traits;

/**
 * Спільні вимоги ресурсів, привʼязаних до події.
 *
 * Очікує наявність властивості $events з методом getById().
 * Також очікує метод json() (ApiCommonTrait).
 */
trait ApiEventResourceTrait
{
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
        return $event;
    }
}
