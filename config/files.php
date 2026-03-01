<?php

declare(strict_types=1);

$projectKeys = require __DIR__ . '/files.keys.php';

return [
    'documents' => [
        'encryption' => [
            'cipher' => 'aes-256-gcm',
            'current_key_version' => (int)($projectKeys['current_key_version'] ?? 1),
            'keys' => (array)($projectKeys['keys'] ?? []),
        ],
    ],
];
