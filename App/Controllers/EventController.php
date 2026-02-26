<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Auth;
use App\Models\EventMysqlRepository;
use App\Models\UserNameResolver;

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

        $owner = $this->parseOwnerField($event['owner'] ?? '');
        $responsible = $this->ownerDisplay($owner);

        $startIso = (string)($event['start_date'] ?? '');
        $endIso = trim((string)($event['end_date'] ?? ''));
        $isMultiDay = $startIso !== '' && $endIso !== '' && $endIso !== $startIso;
        $durationDays = $this->durationDays($startIso, $endIso);

        $passportRows = [
            ['label' => 'ID події', 'value' => $event['id'] ?? '—'],
            ['label' => 'Тип', 'value' => $this->typeLabel((string)($event['type'] ?? 'other'))],
            ['label' => 'Дата початку', 'value' => $this->formatDate($startIso)],
            ['label' => 'Дата завершення', 'value' => $endIso !== '' ? $this->formatDate($endIso) : '—'],
            ['label' => 'Час', 'value' => trim((string)($event['time'] ?? '')) !== '' ? (string)$event['time'] : '—'],
            ['label' => 'Тривалість', 'value' => $durationDays > 1 ? ($durationDays . ' ' . $this->ukDayWord($durationDays)) : '1 день'],
            ['label' => 'Відповідальний', 'value' => $responsible],
            ['label' => 'Автор події', 'value' => $authorName],
            ['label' => 'Створено', 'value' => $this->formatDateTime((string)($event['created_at'] ?? ''))],
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
        if ($this->isOverdue($event)) $badges[] = ['key' => 'overdue', 'label' => 'Подія прострочена'];

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
            'event_type_label' => $this->typeLabel((string)($event['type'] ?? 'other')),
            'event_description' => trim((string)($event['description'] ?? '')) !== '' ? (string)$event['description'] : '',
            'event_responsible' => $responsible,
            'event_author_name' => $authorName,
            'event_created_human' => $this->formatDateTime((string)($event['created_at'] ?? '')),
            'event_start_human' => $this->formatDate($startIso),
            'event_end_human' => $endIso !== '' ? $this->formatDate($endIso) : '—',
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

    private function typeLabel(string $type): string
    {
        return match ($type) {
            'mi' => 'ТЛГ: МИ',
            'nas' => 'ТЛГ: НАС',
            'evt' => 'Захід',
            default => 'Інше',
        };
    }

    private function formatDate(string $iso): string
    {
        $iso = trim($iso);
        if ($iso === '') return '—';
        try {
            $dt = new \DateTimeImmutable($iso);
            return $dt->format('d.m.Y');
        } catch (\Throwable $e) {
            return $iso;
        }
    }

    private function formatDateTime(string $value): string
    {
        $value = trim($value);
        if ($value === '') return '—';
        try {
            $dt = new \DateTimeImmutable($value);
            return $dt->format('d.m.Y H:i:s');
        } catch (\Throwable $e) {
            return $value;
        }
    }

    private function durationDays(string $startIso, string $endIso): int
    {
        $startIso = trim($startIso);
        $endIso = trim($endIso);
        if ($startIso === '' || $endIso === '') return 1;
        try {
            $start = new \DateTimeImmutable($startIso);
            $end = new \DateTimeImmutable($endIso);
            if ($end < $start) return 1;
            return (int)$start->diff($end)->days + 1;
        } catch (\Throwable $e) {
            return 1;
        }
    }

    private function ukDayWord(int $days): string
    {
        $n = abs($days) % 100;
        $n1 = $n % 10;
        if ($n > 10 && $n < 20) return 'днів';
        if ($n1 > 1 && $n1 < 5) return 'дні';
        if ($n1 === 1) return 'день';
        return 'днів';
    }

    /** @return array{type:string,text:string,user_id:int,login:string,name:string,label:string} */
    private function parseOwnerField(mixed $owner): array
    {
        try {
            if ($owner === null) return ['type' => 'text', 'text' => '', 'user_id' => 0, 'login' => '', 'name' => '', 'label' => ''];
            $s = trim((string)$owner);
            if ($s === '') return ['type' => 'text', 'text' => '', 'user_id' => 0, 'login' => '', 'name' => '', 'label' => ''];

            if ($s[0] === '{' && str_ends_with($s, '}')) {
                $decoded = json_decode($s, true);
                if (is_array($decoded)) {
                    $type = strtolower((string)($decoded['t'] ?? $decoded['type'] ?? 'text'));
                    if ($type === 'user') {
                        return [
                            'type' => 'user',
                            'text' => '',
                            'user_id' => (int)($decoded['id'] ?? $decoded['user_id'] ?? 0),
                            'login' => trim((string)($decoded['login'] ?? '')),
                            'name' => trim((string)($decoded['name'] ?? '')),
                            'label' => trim((string)($decoded['label'] ?? $decoded['display'] ?? '')),
                        ];
                    }

                    return [
                        'type' => 'text',
                        'text' => trim((string)($decoded['text'] ?? $decoded['value'] ?? '')),
                        'user_id' => 0,
                        'login' => '',
                        'name' => '',
                        'label' => '',
                    ];
                }
            }

            return ['type' => 'text', 'text' => $s, 'user_id' => 0, 'login' => '', 'name' => '', 'label' => ''];
        } catch (\Throwable $e) {
            return ['type' => 'text', 'text' => trim((string)$owner), 'user_id' => 0, 'login' => '', 'name' => '', 'label' => ''];
        }
    }

    private function ownerDisplay(array $owner): string
    {
        if (($owner['type'] ?? 'text') === 'user') {
            $label = trim((string)($owner['label'] ?? ''));
            if ($label !== '') return $label;

            $name = trim((string)($owner['name'] ?? ''));
            $login = trim((string)($owner['login'] ?? ''));
            $userId = (int)($owner['user_id'] ?? 0);

            if ($name !== '' && $login !== '') return $name . ' (' . $login . ')';
            if ($name !== '') return $name;
            if ($login !== '') return $login;
            if ($userId > 0) {
                return $this->userNames->getNameById($userId) ?? ('User #' . $userId);
            }
        }

        $text = trim((string)($owner['text'] ?? ''));
        return $text !== '' ? $text : '—';
    }

    private function isOverdue(array $event): bool
    {
        try {
            if (!empty($event['done'])) return false;

            $today = new \DateTimeImmutable('today');
            $dateIso = trim((string)($event['end_date'] ?? $event['start_date'] ?? ''));
            if ($dateIso === '') return false;

            $day = new \DateTimeImmutable($dateIso);
            if ($day < $today) return true;
            if ($day > $today) return false;

            $time = trim((string)($event['time'] ?? ''));
            if ($time === '' || !preg_match('/^\d{1,2}:\d{2}$/', $time)) return false;

            $eventAt = new \DateTimeImmutable($today->format('Y-m-d') . ' ' . $time . ':00');
            return $eventAt < new \DateTimeImmutable();
        } catch (\Throwable $e) {
            return false;
        }
    }
}
