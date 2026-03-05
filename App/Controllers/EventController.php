<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Auth;
use App\Models\EventMysqlRepository;
use App\Models\UserNameResolver;
use App\Services\EventViewHelper;

final class EventController extends Controller
{
    private EventMysqlRepository $repo;
    private ?object $messageRepo = null;
    private bool $messageBackendReady = false;
    private UserNameResolver $userNames;

    public function __construct()
    {
        $this->repo = new EventMysqlRepository();
        $this->userNames = new UserNameResolver();

        if (class_exists('App\\Models\\EventMessageMysqlRepository')) {
            try {
                $this->messageRepo = new \App\Models\EventMessageMysqlRepository();
                $this->messageBackendReady = true;
            } catch (\Throwable $e) {
                $this->messageRepo = null;
                $this->messageBackendReady = false;
                error_log('[event-sheet] event message backend unavailable: ' . $e->getMessage());
            }
        }
    }

    public function show(Request $request): string
    {
        $id = trim((string)$request->input('id', ''));
        if ($id === '') {
            http_response_code(400);
            return $this->renderMissing('Не передано ідентифікатор події.');
        }

        try {
            $event = $this->repo->getById($id);
        } catch (\Throwable $e) {
            http_response_code(500);
            return $this->renderMissing('Не вдалося завантажити подію.', $e->getMessage());
        }

        if (!$event) {
            http_response_code(404);
            return $this->renderMissing('Подію не знайдено.');
        }

        $me = Auth::user();
        $meId = (int)($me['id'] ?? 0);
        $authorId = (int)($event['user_id'] ?? 0);
        $authorName = $authorId > 0 ? ($this->userNames->getNameById($authorId) ?? ('User #' . $authorId)) : '—';

        $owner = EventViewHelper::parseOwnerField($event['owner'] ?? '');
        $responsible = EventViewHelper::ownerDisplay($owner, fn(int $uid) => $this->userNames->getNameById($uid));

        $startIso = (string)($event['start_date'] ?? '');
        $endIso = trim((string)($event['end_date'] ?? ''));
        $isMultiDay = $startIso !== '' && $endIso !== '' && $endIso !== $startIso;
        $durationDays = EventViewHelper::durationDays($startIso, $endIso);

        $passportRows = [
            ['label' => 'ID події', 'value' => $event['id'] ?? '—'],
            ['label' => 'Тип', 'value' => EventViewHelper::typeLabel((string)($event['type'] ?? 'other'))],
            ['label' => 'Дата початку', 'value' => EventViewHelper::formatDate($startIso)],
            ['label' => 'Дата завершення', 'value' => $endIso !== '' ? EventViewHelper::formatDate($endIso) : '—'],
            ['label' => 'Час', 'value' => trim((string)($event['time'] ?? '')) !== '' ? (string)$event['time'] : '—'],
            ['label' => 'Тривалість', 'value' => $durationDays > 1 ? ($durationDays . ' ' . EventViewHelper::ukDayWord($durationDays)) : '1 день'],
            ['label' => 'Відповідальний', 'value' => $responsible],
            ['label' => 'Автор події', 'value' => $authorName],
            ['label' => 'Створено', 'value' => EventViewHelper::formatDateTime((string)($event['created_at'] ?? ''))],
            ['label' => 'Терміновість', 'value' => !empty($event['urgent']) ? 'так' : 'ні'],
            ['label' => 'Виконано', 'value' => !empty($event['done']) ? 'так' : 'ні'],
            ['label' => 'Вхідний №', 'value' => trim((string)($event['incoming_no'] ?? '')) !== '' ? (string)$event['incoming_no'] : '—'],
            ['label' => 'Вихідний №', 'value' => trim((string)($event['outgoing_no'] ?? '')) !== '' ? (string)$event['outgoing_no'] : '—'],
        ];

        $messageTotal = 0;
        if ($this->messageBackendReady && $this->messageRepo && method_exists($this->messageRepo, 'countByEvent')) {
            try {
                $messageTotal = (int)$this->messageRepo->countByEvent((string)($event['id'] ?? ''));
            } catch (\Throwable $e) {
                $messageTotal = 0;
                $this->messageBackendReady = false;
                error_log('[event-sheet] countByEvent failed: ' . $e->getMessage());
            }
        }

        $currentUser = Auth::user() ?? [];
        $currentUserId = (int)($currentUser['id'] ?? 0);
        $currentUserName = trim((string)($currentUser['name'] ?? ''));
        $currentUserLogin = trim((string)($currentUser['login'] ?? ''));
        $currentUserDisplay = $currentUserName !== ''
            ? $currentUserName
            : ($currentUserLogin !== '' ? $currentUserLogin : ($currentUserId > 0 ? ('User #' . $currentUserId) : 'Користувач'));
        $currentUserIsAdmin = !empty($currentUser['is_admin']) || strtolower((string)($currentUser['role'] ?? '')) === 'admin';

        $badges = [];
        if (!empty($event['urgent'])) $badges[] = ['key' => 'urgent', 'label' => 'Терміново'];
        if (!empty($event['done'])) $badges[] = ['key' => 'done', 'label' => 'Виконано'];
        if ($authorId > 0 && $meId > 0 && $authorId === $meId) $badges[] = ['key' => 'mine', 'label' => 'Моя подія'];
        if (($owner['type'] ?? '') === 'user' && (int)($owner['user_id'] ?? 0) > 0 && (int)$owner['user_id'] === $meId && empty($event['done'])) $badges[] = ['key' => 'assigned', 'label' => 'На виконанні'];
        if (EventViewHelper::isOverdueStrict($event)) $badges[] = ['key' => 'overdue', 'label' => 'Подія прострочена'];

        return $this->render('pages/event', [
            'title' => 'Лист події',
            'extra_css' => [
                '/assets/css/event.css',
                '/assets/css/icons.css',
            ],
            'extra_js' => $this->messageBackendReady ? [
                '/assets/js/event.js',
            ] : [],
            'event' => $event,
            'event_title' => trim((string)($event['title'] ?? '')) !== '' ? (string)$event['title'] : 'Подія без назви',
            'event_type_label' => EventViewHelper::typeLabel((string)($event['type'] ?? 'other')),
            'event_description' => trim((string)($event['description'] ?? '')) !== '' ? (string)$event['description'] : '',
            'event_responsible' => $responsible,
            'event_author_name' => $authorName,
            'event_created_human' => EventViewHelper::formatDateTime((string)($event['created_at'] ?? '')),
            'event_start_human' => EventViewHelper::formatDate($startIso),
            'event_end_human' => $endIso !== '' ? EventViewHelper::formatDate($endIso) : '—',
            'event_is_multiday' => $isMultiDay,
            'event_duration_days' => $durationDays,
            'event_badges' => $badges,
            'passport_rows' => $passportRows,
            'message_total' => $messageTotal,
            'thread_backend_ready' => $this->messageBackendReady,
            'event_id' => (string)($event['id'] ?? ''),
            'thread_current_user' => [
                'id' => $currentUserId,
                'name' => $currentUserName,
                'login' => $currentUserLogin,
                'display' => $currentUserDisplay,
                'is_admin' => $currentUserIsAdmin,
                'has_avatar' => !empty($currentUser['has_avatar']),
                'avatar_url' => $currentUser['avatar_url'] ?? null,
                'avatar_version' => $currentUser['avatar_version'] ?? null,
            ],
        ]);
    }

    private function renderMissing(string $message, string $details = ''): string
    {
        return $this->render('pages/event', [
            'title' => 'Лист події',
            'extra_css' => [
                '/assets/css/event.css',
                '/assets/css/icons.css',
            ],
            'extra_js' => $this->messageBackendReady ? [
                '/assets/js/event.js',
            ] : [],
            'event' => null,
            'event_title' => 'Лист події',
            'event_missing_message' => $message,
            'event_missing_details' => $details,
            'passport_rows' => [],
            'message_total' => 0,
            'event_badges' => [],
            'thread_backend_ready' => false,
            'event_id' => '',
            'thread_current_user' => [
                'id' => 0,
                'name' => '',
                'login' => '',
                'display' => 'Користувач',
                'is_admin' => false,
                'has_avatar' => false,
                'avatar_url' => null,
                'avatar_version' => null,
            ],
        ]);
    }

}
