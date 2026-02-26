<?php
namespace App\Models;

interface UserRepositoryInterface
{
    /** @return array<int,array<string,mixed>> */
    public function all(): array;

    public function findById(int $id): ?array;

    public function findByEmail(string $email): ?array;

    public function findByLogin(string $login): ?array;

    public function updateById(int $id, array $data): bool;

    /** Create a user and return its numeric ID */
    public function create(array $data): int;


    public function getAvatarById(int $id): ?array;

    public function setAvatarById(int $id, string $blob, string $mime, string $filename): bool;

    public function clearAvatarById(int $id): bool;
}
