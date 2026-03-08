<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Models\DocumentMysqlRepository;
use App\Models\EventMessageMysqlRepository;
use App\Models\EventMysqlRepository;
use App\Models\AppSettingMysqlRepository;
use App\Services\Audit\ActionLogger;
use App\Controllers\Traits\ApiCommonTrait;
use App\Controllers\Traits\ApiEventResourceTrait;
use App\Controllers\Traits\ApiMessageResourceTrait;

final class ApiDocumentsController
{
    use ApiCommonTrait;
    use ApiEventResourceTrait;
    use ApiMessageResourceTrait;

    private DocumentMysqlRepository $documents;
    private EventMessageMysqlRepository $messages;
    private EventMysqlRepository $events;
    private AppSettingMysqlRepository $settings;
    private ActionLogger $logger;

    public function __construct()
    {
        $this->documents = new DocumentMysqlRepository();
        $this->messages = new EventMessageMysqlRepository();
        $this->events = new EventMysqlRepository();
        $this->settings = new AppSettingMysqlRepository();
        $this->logger = new ActionLogger();
    }

    // json/parseJson/requireCsrf/currentUser/isAdmin/currentUserDisplay -> ApiCommonTrait

    // requireEvent()/requireMessage() provided by traits

    private function getUploadMaxFileSizeMb(): int
    {
        $max = $this->settings->getInt('upload.max_file_mb', 100);
        $max = (int)$max;
        if ($max < 1) $max = 1;
        if ($max > 1024) $max = 1024;
        return $max;
    }

    private function getUploadMaxFileSizeBytes(): int
    {
        return $this->getUploadMaxFileSizeMb() * 1024 * 1024;
    }

    /** @return array<int,array<string,mixed>> */
    private function collectUploadedFiles(): array
    {
        $buckets = [];
        foreach ($_FILES as $field => $spec) {
            if (!is_array($spec) || !isset($spec['name'])) {
                continue;
            }
            $normalized = $this->normalizeFilesSpec($spec, (string)$field);
            foreach ($normalized as $row) {
                $buckets[] = $row;
            }
        }
        return $buckets;
    }

    /** @return array<int,array<string,mixed>> */
    private function normalizeFilesSpec(array $spec, string $field): array
    {
        $name = $spec['name'] ?? null;
        $type = $spec['type'] ?? null;
        $tmp = $spec['tmp_name'] ?? null;
        $error = $spec['error'] ?? null;
        $size = $spec['size'] ?? null;

        if (is_array($name)) {
            $out = [];
            $count = count($name);
            for ($i = 0; $i < $count; $i++) {
                $out[] = [
                    'field' => $field,
                    'name' => (string)($name[$i] ?? ''),
                    'type' => (string)($type[$i] ?? ''),
                    'tmp_name' => (string)($tmp[$i] ?? ''),
                    'error' => (int)($error[$i] ?? UPLOAD_ERR_NO_FILE),
                    'size' => (int)($size[$i] ?? 0),
                ];
            }
            return $out;
        }

        return [[
            'field' => $field,
            'name' => (string)$name,
            'type' => (string)$type,
            'tmp_name' => (string)$tmp,
            'error' => (int)$error,
            'size' => (int)$size,
        ]];
    }

    private function uploadErrorMessage(int $code): string
    {
        return match ($code) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Файл перевищує серверне обмеження розміру.',
            UPLOAD_ERR_PARTIAL => 'Файл завантажено не повністю.',
            UPLOAD_ERR_NO_FILE => 'Файл не вибрано.',
            UPLOAD_ERR_NO_TMP_DIR => 'Відсутня тимчасова директорія PHP.',
            UPLOAD_ERR_CANT_WRITE => 'Не вдалося записати файл на диск.',
            UPLOAD_ERR_EXTENSION => 'Завантаження перервано PHP-розширенням.',
            default => 'Помилка завантаження файлу.',
        };
    }

    private function detectMime(string $tmpPath, string $clientType): string
    {
        $mime = '';
        if (is_file($tmpPath)) {
            try {
                $finfo = new \finfo(FILEINFO_MIME_TYPE);
                $mime = (string)$finfo->file($tmpPath);
            } catch (\Throwable $e) {
                $mime = '';
            }
        }
        if ($mime === '') {
            $mime = trim($clientType);
        }
        return $mime !== '' ? $mime : 'application/octet-stream';
    }

    private function isImageMime(string $mime): bool
    {
        return in_array(strtolower(trim($mime)), [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/bmp',
            'image/svg+xml',
            'image/avif',
        ], true);
    }

    private function sanitizeFilename(string $name): string
    {
        $name = trim($name);
        $name = str_replace(["\0", "\r", "\n", '/', '\\'], ' ', $name);
        $name = preg_replace('/\s+/u', ' ', $name) ?? $name;
        if ($name === '') {
            return 'document';
        }
        if (function_exists('mb_substr')) {
            return mb_substr($name, 0, 255, 'UTF-8');
        }
        return substr($name, 0, 255);
    }

    private function documentSnapshot(?array $row): ?array
    {
        if (!is_array($row)) return null;
        return [
            'id' => (int)($row['id'] ?? 0),
            'event_id' => (string)($row['event_id'] ?? ''),
            'message_id' => isset($row['message_id']) ? (int)$row['message_id'] : null,
            'original_name' => (string)($row['original_name'] ?? ''),
            'mime_type' => (string)($row['mime_type'] ?? ''),
            'file_size' => (int)($row['file_size'] ?? 0),
            'is_image' => !empty($row['is_image']),
            'uploaded_by_user_id' => (int)($row['uploaded_by_user_id'] ?? 0),
            'created_at' => (string)($row['created_at'] ?? ''),
            'uploader_display' => (string)($row['uploader']['display'] ?? ''),
        ];
    }

    private function audit(string $action, array $meta = []): void
    {
        try {
            $this->logger->log($action, 'success', $meta);
        } catch (\Throwable $e) {
            // audit must never break document flow
        }
    }


    private function loadAccessibleDocumentById(int $id, bool $binary = false): ?array
    {
        if ($id <= 0) {
            if ($binary) {
                http_response_code(400);
                echo 'Bad Request';
            } else {
                $this->json(['ok' => false, 'error' => 'id required'], 400);
            }
            return null;
        }

        try {
            $doc = $this->documents->getById($id, false);
        } catch (\Throwable $e) {
            if ($binary) {
                http_response_code(500);
                echo 'Internal Server Error';
            } else {
                $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
            }
            return null;
        }

        if (!is_array($doc) || !empty($doc['deleted_at'])) {
            if ($binary) {
                http_response_code(404);
                echo 'Not Found';
            } else {
                $this->json(['ok' => false, 'error' => 'not_found'], 404);
            }
            return null;
        }

        $eventId = trim((string)($doc['event_id'] ?? ''));
        if ($eventId === '') {
            if ($binary) {
                http_response_code(404);
                echo 'Not Found';
            } else {
                $this->json(['ok' => false, 'error' => 'not_found'], 404);
            }
            return null;
        }

        try {
            $event = $this->events->getById($eventId);
        } catch (\Throwable $e) {
            if ($binary) {
                http_response_code(500);
                echo 'Internal Server Error';
            } else {
                $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
            }
            return null;
        }

        if (!is_array($event)) {
            if ($binary) {
                http_response_code(404);
                echo 'Not Found';
            } else {
                $this->json(['ok' => false, 'error' => 'not_found'], 404);
            }
            return null;
        }

        if (!$this->canCurrentUserAccessEvent($event)) {
            if ($binary) {
                http_response_code(403);
                echo 'Forbidden';
            } else {
                $this->json(['ok' => false, 'error' => 'forbidden'], 403);
            }
            return null;
        }

        return $doc;
    }

    private function canDeleteDocument(array $document, array $user): bool
    {
        $uid = (int)($user['id'] ?? 0);
        if ($uid <= 0) return false;
        if ($this->isAdmin($user)) return true;
        if ((int)($document['uploaded_by_user_id'] ?? 0) === $uid) return true;
        $messageUserId = (int)($document['message_user_id'] ?? 0);
        return $messageUserId > 0 && $messageUserId === $uid;
    }

    public function listByEvent(): void
    {
        $eventId = trim((string)($_GET['event_id'] ?? ''));
        $event = $this->requireEvent($eventId);
        if (!$event) return;

        $includeDeleted = !empty($_GET['include_deleted']) && $this->isAdmin($this->currentUser());
        $limit = max(1, min(500, (int)($_GET['limit'] ?? 200)));
        $offset = max(0, (int)($_GET['offset'] ?? 0));

        try {
            $items = $this->documents->listByEventId($eventId, $includeDeleted, $limit, $offset);
            $total = $this->documents->countByEventId($eventId, $includeDeleted);
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

    public function listByMessage(): void
    {
        $messageId = (int)($_GET['message_id'] ?? 0);
        $message = $this->requireMessage($messageId);
        if (!$message) return;

        $includeDeleted = !empty($_GET['include_deleted']) && $this->isAdmin($this->currentUser());

        try {
            $items = $this->documents->listByMessageId($messageId, $includeDeleted);
            $total = $this->documents->countByMessageId($messageId, $includeDeleted);
            $this->json([
                'ok' => true,
                'message_id' => $messageId,
                'event_id' => (string)($message['event_id'] ?? ''),
                'items' => $items,
                'total' => $total,
                'include_deleted' => $includeDeleted,
            ]);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
        }
    }

    public function upload(): void
    {
        if (!$this->requireCsrf((string)($_POST['_csrf'] ?? ''))) { return; }

        $user = $this->currentUser();
        $userId = (int)($user['id'] ?? 0);
        if ($userId <= 0) {
            $this->json(['ok' => false, 'error' => 'unauthorized'], 401);
            return;
        }

        $eventId = trim((string)($_POST['event_id'] ?? ''));
        $event = $this->requireEvent($eventId);
        if (!$event) return;

        $messageIdRaw = $_POST['message_id'] ?? null;
        $messageId = null;
        if ($messageIdRaw !== null && $messageIdRaw !== '') {
            $messageId = (int)$messageIdRaw;
            $message = $this->requireMessage($messageId);
            if (!$message) return;
            if ((string)($message['event_id'] ?? '') !== $eventId) {
                $this->json(['ok' => false, 'error' => 'message_event_mismatch'], 400);
                return;
            }
        }

        $files = $this->collectUploadedFiles();
        if (!$files) {
            $this->json(['ok' => false, 'error' => 'no_files', 'message' => 'Файли не вибрані.'], 400);
            return;
        }

        $created = [];
        foreach ($files as $file) {
            $name = $this->sanitizeFilename((string)($file['name'] ?? ''));
            $error = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
            $tmpPath = (string)($file['tmp_name'] ?? '');
            $size = (int)($file['size'] ?? 0);

            if ($error !== UPLOAD_ERR_OK) {
                $this->json([
                    'ok' => false,
                    'error' => 'upload_error',
                    'message' => $this->uploadErrorMessage($error),
                    'file' => $name,
                    'upload_error_code' => $error,
                ], 400);
                return;
            }
            if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
                $this->json(['ok' => false, 'error' => 'tmp_missing', 'message' => 'Тимчасовий файл не знайдено.', 'file' => $name], 400);
                return;
            }
            $maxBytes = $this->getUploadMaxFileSizeBytes();
            $actualSize = $size > 0 ? $size : (int)@filesize($tmpPath);
            if ($actualSize <= 0) {
                $actualSize = 0;
            }
            if ($actualSize > $maxBytes) {
                $this->json([
                    'ok' => false,
                    'error' => 'file_too_large',
                    'message' => 'Файл завеликий. Максимум: ' . $this->getUploadMaxFileSizeMb() . ' MB.',
                    'file' => $name,
                    'max_file_mb' => $this->getUploadMaxFileSizeMb(),
                ], 413);
                return;
            }

            $blob = @file_get_contents($tmpPath);
            if (!is_string($blob) || $blob === '') {
                $this->json(['ok' => false, 'error' => 'read_failed', 'message' => 'Не вдалося прочитати завантажений файл.', 'file' => $name], 400);
                return;
            }

            $mime = $this->detectMime($tmpPath, (string)($file['type'] ?? ''));
            $sha256 = hash('sha256', $blob);
            $isImage = $this->isImageMime($mime);

            try {
                $row = $this->documents->createForMessage(
                    $eventId,
                    $messageId,
                    $userId,
                    $name,
                    $mime,
                    $size > 0 ? $size : strlen($blob),
                    $isImage,
                    $sha256,
                    $blob
                );
                $created[] = $row;
            } catch (\InvalidArgumentException $e) {
                $this->json(['ok' => false, 'error' => $e->getMessage(), 'file' => $name], 400);
                return;
            } catch (\Throwable $e) {
                $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage(), 'file' => $name], 500);
                return;
            }
        }

        $this->audit('document.upload', [
            'entity_type' => 'event',
            'entity_id' => $eventId,
            'event_id' => $eventId,
            'event_title' => (string)($event['title'] ?? ''),
            'message_id' => $messageId,
            'documents_count' => count($created),
            'documents' => array_map([$this, 'documentSnapshot'], $created),
        ]);

        $this->json([
            'ok' => true,
            'event_id' => $eventId,
            'message_id' => $messageId,
            'documents' => $created,
            'total_event_documents' => $this->documents->countByEventId($eventId, false),
        ], 201);
    }

    public function delete(): void
    {
        $payload = $this->parseJson();
        if ($payload === null) {
            $this->json(['ok' => false, 'error' => 'invalid json'], 400);
            return;
        }
        $providedToken = (string)($payload['_csrf'] ?? ($_POST['_csrf'] ?? ''));
        if (!$this->requireCsrf($providedToken)) { return; }

        $id = (int)($payload['id'] ?? ($_POST['id'] ?? 0));
        if ($id <= 0) {
            $this->json(['ok' => false, 'error' => 'id required'], 400);
            return;
        }

        $user = $this->currentUser();
        $userId = (int)($user['id'] ?? 0);
        if ($userId <= 0) {
            $this->json(['ok' => false, 'error' => 'unauthorized'], 401);
            return;
        }

        try {
            $current = $this->loadAccessibleDocumentById($id);
            if (!$current) {
                return;
            }
            if (!$this->canDeleteDocument($current, $user)) {
                $this->json(['ok' => false, 'error' => 'forbidden'], 403);
                return;
            }
            $row = $this->documents->softDeleteById($id, $userId);
            if (!$row) {
                $this->json(['ok' => false, 'error' => 'not_found'], 404);
                return;
            }

            $this->audit('document.delete', [
                'entity_type' => 'event',
                'entity_id' => (string)($current['event_id'] ?? ''),
                'event_id' => (string)($current['event_id'] ?? ''),
                'message_id' => $current['message_id'] ?? null,
                'document' => $this->documentSnapshot($current),
                'actor_display' => $this->currentUserDisplay($user),
            ]);

            $this->json([
                'ok' => true,
                'document' => $row,
                'total_event_documents' => $this->documents->countByEventId((string)($current['event_id'] ?? ''), false),
            ]);
        } catch (\InvalidArgumentException $e) {
            $this->json(['ok' => false, 'error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
        }
    }

    public function view(): void
    {
        $id = (int)($_GET['id'] ?? 0);
        $docMeta = $this->loadAccessibleDocumentById($id, true);
        if (!$docMeta) {
            return;
        }

        try {
            $doc = $this->documents->getDecryptedBlobById($id, false);
            if (!$doc) {
                http_response_code(404);
                echo 'Not Found';
                return;
            }
            $blob = $doc['blob'] ?? null;
            if (!is_string($blob) || $blob === '') {
                http_response_code(404);
                echo 'Not Found';
                return;
            }
            $mime = trim((string)($doc['mime_type'] ?? 'application/octet-stream')) ?: 'application/octet-stream';
            $filename = trim((string)($doc['original_name'] ?? 'document')) ?: 'document';
            if (!headers_sent()) {
                header('Content-Type: ' . $mime);
                header('Content-Length: ' . strlen($blob));
                header('Cache-Control: private, max-age=300');
                header('Content-Disposition: inline; filename="' . addslashes($filename) . '"');
            }
            echo $blob;
        } catch (\Throwable $e) {
            http_response_code(500);
            echo 'Internal Server Error';
        }
    }

    public function download(): void
    {
        $id = (int)($_GET['id'] ?? 0);
        $docMeta = $this->loadAccessibleDocumentById($id, true);
        if (!$docMeta) {
            return;
        }

        try {
            $doc = $this->documents->getDecryptedBlobById($id, false);
            if (!$doc) {
                http_response_code(404);
                echo 'Not Found';
                return;
            }
            $blob = $doc['blob'] ?? null;
            if (!is_string($blob) || $blob === '') {
                http_response_code(404);
                echo 'Not Found';
                return;
            }
            $mime = trim((string)($doc['mime_type'] ?? 'application/octet-stream')) ?: 'application/octet-stream';
            $filename = trim((string)($doc['original_name'] ?? 'document')) ?: 'document';
            if (!headers_sent()) {
                header('Content-Type: ' . $mime);
                header('Content-Length: ' . strlen($blob));
                header('Cache-Control: private, no-store');
                header('Content-Disposition: attachment; filename="' . addslashes($filename) . '"');
            }
            echo $blob;
        } catch (\Throwable $e) {
            http_response_code(500);
            echo 'Internal Server Error';
        }
    }
}
