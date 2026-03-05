<?php
declare(strict_types=1);

namespace App\Controllers\Traits;

/**
 * Спільні вимоги ресурсів, привʼязаних до повідомлень події.
 *
 * Очікує наявність властивості $messages з методом getById().
 * Також очікує метод json() (ApiCommonTrait).
 */
trait ApiMessageResourceTrait
{
    protected function requireMessage(int $messageId): ?array
    {
        if ($messageId <= 0) {
            $this->json(['ok' => false, 'error' => 'message_id required'], 400);
            return null;
        }
        try {
            /** @var mixed $messages */
            $messages = $this->messages;
            $row = $messages->getById($messageId);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
            return null;
        }
        if (!$row || !empty($row['deleted_at'])) {
            $this->json(['ok' => false, 'error' => 'message_not_found'], 404);
            return null;
        }
        return $row;
    }
}
