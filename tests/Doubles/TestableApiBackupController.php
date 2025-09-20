<?php
declare(strict_types=1);

namespace Tests\Doubles;

use App\Controllers\ApiBackupController;
use App\Models\EventStore;

/**
 * Test double for ApiBackupController: avoids headers/echo and allows custom store path & request body.
 */
class TestableApiBackupController extends ApiBackupController
{
    /** @var array|null */
    public ?array $injectedBody = null;
    /** @var mixed */
    public $lastResponse = null;
    /** @var int|null */
    public ?int $lastCode = null;

    public function __construct(string $storePath)
    {
        // $store is protected in patched controller
        $this->store = new EventStore($storePath);
    }

    /** Override input reader */
    protected function readJson(): array
    {
        return is_array($this->injectedBody) ? $this->injectedBody : [];
    }

    /** Capture JSON instead of echo+headers */
    protected function json($data, int $code = 200): void
    {
        $this->lastResponse = $data;
        $this->lastCode = $code;
    }
}
