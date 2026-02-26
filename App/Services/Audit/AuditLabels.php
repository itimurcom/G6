<?php
declare(strict_types=1);

namespace App\Services\Audit;

class AuditLabels
{
    public static function getConfig(): array
    {
        return [
            // --- Аутентифікація ---
            'auth.login' => [
                'text' => 'Вхід в систему',
                'css'  => 't-login',
                'tags' => 'login signin логін'
            ],
            'auth.logout' => [
                'text' => 'Вихід із системи',
                'css'  => 't-logout',
                'tags' => 'logout signout вихід'
            ],
            'auth.register' => [
                'text' => 'Реєстрація користувача',
                'css'  => 't-login',
                'tags' => 'register new user'
            ],

            // --- Календар ---
            'calendar.event.create' => [
                'text' => 'Створення події',
                'css'  => 't-create',
                'tags' => 'new create нова'
            ],
            // ОСЬ ТУТ: "Редагування" і тег "зміна"
            'calendar.event.update' => [
                'text' => 'Редагування події',
                'css'  => 't-update',
                'tags' => 'edit update зміна' 
            ],
            'calendar.event.delete' => [
                'text' => 'Видалення події',
                'css'  => 't-delete',
                'tags' => 'remove delete видалення'
            ],
            'calendar.event.done' => [
                'text' => 'Зміна статусу виконання',
                'css'  => 't-update',
                'tags' => 'done complete зроблено'
            ],
            'calendar.event.urgent' => [
                'text' => 'Зміна терміновості',
                'css'  => 't-update',
                'tags' => 'important urgent важливо'
            ],
            'calendar.event.close' => [
                'text' => 'Закриття події',
                'css'  => 't-update',
                'tags' => 'close archive'
            ],
            'event.message.create' => [
                'text' => 'Додано повідомлення до події',
                'css'  => 't-create',
                'tags' => 'message comment thread повідомлення лист події'
            ],
            'event.message.update' => [
                'text' => 'Відредаговано повідомлення події',
                'css'  => 't-update',
                'tags' => 'message edit update коментар повідомлення'
            ],
            'event.message.delete' => [
                'text' => 'Видалено повідомлення події',
                'css'  => 't-delete',
                'tags' => 'message delete remove повідомлення'
            ],

            // --- Адмінка ---
            'user.create' => [
                'text' => 'Створення користувача (Адмін)',
                'css'  => 't-create',
                'tags' => 'admin user add'
            ],
            'user.update' => [
                'text' => 'Редагування користувача (Адмін)',
                'css'  => 't-update',
                'tags' => 'admin user edit'
            ],
            'user.password' => [
                'text' => 'Зміна пароля (Адмін)',
                'css'  => 't-update',
                'tags' => 'admin password pass'
            ],

            // --- Кабінет ---
            'cabinet.change_password' => [
                'text' => 'Зміна власного пароля',
                'css'  => 't-update',
                'tags' => 'security безпека password'
            ],
            'cabinet.profile_update' => [
                'text' => 'Оновлення профілю',
                'css'  => 't-update',
                'tags' => 'settings налаштування profile'
            ],
        ];
    }
}