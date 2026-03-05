<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Controllers\Traits\ApiCommonTrait;
use App\Models\AppSettingMysqlRepository;

final class ApiSettingsController
{
    use ApiCommonTrait;

    private AppSettingMysqlRepository $settings;

    public function __construct()
    {
        $this->settings = new AppSettingMysqlRepository();
    }

    public function getUpload(): void
    {
        $max = $this->settings->getInt('upload.max_file_mb', 100);
        $max = max(1, min(1024, (int)$max));

        $this->json([
            'ok' => true,
            'upload' => [
                'max_file_mb' => $max,
            ],
        ]);
    }

    public function setUpload(): void
    {
        $token = (string)($_POST['_csrf'] ?? '');
        if (!$this->requireCsrf($token)) { return; }

        $user = $this->currentUser();
        if (!$user || !$this->isAdmin($user)) {
            $this->json(['ok' => false, 'error' => 'forbidden'], 403);
            return;
        }

        $raw = $_POST['max_file_mb'] ?? null;
        if ($raw === null || $raw === '') {
            $payload = $this->parseJson();
            $raw = is_array($payload) ? ($payload['max_file_mb'] ?? null) : null;
        }

        $max = (int)$raw;
        if ($max < 1) $max = 1;
        if ($max > 1024) $max = 1024;

        try {
            $this->settings->setInt('upload.max_file_mb', $max);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
            return;
        }

        $this->json([
            'ok' => true,
            'upload' => [
                'max_file_mb' => $max,
            ],
        ]);
    }
}
