<?php
namespace App\Controllers;

use App\Core\Request;
use App\Models\FileEventRepository;
use App\Models\EventRepositoryInterface;

class ApiEventsController
{
    private EventRepositoryInterface $repo;

    public function __construct() {
        $this->repo = new FileEventRepository();
    }

    private function json($data, int $code = 200): void {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
    }

    public function byDate(Request $req): void {
        $date = (string)($_GET['date'] ?? '');
        if (!$date) { $this->json(['error'=>'date required'], 400); return; }
        $this->json($this->repo->listByDate($date));
    }

    public function byRange(Request $req): void {
        $start = (string)($_GET['start'] ?? '');
        $end   = (string)($_GET['end'] ?? '');
        if (!$start || !$end) { $this->json(['error'=>'start/end required'], 400); return; }
        $this->json($this->repo->listByRange($start, $end));
    }

    public function get(Request $req): void {
        $id = (string)($_GET['id'] ?? '');
        if (!$id) { $this->json(['error'=>'id required'], 400); return; }
        $row = $this->repo->getById($id);
        if (!$row) { $this->json(['error'=>'not_found'], 404); return; }
        $this->json($row);
    }

    public function create(Request $req): void {
        $payload = json_decode(file_get_contents('php://input') ?: 'null', true);
        if (!is_array($payload)) { $this->json(['error'=>'invalid json'], 400); return; }
        try {
            $id = $this->repo->create($payload);
            $this->json(['id'=>$id], 201);
        } catch (\Throwable $e) {
            $this->json(['error'=>$e->getMessage()], 400);
        }
    }

    public function update(Request $req): void {
        $payload = json_decode(file_get_contents('php://input') ?: 'null', true);
        if (!is_array($payload)) { $this->json(['error'=>'invalid json'], 400); return; }
        $id = (string)($payload['id'] ?? '');
        if (!$id) { $this->json(['error'=>'id required'], 400); return; }
        unset($payload['id']);
        $ok = $this->repo->updateById($id, $payload);
        $this->json(['ok'=>$ok]);
    }

    public function delete(Request $req): void {
        $payload = json_decode(file_get_contents('php://input') ?: 'null', true);
        if (!is_array($payload)) { $this->json(['error'=>'invalid json'], 400); return; }
        $id = (string)($payload['id'] ?? '');
        if (!$id) { $this->json(['error'=>'id required'], 400); return; }
        $ok = $this->repo->deleteById($id);
        $this->json(['ok'=>$ok]);
    }

    public function done(Request $req): void {
        $payload = json_decode(file_get_contents('php://input') ?: 'null', true);
        if (!is_array($payload)) { $this->json(['error'=>'invalid json'], 400); return; }
        $id = (string)($payload['id'] ?? '');
        $done = $payload['done'] ?? 1;
        if (!$id) { $this->json(['error'=>'id required'], 400); return; }
        $ok = $this->repo->setDone($id, $done);
        $this->json(['ok'=>$ok]);
    }

    public function urgent(Request $req): void {
        $payload = json_decode(file_get_contents('php://input') ?: 'null', true);
        if (!is_array($payload)) { $this->json(['error'=>'invalid json'], 400); return; }
        $id = (string)($payload['id'] ?? '');
        $urgent = $payload['urgent'] ?? 1;
        if (!$id) { $this->json(['error'=>'id required'], 400); return; }
        $ok = $this->repo->setUrgent($id, $urgent);
        $this->json(['ok'=>$ok]);
    }

    public function search(Request $req): void {
        $filters = [
            'text' => $_GET['text'] ?? null,
            'type' => $_GET['type'] ?? null,
            'owner' => $_GET['owner'] ?? null,
            'urgent' => $_GET['urgent'] ?? null,
            'done' => $_GET['done'] ?? null,
            'date' => $_GET['date'] ?? null,
            'start' => $_GET['start'] ?? null,
            'end' => $_GET['end'] ?? null,
        ];
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 200;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $rows = $this->repo->search($filters, $limit, $offset);
        $this->json($rows);
    }
}
