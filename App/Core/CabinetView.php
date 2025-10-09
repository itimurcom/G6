<?php
declare(strict_types=1);

namespace App\Core;

final class CabinetView
{
    /**
     * Decide which user_id should be shown in Cabinet.
     * Allow ?user_id=X only if X == current or role is admin/superadmin/root; otherwise fallback to current.
     * Writes result to:
     *  - $_REQUEST['cabinet_user_id']
     *  - $_SESSION['cabinet.view_user_id']
     *  - CABINET_VIEW_USER_ID
     */
    public static function resolveUserIdAndAttach(): int
    {
        if (session_status() !== \PHP_SESSION_ACTIVE) { @session_start(); }

        $current = $_SESSION['user'] ?? null;
        $currentId = (int)($_SESSION['user_id'] ?? ($current['id'] ?? 0));

        $requestedId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
        if ($requestedId < 0) { $requestedId = 0; }

        $role = is_array($current) ? ($current['role'] ?? null) : null;
        $isAdmin = false;
        if (is_string($role)) {
            $rl = strtolower(trim($role));
            $isAdmin = in_array($rl, ['admin','superadmin','root'], true);
        }

        $viewId = $currentId;
        if ($requestedId > 0) {
            if ($requestedId === $currentId || $isAdmin) {
                $viewId = $requestedId;
            }
        }

        $_REQUEST['cabinet_user_id'] = $viewId;
        $_SESSION['cabinet.view_user_id'] = $viewId;
        if (!\defined('CABINET_VIEW_USER_ID')) {
            \define('CABINET_VIEW_USER_ID', $viewId);
        }

        return $viewId;
    }
}
