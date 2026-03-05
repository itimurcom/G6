<?php
declare(strict_types=1);

namespace App\Services;

/**
 * EventViewHelper
 *
 * Спільні допоміжні методи для відображення/друку подій.
 * Мета: прибрати дублювання між EventController та PrintController.
 */
final class EventViewHelper
{
    public static function typeLabel(string $type): string
    {
        return match ($type) {
            'mi' => 'ТЛГ: МИ',
            'nas' => 'ТЛГ: НАС',
            'evt' => 'Захід',
            default => 'Інше',
        };
    }

    public static function formatDate(string $iso): string
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

    public static function formatDateTime(string $value): string
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

    public static function durationDays(string $startIso, string $endIso): int
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

    public static function ukDayWord(int $days): string
    {
        $n = abs($days) % 100;
        $n1 = $n % 10;
        if ($n > 10 && $n < 20) return 'днів';
        if ($n1 > 1 && $n1 < 5) return 'дні';
        if ($n1 === 1) return 'день';
        return 'днів';
    }

    /** @return array{type:string,text:string,user_id:int,login:string,name:string,label:string} */
    public static function parseOwnerField(mixed $owner): array
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

    /**
     * @param array{type?:string,text?:string,user_id?:int,login?:string,name?:string,label?:string} $owner
     * @param callable(int):(?string)|null $resolveUserName
     */
    public static function ownerDisplay(array $owner, ?callable $resolveUserName = null): string
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

            if ($userId > 0 && $resolveUserName) {
                $resolved = $resolveUserName($userId);
                if (is_string($resolved) && trim($resolved) !== '') {
                    return $resolved;
                }
            }
            if ($userId > 0) return 'User #' . $userId;
        }

        $text = trim((string)($owner['text'] ?? ''));
        return $text !== '' ? $text : '—';
    }

    /**
     * Прострочка для "листа події" (з урахуванням часу в межах дня).
     */
    public static function isOverdueStrict(array $event): bool
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

    /**
     * Прострочка для друку (date-only як було у PrintController).
     */
    public static function isOverdueDateOnly(array $event): bool
    {
        if (!empty($event['done'])) return false;
        $endDate = trim((string)($event['end_date'] ?? ''));
        $startDate = trim((string)($event['start_date'] ?? ''));
        $dateIso = $endDate !== '' ? $endDate : $startDate;
        if ($dateIso === '') return false;
        return $dateIso < date('Y-m-d');
    }
}
