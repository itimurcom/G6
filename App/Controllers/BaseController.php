<?php
// file: App/Controllers/BaseController.php
namespace App\Controllers;

use App\Core\Auth;

abstract class BaseController
{
    protected function requireAuth(): void
    {
        Auth::requireLogin();
    }
}
