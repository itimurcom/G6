<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Models\EventMessageMysqlRepository;
use App\Models\EventMysqlRepository;
use App\Models\UserNameResolver;
use PDO;

final class PrintController
{
    private EventMysqlRepository $events;
    private UserNameResolver $userNames;
    private ?EventMessageMysqlRepository $messages;
    private PDO $db;

    public function __construct()
    {
        $this->events = new EventMysqlRepository();
        $this->userNames = new UserNameResolver();
        $this->db = Database::connect();
        $this->messages = class_exists(EventMessageMysqlRepository::class) ? new EventMessageMysqlRepository() : null;
    }

    public function today(Request $request): string
    {
        $date = trim((string)($request->input('date') ?? ''));
        if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $date = date('Y-m-d');
        }

        $events = $this->events->listByDate($date);
        usort($events, [$this, 'compareEvents']);

        $groups = [
            'early' => ['title' => 'До 06:00', 'items' => []],
            'day' => ['title' => 'Події дня', 'items' => []],
            'late' => ['title' => 'Після 24:00 (завтра до 06:00)', 'items' => []],
        ];

        foreach ($events as $event) {
            $bucket = $this->bucketTodayEvent((string)($event['time'] ?? ''));
            $groups[$bucket]['items'][] = $this->mapEventLine($event, $date);
        }

        return $this->renderPrint('pages/print_today', [
            'title' => $this->buildFileStem('today', [$date]),
            'doc_title' => 'Сьогодні',
            'doc_subtitle' => $this->formatDateLong($date),
            'doc_mode' => 'today',
            'date_iso' => $date,
            'generated_at' => date('d.m.Y H:i:s'),
            'groups' => $groups,
            'autoprint' => $this->wantAutoPrint($request),
        ]);
    }

    public function calendarMonth(Request $request): string
    {
        $year = (int)($request->input('year') ?? date('Y'));
        $month = (int)($request->input('month') ?? date('n'));
        if ($year < 2000 || $year > 2100) { $year = (int)date('Y'); }
        if ($month < 1 || $month > 12) { $month = (int)date('n'); }

        $first = sprintf('%04d-%02d-01', $year, $month);
        $last = date('Y-m-t', strtotime($first));
        $map = $this->events->listByRange($first, $last);
        $days = $this->buildMonthListDays($year, $month, $map);
        $total = 0;
        foreach ($days as $day) { $total += count($day['items'] ?? []); }

        return $this->renderPrint('pages/print_calendar_month', [
            'title' => $this->buildFileStem('calendar-month', [sprintf('%04d-%02d', $year, $month), $this->formatMonthTitle($year, $month)]),
            'doc_title' => $this->formatMonthTitle($year, $month),
            'doc_subtitle' => 'Список подій за місяць',
            'doc_mode' => 'month',
            'generated_at' => date('d.m.Y H:i:s'),
            'days' => $days,
            'events_total' => $total,
            'autoprint' => $this->wantAutoPrint($request),
        ]);
    }

    public function planning(Request $request): string
    {
        $scope = strtolower(trim((string)($request->input('scope') ?? 'all')));
        if (!in_array($scope, ['all', 'my', 'exec'], true)) {
            $scope = 'all';
        }

        $today = new \DateTimeImmutable('today');
        $yesterday = $today->modify('-1 day');
        $tomorrow = $today->modify('+1 day');
        $afterTomorrow = $today->modify('+2 day');

        $from = '2000-01-01';
        $to = $afterTomorrow->format('Y-m-d');
        $map = $this->events->listByRange($from, $to);
        $all = $this->flattenEventMap($map);
        $all = $this->applyPlanningScope($all, $scope, (int)(Auth::id() ?? 0), (string)($this->currentUserLogin() ?? ''));

        $sections = [
            [
                'title' => 'Прострочені до',
                'date' => $this->formatDateLong($yesterday->format('Y-m-d')),
                'items' => $this->planningOverdueItems($all, $yesterday->format('Y-m-d')),
            ],
            [
                'title' => 'Вчора',
                'date' => $this->formatDateLong($yesterday->format('Y-m-d')),
                'items' => $this->planningDayItems($all, $yesterday->format('Y-m-d')),
            ],
            [
                'title' => 'Сьогодні',
                'date' => $this->formatDateLong($today->format('Y-m-d')),
                'items' => $this->planningDayItems($all, $today->format('Y-m-d')),
            ],
            [
                'title' => 'Завтра',
                'date' => $this->formatDateLong($tomorrow->format('Y-m-d')),
                'items' => $this->planningDayItems($all, $tomorrow->format('Y-m-d')),
            ],
            [
                'title' => 'Післязавтра',
                'date' => $this->formatDateLong($afterTomorrow->format('Y-m-d')),
                'items' => $this->planningDayItems($all, $afterTomorrow->format('Y-m-d')),
            ],
        ];

        return $this->renderPrint('pages/print_planning', [
            'title' => $this->buildFileStem('planning', [$this->planningScopeLabel($scope), date('Y-m-d')]),
            'doc_title' => 'Планування',
            'doc_subtitle' => 'Список задач - ' . $this->planningScopeLabel($scope),
            'doc_mode' => 'planning',
            'generated_at' => date('d.m.Y H:i:s'),
            'scope' => $scope,
            'scope_label' => $this->planningScopeLabel($scope),
            'sections' => $sections,
            'autoprint' => $this->wantAutoPrint($request),
        ]);
    }

    public function event(Request $request): string
    {
        $id = trim((string)($request->input('id') ?? ''));
        if ($id === '') {
            http_response_code(400);
            return $this->renderPrint('pages/print_event', [
                'title' => $this->buildFileStem('event', ['missing-id']),
                'doc_title' => 'Подія',
                'doc_subtitle' => 'Помилка',
                'doc_mode' => 'event',
                'generated_at' => date('d.m.Y H:i:s'),
                'error_message' => 'Не вказано ID події.',
                'autoprint' => false,
            ]);
        }

        $event = $this->events->getById($id);
        if (!$event) {
            http_response_code(404);
            return $this->renderPrint('pages/print_event', [
                'title' => $this->buildFileStem('event', [$id !== '' ? $id : 'not-found']),
                'doc_title' => 'Подія',
                'doc_subtitle' => 'Не знайдено',
                'doc_mode' => 'event',
                'generated_at' => date('d.m.Y H:i:s'),
                'error_message' => 'Подію не знайдено.',
                'autoprint' => false,
            ]);
        }

        $meId = (int)(Auth::id() ?? 0);
        $authorId = (int)($event['user_id'] ?? 0);
        $authorName = $authorId > 0 ? ($this->userNames->getNameById($authorId) ?? ('User #' . $authorId)) : '—';
        $owner = $this->parseOwnerField($event['owner'] ?? '');
        $responsible = $this->ownerDisplay($owner);
        $startIso = (string)($event['start_date'] ?? '');
        $endIso = trim((string)($event['end_date'] ?? ''));
        $durationDays = $this->durationDays($startIso, $endIso);
        $badges = $this->eventBadges($event, $meId, $owner);

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

        $comments = [];
        if ($this->messages) {
            try {
                $comments = $this->messages->listByEvent($id, false, 500, 0);
            } catch (\Throwable $_) {
                $comments = [];
            }
        }

        $history = $this->loadEventAudit($id);

        return $this->renderPrint('pages/print_event', [
            'title' => $this->buildFileStem('event', [(string)($event['id'] ?? ''), trim((string)($event['title'] ?? 'Подія'))]),
            'doc_title' => trim((string)($event['title'] ?? '')) !== '' ? (string)$event['title'] : 'Подія без назви',
            'doc_subtitle' => 'Паспорт події',
            'doc_mode' => 'event',
            'generated_at' => date('d.m.Y H:i:s'),
            'event' => $event,
            'passport_rows' => $passportRows,
            'badges' => $badges,
            'description' => trim((string)($event['description'] ?? '')),
            'comments' => $comments,
            'history' => $history,
            'autoprint' => $this->wantAutoPrint($request),
        ]);
    }

    private function renderPrint(string $view, array $params = []): string
    {
        $viewsDir = dirname(__DIR__) . '/Views/';
        $viewPath = $viewsDir . $view . '.php';
        $layoutPath = $viewsDir . 'layouts/print.php';
        if (!is_file($viewPath) || !is_file($layoutPath)) {
            http_response_code(500);
            return 'Print view/layout missing';
        }
        extract($params, EXTR_SKIP);
        ob_start();
        include $viewPath;
        $content = ob_get_clean();
        ob_start();
        include $layoutPath;
        return ob_get_clean();
    }

    private function wantAutoPrint(Request $request): bool
    {
        return (string)($request->input('autoprint') ?? '') === '1';
    }

    private function compareEvents(array $a, array $b): int
    {
        $ta = $this->timeToMinutes((string)($a['time'] ?? ''));
        $tb = $this->timeToMinutes((string)($b['time'] ?? ''));
        if ($ta === $tb) {
            return strcmp((string)($a['title'] ?? ''), (string)($b['title'] ?? ''));
        }
        return $ta <=> $tb;
    }

    private function bucketTodayEvent(string $time): string
    {
        $m = $this->timeToMinutes($time);
        if ($m < 360) return 'early';
        if ($m >= 1440) return 'late';
        return 'day';
    }

    private function timeToMinutes(string $time): int
    {
        $time = trim($time);
        if (!preg_match('/^(\d{1,2}):(\d{2})$/', $time, $m)) return 12 * 60;
        return ((int)$m[1] * 60) + (int)$m[2];
    }

    private function mapEventLine(array $event, string $dateIso): array
    {
        $owner = $this->parseOwnerField($event['owner'] ?? '');
        return [
            'time' => trim((string)($event['time'] ?? '')) !== '' ? (string)$event['time'] : '—',
            'title' => trim((string)($event['title'] ?? '')) !== '' ? (string)$event['title'] : '(без назви)',
            'type' => $this->typeLabel((string)($event['type'] ?? 'other')),
            'responsible' => $this->ownerDisplay($owner),
            'description' => trim((string)($event['description'] ?? '')),
            'badges' => $this->eventBadges($event, (int)(Auth::id() ?? 0), $owner),
            'date' => $dateIso,
        ];
    }

    private function buildMonthListDays(int $year, int $month, array $map): array
    {
        $first = new \DateTimeImmutable(sprintf('%04d-%02d-01', $year, $month));
        $last = $first->modify('last day of this month');
        $days = [];
        $cursor = $first;
        while ($cursor <= $last) {
            $iso = $cursor->format('Y-m-d');
            $items = array_map(fn(array $e) => $this->mapEventLine($e, $iso), $map[$iso] ?? []);
            usort($items, fn(array $a, array $b) => $this->timeToMinutes((string)($a['time'] ?? '')) <=> $this->timeToMinutes((string)($b['time'] ?? '')));
            if ($items) {
                $days[] = [
                    'iso' => $iso,
                    'title' => $this->formatDateLong($iso),
                    'day' => (int)$cursor->format('j'),
                    'items' => $items,
                ];
            }
            $cursor = $cursor->modify('+1 day');
        }
        return $days;
    }

    private function flattenEventMap(array $map): array
    {
        $flat = [];
        foreach ($map as $date => $rows) {
            foreach (($rows ?: []) as $row) {
                if (!is_array($row)) continue;
                $row['_store_date'] = $date;
                $flat[] = $row;
            }
        }
        return $flat;
    }

    private function planningDayItems(array $events, string $dateIso): array
    {
        $out = [];
        foreach ($events as $event) {
            $start = trim((string)($event['start_date'] ?? ''));
            if ($start !== $dateIso) continue;
            $out[] = $this->mapEventLine($event, $dateIso);
        }
        usort($out, fn(array $a, array $b) => $this->timeToMinutes((string)($a['time'] ?? '')) <=> $this->timeToMinutes((string)($b['time'] ?? '')));
        return $out;
    }

    private function planningOverdueItems(array $events, string $cutoffExclusive): array
    {
        $grouped = [];
        $seen = [];
        foreach ($events as $event) {
            if (!$this->isOverdue($event)) continue;
            $start = trim((string)($event['start_date'] ?? ''));
            if ($start === '' || $start >= $cutoffExclusive) continue;
            $id = trim((string)($event['id'] ?? ''));
            if ($id !== '' && isset($seen[$id])) continue;
            if ($id !== '') $seen[$id] = true;
            $grouped[$start][] = $this->mapEventLine($event, $start);
        }
        krsort($grouped);
        foreach ($grouped as &$list) {
            usort($list, fn(array $a, array $b) => $this->timeToMinutes((string)($a['time'] ?? '')) <=> $this->timeToMinutes((string)($b['time'] ?? '')));
        }
        unset($list);
        return $grouped;
    }

    private function applyPlanningScope(array $events, string $scope, int $meId, string $myLogin): array
    {
        if ($scope === 'all') return $events;
        $loginNorm = mb_strtolower(trim($myLogin), 'UTF-8');
        $out = [];
        foreach ($events as $event) {
            $authorId = (int)($event['user_id'] ?? 0);
            if ($scope === 'my') {
                if ($meId > 0 && $authorId === $meId) $out[] = $event;
                continue;
            }
            $owner = $this->parseOwnerField($event['owner'] ?? '');
            $isMine = false;
            if (($owner['type'] ?? '') === 'user') {
                $ownerId = (int)($owner['user_id'] ?? 0);
                $ownerLogin = mb_strtolower(trim((string)($owner['login'] ?? '')), 'UTF-8');
                if ($meId > 0 && $ownerId === $meId) $isMine = true;
                elseif ($loginNorm !== '' && $ownerLogin !== '' && $ownerLogin === $loginNorm) $isMine = true;
            } else {
                $ownerText = mb_strtolower(trim((string)($owner['text'] ?? '')), 'UTF-8');
                if ($loginNorm !== '' && $ownerText !== '' && $ownerText === $loginNorm) $isMine = true;
            }
            if (!$isMine) continue;
            if (!empty($event['done'])) continue;
            if ($this->isClosed($event)) continue;
            $out[] = $event;
        }
        return $out;
    }

    private function isClosed(array $event): bool
    {
        return !empty($event['close_user_id']) && !empty($event['close_time']);
    }

    private function currentUserLogin(): ?string
    {
        $session = $_SESSION['user'] ?? null;
        if (is_array($session)) {
            $login = trim((string)($session['login'] ?? ''));
            if ($login !== '') return $login;
        }
        $legacy = trim((string)($_SESSION['user_login'] ?? ''));
        return $legacy !== '' ? $legacy : null;
    }

    private function planningScopeLabel(string $scope): string
    {
        return match ($scope) {
            'my' => 'Мої задачі',
            'exec' => 'На виконанні',
            default => 'Всі задачі',
        };
    }

    private function loadEventAudit(string $eventId): array
    {
        $sql = 'SELECT created_at, user_name, action, payload FROM audit_logs WHERE entity_type = :entity_type AND entity_id = :entity_id ORDER BY id DESC LIMIT 200';
        $st = $this->db->prepare($sql);
        $st->execute(['entity_type' => 'event', 'entity_id' => $eventId]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $labels = \App\Services\Audit\AuditLabels::getConfig();
        $out = [];
        foreach ($rows as $row) {
            $payload = json_decode((string)($row['payload'] ?? '{}'), true);
            if (!is_array($payload)) $payload = [];
            $action = (string)($row['action'] ?? '');
            $label = $labels[$action]['text'] ?? $action;
            $summary = $this->auditSummary($action, $payload);
            $out[] = [
                'created_at' => $this->formatDateTime((string)($row['created_at'] ?? '')),
                'user_name' => trim((string)($row['user_name'] ?? '')) !== '' ? (string)$row['user_name'] : '—',
                'label' => $label,
                'summary' => $summary,
            ];
        }
        return $out;
    }

    private function auditSummary(string $action, array $payload): string
    {
        if (str_starts_with($action, 'event.message.')) {
            $text = '';
            if (!empty($payload['message']['message_text'])) $text = (string)$payload['message']['message_text'];
            elseif (!empty($payload['after']['message_text'])) $text = (string)$payload['after']['message_text'];
            elseif (!empty($payload['before']['message_text'])) $text = (string)$payload['before']['message_text'];
            $text = trim(preg_replace('/\s+/u', ' ', $text));
            if ($text !== '') {
                return function_exists('mb_strimwidth') ? mb_strimwidth($text, 0, 120, '…', 'UTF-8') : substr($text, 0, 120);
            }
        }
        if ($action === 'calendar.event.update') {
            $changes = [];
            $before = is_array($payload['before'] ?? null) ? $payload['before'] : [];
            $after = is_array($payload['after'] ?? null) ? $payload['after'] : [];
            foreach (['title' => 'назва', 'start_date' => 'дата початку', 'end_date' => 'дата завершення', 'time' => 'час'] as $k => $label) {
                if (array_key_exists($k, $before) && array_key_exists($k, $after) && (string)$before[$k] !== (string)$after[$k]) {
                    $changes[] = $label . ': ' . (string)$before[$k] . ' → ' . (string)$after[$k];
                }
            }
            return implode('; ', $changes);
        }
        return '';
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
        try { return (new \DateTimeImmutable($iso))->format('d.m.Y'); } catch (\Throwable $_) { return $iso; }
    }

    private function formatDateLong(string $iso): string
    {
        try {
            $dt = new \DateTimeImmutable($iso);
            $fmt = new \IntlDateFormatter('uk_UA', \IntlDateFormatter::FULL, \IntlDateFormatter::NONE, date_default_timezone_get(), \IntlDateFormatter::GREGORIAN, 'd MMMM yyyy');
            $res = $fmt->format($dt);
            return $res ?: $dt->format('d.m.Y');
        } catch (\Throwable $_) {
            return $this->formatDate($iso);
        }
    }

    private function formatDateTime(string $value): string
    {
        $value = trim($value);
        if ($value === '') return '—';
        try { return (new \DateTimeImmutable($value))->format('d.m.Y H:i:s'); } catch (\Throwable $_) { return $value; }
    }

    private function formatMonthTitle(int $year, int $month): string
    {
        try {
            $dt = new \DateTimeImmutable(sprintf('%04d-%02d-01', $year, $month));
            $fmt = new \IntlDateFormatter('uk_UA', \IntlDateFormatter::LONG, \IntlDateFormatter::NONE, date_default_timezone_get(), \IntlDateFormatter::GREGORIAN, 'LLLL yyyy');
            $res = $fmt->format($dt);
            if ($res) { return mb_convert_case((string)$res, MB_CASE_TITLE, 'UTF-8'); }
        } catch (\Throwable $_) { }
        return sprintf('%02d.%04d', $month, $year);
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
        } catch (\Throwable $_) {
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

    private function isOverdue(array $event): bool
    {
        if (!empty($event['done'])) return false;
        $endDate = trim((string)($event['end_date'] ?? ''));
        $startDate = trim((string)($event['start_date'] ?? ''));
        $dateIso = $endDate !== '' ? $endDate : $startDate;
        if ($dateIso === '') return false;
        return $dateIso < date('Y-m-d');
    }

    private function eventBadges(array $event, int $meId, array $owner): array
    {
        $authorId = (int)($event['user_id'] ?? 0);
        $badges = [];
        if (!empty($event['urgent'])) $badges[] = 'Терміново';
        if (!empty($event['done'])) $badges[] = 'Виконано';
        if ($authorId > 0 && $meId > 0 && $authorId === $meId) $badges[] = 'Моя подія';
        if (($owner['type'] ?? '') === 'user' && (int)($owner['user_id'] ?? 0) > 0 && (int)$owner['user_id'] === $meId && empty($event['done'])) $badges[] = 'На виконанні';
        if ($this->isOverdue($event)) $badges[] = 'Подія прострочена';
        return $badges;
    }

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
                            'type' => 'user', 'text' => '', 'user_id' => (int)($decoded['id'] ?? $decoded['user_id'] ?? 0),
                            'login' => trim((string)($decoded['login'] ?? '')), 'name' => trim((string)($decoded['name'] ?? '')), 'label' => trim((string)($decoded['label'] ?? '')),
                        ];
                    }
                    return ['type' => 'text', 'text' => trim((string)($decoded['text'] ?? $decoded['value'] ?? '')), 'user_id' => 0, 'login' => '', 'name' => '', 'label' => ''];
                }
            }
            return ['type' => 'text', 'text' => $s, 'user_id' => 0, 'login' => '', 'name' => '', 'label' => ''];
        } catch (\Throwable $_) {
            return ['type' => 'text', 'text' => trim((string)$owner), 'user_id' => 0, 'login' => '', 'name' => '', 'label' => ''];
        }
    }


    private function buildFileStem(string $kind, array $parts = []): string
    {
        $tokens = ['calendar.localhost', $this->fileSafeToken($kind)];
        foreach ($parts as $part) {
            $token = $this->fileSafeToken((string)$part);
            if ($token !== '') {
                $tokens[] = $token;
            }
        }
        return implode('_', array_values(array_filter($tokens, static fn($v) => $v !== '')));
    }

    private function fileSafeToken(string $value): string
    {
        $value = trim($value);
        if ($value === '') return '';
        $value = preg_replace('~[\\/:*?"<>|]+~u', ' ', $value) ?? $value;
        $value = preg_replace('~\s+~u', ' ', $value) ?? $value;
        $value = trim($value, " .-_	

");
        if ($value === '') return '';
        $value = str_replace(' ', '_', $value);
        if (function_exists('mb_substr')) {
            $value = mb_substr($value, 0, 80, 'UTF-8');
        } else {
            $value = substr($value, 0, 80);
        }
        return $value;
    }

    private function ownerDisplay(array $owner): string
    {
        if (($owner['type'] ?? '') === 'user') {
            $name = trim((string)($owner['name'] ?? ''));
            if ($name !== '') return $name;
            $login = trim((string)($owner['login'] ?? ''));
            if ($login !== '') return $login;
            $label = trim((string)($owner['label'] ?? ''));
            if ($label !== '') return $label;
            $uid = (int)($owner['user_id'] ?? 0);
            return $uid > 0 ? ('User #' . $uid) : '—';
        }
        $text = trim((string)($owner['text'] ?? ''));
        return $text !== '' ? $text : '—';
    }
}
