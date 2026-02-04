<?php
declare(strict_types=1);

namespace App\Models;

final class EventRepositoryFactory {
    public static function make(): EventRepositoryInterface {

        return new EventMysqlRepository();
    }
}
