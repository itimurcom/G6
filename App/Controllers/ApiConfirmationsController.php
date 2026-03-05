<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Controllers\Traits\ApiCommonTrait;
use App\Core\Auth;
use App\Models\EventConfirmationMysqlRepository;
use App\Models\EventMessageMysqlRepository;
use App\Models\EventMysqlRepository;
use App\Models\UserNameResolver;
use App\Services\Audit\ActionLogger;

final class ApiConfirmationsController
{
    use ApiCommonTrait;

    private EventConfirmationMysqlRepository $repo;
    private EventMysqlRepository $events;
    private EventMessageMysqlRepository $messages;
    private UserNameResolver $userNames;
    private ActionLogger $logger;

    public function __construct()
    {
        $this->repo = new EventConfirmationMysqlRepository();
        $this->events = new EventMysqlRepository();
        $this->messages = new EventMessageMysqlRepository();
        $this->userNames = new UserNameResolver();
        $this->logger = new ActionLogger();
    }

    /**
     * GET /api/confirmations/my
     * Returns pending confirmations for current user.
     */
    public function my(): void
    {
        $uid = (int)(Auth::id() ?? 0);
        if ($uid <= 0) { $this->json(['ok'=>false,'error'=>'unauthorized'], 401); return; }

        try {
            $rows = $this->repo->listPendingForUser($uid, 200);
            $this->json(['ok'=>true,'items'=>$rows]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

    /**
     * POST /api/confirmations/accept
     * Body: { "event_id": "e_..." }
     */
    public function accept(): void
    {
        if (!$this->requireCsrf()) { return; }

        $uid = (int)(Auth::id() ?? 0);
        if ($uid <= 0) { $this->json(['ok'=>false,'error'=>'unauthorized'], 401); return; }

        $payload = $this->parseJson();
        if ($payload === null) { $this->json(['ok'=>false,'error'=>'invalid json'], 400); return; }
        $eventId = trim((string)($payload['event_id'] ?? ''));
        if ($eventId === '') { $this->json(['ok'=>false,'error'=>'event_id required'], 400); return; }

        try {
            $event = $this->events->getById($eventId);
            if (!$event) { $this->json(['ok'=>false,'error'=>'not_found'], 404); return; }

            // Verify that current user is the assignee (owner must be a user JSON)
            $assigneeId = $this->parseAssigneeUserId($event['owner'] ?? null);
            if ($assigneeId <= 0 || $assigneeId !== $uid) {
                $this->json(['ok'=>false,'error'=>'forbidden'], 403);
                return;
            }

            $res = $this->repo->accept($eventId, $uid);
            if (empty($res['ok'])) {
                $this->json(['ok'=>false,'error'=>$res['error'] ?? 'not_pending'], 409);
                return;
            }

            $acceptedAt = (string)($res['accepted_at'] ?? '');
            $meName = $this->userNames->getNameById($uid) ?? ('User #' . $uid);

            // Event history: add message under the accepting user
            try {
                $msg = '✅ Прийняв на виконання' . ($acceptedAt !== '' ? (' (' . $acceptedAt . ')') : '');
                $this->messages->create($eventId, $uid, $msg);
            } catch (\Throwable $e) {
                // history must not break accept
            }

            // Journal (audit)
            try {
                $this->logger->log('calendar.event.accept', 'success', [
                    'entity_type' => 'event',
                    'entity_id' => $eventId,
                    'event_title' => (string)($event['title'] ?? ''),
                    'assignee_user_id' => $uid,
                    'assignee_name' => $meName,
                    'accepted_at' => $acceptedAt,
                ]);
            } catch (\Throwable $e) {
                // audit must not break accept
            }

            $this->json(['ok'=>true,'accepted_at'=>$acceptedAt]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

    /** Extract assignee user id from event.owner JSON string (t=user). Returns 0 if owner is not a user. */
    private function parseAssigneeUserId(mixed $owner): int
    {
        try {
            if ($owner === null) return 0;
            $s = trim((string)$owner);
            if ($s === '') return 0;
            if ($s[0] !== '{' || !str_ends_with($s, '}')) return 0;
            $decoded = json_decode($s, true);
            if (!is_array($decoded)) return 0;
            $t = strtolower((string)($decoded['t'] ?? $decoded['type'] ?? ''));
            if ($t !== 'user') return 0;
            $id = (int)($decoded['id'] ?? $decoded['user_id'] ?? 0);
            return $id > 0 ? $id : 0;
        } catch (\Throwable $e) {
            return 0;
        }
    }
}
