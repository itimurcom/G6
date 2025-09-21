<?php
declare(strict_types=1);

namespace App\Controllers;

/**
 * Back-compat shim for legacy /api/mysql/... routes.
 * Maps old method names to the new ApiEventsController methods.
 */
final class ApiMysqlEventsController
{
    private ApiEventsController $ctrl;

    public function __construct()
    {
        $this->ctrl = new ApiEventsController();
    }

    // Legacy -> New
    public function listByDate(): void   { $this->ctrl->byDate(); }
    public function listByRange(): void  { $this->ctrl->byRange(); }
    public function create(): void       { $this->ctrl->create(); }
    public function update(): void       { $this->ctrl->update(); }
    public function delete(): void       { $this->ctrl->delete(); }
    public function done(): void         { $this->ctrl->done(); }
    public function urgent(): void       { $this->ctrl->urgent(); }

    // Extra aliases (якщо десь залишились старі назви)
    public function setDone(): void      { $this->ctrl->done(); }
    public function setUrgent(): void    { $this->ctrl->urgent(); }
    public function search(): void       { $this->ctrl->search(); }
}
